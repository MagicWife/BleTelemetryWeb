'use strict';

const baseConfig = require('../../config');
const AttitudeSolverModule = require('../imu/AttitudeSolver');
const { removeGravity } = require('../imu/GravityRemoval');
const { classifySeriesWindows } = require('../state/MotionClassifier');
const { buildRawImuQualityGate } = require('../quality/RawImuQualityGate');
const {
  buildRespAndHeartProxies,
  buildGyroMotionProxy
} = require('../baseline/ProxySignalBuilder');
const {
  estimateHRRRTimeSeries,
  createEstimatorRuntimeState
} = require('../baseline/SlidingWindowEstimator');
const {
  createLowHeartRateObserverState,
  observeLowHeartRate
} = require('../baseline/LowHeartRateObserver');

const AttitudeSolver = AttitudeSolverModule.AttitudeSolver || AttitudeSolverModule;

function finiteNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function last(array) {
  return array && array.length ? array[array.length - 1] : null;
}

/**
 * Real-time session adapter for the validated causal IMU baseline.
 *
 * Samples are appended in acquisition order. Once per stepSec, the adapter
 * evaluates a bounded causal history through the production prediction pipeline and
 * returns only the prediction stamped at the current window end. Replaying a
 * bounded history deliberately keeps this first real-time implementation
 * identical to the validated baseline while keeping run time and memory
 * bounded. It can later be moved to a Web Worker without changing this API.
 */
class RealtimeImuVitalsEstimator {
  constructor(options = {}) {
    this.config = Object.assign({}, baseConfig, options.config || {});
    this.sampleRateHz = finiteNumber(options.sampleRateHz, this.config.fsDefault || 50);
    this.stepSec = finiteNumber(options.stepSec, this.config.stepSec || 1);
    this.accelUnit = String(options.accelUnit || this.config.accelUnit || 'mps2').toLowerCase();
    this.gyroUnit = String(options.gyroUnit || this.config.gyroUnit || 'deg').toLowerCase();
    this.frame = options.frame === 'body' ? 'body' : 'world';
    this.resetGapSec = finiteNumber(options.resetGapSec, 10);
    this.replayHistorySec = Math.max(
      Math.max(...this.config.windowSecList),
      finiteNumber(options.replayHistorySec, 70)
    );
    this.includeDiagnostics = options.includeDiagnostics === true;
    this.onPrediction = typeof options.onPrediction === 'function'
      ? options.onPrediction
      : null;

    if (!(this.sampleRateHz > 0)) throw new Error('sampleRateHz must be positive');
    if (!(this.stepSec > 0)) throw new Error('stepSec must be positive');

    this.reset();
  }

  reset(reason = 'manual') {
    this.samples = [];
    this.sessionSampleCount = 0;
    this.sessionStartTimestampSec = NaN;
    this.lastTimestampSec = NaN;
    this.lastPredictionSampleCount = 0;
    this.latestResult = null;
    this.estimatorRuntimeState = createEstimatorRuntimeState(this.config);
    this.lowHeartRateObserverState = createLowHeartRateObserverState();
    this.outputHeartHistory = [];
    this.lastStableHeartRate = NaN;
    this.lastResetReason = reason;
  }

  getStatus() {
    const elapsedSec = this.sessionSampleCount / this.sampleRateHz;
    const maximumWindowSec = Math.max(...this.config.windowSecList);
    const fullWarmupSec = Math.max(
      maximumWindowSec,
      finiteNumber(this.config.estimatorHistoryWarmupSec, 60)
    );
    return {
      sampleRateHz: this.sampleRateHz,
      bufferedSamples: this.samples.length,
      sessionSampleCount: this.sessionSampleCount,
      elapsedSec,
      minimumWindowSec: Math.min(...this.config.windowSecList),
      maximumWindowSec,
      warmupSec: fullWarmupSec,
      warmupProgress: Math.min(1, elapsedSec / fullWarmupSec),
      fullyWarmedUp: elapsedSec >= fullWarmupSec,
      lastResetReason: this.lastResetReason,
      latestResult: this.latestResult
    };
  }

  getLatestResult() {
    return this.latestResult;
  }

  isReady() {
    return this.samples.length >= Math.ceil(
      Math.min(...this.config.windowSecList) * this.sampleRateHz
    );
  }

  pushSample(sample) {
    return this.addSample(sample);
  }

  pushSamples(samples) {
    return this.addSamples(samples);
  }

  run() {
    return this.predictNow();
  }

  addSamples(samples) {
    const results = [];
    for (const sample of samples || []) {
      const result = this.addSample(sample);
      if (result) results.push(result);
    }
    return results;
  }

  addSample(input) {
    const sample = this._normalizeSample(input);
    if (!sample) return null;

    if (Number.isFinite(this.lastTimestampSec)) {
      const gapSec = sample.timestamp_s - this.lastTimestampSec;
      if (gapSec < -1e-9) {
        throw new Error('IMU timestamps must be monotonic');
      }
      if (gapSec > this.resetGapSec) {
        this.reset('timestamp_gap');
      }
    }

    if (!Number.isFinite(this.sessionStartTimestampSec)) {
      this.sessionStartTimestampSec = sample.timestamp_s;
    }
    this.lastTimestampSec = sample.timestamp_s;
    this.samples.push(sample);
    this.sessionSampleCount++;

    const maximumSamples = Math.ceil(this.replayHistorySec * this.sampleRateHz);
    if (this.samples.length > maximumSamples) {
      this.samples.splice(0, this.samples.length - maximumSamples);
    }

    const stepSamples = Math.max(1, Math.round(this.stepSec * this.sampleRateHz));
    const minimumSamples = Math.ceil(
      Math.min(...this.config.windowSecList) * this.sampleRateHz
    );
    if (this.sessionSampleCount < minimumSamples) return null;
    if (this.sessionSampleCount - this.lastPredictionSampleCount < stepSamples) return null;

    this.lastPredictionSampleCount = this.sessionSampleCount;
    return this.predictNow();
  }

  predictNow() {
    const minimumSamples = Math.ceil(
      Math.min(...this.config.windowSecList) * this.sampleRateHz
    );
    if (this.samples.length < minimumSamples) return null;

    const startedAt = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    const relativeSamples = this.samples.map((sample, index) => ({
      time_s: index / this.sampleRateHz,
      ax: sample.ax,
      ay: sample.ay,
      az: sample.az,
      gx: sample.gx,
      gy: sample.gy,
      gz: sample.gz
    }));

    const solver = new AttitudeSolver({
      accelUnit: 'mps2',
      gyroUnit: 'deg/s',
      gravity: this.config.gravity || 9.81,
      sampleRateHz: this.sampleRateHz
    });
    if (typeof solver.setAlgorithm === 'function') solver.setAlgorithm('madgwick');

    const gravity = removeGravity(relativeSamples, solver, {
      accelUnit: 'mps2',
      gyroUnit: 'deg/s',
      quaternionConvention: this.config.quaternionConvention || 'bodyToWorld',
      gravity: this.config.gravity || 9.81,
      fsDefault: this.sampleRateHz
    });
    const windows = classifySeriesWindows({
      ax: gravity.ax,
      ay: gravity.ay,
      az: gravity.az,
      gx: gravity.gx,
      gy: gravity.gy,
      gz: gravity.gz
    }, this.sampleRateHz, {
      windowSec: this.config.windowSec,
      stepSec: this.config.stepSec,
      staticAccVarThreshold: this.config.staticAccVarThreshold,
      staticGyrMagThreshold: this.config.staticGyrMagThreshold
    });
    const qualityGate = buildRawImuQualityGate(
      relativeSamples,
      this.sampleRateHz,
      {
        enabled: this.config.rawImuQualityGateEnabled,
        windowSec: this.config.rawImuQualityWindowSec,
        minimumRejectRunSec: this.config.rawImuQualityMinimumRejectRunSec,
        acceptConfirmSec: this.config.rawImuQualityAcceptConfirmSec,
        rejectMotionStatuses: this.config.rawImuQualityRejectMotionStatuses,
        validityThresholds: this.config.rawImuQualityValidity,
        motionThresholds: this.config.rawImuQualityMotion,
        timeQuality: {}
      }
    );

    const linearX = this.frame === 'body' ? gravity.linAx : gravity.linAxWorld;
    const linearY = this.frame === 'body' ? gravity.linAy : gravity.linAyWorld;
    const linearZ = this.frame === 'body' ? gravity.linAz : gravity.linAzWorld;
    const proxies = buildRespAndHeartProxies(
      linearX,
      linearY,
      linearZ,
      this.sampleRateHz,
      {
        respProxyBand: this.config.respProxyBand,
        heartProxyBand: this.config.heartProxyBand,
        normalize: false
      }
    );
    const gyroMotion = buildGyroMotionProxy(
      gravity.gx,
      gravity.gy,
      gravity.gz,
      this.sampleRateHz,
      { heartProxyBand: this.config.heartProxyBand }
    );
    const lowHeartProxies = this.config.criticalLowHeartObservationEnabled === true
      ? buildRespAndHeartProxies(
          linearX,
          linearY,
          linearZ,
          this.sampleRateHz,
          {
            respProxyBand: this.config.respProxyBand,
            heartProxyBand: this.config.criticalLowHeartProxyBand,
            normalize: false
          }
        )
      : null;
    const lowGyroMotion = lowHeartProxies
      ? buildGyroMotionProxy(
          gravity.gx,
          gravity.gy,
          gravity.gz,
          this.sampleRateHz,
          { heartProxyBand: this.config.criticalLowHeartProxyBand }
        )
      : null;
    const estimate = estimateHRRRTimeSeries(
      proxies.s_resp,
      proxies.s_heart,
      this.sampleRateHz,
      Object.assign({}, this.config, {
        gyroMotionSignal: gyroMotion.signal,
        diagnosticHeartAxes: proxies.diagnostic_heart_axes,
        artifactMask: null,
        rawImuQualityGate: qualityGate,
        stateResetTimeSec: 0,
        windowStates: windows,
        runtimeState: this.estimatorRuntimeState,
        timelineOffsetSec:
          this.sessionSampleCount / this.sampleRateHz -
          relativeSamples.length / this.sampleRateHz
      })
    );

    const heart = last(estimate.heartRateTimeSeries);
    const respiratory = last(estimate.respiratoryRateTimeSeries);
    const segment = last(estimate.segments);
    const primaryDiagnosticCandidates = heart?.diagnostic_candidates_bpm
      ? String(heart.diagnostic_candidates_bpm).split('|').filter(Boolean).map(Number)
      : [];
    const lowHeartObservation = lowHeartProxies
      ? observeLowHeartRate(
          lowHeartProxies.s_heart,
          lowGyroMotion.signal,
          this.sampleRateHz,
          this.sessionSampleCount / this.sampleRateHz,
          this.lowHeartRateObserverState,
          {
            primaryHr: heart && Number.isFinite(heart.hr_bpm_raw) ? heart.hr_bpm_raw : NaN,
            primaryCandidates: primaryDiagnosticCandidates,
            respiratoryRate: respiratory && Number.isFinite(respiratory.rr_bpm) ? respiratory.rr_bpm : NaN
          },
          this.config
        )
      : null;
    const status = this.getStatus();
    const endedAt = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    let rawCurrentHeartRate = heart && Number.isFinite(heart.hr_bpm_raw) && heart.hr_bpm_raw > 0
      ? heart.hr_bpm_raw
      : null;
    const qualityAccepted = heart ? heart.quality_gate_pass !== 0 : false;
    // Stage 3 controlled takeover. The observer never bypasses the raw IMU
    // quality gate: an explicitly rejected second stays invalid. The switch is
    // also configuration-gated so the shadow rule can be evaluated offline
    // before it is allowed to affect production output.
    const criticalLowTakeoverApplied = Boolean(
      this.config.criticalLowHeartTakeoverEnabled === true &&
      qualityAccepted &&
      lowHeartObservation?.shadowWouldAdmit &&
      Number.isFinite(lowHeartObservation.selectedCandidate?.hrBpm)
    );
    if (criticalLowTakeoverApplied) {
      rawCurrentHeartRate = lowHeartObservation.selectedCandidate.hrBpm;
    }
    const heartRate = this._stabilizeHeartRate(
      rawCurrentHeartRate,
      heart?.quality_score || 0,
      qualityAccepted
    );
    const respiratoryRate = respiratory && Number.isFinite(respiratory.rr_bpm) && respiratory.rr_bpm > 0
      ? respiratory.rr_bpm
      : null;

    const result = {
      method: 'imu-vitals',
      HR_bpm: heartRate,
      RR_bpm: respiratoryRate,
      HR_confidence: heart && Number.isFinite(heart.quality_score)
        ? heart.quality_score
        : 0,
      RR_confidence: respiratory && Number.isFinite(respiratory.quality_score)
        ? respiratory.quality_score
        : 0,
      samples: this.samples.length,
      fs: this.sampleRateHz,
      timestamp_s: this.lastTimestampSec,
      session_elapsed_s: this.sessionSampleCount / this.sampleRateHz,
      heart_rate_bpm: heartRate,
      respiratory_rate_bpm: respiratoryRate,
      heart_rate_raw_bpm: heart && Number.isFinite(heart.hr_bpm_raw)
        ? heart.hr_bpm_raw
        : null,
      heart_rate_pre_takeover_bpm: heart && Number.isFinite(heart.hr_bpm_raw)
        ? heart.hr_bpm_raw
        : null,
      critical_low_takeover_applied: criticalLowTakeoverApplied,
      heart_quality: heart && Number.isFinite(heart.quality_score)
        ? heart.quality_score
        : 0,
      respiratory_quality: respiratory && Number.isFinite(respiratory.quality_score)
        ? respiratory.quality_score
        : 0,
      heart_valid: heartRate !== null,
      respiratory_valid: respiratoryRate !== null,
      quality_gate_passed: qualityAccepted,
      quality_validity_status: heart?.quality_validity_status || 'not_evaluated',
      quality_motion_status: heart?.quality_motion_status || segment?.state || 'unknown',
      quality_reject_reasons: heart?.quality_reject_reasons
        ? heart.quality_reject_reasons.split('|').filter(Boolean)
        : [],
      motion_state: heart?.state || respiratory?.state || segment?.state || 'unknown',
      available_windows: heart?.available_windows
        ? String(heart.available_windows).split('|').filter(Boolean).map(Number)
        : [],
      window_start_s: segment?.win_start_s ?? null,
      window_end_s: segment?.win_end_s ?? null,
      warmup_progress: status.warmupProgress,
      fully_warmed_up: status.fullyWarmedUp,
      samples_used: this.samples.length,
      runtime_ms: endedAt - startedAt,
      candidates: primaryDiagnosticCandidates,
      critical_low_candidates: lowHeartObservation?.candidates?.map(candidate => candidate.hrBpm) || [],
      critical_low_observation: lowHeartObservation ? {
        selected_hr_bpm: lowHeartObservation.selectedCandidate?.hrBpm ?? null,
        spectral_score: lowHeartObservation.selectedCandidate?.spectralScore ?? 0,
        support_windows: lowHeartObservation.selectedCandidate?.supportWindows || [],
        track_coverage: lowHeartObservation.selectedCandidate?.trackCoverage ?? 0,
        track_duration_s: lowHeartObservation.selectedCandidate?.trackDurationSec ?? 0,
        candidate_duration_s: lowHeartObservation.candidateDurationSec,
        primary_missing_s: lowHeartObservation.primaryMissingSec,
        shadow_would_admit: lowHeartObservation.shadowWouldAdmit,
        decision: lowHeartObservation.decision,
        near_respiratory_harmonic: lowHeartObservation.nearRespiratoryHarmonic,
        respiratory_order: lowHeartObservation.respiratoryOrder,
        respiratory_distance_bpm: lowHeartObservation.respiratoryDistanceBpm,
        near_primary_half: lowHeartObservation.nearPrimaryHalf,
        primary_double_bpm: lowHeartObservation.primaryDoubleBpm,
        primary_double_distance_bpm: lowHeartObservation.primaryDoubleDistanceBpm
      } : null
    };
    if (this.includeDiagnostics) {
      result.diagnostics = { heart, respiratory, segment };
    }
    this.latestResult = result;
    if (this.onPrediction) this.onPrediction(result);
    return result;
  }

  _normalizeSample(input) {
    if (!input || typeof input !== 'object') return null;
    const required = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];
    const values = {};
    for (const key of required) {
      values[key] = finiteNumber(input[key]);
      if (!Number.isFinite(values[key])) return null;
    }

    const gravity = this.config.gravity || 9.81;
    if (this.accelUnit === 'g') {
      values.ax *= gravity;
      values.ay *= gravity;
      values.az *= gravity;
    }
    if (this.gyroUnit.startsWith('rad')) {
      const radiansToDegrees = 180 / Math.PI;
      values.gx *= radiansToDegrees;
      values.gy *= radiansToDegrees;
      values.gz *= radiansToDegrees;
    }

    let timestampSec = finiteNumber(
      input.timestamp_s ?? input.time_s ?? input.timestampSec
    );
    if (!Number.isFinite(timestampSec)) {
      timestampSec = this.sessionSampleCount / this.sampleRateHz;
    }
    return Object.assign(values, { timestamp_s: timestampSec });
  }

  _stabilizeHeartRate(value, confidence, qualityAccepted) {
    if (!qualityAccepted) return null;
    if (!Number.isFinite(value) || value <= 0) {
      return Number.isFinite(this.lastStableHeartRate)
        ? this.lastStableHeartRate
        : null;
    }
    this.outputHeartHistory.push(value);
    const maximum = Math.max(1, this.config.hrMedianWindowSize || 5);
    if (this.outputHeartHistory.length > maximum) this.outputHeartHistory.shift();
    const ordered = this.outputHeartHistory.slice().sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    const median = ordered.length % 2
      ? ordered[middle]
      : 0.5 * (ordered[middle - 1] + ordered[middle]);
    if (!Number.isFinite(this.lastStableHeartRate)) {
      this.lastStableHeartRate = median;
      return median;
    }
    const maximumStep = Math.min(
      this.config.hrHardMaxStepBpm || 20,
      (this.config.hrMaxSlopeBpmPerSec || 10) * this.stepSec
    );
    const target = confidence < (this.config.hrLowQualityThreshold || 0.35)
      ? median
      : value;
    const limited = this.lastStableHeartRate + Math.max(
      -maximumStep,
      Math.min(maximumStep, target - this.lastStableHeartRate)
    );
    const alpha = Math.max(0.1, Math.min(
      0.9,
      (this.config.hrPostAlpha || 0.5) * (0.65 + 0.35 * confidence)
    ));
    this.lastStableHeartRate = alpha * limited +
      (1 - alpha) * this.lastStableHeartRate;
    return this.lastStableHeartRate;
  }
}

module.exports = RealtimeImuVitalsEstimator;
module.exports.RealtimeImuVitalsEstimator = RealtimeImuVitalsEstimator;
