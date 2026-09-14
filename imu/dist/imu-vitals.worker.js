"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // config.js
  var require_config = __commonJS({
    "config.js"(exports, module) {
      "use strict";
      module.exports = {
        // Raw IMU units and attitude/gravity processing.
        accelUnit: "mps2",
        gyroUnit: "deg",
        fsDefault: 100,
        gravity: 9.81,
        // AttitudeSolver defines q as the body -> world rotation. Keep the whole
        // pipeline on that single convention.
        quaternionConvention: "bodyToWorld",
        // Sliding-window estimation.
        windowSec: 20,
        windowSecList: [10, 20, 30],
        stepSec: 1,
        // Raw-IMU quality gate. Rejected seconds remain on the original timeline as
        // NaN and must not update HR candidate/trajectory state.
        rawImuQualityGateEnabled: true,
        estimatorResetAtGoldStartEnabled: true,
        estimatorHistoryWarmupSec: 60,
        rawImuQualityWindowSec: 10,
        rawImuQualityMinimumRejectRunSec: 1,
        rawImuQualityAcceptConfirmSec: 3,
        rawImuQualityLongGapResetSec: 10,
        rawImuQualityMediumGapMinSec: 3,
        rawImuQualityRecoveryConfirmSec: 5,
        rawImuQualityRecoveryMatchBpm: 6,
        rawImuQualityRecoveryAnchorSigmaBpm: 20,
        rawImuQualityRecoveryMinimumAnchorWeight: 0.15,
        rawImuQualityRejectMotionStatuses: ["strong_motion", "impact"],
        rawImuQualityValidity: {
          validCoverage: 0.8,
          invalidCoverage: 0.5,
          validFiniteRatio: 0.99,
          invalidFiniteRatio: 0.8,
          validStuckRatio: 0.05,
          invalidStuckRatio: 0.5
        },
        rawImuQualityMotion: {
          accMadP95: 0.02933569594836624,
          accMadP99: 0.0560047932263039,
          gyroRmsP95: 0.11012278065735638,
          gyroRmsP99: 0.3628267925229166,
          shockP95: 0.05267967548330664,
          shockP99: 0.10793587174348677
        },
        // Frequency bands.
        respiratoryBand: [10 / 60, 0.5],
        heartBand: [30 / 60, 220 / 60],
        // Keep the formal RR output at 10-30 bpm, but retain slower components in
        // the proxy because they change the relative evidence of the 10-30 bpm peak.
        respProxyBand: [1 / 60, 0.5],
        respiratoryRateBpmRange: [10, 30],
        respiratoryFamilyExclusionEnabled: false,
        respiratoryFamilyPenaltyEnabled: false,
        respiratoryFamilyMinimumQuality: 0.75,
        respiratoryFamilyConfirmSec: 8,
        respiratoryFamilyRateMatchBpm: 3,
        respiratoryFamilyMaximumMissingSec: 3,
        respiratoryFamilyHarmonicOrders: [2, 3, 4],
        respiratoryFamilyToleranceBpm: 3,
        respiratoryFamilyNormalPenalty: 0.08,
        respiratoryFamilyExtremePenalty: 0.12,
        respiratoryFamilyAuthorityProtectionBpm: 6,
        respiratoryFamilyStrongHeartbeatProtection: 0.75,
        respiratoryControlAdmissionEnabled: true,
        respiratoryControlMinimumQuality: 0.75,
        respiratoryControlMinimumPersistenceSec: 5,
        respiratoryControlHarmonicOrders: [2, 3, 4],
        respiratoryControlStrongDistanceBpm: 1.5,
        respiratoryControlFamilyToleranceBpm: 3,
        respiratoryControlAlternativeScoreGap: 0.15,
        respiratoryControlAlternativeSpectralGap: 0.2,
        respiratoryControlAuthorityProtectionBpm: 6,
        respiratoryControlSelectedTrackProtectionSec: 15,
        respiratoryControlHeartbeatEvidenceRequired: 2,
        respiratoryControlBlockedMatchBpm: 6,
        respiratoryControlHoldSec: 12,
        respiratoryControlAlternativeReconnectBpm: 10,
        heartProxyBand: [30 / 60, 220 / 60],
        // Perioperative critical-low HR observation channel. This is deliberately
        // separate from the validated 50-220 bpm production channel: widening the
        // production filter would change its PSD floor, Top-K competition and gyro
        // normalization even when the true HR remains above 50 bpm.
        criticalLowHeartObservationEnabled: false,
        criticalLowHeartProxyBand: [30 / 60, 55 / 60],
        criticalLowHeartCandidateBandBpm: [30, 50],
        criticalLowHeartCandidateMergeBpm: 4,
        criticalLowHeartTrackMatchBpm: 5,
        criticalLowHeartTrackHistorySec: 60,
        criticalLowHeartTrackMaximumGapSec: 3,
        criticalLowHeartRequiredWindows: [20, 30],
        criticalLowHeartAdmissionConfirmSec: 30,
        criticalLowHeartMinimumCoverage: 0.8,
        criticalLowHeartMinimumSpectralScore: 0.45,
        criticalLowHeartPrimaryMissingSec: 15,
        criticalLowHeartPrimaryMatchBpm: 12,
        criticalLowHeartRespiratoryHarmonicToleranceBpm: 3,
        criticalLowHeartHalfFrequencyToleranceBpm: 6,
        // Stage 1/2 default: observe and simulate admission without changing HR.
        criticalLowHeartTakeoverEnabled: false,
        // Heart-rate candidate selection.
        hrPhysLowBpm: 30,
        hrPhysHighBpm: 220,
        hrTopKPeaks: 5,
        hrMinPeakDistanceHz: 0.15,
        hrCandidateMergeBpm: 6,
        hrTrackingSigmaBpm: 12,
        hrReliableUpdateMaxDeviationBpm: 15,
        hrBaselineSigmaBpm: 20,
        hrBaselineHistoryLength: 120,
        hrHistoryMinQuality: 0.42,
        // A single authoritative HR history is deliberately harder to update than
        // the ordinary Beam. Thresholds were selected from all 28 aligned segments:
        // correct outputs have markedly higher 20/30 s support and quality, while a
        // score threshold alone still admits many stable motion/respiratory peaks.
        // Quality is only a floor here; persistence, 20/30 s support, score margin
        // and old-anchor visibility provide the actual discrimination. A higher
        // absolute floor incorrectly excludes low-amplitude but valid 7.2 tracks.
        hrAuthorityMinimumQuality: 0.65,
        hrAuthorityInitialMinimumMargin: 0.05,
        hrAuthorityInitialConfirmSec: 5,
        hrAuthorityLocalConfirmSec: 5,
        hrAuthorityRemoteConfirmSec: 5,
        hrAuthorityMatureTrackConfirmSec: 5,
        hrAuthorityCandidateMatchBpm: 6,
        hrAuthorityNearbyBpm: 10,
        hrAuthorityHistorySec: 15,
        hrAuthorityMaximumFiveSecondChangeBpm: 16,
        hrAuthoritySingleWindowMinimumQuality: 0.45,
        hrAuthorityLocalEvidenceRequired: 4,
        // Confirmed authoritative writes are intentionally limited to the p95
        // physiological envelopes measured from all aligned gold data. Faster
        // movement may still be output, but must use remote/mature re-anchoring
        // instead of walking the unique anchor through several small local steps.
        hrAuthorityLocalMaximumFiveSecondDriftBpm: 8,
        hrAuthorityLocalMaximumFifteenSecondDriftBpm: 12,
        hrAuthorityInitialEvidenceRequired: 4,
        hrAuthorityRemoteEvidenceRequired: 5,
        // Data-supported candidate selection. The weak-candidate veto was selected
        // by leave-one-segment-out analysis of the fixed-alignment diagnostics.
        hrWeakCandidateSpectralThreshold: 0.25,
        hrWeakCandidateAxisEnergyThreshold: 2,
        hrTrackBeamWidth: 5,
        hrTrackMemory: 0.82,
        hrTrackTransitionScaleBpm: 18,
        hrTrackTransitionPenalty: 0.18,
        hrTrackMaxMatchBpm: 18,
        // Data-driven candidate observation score. Values are normalized near the
        // empirical scale of candidates within 10 bpm of gold, then combined using
        // features that separated correct and incorrect peaks in fixed-alignment
        // diagnostics. Autocorrelation stability, gyro penalty and contamination
        // are not rewarded here because they showed little/no class separation.
        hrDataDrivenScoringEnabled: true,
        hrObservationSupportWeight: 0,
        hrObservationSpectralWeight: 0.35,
        hrObservationIntervalWeight: 0.26,
        hrObservationCrossAxisWeight: 0.1,
        hrObservationAutocorrelationWeight: 0.12,
        hrObservationContinuityWeight: 0.17,
        hrObservationDataBlendWeight: 0.2,
        hrDataDrivenTieMargin: 0.05,
        hrPhysiologyTransitionPenaltyWeight: 0.12,
        hrPhysiologyNewTrackPenaltyWeight: 0.18,
        hrObservationIntervalScale: 0.35,
        hrObservationCrossAxisScale: 0.12,
        hrObservationAutocorrelationScale: 0.2,
        // Thirty-second candidate-history evidence. During the first 30 seconds all
        // viable candidates are tracked without changing the selected peak. Once a
        // track has enough history, smooth and persistent candidate trajectories
        // contribute to peak selection.
        // Candidate stability is evaluated over the latest rolling 30 s. This is
        // long enough to reject transient peak switches without delaying genuine
        // gradual HR changes for a full minute.
        hrTrendHistorySec: 60,
        hrTrendMinHistorySec: 20,
        hrTrendMaxGapSec: 3,
        // Unselected candidates remain in the trajectory bank through short peak
        // dropouts. This preserves primary, secondary and harmonic alternatives
        // independently of which trajectory currently drives the output.
        hrPersistentTrackMaxGapSec: 3,
        hrTrendMatchBpm: 12,
        // Candidate-to-track relinking follows the empirical 1 s and 5 s HR-change
        // envelopes instead of using the same permissive 12 bpm gate at every gap.
        hrTrendMatchBpmByGapSec: { 1: 6, 2: 9, 3: 11 },
        hrTrendVelocityAlpha: 0.25,
        hrTrendStepScaleBpm: 4,
        hrTrendCurvatureScaleBpm: 3,
        // Robust trajectory stability: normal changes dominate the rolling minute,
        // while one or two interpolation/peak-centre shifts do not veto all 60 s.
        hrTrendStepP95MaximumBpm: 4,
        hrTrendLargeStepThresholdBpm: 6,
        hrTrendMaximumLargeStepCount: 2,
        hrTrendAbsoluteMaximumStepBpm: 8,
        // The 0.28 experiment is preserved under results/30秒候选趋势. It helped
        // several difficult 7.18 segments but reduced aggregate generalization, so
        // keep the trajectory fields diagnostic-only in the default pipeline.
        hrTrendScoreWeight: 0.1,
        // A fully observed, physiologically stable 60 s candidate trajectory may
        // replace a stale previousReliableHr even when the gap exceeds the ordinary
        // 15 bpm reliable-update limit.
        hrMatureTrackTakeoverEnabled: true,
        hrMatureTrackTakeoverSpanSec: 60,
        hrMatureTrackTakeoverMinimumCoverage: 0.95,
        hrMatureTrackTakeoverRequiredWindows: [20, 30],
        hrMatureTrackCurrentMatchBpm: 15,
        hrMatureTrackRemoteConfirmSec: 10,
        hrMatureTrackRemoteMatchBpm: 6,
        hrMatureTrackTakeoverCooldownSec: 60,
        hrMatureTrackMaximumStepBpm: 8,
        hrMatureTrackSelectedConfirmSec: 30,
        hrMatureTrackSelectedMatchBpm: 10,
        // A very strong 50-68 bpm component can be a respiratory harmonic. When a
        // supported high-HR anchor is still present, keep the low candidate for
        // diagnostics/tracking but prevent it from taking over control state.
        hrLowStrongArtifactGuardEnabled: true,
        hrLowStrongArtifactBandBpm: [50, 68],
        hrLowStrongArtifactMinimumSpectralScore: 0.8,
        hrLowStrongArtifactRequiredWindows: [20, 30],
        hrLowStrongArtifactMinimumAnchorBpm: 90,
        hrLowStrongArtifactMinimumDistanceBpm: 25,
        hrLowStrongArtifactAnchorMatchBpm: 15,
        hrLowStrongArtifactSpectralDominanceRatio: 3,
        // 50-68 bpm is retained as a possible physiological range, but it uses an
        // asymmetric admission rule because respiratory harmonics are common here.
        // Low candidates keep accumulating diagnostic/trajectory evidence while
        // pending, but cannot control the band, Beam or reliable anchor.
        hrLowZoneEnabled: true,
        hrLowZoneBandBpm: [30, 68],
        hrLowZoneNormalBoundaryBpm: 75,
        hrLowZoneRequiredWindows: [20, 30],
        hrLowZoneEntryConfirmSec: 20,
        hrLowZoneOldAnchorMissingSec: 15,
        hrLowZoneMinimumObservationScore: 0.6,
        hrLowZoneMinimumTrackCoverage: 0.65,
        hrLowZoneCandidateMatchBpm: 6,
        hrLowZoneEvidencePassRatio: 0.7,
        hrCriticalLowBandBpm: [30, 55],
        hrCriticalLowEntryConfirmSec: 30,
        hrCriticalLowMinimumObservationScore: 0.65,
        hrCriticalLowMinimumTrackCoverage: 0.8,
        hrLowZoneExitConfirmSec: 5,
        hrLowZoneExitObservationAdvantage: 0.05,
        // Cleaned-gold trajectory limits. Inside p95 is fully plausible; p95-p99
        // is progressively less likely; beyond p99 decays rather than being vetoed.
        hrPhysiologyDeltaLimits: {
          1: [3, 6],
          5: [8, 16],
          15: [12, 21],
          30: [15, 24]
        },
        hrPhysiologySlopeLimits: [0.525, 0.891],
        hrPhysiologyResidualLimits: [5.33, 7.79],
        hrPhysiologyAccelerationLimits: [4, 8],
        hrPhysiologyCoverageWeight: 0.25,
        hrPhysiologyDeltaWeight: 0.4,
        hrPhysiologySlopeWeight: 0.12,
        hrPhysiologyResidualWeight: 0.13,
        hrPhysiologyAccelerationWeight: 0.1,
        // Robust 30 s candidate band. This is a gate, not a smoothness reward.
        // The first full experiment is preserved under results/30秒稳健候选带.
        // It removed transient spikes but could lock onto a wrong initial band, so
        // keep it disabled by default until multi-band initialization is added.
        // Retained as an experimental feature. Across all 16 fixed-alignment
        // segments, the rolling multi-band gate reached 50.66% within 10 bpm versus
        // 53.27% for the current baseline, so it must not be enabled by default.
        // The rolling 30 s stable-band experiment reduced MAE from 14.67 to 14.14
        // bpm and improved +/-10 accuracy from 53.27% to 53.96%, while reacting
        // sooner than the 60 s variant.
        hrBandEnabled: false,
        // Track identity is reconsidered only at fixed 15 s checkpoints. Between
        // checkpoints the selected physiological track may move normally, but a
        // different candidate family cannot take control.
        hrCheckpointTrackLockEnabled: true,
        hrCheckpointTrackInitializationSec: 30,
        hrCheckpointTrackDecisionSec: 15,
        hrCheckpointTrackShortHoldSec: 2,
        hrCheckpointTrackRelinkBpm: 6,
        hrCheckpointTrackLocalSwitchBpm: 10,
        hrCheckpointTrackRemoteSwitchBpm: 15,
        hrCheckpointTrackCurrentMinimumCoverage15: 0.6,
        hrCheckpointTrackCurrentInvalidCoverage15: 0.4,
        hrCheckpointTrackCurrentMissingSec: 5,
        hrCheckpointTrackChallengerCoverage15: 0.8,
        hrCheckpointTrackLocalMinimumSpanSec: 15,
        hrCheckpointTrackRemoteMinimumSpanSec: 30,
        hrCheckpointTrackLocalScoreAdvantage: 0.05,
        hrCheckpointTrackRemoteScoreAdvantage: 0.1,
        hrCheckpointTrackRemoteRequiredCheckpoints: 2,
        // The mature 60-second selector and the original-score selector run in
        // parallel. These values control only which branch owns the final output;
        // they never filter candidates from the original-score Beam.
        hrSixtySecondTrackEnterConfirmSec: 5,
        hrSixtySecondTrackExitConfirmSec: 2,
        // A mature trajectory may only take over a remote raw selection when its
        // competitive evidence grows with the requested HR distance.
        hrMatureTakeoverEvidenceGateEnabled: true,
        hrMatureTakeoverEvidenceGateStartBpm: 15,
        hrMatureTakeoverBaseRatio: 0.6,
        hrMatureTakeoverRatioPerBpm: 4e-3,
        hrMatureTakeoverMaximumRatio: 0.95,
        hrMatureTakeoverConfirmBaseSec: 5,
        hrMatureTakeoverConfirmStepBpm: 20,
        hrMatureTakeoverConfirmStepSec: 2,
        hrMatureTakeoverMaximumConfirmSec: 15,
        hrRawBeamTransitionGuardEnabled: true,
        hrRawBeamTrendHistorySec: 15,
        hrRawBeamRemoteDeviationBpm: 12,
        hrRawBeamNearbyCandidateBpm: 10,
        hrRawBeamMaximumTrendHoldSec: 5,
        hrRawBeamHoldMaximumDriftBpm: 6,
        hrRawBeamRemoteConfirmSec: 5,
        hrRawBeamRemoteMatchBpm: 6,
        hrRawBeamRemoteMaximumFiveSecondChangeBpm: 16,
        hrRawBeamMaximumFifteenSecondChangeBpm: 21,
        hrCheckpointFallbackBandBpm: 10,
        hrBandInitializationSec: 30,
        // Initial band creation is deliberately stricter than later tracking.
        // Keep up to three established trajectories, but do not lock the 60 s band
        // until a trajectory is present in both long candidate windows.
        hrBandInitializationRequiredWindows: [20, 30],
        // Rebuild every 15 s: 0-30, 15-45, 30-60, 45-75, and so on.
        hrBandRefreshSec: 15,
        hrBandMaximumCandidates: 3,
        hrBandCandidateMergeBpm: 6,
        hrBandMinimumTrackCoverage: 0.65,
        // Candidate trajectories include FFT-bin and clustering jitter, so their
        // hard limits must be wider than the cleaned-gold p95 values. Retain the
        // established step/residual margins and only tighten sustained slope from
        // the original 1.5 bpm/s to 1.0 bpm/s.
        hrBandMaximumTrackStepBpm: 5,
        hrBandMaximumTrackResidualBpm: 6,
        hrBandMaximumTrackSlopeBpmPerSec: 1,
        hrBandMaximumTransitionBpmPerSec: 6,
        hrBandHalfWidthBpm: 10,
        hrBandMinimumHalfWidthBpm: 8,
        hrBandMaximumHalfWidthBpm: 12,
        hrBandCenterMaxStepBpm: 1,
        hrBandHoldMaximumSec: 15,
        hrBandShiftConfirmSec: 10,
        hrBandPendingMatchBpm: 6,
        hrBandShiftMinimumSpectralScore: 0.3,
        hrBandShiftMinimumSupportWindows: 2,
        // Pre-FFT impact/artifact handling.
        impactJerkMadMultiplier: 8,
        impactExtremeJerkMadMultiplier: 15,
        impactGyroMadMultiplier: 6,
        impactPaddingSec: 0.2,
        impactMaxInterpolationSec: 0.25,
        impactWindowPenaltyWeight: 0.6,
        impactHighContaminationRatio: 0.15,
        // Candidate verification from pre-FFT time-domain rhythm evidence.
        // The 0.12/0.08 scoring experiment is preserved under results/节律验证,
        // but reduced overall ±10 accuracy. Keep the evidence diagnostic-only in
        // the production path until it can distinguish stable artifacts.
        // Compute/export rhythm evidence even when its scoring weights remain zero.
        rhythmEvidenceDiagnosticEnabled: true,
        rhythmPeakThresholdStd: 0.35,
        rhythmPeakMinDistanceSec: 0.22,
        rhythmIntervalRelativeSigma: 0.18,
        rhythmIntervalCvScale: 0.3,
        // Rhythm-aware switch controller layered on top of the reproduced 60 s
        // candidate band. It does not rescore ordinary nearby candidates. Only a
        // remote proposed switch enters a short evidence-accumulation challenge.
        rhythmSwitchControllerEnabled: true,
        rhythmSwitchRemoteBpm: 10,
        rhythmSwitchOldMatchBpm: 6,
        rhythmSwitchChallengeMatchBpm: 6,
        rhythmSwitchOldEvidenceAdvantage: 0.05,
        rhythmSwitchConfirmSec: 6,
        rhythmSwitchMaximumVetoSec: 10,
        // Context-only heartbeat evidence. These weights are never added to the
        // ordinary per-second candidate/beam score. They are used only while
        // initializing, comparing a remote challenger, or reacquiring after the
        // remembered peak disappears.
        rhythmContextIntervalWeight: 0.45,
        rhythmContextCrossAxisWeight: 0.3,
        rhythmContextAutocorrelationWeight: 0.25,
        rhythmInitializationBlendWeight: 0.25,
        rhythmReacquireBlendWeight: 0.35,
        // Signed-axis time-domain consensus. A cardiac event must appear on at
        // least two acceleration axes; gyro-synchronous consensus is penalized.
        // The 0.12/0.08 experiment is preserved under results/三轴事件共识 but
        // slightly reduced aggregate accuracy. Keep these diagnostic-only.
        crossAxisEventThresholdStd: 0.45,
        crossAxisCoincidenceSec: 0.1,
        crossAxisMinConsensusEvents: 4,
        // Gyroscope evidence is a soft motion-artifact penalty, never a hard veto.
        // Coherence needs repeated subsegments, so it is used only by 20/30 s
        // candidate windows. The 10 s window continues to provide fast HR changes.
        gyroCoherenceMinWindowSec: 20,
        gyroCoherenceSegmentSec: 5,
        gyroCoherenceOverlap: 0.5,
        gyroEnergyNeutralRatio: 2,
        gyroEnergyHighRatio: 12,
        gyroImpulseMadMultiplier: 6,
        gyroImpulseFullRatio: 0.05,
        gyroMotionEvidenceThreshold: 0.45,
        gyroPersistenceFullSec: 10,
        gyroPenaltyWeight: 0.14,
        // Final quality-aware smoothing.
        hrMedianWindowSize: 5,
        hrMaxSlopeBpmPerSec: 10,
        hrHardMaxStepBpm: 20,
        hrPostAlpha: 0.5,
        hrLowQualityThreshold: 0.35,
        hrOutlierGapBpm: 18,
        // Motion classification.
        staticAccVarThreshold: 0.2,
        staticGyrMagThreshold: 3,
        epsilon: 1e-10
      };
    }
  });

  // src/imu/AttitudeSolver.js
  var require_AttitudeSolver = __commonJS({
    "src/imu/AttitudeSolver.js"(exports, module) {
      "use strict";
      var AttitudeSolver = class {
        constructor(options = {}) {
          this.algorithm = String(options.algorithm || "mahony").toLowerCase();
          this.kp = this._num(options.kp, 1);
          this.ki = this._num(options.ki, 0);
          this.beta = this._num(options.beta, 0.05);
          this.sampleRateHz = this._num(options.sampleRateHz, 50);
          this.defaultDt = this.sampleRateHz > 0 ? 1 / this.sampleRateHz : 0.02;
          this.clampDtMin = this._num(options.clampDtMin, 1e-4);
          this.clampDtMax = this._num(options.clampDtMax, 0.1);
          this.accelUnit = String(options.accelUnit || "mps2").toLowerCase();
          this.gyroUnit = String(options.gyroUnit || "rad/s").toLowerCase();
          this.gravity = this._num(options.gravity, 9.80665);
          this.useAccConfidence = options.useAccConfidence !== false;
          this.accConfLow = this._num(options.accConfLow, 0.05);
          this.accConfHigh = this._num(options.accConfHigh, 0.15);
          this.accConfMinForIntegral = this._num(options.accConfMinForIntegral, 0.5);
          this.eps = this._num(options.eps, 1e-12);
          this.integralLimit = this._num(options.integralLimit, 0.5);
          this.reset(options.initialQuaternion);
          this.lastAccNorm = 0;
          this.lastAccConfidence = 0;
          this.lastDt = this.defaultDt;
          this.lastError = { x: 0, y: 0, z: 0 };
        }
        reset(initialQuaternion) {
          if (initialQuaternion && this._isValidQuat(initialQuaternion)) {
            const q = this._normalizeQuat({
              w: this._num(initialQuaternion.w, 1),
              x: this._num(initialQuaternion.x, 0),
              y: this._num(initialQuaternion.y, 0),
              z: this._num(initialQuaternion.z, 0)
            });
            this.q = q;
          } else {
            this.q = { w: 1, x: 0, y: 0, z: 0 };
          }
          this.integral = { x: 0, y: 0, z: 0 };
          this.lastError = { x: 0, y: 0, z: 0 };
          this.lastAccNorm = 0;
          this.lastAccConfidence = 0;
          this.lastDt = this.defaultDt;
        }
        setAlgorithm(algorithm) {
          this.algorithm = String(algorithm || "mahony").toLowerCase();
        }
        setQuaternion(q) {
          if (!this._isValidQuat(q)) return false;
          this.q = this._normalizeQuat({
            w: this._num(q.w, 1),
            x: this._num(q.x, 0),
            y: this._num(q.y, 0),
            z: this._num(q.z, 0)
          });
          return true;
        }
        getQuaternion() {
          return {
            w: this.q.w,
            x: this.q.x,
            y: this.q.y,
            z: this.q.z
          };
        }
        getState() {
          const gBody = this.getGravityBody();
          return {
            quaternion: this.getQuaternion(),
            gravityBody: gBody,
            gravityWorld: this.getGravityWorld(),
            accNorm: this.lastAccNorm,
            accConfidence: this.lastAccConfidence,
            dt: this.lastDt,
            error: {
              x: this.lastError.x,
              y: this.lastError.y,
              z: this.lastError.z
            },
            integral: {
              x: this.integral.x,
              y: this.integral.y,
              z: this.integral.z
            },
            algorithm: this.algorithm
          };
        }
        /**
         * Update orientation.
         *
         * Inputs:
         * - gx, gy, gz: angular rate
         * - ax, ay, az: accelerometer
         * - dt: seconds
         *
         * Returns:
         * - state object with quaternion and diagnostics
         */
        update(gx, gy, gz, ax, ay, az, dt) {
          const dti = this._clampDt(this._num(dt, this.defaultDt));
          this.lastDt = dti;
          let gyro = this._toRadPerSec(gx, gy, gz);
          let acc = this._toG(ax, ay, az);
          const accNorm = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
          this.lastAccNorm = accNorm;
          const hasAcc = Number.isFinite(accNorm) && accNorm > this.eps;
          const accConfidence = hasAcc ? this._accConfidence(accNorm) : 0;
          this.lastAccConfidence = accConfidence;
          if (this.algorithm === "madgwick") {
            this._updateMadgwick(gyro, acc, accConfidence, dti);
          } else {
            this._updateMahony(gyro, acc, accConfidence, dti);
          }
          return this.getState();
        }
        /**
         * Gravity vector in body frame, in g units.
         * At rest and level, this should be approximately [0, 0, 1].
         */
        getGravityBody() {
          return this._rotateWorldToBody({ x: 0, y: 0, z: 1 }, this.q);
        }
        /**
         * Gravity vector in world frame, in g units.
         * For the chosen convention, this is always [0, 0, 1].
         */
        getGravityWorld() {
          return { x: 0, y: 0, z: 1 };
        }
        /**
         * Optional helper: linear acceleration in body frame.
         * Input can be in m/s^2 or g, but the result is always in g.
         */
        removeGravity(ax, ay, az) {
          const acc = this._toG(ax, ay, az);
          const gBody = this.getGravityBody();
          return {
            x: acc.x - gBody.x,
            y: acc.y - gBody.y,
            z: acc.z - gBody.z
          };
        }
        /**
         * Euler angles in radians.
         * roll  = rotation about X
         * pitch = rotation about Y
         * yaw   = rotation about Z
         */
        getEuler() {
          const q = this.q;
          const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
          const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
          const roll = Math.atan2(sinr_cosp, cosr_cosp);
          let sinp = 2 * (q.w * q.y - q.z * q.x);
          sinp = Math.max(-1, Math.min(1, sinp));
          const pitch = Math.asin(sinp);
          const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
          const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
          const yaw = Math.atan2(siny_cosp, cosy_cosp);
          return { roll, pitch, yaw };
        }
        // -------------------------
        // Mahony
        // -------------------------
        _updateMahony(gyro, acc, accConfidence, dt) {
          const q = this.q;
          let gx = gyro.x;
          let gy = gyro.y;
          let gz = gyro.z;
          if (accConfidence > 0 && Number.isFinite(acc.x) && Number.isFinite(acc.y) && Number.isFinite(acc.z)) {
            const an = this._normalizeVec(acc);
            if (an) {
              const gEst = this.getGravityBody();
              const ex = an.y * gEst.z - an.z * gEst.y;
              const ey = an.z * gEst.x - an.x * gEst.z;
              const ez = an.x * gEst.y - an.y * gEst.x;
              this.lastError = { x: ex, y: ey, z: ez };
              if (this.ki > 0 && accConfidence >= this.accConfMinForIntegral) {
                this.integral.x += ex * dt;
                this.integral.y += ey * dt;
                this.integral.z += ez * dt;
                this.integral.x = this._clamp(this.integral.x, -this.integralLimit, this.integralLimit);
                this.integral.y = this._clamp(this.integral.y, -this.integralLimit, this.integralLimit);
                this.integral.z = this._clamp(this.integral.z, -this.integralLimit, this.integralLimit);
              }
              gx += accConfidence * (this.kp * ex + this.ki * this.integral.x);
              gy += accConfidence * (this.kp * ey + this.ki * this.integral.y);
              gz += accConfidence * (this.kp * ez + this.ki * this.integral.z);
            }
          } else {
            this.lastError = { x: 0, y: 0, z: 0 };
          }
          this._integrateQuaternion(gx, gy, gz, dt);
        }
        // -------------------------
        // Madgwick
        // -------------------------
        _updateMadgwick(gyro, acc, accConfidence, dt) {
          let q1 = this.q.w;
          let q2 = this.q.x;
          let q3 = this.q.y;
          let q4 = this.q.z;
          let gx = gyro.x;
          let gy = gyro.y;
          let gz = gyro.z;
          const accNorm = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
          if (!(Number.isFinite(accNorm) && accNorm > this.eps && accConfidence > 0)) {
            this.lastError = { x: 0, y: 0, z: 0 };
            this._integrateQuaternion(gx, gy, gz, dt);
            return;
          }
          const ax = acc.x / accNorm;
          const ay = acc.y / accNorm;
          const az = acc.z / accNorm;
          const f1 = 2 * (q2 * q4 - q1 * q3) - ax;
          const f2 = 2 * (q1 * q2 + q3 * q4) - ay;
          const f3 = 2 * (0.5 - q2 * q2 - q3 * q3) - az;
          let s1 = -2 * q3 * f1 + 2 * q2 * f2;
          let s2 = 2 * q4 * f1 + 2 * q1 * f2 - 4 * q2 * f3;
          let s3 = -2 * q1 * f1 + 2 * q4 * f2 - 4 * q3 * f3;
          let s4 = 2 * q2 * f1 + 2 * q3 * f2;
          const sn = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3 + s4 * s4);
          if (sn > this.eps) {
            s1 /= sn;
            s2 /= sn;
            s3 /= sn;
            s4 /= sn;
          } else {
            s1 = 0;
            s2 = 0;
            s3 = 0;
            s4 = 0;
          }
          this.lastError = { x: f1, y: f2, z: f3 };
          const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz) - this.beta * s1;
          const qDot2 = 0.5 * (q1 * gx + q3 * gz - q4 * gy) - this.beta * s2;
          const qDot3 = 0.5 * (q1 * gy - q2 * gz + q4 * gx) - this.beta * s3;
          const qDot4 = 0.5 * (q1 * gz + q2 * gy - q3 * gx) - this.beta * s4;
          q1 += qDot1 * dt;
          q2 += qDot2 * dt;
          q3 += qDot3 * dt;
          q4 += qDot4 * dt;
          this.q = this._normalizeQuat({ w: q1, x: q2, y: q3, z: q4 });
        }
        // -------------------------
        // Quaternion helpers
        // -------------------------
        _integrateQuaternion(gx, gy, gz, dt) {
          let q1 = this.q.w;
          let q2 = this.q.x;
          let q3 = this.q.y;
          let q4 = this.q.z;
          const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz);
          const qDot2 = 0.5 * (q1 * gx + q3 * gz - q4 * gy);
          const qDot3 = 0.5 * (q1 * gy - q2 * gz + q4 * gx);
          const qDot4 = 0.5 * (q1 * gz + q2 * gy - q3 * gx);
          q1 += qDot1 * dt;
          q2 += qDot2 * dt;
          q3 += qDot3 * dt;
          q4 += qDot4 * dt;
          this.q = this._normalizeQuat({ w: q1, x: q2, y: q3, z: q4 });
        }
        _rotateWorldToBody(v, qBodyToWorld) {
          const qc = { w: qBodyToWorld.w, x: -qBodyToWorld.x, y: -qBodyToWorld.y, z: -qBodyToWorld.z };
          return this._rotateByQuat(v, qc);
        }
        _rotateBodyToWorld(v, qBodyToWorld) {
          return this._rotateByQuat(v, qBodyToWorld);
        }
        _rotateByQuat(v, q) {
          const p = { w: 0, x: v.x, y: v.y, z: v.z };
          const qp = this._quatMul(q, p);
          const r = this._quatMul(qp, { w: q.w, x: -q.x, y: -q.y, z: -q.z });
          return { x: r.x, y: r.y, z: r.z };
        }
        _quatMul(a, b) {
          return {
            w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
            x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
            z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
          };
        }
        _normalizeQuat(q) {
          const n = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
          if (!(Number.isFinite(n) && n > this.eps)) {
            return { w: 1, x: 0, y: 0, z: 0 };
          }
          return {
            w: q.w / n,
            x: q.x / n,
            y: q.y / n,
            z: q.z / n
          };
        }
        _normalizeVec(v) {
          const n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          if (!(Number.isFinite(n) && n > this.eps)) return null;
          return { x: v.x / n, y: v.y / n, z: v.z / n };
        }
        _accConfidence(accNormG) {
          const err = Math.abs(accNormG - 1);
          if (err <= this.accConfLow) return 1;
          if (err >= this.accConfHigh) return 0;
          return (this.accConfHigh - err) / (this.accConfHigh - this.accConfLow);
        }
        _clampDt(dt) {
          if (!Number.isFinite(dt) || dt <= 0) return this.defaultDt;
          return this._clamp(dt, this.clampDtMin, this.clampDtMax);
        }
        _toG(ax, ay, az) {
          if (this.accelUnit === "g") {
            return { x: ax, y: ay, z: az };
          }
          const s = 1 / this.gravity;
          return { x: ax * s, y: ay * s, z: az * s };
        }
        _toRadPerSec(gx, gy, gz) {
          if (this.gyroUnit === "deg/s" || this.gyroUnit === "degs" || this.gyroUnit === "deg") {
            const s = Math.PI / 180;
            return { x: gx * s, y: gy * s, z: gz * s };
          }
          return { x: gx, y: gy, z: gz };
        }
        _isValidQuat(q) {
          return q && Number.isFinite(q.w) && Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z);
        }
        _num(v, fallback) {
          return Number.isFinite(v) ? v : fallback;
        }
        _clamp(v, lo, hi) {
          return Math.max(lo, Math.min(hi, v));
        }
      };
      module.exports = AttitudeSolver;
      module.exports.AttitudeSolver = AttitudeSolver;
    }
  });

  // src/imu/GravityRemoval.js
  var require_GravityRemoval = __commonJS({
    "src/imu/GravityRemoval.js"(exports, module) {
      "use strict";
      var defaultConfig = require_config();
      function estimateFs(time_s, fsDefault = 100) {
        const n = time_s.length;
        if (n < 2) return fsDefault;
        const dts = [];
        for (let i = 1; i < n; i++) {
          const dt = time_s[i] - time_s[i - 1];
          if (dt > 0 && isFinite(dt)) dts.push(dt);
        }
        if (dts.length === 0) return fsDefault;
        dts.sort((a, b) => a - b);
        const mid = Math.floor(dts.length / 2);
        const medianDt = dts.length % 2 ? dts[mid] : 0.5 * (dts[mid - 1] + dts[mid]);
        const fs = medianDt > 0 ? 1 / medianDt : fsDefault;
        return fs;
      }
      function qConjugate(q) {
        return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
      }
      function qMultiply(a, b) {
        return {
          w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
          x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
          y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
          z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
        };
      }
      function rotateVectorByQuaternion(v, q) {
        const vq = { w: 0, x: v[0], y: v[1], z: v[2] };
        const qConj = qConjugate(q);
        const t = qMultiply(q, vq);
        const r = qMultiply(t, qConj);
        return [r.x, r.y, r.z];
      }
      function removeGravity(samples, solver, cfg = {}) {
        const config = Object.assign({}, defaultConfig, cfg);
        const gravity = config.gravity || 9.81;
        const accelUnit = (config.accelUnit || "mps2").toLowerCase();
        const gyroUnit = (config.gyroUnit || "deg/s").toLowerCase();
        const quatConv = config.quaternionConvention || "bodyToWorld";
        const fsDefault = config.fsDefault || 100;
        const n = samples.length;
        const time_s = new Float64Array(n);
        const ax_raw_mps2 = new Float64Array(n);
        const ay_raw_mps2 = new Float64Array(n);
        const az_raw_mps2 = new Float64Array(n);
        const gx_deg = new Float64Array(n);
        const gy_deg = new Float64Array(n);
        const gz_deg = new Float64Array(n);
        const linAx = new Float64Array(n);
        const linAy = new Float64Array(n);
        const linAz = new Float64Array(n);
        const linAxWorld = new Float64Array(n);
        const linAyWorld = new Float64Array(n);
        const linAzWorld = new Float64Array(n);
        const gravityBodyX = new Float64Array(n);
        const gravityBodyY = new Float64Array(n);
        const gravityBodyZ = new Float64Array(n);
        const gravityResidual = new Float64Array(n);
        const accNorm = new Float64Array(n);
        const accConfidence = new Float64Array(n);
        const attitudeErrorX = new Float64Array(n);
        const attitudeErrorY = new Float64Array(n);
        const attitudeErrorZ = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const s = samples[i] || {};
          if (typeof s.time_s === "number") {
            time_s[i] = s.time_s;
          } else if (i > 0) {
            time_s[i] = time_s[i - 1] + 1 / fsDefault;
          } else {
            time_s[i] = 0;
          }
          if (accelUnit === "g") {
            ax_raw_mps2[i] = (s.ax || 0) * gravity;
            ay_raw_mps2[i] = (s.ay || 0) * gravity;
            az_raw_mps2[i] = (s.az || 0) * gravity;
          } else {
            ax_raw_mps2[i] = s.ax || 0;
            ay_raw_mps2[i] = s.ay || 0;
            az_raw_mps2[i] = s.az || 0;
          }
          if (gyroUnit.startsWith("rad")) {
            const r2d = 180 / Math.PI;
            gx_deg[i] = (s.gx || 0) * r2d;
            gy_deg[i] = (s.gy || 0) * r2d;
            gz_deg[i] = (s.gz || 0) * r2d;
          } else {
            gx_deg[i] = s.gx || 0;
            gy_deg[i] = s.gy || 0;
            gz_deg[i] = s.gz || 0;
          }
        }
        const fs = estimateFs(time_s, fsDefault);
        if (typeof solver.setSampleRate === "function") {
          solver.setSampleRate(fs);
        }
        for (let i = 0; i < n; i++) {
          const ax = ax_raw_mps2[i];
          const ay = ay_raw_mps2[i];
          const az = az_raw_mps2[i];
          const gx = gx_deg[i];
          const gy = gy_deg[i];
          const gz = gz_deg[i];
          let dt;
          if (i === 0) {
            dt = 1 / fs;
          } else {
            dt = time_s[i] - time_s[i - 1];
            if (!isFinite(dt) || dt <= 0) {
              dt = 1 / fs;
            }
          }
          solver.update(gx, gy, gz, ax, ay, az, dt);
          let state = null;
          if (typeof solver.getState === "function") {
            state = solver.getState();
          }
          let q = null;
          let gBodyG = null;
          let accNormG = NaN;
          let accConf = NaN;
          let errX = NaN;
          let errY = NaN;
          let errZ = NaN;
          if (state) {
            q = state.quaternion;
            const gBody = state.gravityBody || { x: 0, y: 0, z: 1 };
            gBodyG = gBody;
            accNormG = state.accNorm;
            accConf = state.accConfidence;
            if (state.error) {
              errX = state.error.x;
              errY = state.error.y;
              errZ = state.error.z;
            }
          } else {
            q = solver.getQuaternion();
            if (quatConv === "bodyToWorld") {
              const qConj = qConjugate(q);
              const gBodyArr = rotateVectorByQuaternion([0, 0, 1], qConj);
              gBodyG = { x: gBodyArr[0], y: gBodyArr[1], z: gBodyArr[2] };
            } else {
              const gBodyArr = rotateVectorByQuaternion([0, 0, 1], q);
              gBodyG = { x: gBodyArr[0], y: gBodyArr[1], z: gBodyArr[2] };
            }
            accNormG = Math.sqrt(
              ax / gravity * (ax / gravity) + ay / gravity * (ay / gravity) + az / gravity * (az / gravity)
            );
            accConf = NaN;
          }
          const gBx = gBodyG.x * gravity;
          const gBy = gBodyG.y * gravity;
          const gBz = gBodyG.z * gravity;
          gravityBodyX[i] = gBx;
          gravityBodyY[i] = gBy;
          gravityBodyZ[i] = gBz;
          accNorm[i] = accNormG;
          accConfidence[i] = accConf;
          attitudeErrorX[i] = errX;
          attitudeErrorY[i] = errY;
          attitudeErrorZ[i] = errZ;
          const linBx = ax - gBx;
          const linBy = ay - gBy;
          const linBz = az - gBz;
          linAx[i] = linBx;
          linAy[i] = linBy;
          linAz[i] = linBz;
          gravityResidual[i] = Math.sqrt(
            (ax - gBx) * (ax - gBx) + (ay - gBy) * (ay - gBy) + (az - gBz) * (az - gBz)
          );
          let linWorld;
          if (quatConv === "bodyToWorld") {
            linWorld = rotateVectorByQuaternion([linBx, linBy, linBz], q);
          } else {
            const qConj = qConjugate(q);
            linWorld = rotateVectorByQuaternion([linBx, linBy, linBz], qConj);
          }
          linAxWorld[i] = linWorld[0];
          linAyWorld[i] = linWorld[1];
          linAzWorld[i] = linWorld[2];
        }
        return {
          time_s,
          fs,
          ax: ax_raw_mps2,
          ay: ay_raw_mps2,
          az: az_raw_mps2,
          gx: gx_deg,
          gy: gy_deg,
          gz: gz_deg,
          linAx,
          linAy,
          linAz,
          linAxWorld,
          linAyWorld,
          linAzWorld,
          gravityBodyX,
          gravityBodyY,
          gravityBodyZ,
          gravityResidual,
          accNorm,
          accConfidence,
          attitudeErrorX,
          attitudeErrorY,
          attitudeErrorZ
        };
      }
      module.exports = { removeGravity };
    }
  });

  // src/state/MotionClassifier.js
  var require_MotionClassifier = __commonJS({
    "src/state/MotionClassifier.js"(exports, module) {
      var baseConfig = require_config();
      function toF64(arr) {
        if (!arr) return new Float64Array(0);
        return new Float64Array(Array.from(arr));
      }
      function mean(arr) {
        let s = 0;
        let c = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (Number.isFinite(v)) {
            s += v;
            c++;
          }
        }
        return c > 0 ? s / c : 0;
      }
      function variance(arr) {
        const mu = mean(arr);
        let s = 0;
        let c = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (Number.isFinite(v)) {
            const d = v - mu;
            s += d * d;
            c++;
          }
        }
        return c > 0 ? s / c : 0;
      }
      function magnitude3(ax, ay, az) {
        const n = Math.min(ax.length, ay.length, az.length);
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const x = Number.isFinite(ax[i]) ? ax[i] : 0;
          const y = Number.isFinite(ay[i]) ? ay[i] : 0;
          const z = Number.isFinite(az[i]) ? az[i] : 0;
          out[i] = Math.sqrt(x * x + y * y + z * z);
        }
        return out;
      }
      function rms(arr) {
        let s2 = 0;
        let c = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (Number.isFinite(v)) {
            s2 += v * v;
            c++;
          }
        }
        return c > 0 ? Math.sqrt(s2 / c) : 0;
      }
      function classifyWindowState(axWin, ayWin, azWin, gxWin, gyWin, gzWin, fs, cfg = {}) {
        const config = Object.assign({}, baseConfig, cfg);
        const ax = toF64(axWin);
        const ay = toF64(ayWin);
        const az = toF64(azWin);
        const gx = toF64(gxWin);
        const gy = toF64(gyWin);
        const gz = toF64(gzWin);
        const accMag = magnitude3(ax, ay, az);
        const accVar = variance(accMag);
        const gyrMag = magnitude3(gx, gy, gz);
        const gyrRMS = rms(gyrMag);
        const isStatic = accVar < (config.staticAccVarThreshold || 15) && gyrRMS < (config.staticGyrMagThreshold || 3);
        return {
          state: isStatic ? "static" : "moving",
          accVar,
          gyrRMS
        };
      }
      function classifySeriesWindows(series, fs, options = {}) {
        const config = Object.assign({}, baseConfig, options);
        const ax = toF64(series.ax);
        const ay = toF64(series.ay);
        const az = toF64(series.az);
        const gx = toF64(series.gx);
        const gy = toF64(series.gy);
        const gz = toF64(series.gz);
        const n = Math.min(ax.length, ay.length, az.length, gx.length, gy.length, gz.length);
        if (!(fs > 0) || n === 0) return [];
        const winLen = Math.max(1, Math.round((config.windowSec || 10) * fs));
        const step = Math.max(1, Math.round((config.stepSec || 1) * fs));
        const windows = [];
        for (let end = winLen; end <= n; end += step) {
          const start = end - winLen;
          const axWin = ax.subarray(start, end);
          const ayWin = ay.subarray(start, end);
          const azWin = az.subarray(start, end);
          const gxWin = gx.subarray(start, end);
          const gyWin = gy.subarray(start, end);
          const gzWin = gz.subarray(start, end);
          const res = classifyWindowState(axWin, ayWin, azWin, gxWin, gyWin, gzWin, fs, config);
          windows.push({
            winStartIdx: start,
            winEndIdx: end - 1,
            winStart_s: start / fs,
            winEnd_s: end / fs,
            state: res.state,
            accVar: res.accVar,
            gyrRMS: res.gyrRMS
          });
        }
        return windows;
      }
      module.exports = {
        classifySeriesWindows
      };
    }
  });

  // src/quality/RawImuQualityGate.js
  var require_RawImuQualityGate = __commonJS({
    "src/quality/RawImuQualityGate.js"(exports, module) {
      "use strict";
      function median(values) {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return NaN;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : 0.5 * (sorted[middle - 1] + sorted[middle]);
      }
      function mad(values) {
        const center = median(values);
        return Number.isFinite(center) ? median(values.map((value) => Math.abs(value - center))) : NaN;
      }
      function rms(values) {
        if (!values.length) return NaN;
        return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
      }
      function classifyValidity(metrics, thresholds) {
        if (metrics.sampleCoverage < thresholds.invalidCoverage || metrics.finiteRatio < thresholds.invalidFiniteRatio || metrics.stuckRatio > thresholds.invalidStuckRatio) return "invalid";
        if (metrics.sampleCoverage < thresholds.validCoverage || metrics.finiteRatio < thresholds.validFiniteRatio || metrics.stuckRatio > thresholds.validStuckRatio) return "degraded";
        return "valid";
      }
      function classifyMotion(metrics, thresholds) {
        const over95 = Number(metrics.accNormMad > thresholds.accMadP95) + Number(metrics.gyroRms > thresholds.gyroRmsP95) + Number(metrics.shockRatio > thresholds.shockP95);
        if (metrics.shockRatio > thresholds.shockP99) return "impact";
        if (metrics.accNormMad > thresholds.accMadP99 || metrics.gyroRms > thresholds.gyroRmsP99 || over95 >= 2) return "strong_motion";
        if (over95 >= 1) return "mild_motion";
        return "static";
      }
      function buildRawImuQualityGate(samples, sampleRateHz, options = {}) {
        const enabled = options.enabled !== false;
        const windowSec = options.windowSec || 10;
        const validityThresholds = options.validityThresholds;
        const motionThresholds = options.motionThresholds;
        const rejectedMotion = new Set(options.rejectMotionStatuses || ["strong_motion", "impact"]);
        const timeQuality = options.timeQuality || {};
        const minimumRejectRunSec = Math.max(1, options.minimumRejectRunSec || 5);
        const acceptConfirmSec = Math.max(1, options.acceptConfirmSec || 3);
        const decisions = [];
        const durationSec = samples.length / sampleRateHz;
        const pauseStart = Number.isFinite(timeQuality.detectedPauseAfterSample) ? timeQuality.detectedPauseAfterSample / sampleRateHz : NaN;
        const pauseEnd = Number.isFinite(pauseStart) && Number.isFinite(timeQuality.detectedPauseSec) ? pauseStart + Math.max(0, timeQuality.detectedPauseSec) : NaN;
        function evaluateAt(timeSec) {
          if (!enabled) return { accepted: true, validityStatus: "disabled", motionStatus: "disabled", reasons: [] };
          const startSec = Math.max(0, timeSec - windowSec);
          const endSec = Math.min(durationSec, timeSec);
          const start = Math.max(0, Math.floor(startSec * sampleRateHz));
          const end = Math.min(samples.length, Math.ceil(endSec * sampleRateHz));
          const selected = samples.slice(start, end);
          const finite = selected.filter((sample) => ["ax", "ay", "az", "gx", "gy", "gz"].every((axis) => Number.isFinite(sample[axis])));
          const expected = Math.max(1, (endSec - startSec) * sampleRateHz);
          let unavailableSec = 0;
          if (Number.isFinite(pauseStart) && Number.isFinite(pauseEnd)) {
            unavailableSec = Math.max(0, Math.min(endSec, pauseEnd) - Math.max(startSec, pauseStart));
          }
          const observableCoverage = Math.max(0, selected.length / expected - unavailableSec / Math.max(1e-9, endSec - startSec));
          let repeated = 0;
          const jerk = [];
          for (let index = 1; index < finite.length; index++) {
            if (["ax", "ay", "az", "gx", "gy", "gz"].every((axis) => finite[index][axis] === finite[index - 1][axis])) repeated++;
            jerk.push(Math.hypot(
              finite[index].ax - finite[index - 1].ax,
              finite[index].ay - finite[index - 1].ay,
              finite[index].az - finite[index - 1].az
            ));
          }
          const jerkCenter = median(jerk);
          const jerkMad = mad(jerk);
          const shockThreshold = jerkCenter + 8 * Math.max(jerkMad, 1e-6);
          const metrics = {
            sampleCoverage: Math.min(1, observableCoverage),
            finiteRatio: finite.length / Math.max(1, selected.length),
            stuckRatio: repeated / Math.max(1, finite.length - 1),
            accNormMad: mad(finite.map((sample) => Math.hypot(sample.ax, sample.ay, sample.az))),
            gyroRms: rms(finite.map((sample) => Math.hypot(sample.gx, sample.gy, sample.gz))),
            shockRatio: jerk.length ? jerk.filter((value) => value > shockThreshold).length / jerk.length : 1,
            unavailableSec
          };
          const validityStatus = classifyValidity(metrics, validityThresholds);
          const motionStatus = classifyMotion(metrics, motionThresholds);
          const reasons = [
            validityStatus === "invalid" ? "invalid_window" : "",
            rejectedMotion.has(motionStatus) ? motionStatus : ""
          ].filter(Boolean);
          return { accepted: reasons.length === 0, validityStatus, motionStatus, reasons, metrics };
        }
        for (let timeSec = 0; timeSec <= durationSec + 1e-9; timeSec += 1) {
          decisions.push({ time_s: timeSec, ...evaluateAt(timeSec) });
        }
        let rejecting = false;
        let normalRecoverySec = 0;
        for (const decision of decisions) {
          const rawAccepted = decision.accepted;
          decision.rawReasons = decision.reasons.slice();
          if (!rawAccepted) {
            rejecting = true;
            normalRecoverySec = 0;
            decision.rejectRunSec = 1;
            continue;
          }
          if (!rejecting) continue;
          normalRecoverySec++;
          decision.recoveryNormalSec = normalRecoverySec;
          if (normalRecoverySec < acceptConfirmSec) {
            decision.accepted = false;
            decision.reasons = ["quality_recovery_pending"];
            decision.rejectRunSec = 0;
            continue;
          }
          rejecting = false;
          normalRecoverySec = 0;
        }
        function decisionAt(timeSec) {
          if (!enabled) return evaluateAt(timeSec);
          const index = Math.round(timeSec);
          return decisions[index] || evaluateAt(timeSec);
        }
        const summary = decisions.reduce((result, decision) => {
          result.total++;
          if (decision.accepted) result.accepted++;
          else result.rejected++;
          result.validity[decision.validityStatus] = (result.validity[decision.validityStatus] || 0) + 1;
          result.motion[decision.motionStatus] = (result.motion[decision.motionStatus] || 0) + 1;
          return result;
        }, {
          enabled,
          minimumRejectRunSec,
          acceptConfirmSec,
          total: 0,
          accepted: 0,
          rejected: 0,
          validity: {},
          motion: {}
        });
        return { enabled, decisions, summary, decisionAt };
      }
      module.exports = { buildRawImuQualityGate };
    }
  });

  // src/signal/SignalFilters.js
  var require_SignalFilters = __commonJS({
    "src/signal/SignalFilters.js"(exports, module) {
      "use strict";
      var config = require_config();
      function toFloat64Array(signal) {
        if (signal instanceof Float64Array) return new Float64Array(signal);
        return new Float64Array(Array.from(signal || []));
      }
      function mean(signal) {
        if (!signal || !signal.length) return 0;
        let sum = 0;
        for (let index = 0; index < signal.length; index++) sum += signal[index];
        return sum / signal.length;
      }
      function variance(signal) {
        if (!signal || signal.length < 2) return 0;
        const center = mean(signal);
        let sum = 0;
        for (let index = 0; index < signal.length; index++) {
          const difference = signal[index] - center;
          sum += difference * difference;
        }
        return sum / signal.length;
      }
      function removeDC(signal) {
        const output = toFloat64Array(signal);
        const center = mean(output);
        for (let index = 0; index < output.length; index++) output[index] -= center;
        return output;
      }
      function zscore(signal, epsilon = config.epsilon || 1e-10) {
        const output = toFloat64Array(signal);
        const center = mean(output);
        const deviation = Math.sqrt(variance(output));
        const scale = deviation > epsilon ? deviation : 1;
        for (let index = 0; index < output.length; index++) {
          output[index] = (output[index] - center) / scale;
        }
        return output;
      }
      function lowPass1(signal, sampleRateHz, cutoffHz) {
        const input = toFloat64Array(signal);
        if (!input.length || !(sampleRateHz > 0) || !(cutoffHz > 0)) return input;
        const dt = 1 / sampleRateHz;
        const rc = 1 / (2 * Math.PI * cutoffHz);
        const alpha = dt / (rc + dt);
        const output = new Float64Array(input.length);
        output[0] = input[0];
        for (let index = 1; index < input.length; index++) {
          output[index] = output[index - 1] + alpha * (input[index] - output[index - 1]);
        }
        return output;
      }
      function highPass1(signal, sampleRateHz, cutoffHz) {
        const input = toFloat64Array(signal);
        if (!input.length || !(sampleRateHz > 0) || !(cutoffHz > 0)) return input;
        const dt = 1 / sampleRateHz;
        const rc = 1 / (2 * Math.PI * cutoffHz);
        const alpha = rc / (rc + dt);
        const output = new Float64Array(input.length);
        for (let index = 1; index < input.length; index++) {
          output[index] = alpha * (output[index - 1] + input[index] - input[index - 1]);
        }
        return output;
      }
      function bandpass(signal, sampleRateHz, lowCutHz, highCutHz) {
        let output = toFloat64Array(signal);
        const low = Math.min(lowCutHz, highCutHz);
        const high = Math.max(lowCutHz, highCutHz);
        if (!output.length || !(sampleRateHz > 0) || !(low > 0) || !(high > low)) return output;
        output = highPass1(output, sampleRateHz, low);
        output = highPass1(output, sampleRateHz, low);
        output = lowPass1(output, sampleRateHz, high);
        return lowPass1(output, sampleRateHz, high);
      }
      function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
      }
      module.exports = { removeDC, zscore, bandpass, clamp };
    }
  });

  // src/signal/AxisDifferential.js
  var require_AxisDifferential = __commonJS({
    "src/signal/AxisDifferential.js"(exports, module) {
      "use strict";
      function differentialMagnitude3D(x, y, z, sampleRateHz) {
        const n = Math.min(x?.length || 0, y?.length || 0, z?.length || 0);
        const out = new Float64Array(n);
        if (n === 0 || !(sampleRateHz > 0)) return out;
        out[0] = 0;
        for (let i = 1; i < n; i++) {
          const x0 = Number.isFinite(x[i - 1]) ? x[i - 1] : 0;
          const y0 = Number.isFinite(y[i - 1]) ? y[i - 1] : 0;
          const z0 = Number.isFinite(z[i - 1]) ? z[i - 1] : 0;
          const x1 = Number.isFinite(x[i]) ? x[i] : 0;
          const y1 = Number.isFinite(y[i]) ? y[i] : 0;
          const z1 = Number.isFinite(z[i]) ? z[i] : 0;
          const dxdt = (x1 - x0) * sampleRateHz;
          const dydt = (y1 - y0) * sampleRateHz;
          const dzdt = (z1 - z0) * sampleRateHz;
          out[i] = Math.sqrt(dxdt * dxdt + dydt * dydt + dzdt * dzdt);
        }
        return out;
      }
      function differentialAxis(signal, sampleRateHz) {
        const source = new Float64Array(Array.from(signal || []));
        const out = new Float64Array(source.length);
        if (source.length === 0 || !(sampleRateHz > 0)) return out;
        for (let i = 1; i < source.length; i++) {
          const previous = Number.isFinite(source[i - 1]) ? source[i - 1] : 0;
          const current = Number.isFinite(source[i]) ? source[i] : 0;
          out[i] = (current - previous) * sampleRateHz;
        }
        return out;
      }
      module.exports = { differentialMagnitude3D, differentialAxis };
    }
  });

  // src/baseline/ProxySignalBuilder.js
  var require_ProxySignalBuilder = __commonJS({
    "src/baseline/ProxySignalBuilder.js"(exports, module) {
      "use strict";
      var baseConfig = require_config();
      var { bandpass, removeDC, zscore } = require_SignalFilters();
      var {
        differentialMagnitude3D,
        differentialAxis
      } = require_AxisDifferential();
      function buildRespAndHeartProxies(linAx, linAy, linAz, fs, cfg = {}) {
        const config = Object.assign({}, baseConfig, cfg);
        const respBand = Array.isArray(cfg.respProxyBand) ? cfg.respProxyBand : config.respProxyBand || [0.1, 0.5];
        const heartBand = Array.isArray(cfg.heartProxyBand) ? cfg.heartProxyBand : config.heartProxyBand || [1, 4];
        const x = new Float64Array(Array.from(linAx || []));
        const y = new Float64Array(Array.from(linAy || []));
        const z = new Float64Array(Array.from(linAz || []));
        const n = Math.min(x.length, y.length, z.length);
        if (!(fs > 0) || n < 4) {
          const zero = new Float64Array(n);
          return {
            s_resp: zero,
            s_heart: zero,
            diagnostic_heart_axes: { x: zero, y: zero, z: zero },
            s_sum: zero,
            meta: {
              method: "axis_differential_magnitude",
              resp: { band: respBand },
              heart: { band: heartBand }
            }
          };
        }
        const ax = x.subarray(0, n);
        const ay = y.subarray(0, n);
        const az = z.subarray(0, n);
        const axResp = bandpass(ax, fs, respBand[0], respBand[1]);
        const ayResp = bandpass(ay, fs, respBand[0], respBand[1]);
        const azResp = bandpass(az, fs, respBand[0], respBand[1]);
        let sResp = differentialMagnitude3D(axResp, ayResp, azResp, fs);
        const axHeart = bandpass(ax, fs, heartBand[0], heartBand[1]);
        const ayHeart = bandpass(ay, fs, heartBand[0], heartBand[1]);
        const azHeart = bandpass(az, fs, heartBand[0], heartBand[1]);
        let sHeart = differentialMagnitude3D(axHeart, ayHeart, azHeart, fs);
        let diagnosticHeartX = differentialAxis(axHeart, fs);
        let diagnosticHeartY = differentialAxis(ayHeart, fs);
        let diagnosticHeartZ = differentialAxis(azHeart, fs);
        if (cfg.normalize === true) {
          sResp = zscore(sResp);
          sHeart = zscore(sHeart);
          diagnosticHeartX = zscore(diagnosticHeartX);
          diagnosticHeartY = zscore(diagnosticHeartY);
          diagnosticHeartZ = zscore(diagnosticHeartZ);
        }
        return {
          s_resp: sResp,
          s_heart: sHeart,
          diagnostic_heart_axes: {
            x: diagnosticHeartX,
            y: diagnosticHeartY,
            z: diagnosticHeartZ
          },
          s_sum: differentialMagnitude3D(ax, ay, az, fs),
          meta: {
            method: "axis_differential_magnitude",
            formula: "sqrt((dx/dt)^2 + (dy/dt)^2 + (dz/dt)^2)",
            resp: { band: respBand },
            heart: { band: heartBand }
          }
        };
      }
      function buildGyroMotionProxy(gx, gy, gz, fs, cfg = {}) {
        const config = Object.assign({}, baseConfig, cfg);
        const band = Array.isArray(cfg.heartProxyBand) ? cfg.heartProxyBand : config.heartProxyBand || [1, 4];
        const x = new Float64Array(Array.from(gx || []));
        const y = new Float64Array(Array.from(gy || []));
        const z = new Float64Array(Array.from(gz || []));
        const n = Math.min(x.length, y.length, z.length);
        if (!(fs > 0) || n < 4) {
          return {
            signal: new Float64Array(n),
            meta: { method: "gyro_bandpassed_magnitude", band }
          };
        }
        const fx = bandpass(x.subarray(0, n), fs, band[0], band[1]);
        const fy = bandpass(y.subarray(0, n), fs, band[0], band[1]);
        const fz = bandpass(z.subarray(0, n), fs, band[0], band[1]);
        const magnitude = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          magnitude[i] = Math.hypot(fx[i], fy[i], fz[i]);
        }
        return {
          signal: removeDC(magnitude),
          meta: {
            method: "gyro_bandpassed_magnitude",
            formula: "removeDC(sqrt(gx_band^2 + gy_band^2 + gz_band^2))",
            band
          }
        };
      }
      module.exports = { buildRespAndHeartProxies, buildGyroMotionProxy };
    }
  });

  // src/signal/FFT.js
  var require_FFT = __commonJS({
    "src/signal/FFT.js"(exports, module) {
      "use strict";
      function nextPow2(value) {
        let n = Math.max(1, Math.ceil(Number(value) || 1));
        let p = 1;
        while (p < n) p <<= 1;
        return p;
      }
      function fftComplex(re, im) {
        const n = re.length;
        if (n !== im.length || (n & n - 1) !== 0) {
          throw new Error("FFT length must be a power of two");
        }
        let j = 0;
        for (let i = 1; i < n; i++) {
          let bit = n >> 1;
          while (j & bit) {
            j ^= bit;
            bit >>= 1;
          }
          j ^= bit;
          if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
          }
        }
        for (let len = 2; len <= n; len <<= 1) {
          const angle = -2 * Math.PI / len;
          const wLenRe = Math.cos(angle);
          const wLenIm = Math.sin(angle);
          for (let start = 0; start < n; start += len) {
            let wRe = 1;
            let wIm = 0;
            const half = len >> 1;
            for (let offset = 0; offset < half; offset++) {
              const even = start + offset;
              const odd = even + half;
              const oddRe = re[odd] * wRe - im[odd] * wIm;
              const oddIm = re[odd] * wIm + im[odd] * wRe;
              const evenRe = re[even];
              const evenIm = im[even];
              re[even] = evenRe + oddRe;
              im[even] = evenIm + oddIm;
              re[odd] = evenRe - oddRe;
              im[odd] = evenIm - oddIm;
              const nextWRe = wRe * wLenRe - wIm * wLenIm;
              wIm = wRe * wLenIm + wIm * wLenRe;
              wRe = nextWRe;
            }
          }
        }
      }
      function periodogramPSD(signal, sampleRateHz, options = {}) {
        const source = new Float64Array(Array.from(signal || []));
        const n = source.length;
        if (!(sampleRateHz > 0) || n < 2) {
          return {
            psd: new Float64Array(0),
            freqs: new Float64Array(0),
            fftLength: 0,
            sampleCount: n,
            frequencyResolutionHz: NaN,
            physicalResolutionHz: NaN
          };
        }
        const useHann = options.window !== "none";
        const fftLength = options.fftLength ? nextPow2(Math.max(n, options.fftLength)) : nextPow2(n);
        const re = new Float64Array(fftLength);
        const im = new Float64Array(fftLength);
        let windowEnergy = 0;
        for (let i = 0; i < n; i++) {
          const weight = useHann && n > 1 ? 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1))) : 1;
          const value = Number.isFinite(source[i]) ? source[i] : 0;
          re[i] = value * weight;
          windowEnergy += weight * weight;
        }
        fftComplex(re, im);
        const bins = fftLength >> 1;
        const psd = new Float64Array(bins);
        const freqs = new Float64Array(bins);
        const scale = sampleRateHz * Math.max(windowEnergy, 1e-12);
        const df = sampleRateHz / fftLength;
        for (let i = 0; i < bins; i++) {
          const oneSided = i === 0 ? 1 : 2;
          psd[i] = oneSided * (re[i] * re[i] + im[i] * im[i]) / scale;
          freqs[i] = i * df;
        }
        return {
          psd,
          freqs,
          fftLength,
          sampleCount: n,
          frequencyResolutionHz: df,
          physicalResolutionHz: sampleRateHz / n
        };
      }
      function magnitudeSquaredCoherence(signalA, signalB, sampleRateHz, options = {}) {
        const a = new Float64Array(Array.from(signalA || []));
        const b = new Float64Array(Array.from(signalB || []));
        const n = Math.min(a.length, b.length);
        const requested = Math.round((options.segmentSec || 5) * sampleRateHz);
        const segmentLength = Math.min(n, Math.max(8, requested));
        const overlap = Math.min(0.9, Math.max(0, options.overlap ?? 0.5));
        const step = Math.max(1, Math.round(segmentLength * (1 - overlap)));
        const fftLength = nextPow2(segmentLength);
        const bins = fftLength >> 1;
        const sxx = new Float64Array(bins);
        const syy = new Float64Array(bins);
        const sxyRe = new Float64Array(bins);
        const sxyIm = new Float64Array(bins);
        let segmentCount = 0;
        if (!(sampleRateHz > 0) || segmentLength < 8 || n < segmentLength) {
          return {
            coherence: new Float64Array(0),
            freqs: new Float64Array(0),
            segmentCount: 0,
            segmentLength,
            fftLength: 0
          };
        }
        for (let start = 0; start + segmentLength <= n; start += step) {
          const ar = new Float64Array(fftLength);
          const ai = new Float64Array(fftLength);
          const br = new Float64Array(fftLength);
          const bi = new Float64Array(fftLength);
          for (let i = 0; i < segmentLength; i++) {
            const weight = segmentLength > 1 ? 0.5 * (1 - Math.cos(2 * Math.PI * i / (segmentLength - 1))) : 1;
            ar[i] = (Number.isFinite(a[start + i]) ? a[start + i] : 0) * weight;
            br[i] = (Number.isFinite(b[start + i]) ? b[start + i] : 0) * weight;
          }
          fftComplex(ar, ai);
          fftComplex(br, bi);
          for (let k = 0; k < bins; k++) {
            sxx[k] += ar[k] * ar[k] + ai[k] * ai[k];
            syy[k] += br[k] * br[k] + bi[k] * bi[k];
            sxyRe[k] += ar[k] * br[k] + ai[k] * bi[k];
            sxyIm[k] += ai[k] * br[k] - ar[k] * bi[k];
          }
          segmentCount++;
        }
        const coherence = new Float64Array(bins);
        const freqs = new Float64Array(bins);
        const df = sampleRateHz / fftLength;
        for (let k = 0; k < bins; k++) {
          const numerator = sxyRe[k] * sxyRe[k] + sxyIm[k] * sxyIm[k];
          const denominator = sxx[k] * syy[k];
          coherence[k] = denominator > 1e-24 ? Math.min(1, Math.max(0, numerator / denominator)) : 0;
          freqs[k] = k * df;
        }
        return { coherence, freqs, segmentCount, segmentLength, fftLength };
      }
      module.exports = {
        nextPow2,
        periodogramPSD,
        magnitudeSquaredCoherence
      };
    }
  });

  // src/baseline/CandidateScoring.js
  var require_CandidateScoring = __commonJS({
    "src/baseline/CandidateScoring.js"(exports, module) {
      "use strict";
      var { clamp } = require_SignalFilters();
      function relativePercentile(values, value) {
        const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (finite.length <= 1) return 0.5;
        let below = 0;
        let equal = 0;
        for (const item of finite) {
          if (item < value - 1e-12) below++;
          else if (Math.abs(item - value) <= 1e-12) equal++;
        }
        return clamp((below + 0.5 * Math.max(0, equal - 1)) / (finite.length - 1), 0, 1);
      }
      function annotateRelativeCandidateEvidence(clusters) {
        const fields = [
          ["intervalScore", "relativeIntervalScore"],
          ["crossAxisHeartEvidence", "relativeCrossAxisScore"],
          ["autocorrelationScore", "relativeAutocorrelationScore"]
        ];
        for (const [source, target] of fields) {
          const values = clusters.map((cluster) => cluster[source] || 0);
          for (const cluster of clusters) {
            cluster[target] = relativePercentile(values, cluster[source] || 0);
          }
        }
        for (const cluster of clusters) {
          cluster.relativeHeartbeatScore = clamp(
            0.45 * cluster.relativeIntervalScore + 0.3 * cluster.relativeCrossAxisScore + 0.25 * cluster.relativeAutocorrelationScore,
            0,
            1
          );
        }
      }
      function computeObservationScores(clusters, config) {
        annotateRelativeCandidateEvidence(clusters);
        const bestValidatedBaseScore = clusters.reduce(
          (best, cluster) => Math.max(
            best,
            clamp(0.7 * cluster.score + 0.3 * cluster.spectralScore, 0, 1)
          ),
          0
        );
        for (const cluster of clusters) {
          if (config.hrDataDrivenScoringEnabled === true && config.hrDataDrivenScoringActive === true) {
            const intervalEvidence = clamp(
              (cluster.intervalScore || 0) / Math.max(config.hrObservationIntervalScale, config.epsilon),
              0,
              1
            );
            const crossAxisEvidence = clamp(
              (cluster.crossAxisHeartEvidence || 0) / Math.max(config.hrObservationCrossAxisScale, config.epsilon),
              0,
              1
            );
            const autocorrelationEvidence = clamp(
              (cluster.autocorrelationScore || 0) / Math.max(config.hrObservationAutocorrelationScale, config.epsilon),
              0,
              1
            );
            cluster.dataDrivenObservationScore = clamp(
              config.hrObservationSupportWeight * cluster.supportScore + config.hrObservationSpectralWeight * cluster.spectralScore + config.hrObservationIntervalWeight * intervalEvidence + config.hrObservationCrossAxisWeight * crossAxisEvidence + config.hrObservationAutocorrelationWeight * autocorrelationEvidence + config.hrObservationContinuityWeight * cluster.continuityScore,
              0,
              1
            );
            const validatedBaseScore = clamp(
              0.7 * cluster.score + 0.3 * cluster.spectralScore,
              0,
              1
            );
            const dataBlendWeight = clamp(
              config.hrObservationDataBlendWeight,
              0,
              1
            );
            const isCompetitive = bestValidatedBaseScore - validatedBaseScore <= config.hrDataDrivenTieMargin;
            cluster.preArtifactObservationScore = clamp(
              isCompetitive ? (1 - dataBlendWeight) * validatedBaseScore + dataBlendWeight * cluster.dataDrivenObservationScore : validatedBaseScore,
              0,
              1
            );
          } else {
            cluster.preArtifactObservationScore = clamp(
              0.7 * cluster.score + 0.3 * cluster.spectralScore,
              0,
              1
            );
          }
          cluster.artifactPenalty = clamp(
            config.impactWindowPenaltyWeight * (cluster.contaminationRatio || 0),
            0,
            0.8
          );
          cluster.observationScore = clamp(
            cluster.preArtifactObservationScore * (1 - cluster.artifactPenalty),
            0,
            1
          );
        }
      }
      module.exports = {
        relativePercentile,
        annotateRelativeCandidateEvidence,
        computeObservationScores
      };
    }
  });

  // src/baseline/CandidateBeam.js
  var require_CandidateBeam = __commonJS({
    "src/baseline/CandidateBeam.js"(exports, module) {
      "use strict";
      var { clamp } = require_SignalFilters();
      function empiricalPlausibility(value, limits) {
        if (!Number.isFinite(value) || !limits) return 0;
        const p95 = Math.max(0, limits.p95 || 0);
        const p99 = Math.max(p95 + 1e-9, limits.p99 || p95 + 1);
        if (value <= p95) return 1;
        if (value >= p99) return 0;
        return 1 - (value - p95) / (p99 - p95);
      }
      function updateCandidateBeam(clusters, previousBeam, config) {
        if (clusters.length === 0) {
          return { selected: null, beam: [], mode: "no_candidate" };
        }
        const next = [];
        for (const cluster of clusters) {
          const predecessors = previousBeam.filter(
            (track) => Math.abs(track.hrBpm - cluster.hrBpm) <= config.hrTrackMaxMatchBpm
          );
          let best = null;
          for (const predecessor of predecessors) {
            const jump = Math.abs(predecessor.hrBpm - cluster.hrBpm);
            const transitionPenalty = config.hrTrackTransitionPenalty * clamp(jump / config.hrTrackTransitionScaleBpm, 0, 1);
            const physiologicTransitionPenalty = config.hrDataDrivenScoringActive === true ? config.hrPhysiologyTransitionPenaltyWeight * (1 - empiricalPlausibility(
              jump,
              config.hrPhysiologyDeltaLimits?.[1]
            )) : 0;
            const memory = (cluster.contaminationRatio || 0) >= config.impactHighContaminationRatio ? Math.min(config.hrTrackMemory, 0.45) : config.hrTrackMemory;
            const cumulative = memory * predecessor.cumulativeScore + cluster.observationScore - transitionPenalty - physiologicTransitionPenalty;
            if (!best || cumulative > best.cumulativeScore) {
              best = {
                cumulativeScore: cumulative,
                ageSec: predecessor.ageSec + config.stepSec,
                stableHr: 0.95 * predecessor.stableHr + 0.05 * cluster.hrBpm
              };
            }
          }
          if (!best) {
            const nearestPreviousDistance = previousBeam.length > 0 ? Math.min(...previousBeam.map((track) => Math.abs(track.hrBpm - cluster.hrBpm))) : 0;
            const newTrackPenalty = config.hrDataDrivenScoringActive === true && previousBeam.length > 0 ? config.hrPhysiologyNewTrackPenaltyWeight * (1 - empiricalPlausibility(
              nearestPreviousDistance,
              config.hrPhysiologyDeltaLimits?.[1]
            )) : 0;
            best = {
              cumulativeScore: cluster.observationScore - newTrackPenalty,
              ageSec: config.stepSec,
              stableHr: cluster.hrBpm
            };
          }
          next.push({ ...best, hrBpm: cluster.hrBpm, cluster });
        }
        next.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
        const beam = next.slice(0, config.hrTrackBeamWidth);
        const selectedTrack = beam[0];
        const previousPrimary = previousBeam[0];
        const mode = !previousPrimary ? "beam_initialize" : Math.abs(previousPrimary.hrBpm - selectedTrack.hrBpm) > config.hrTrackMaxMatchBpm ? "beam_reacquire" : "beam_tracking";
        return { selected: selectedTrack.cluster, beam, mode };
      }
      module.exports = { updateCandidateBeam };
    }
  });

  // src/baseline/SixtySecondTrackSelector.js
  var require_SixtySecondTrackSelector = __commonJS({
    "src/baseline/SixtySecondTrackSelector.js"(exports, module) {
      "use strict";
      var { clamp } = require_SignalFilters();
      function createSixtySecondTrackState(config) {
        return {
          activeTrackId: 0,
          activeHr: NaN,
          activeVelocity: 0,
          heldCluster: null,
          missingSec: 0,
          nextDecisionSec: config.hrCheckpointTrackInitializationSec || 30,
          remoteTrackId: 0,
          remoteCheckpointCount: 0,
          lastDecision: "waiting_for_mature_track"
        };
      }
      function trackScore(cluster) {
        const longSupport = cluster.supportWindows?.includes(20) && cluster.supportWindows?.includes(30) ? 1 : 0;
        const trendShape = 0.5 * (cluster.physiologicSlopeScore || 0) + 0.5 * (cluster.physiologicResidualScore || 0);
        return clamp(
          0.2 * (cluster.physiologicRecent15Coverage || 0) + 0.2 * longSupport + 0.15 * (cluster.spectralScore || 0) + 0.2 * (cluster.physiologicDeltaScore || 0) + 0.15 * trendShape + 0.1 * (cluster.relativeHeartbeatScore || 0),
          0,
          1
        );
      }
      function isMatureTrack(cluster, config) {
        const requiredWindows = config.hrMatureTrackTakeoverRequiredWindows || [20, 30];
        return cluster && cluster.physiologicTrendStable === true && (cluster.physiologicTrendSpanSec || 0) >= (config.hrMatureTrackTakeoverSpanSec || 60) && (cluster.physiologicTrendCoverage || 0) >= (config.hrMatureTrackTakeoverMinimumCoverage || 0.95) && (cluster.physiologicRecent15Coverage || 0) >= (config.hrCheckpointTrackCurrentMinimumCoverage15 || 0.6) && (cluster.physiologicTrendMaximumStep || 0) <= (config.hrMatureTrackMaximumStepBpm || 6) && requiredWindows.every((windowSec) => cluster.supportWindows?.includes(windowSec));
      }
      function selectSixtySecondTrack(clusters, timeSec, state, config) {
        if (config.hrCheckpointTrackLockEnabled !== true) {
          return { selected: null, valid: false, reason: "disabled" };
        }
        const decisionSec = config.hrCheckpointTrackDecisionSec || 15;
        const mature = clusters.filter((cluster) => isMatureTrack(cluster, config)).sort((left, right) => trackScore(right) - trackScore(left) || (right.observationScore || 0) - (left.observationScore || 0));
        let current = mature.find((cluster) => cluster.physiologicTrackId === state.activeTrackId) || null;
        if (!current && state.activeTrackId && state.missingSec < (config.hrCheckpointTrackShortHoldSec || 2)) {
          const predicted = state.activeHr + state.activeVelocity * (config.stepSec || 1);
          current = mature.filter((cluster) => Math.abs(cluster.hrBpm - predicted) <= (config.hrCheckpointTrackRelinkBpm || 6)).sort((left, right) => Math.abs(left.hrBpm - predicted) - Math.abs(right.hrBpm - predicted))[0] || null;
          if (current) state.activeTrackId = current.physiologicTrackId || state.activeTrackId;
        }
        if (!state.activeTrackId && mature.length > 0) {
          current = mature[0];
          state.activeTrackId = current.physiologicTrackId || 0;
          state.activeHr = current.hrBpm;
          state.activeVelocity = current.physiologicTrendVelocity || 0;
          state.heldCluster = current;
          state.missingSec = 0;
          state.nextDecisionSec = timeSec + decisionSec;
          state.lastDecision = "mature_track_initialized";
        } else if (current) {
          const previousHr = state.activeHr;
          state.activeHr = current.hrBpm;
          state.activeVelocity = Number.isFinite(current.physiologicTrendVelocity) ? current.physiologicTrendVelocity : current.hrBpm - previousHr;
          state.heldCluster = current;
          state.missingSec = 0;
        } else if (state.activeTrackId) {
          state.missingSec += config.stepSec || 1;
        }
        if (timeSec + 1e-9 >= state.nextDecisionSec && state.activeTrackId) {
          const activeScore = current ? trackScore(current) : trackScore(state.heldCluster || {});
          const anchorHr = Number.isFinite(state.activeHr) ? state.activeHr : state.heldCluster?.hrBpm;
          const challenger = mature.find((cluster) => cluster.physiologicTrackId !== state.activeTrackId) || null;
          if (challenger) {
            const distance = Math.abs(challenger.hrBpm - anchorHr);
            const advantage = trackScore(challenger) - activeScore;
            const activeInvalid = !current || state.missingSec >= (config.hrCheckpointTrackCurrentMissingSec || 5);
            const local = distance <= (config.hrCheckpointTrackLocalSwitchBpm || 10);
            if (activeInvalid && local && advantage >= (config.hrCheckpointTrackLocalScoreAdvantage || 0.05)) {
              state.activeTrackId = challenger.physiologicTrackId || 0;
              state.activeHr = challenger.hrBpm;
              state.activeVelocity = challenger.physiologicTrendVelocity || 0;
              state.heldCluster = challenger;
              state.missingSec = 0;
              state.remoteTrackId = 0;
              state.remoteCheckpointCount = 0;
              current = challenger;
              state.lastDecision = "local_mature_track_switched";
            } else if (activeInvalid && distance > (config.hrCheckpointTrackRemoteSwitchBpm || 15) && advantage >= (config.hrCheckpointTrackRemoteScoreAdvantage || 0.1)) {
              const sameRemote = state.remoteTrackId === challenger.physiologicTrackId;
              state.remoteTrackId = challenger.physiologicTrackId || 0;
              state.remoteCheckpointCount = sameRemote ? state.remoteCheckpointCount + 1 : 1;
              state.lastDecision = "remote_mature_track_pending";
              if (state.remoteCheckpointCount >= (config.hrCheckpointTrackRemoteRequiredCheckpoints || 2)) {
                state.activeTrackId = challenger.physiologicTrackId || 0;
                state.activeHr = challenger.hrBpm;
                state.activeVelocity = challenger.physiologicTrendVelocity || 0;
                state.heldCluster = challenger;
                state.missingSec = 0;
                state.remoteTrackId = 0;
                state.remoteCheckpointCount = 0;
                current = challenger;
                state.lastDecision = "remote_mature_track_switched";
              }
            } else {
              state.remoteTrackId = 0;
              state.remoteCheckpointCount = 0;
              state.lastDecision = current ? "current_mature_track_retained" : "challenger_rejected";
            }
          } else {
            state.remoteTrackId = 0;
            state.remoteCheckpointCount = 0;
            state.lastDecision = current ? "current_mature_track_retained" : "no_mature_challenger";
          }
          do {
            state.nextDecisionSec += decisionSec;
          } while (timeSec + 1e-9 >= state.nextDecisionSec);
        }
        if (current && isMatureTrack(current, config)) {
          return { selected: current, valid: true, reason: state.lastDecision };
        }
        const shortHoldSec = config.hrCheckpointTrackShortHoldSec || 2;
        if (state.heldCluster && state.missingSec > 0 && state.missingSec < shortHoldSec) {
          return {
            selected: {
              ...state.heldCluster,
              hrBpm: state.activeHr,
              frequencyHz: state.activeHr / 60,
              heldBySixtySecondTrack: true
            },
            valid: true,
            reason: "short_track_hold"
          };
        }
        return {
          selected: null,
          valid: false,
          reason: state.activeTrackId ? "mature_track_missing" : "no_mature_track"
        };
      }
      module.exports = {
        createSixtySecondTrackState,
        selectSixtySecondTrack,
        trackScore,
        isMatureTrack
      };
    }
  });

  // src/baseline/SelectionArbiter.js
  var require_SelectionArbiter = __commonJS({
    "src/baseline/SelectionArbiter.js"(exports, module) {
      "use strict";
      function createSelectionArbiterState() {
        return {
          mode: "original_score",
          trackValidSec: 0,
          trackInvalidSec: 0,
          lastReason: "initializing"
        };
      }
      function candidateScore(candidate) {
        return candidate?.score ?? candidate?.observationScore ?? 0;
      }
      function arbitrateSelection(rawSelection, trackResult, state, config) {
        const stepSec = config.stepSec || 1;
        const haveComparison = Boolean(rawSelection && trackResult.selected);
        const distanceBpm = haveComparison ? Math.abs(trackResult.selected.hrBpm - rawSelection.hrBpm) : 0;
        const trackScore = candidateScore(trackResult.selected);
        const rawScore = candidateScore(rawSelection);
        const evidenceRatio = haveComparison ? trackScore / Math.max(rawScore, 1e-3) : 1;
        const gateStartBpm = config.hrMatureTakeoverEvidenceGateStartBpm ?? 15;
        const requiredEvidenceRatio = Math.min(
          config.hrMatureTakeoverMaximumRatio ?? 0.95,
          (config.hrMatureTakeoverBaseRatio ?? 0.6) + (config.hrMatureTakeoverRatioPerBpm ?? 4e-3) * distanceBpm
        );
        const evidenceGatePassed = config.hrMatureTakeoverEvidenceGateEnabled !== true || !haveComparison || distanceBpm <= gateStartBpm || evidenceRatio >= requiredEvidenceRatio;
        const takeoverEligible = Boolean(
          trackResult.valid && trackResult.selected && evidenceGatePassed
        );
        if (takeoverEligible) {
          state.trackValidSec += stepSec;
          state.trackInvalidSec = 0;
        } else {
          state.trackInvalidSec += stepSec;
          state.trackValidSec = 0;
        }
        const baseEnterSec = config.hrMatureTakeoverConfirmBaseSec ?? config.hrSixtySecondTrackEnterConfirmSec ?? 5;
        const extraDistance = Math.max(0, distanceBpm - gateStartBpm);
        const confirmStepBpm = Math.max(
          1,
          config.hrMatureTakeoverConfirmStepBpm ?? 20
        );
        const enterSec = Math.min(
          config.hrMatureTakeoverMaximumConfirmSec ?? 15,
          baseEnterSec + Math.ceil(extraDistance / confirmStepBpm) * (config.hrMatureTakeoverConfirmStepSec ?? 2)
        );
        const exitSec = config.hrSixtySecondTrackExitConfirmSec ?? 2;
        if (state.mode !== "sixty_second_track" && state.trackValidSec >= enterSec) {
          state.mode = "sixty_second_track";
          state.lastReason = "mature_track_confirmed";
        }
        if (state.mode === "sixty_second_track" && state.trackInvalidSec >= exitSec) {
          state.mode = "original_score";
          state.lastReason = "mature_track_invalid";
        }
        if (state.mode === "sixty_second_track" && takeoverEligible) {
          return {
            selected: trackResult.selected,
            mode: "sixty_second_track",
            reason: trackResult.reason,
            distanceBpm,
            evidenceRatio,
            requiredEvidenceRatio,
            requiredConfirmSec: enterSec,
            evidenceGatePassed
          };
        }
        return {
          selected: rawSelection || null,
          mode: "original_score_fallback",
          reason: !evidenceGatePassed ? "mature_takeover_insufficient_distance_evidence" : trackResult.reason || state.lastReason,
          distanceBpm,
          evidenceRatio,
          requiredEvidenceRatio,
          requiredConfirmSec: enterSec,
          evidenceGatePassed
        };
      }
      module.exports = { createSelectionArbiterState, arbitrateSelection };
    }
  });

  // src/baseline/RawBeamTransitionGuard.js
  var require_RawBeamTransitionGuard = __commonJS({
    "src/baseline/RawBeamTransitionGuard.js"(exports, module) {
      "use strict";
      var { clamp } = require_SignalFilters();
      function createRawBeamTransitionGuardState() {
        return {
          remoteCandidateHr: NaN,
          remoteStartHr: NaN,
          remoteDurationSec: 0,
          holdDurationSec: 0,
          lastMode: "initializing"
        };
      }
      function median(values) {
        const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (finite.length === 0) return 0;
        const middle = Math.floor(finite.length / 2);
        return finite.length % 2 ? finite[middle] : 0.5 * (finite[middle - 1] + finite[middle]);
      }
      function trendPrediction(history, timeSec) {
        if (history.length === 0) return NaN;
        if (history.length === 1) return history[0].hrBpm;
        const slopes = [];
        for (let index = 1; index < history.length; index++) {
          const dt = history[index].timeSec - history[index - 1].timeSec;
          if (dt > 0) slopes.push(
            (history[index].hrBpm - history[index - 1].hrBpm) / dt
          );
        }
        const last = history[history.length - 1];
        const slope = clamp(median(slopes.slice(-5)), -3, 3);
        return last.hrBpm + slope * Math.max(0, timeSec - last.timeSec);
      }
      function candidateScore(candidate) {
        return candidate?.observationScore ?? candidate?.score ?? 0;
      }
      function historicalValue(history, timeSec, lookbackSec) {
        const target = timeSec - lookbackSec;
        let result = null;
        for (const item of history) {
          if (item.timeSec <= target + 1e-9) result = item;
          else break;
        }
        return result;
      }
      function passesReliableChangeLimits(candidate, timeSec, history, config) {
        const fiveSecond = historicalValue(history, timeSec, 5);
        const fifteenSecond = historicalValue(history, timeSec, 15);
        if (fiveSecond && Math.abs(candidate.hrBpm - fiveSecond.hrBpm) > (config.hrRawBeamRemoteMaximumFiveSecondChangeBpm || 16)) return false;
        if (fifteenSecond && Math.abs(candidate.hrBpm - fifteenSecond.hrBpm) > (config.hrRawBeamMaximumFifteenSecondChangeBpm || 21)) return false;
        return true;
      }
      function resetRemote(state) {
        state.remoteCandidateHr = NaN;
        state.remoteStartHr = NaN;
        state.remoteDurationSec = 0;
        state.holdDurationSec = 0;
      }
      function acceptSelection(candidate, state, mode) {
        const accepted = { ...candidate };
        state.lastMode = mode;
        resetRemote(state);
        return { selected: accepted, mode, acceptedRemote: mode === "remote_confirmed" };
      }
      function holdTrend(timeSec, state, authoritativeState, config, reason) {
        if (!authoritativeState.lastCandidate) {
          return { selected: null, mode: "no_reliable_history", reason };
        }
        const lastHr = authoritativeState.lastHr;
        const predicted = reason === "remote_unconfirmed_hold" ? lastHr : trendPrediction(authoritativeState.history, timeSec);
        const maximumDrift = config.hrRawBeamHoldMaximumDriftBpm || 6;
        const heldHr = clamp(
          Number.isFinite(predicted) ? predicted : lastHr,
          lastHr - maximumDrift,
          lastHr + maximumDrift
        );
        return {
          selected: {
            ...authoritativeState.lastCandidate,
            hrBpm: heldHr,
            frequencyHz: heldHr / 60,
            heldByRawBeamTransitionGuard: true
          },
          mode: "trend_hold",
          reason
        };
      }
      function guardRawBeamSelection(proposed, clusters, timeSec, state, authoritativeState, config) {
        if (config.hrRawBeamTransitionGuardEnabled !== true || !proposed) {
          if (proposed) return acceptSelection(proposed, state, "guard_disabled");
          return { selected: proposed || null, mode: "no_candidate" };
        }
        const reliableHistory = authoritativeState.history;
        if (!authoritativeState.lastCandidate || reliableHistory.length === 0) {
          return acceptSelection(proposed, state, "awaiting_authoritative_history");
        }
        const trendHr = trendPrediction(reliableHistory, timeSec);
        const remoteThreshold = config.hrRawBeamRemoteDeviationBpm || 15;
        if ((!Number.isFinite(trendHr) || Math.abs(proposed.hrBpm - trendHr) <= remoteThreshold) && passesReliableChangeLimits(
          proposed,
          timeSec,
          reliableHistory,
          config
        )) {
          return acceptSelection(proposed, state, "normal");
        }
        const previousReliableHr = authoritativeState.lastHr;
        const nearbyBpm = config.hrRawBeamNearbyCandidateBpm || 10;
        const nearby = clusters.filter(
          (candidate) => Math.abs(candidate.hrBpm - previousReliableHr) <= nearbyBpm && passesReliableChangeLimits(
            candidate,
            timeSec,
            reliableHistory,
            config
          )
        ).sort((left, right) => candidateScore(right) - candidateScore(left))[0] || null;
        if (nearby) {
          return acceptSelection(nearby, state, "nearby_candidate");
        }
        const stepSec = config.stepSec || 1;
        const remoteMatchBpm = config.hrRawBeamRemoteMatchBpm || 6;
        const sameRemote = Number.isFinite(state.remoteCandidateHr) && Math.abs(proposed.hrBpm - state.remoteCandidateHr) <= remoteMatchBpm;
        if (sameRemote) {
          state.remoteDurationSec += stepSec;
        } else {
          state.remoteCandidateHr = proposed.hrBpm;
          state.remoteStartHr = previousReliableHr;
          state.remoteDurationSec = stepSec;
        }
        state.remoteCandidateHr = proposed.hrBpm;
        state.holdDurationSec += stepSec;
        const supportsLongWindows = proposed.supportWindows?.includes(20) && proposed.supportWindows?.includes(30);
        const fiveSecondChange = Math.abs(proposed.hrBpm - state.remoteStartHr);
        const remoteConfirmed = state.remoteDurationSec >= (config.hrRawBeamRemoteConfirmSec || 5) && supportsLongWindows && fiveSecondChange <= (config.hrRawBeamRemoteMaximumFiveSecondChangeBpm || 16);
        if (remoteConfirmed) {
          return acceptSelection(proposed, state, "remote_confirmed");
        }
        const maximumHoldSec = config.hrRawBeamMaximumTrendHoldSec || 5;
        return holdTrend(
          timeSec,
          state,
          authoritativeState,
          config,
          state.holdDurationSec <= maximumHoldSec ? "remote_pending" : "remote_unconfirmed_hold"
        );
      }
      module.exports = {
        createRawBeamTransitionGuardState,
        guardRawBeamSelection,
        trendPrediction
      };
    }
  });

  // src/baseline/AuthoritativeReliableHistory.js
  var require_AuthoritativeReliableHistory = __commonJS({
    "src/baseline/AuthoritativeReliableHistory.js"(exports, module) {
      "use strict";
      function median(values) {
        const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (finite.length === 0) return NaN;
        const middle = Math.floor(finite.length / 2);
        return finite.length % 2 ? finite[middle] : 0.5 * (finite[middle - 1] + finite[middle]);
      }
      function createPendingState() {
        return {
          kind: "none",
          hrBpm: NaN,
          durationSec: 0,
          startHr: NaN,
          values: [],
          evidence: 0,
          hadMultipleWindowSupport: false
        };
      }
      function createAuthoritativeReliableHistoryState() {
        return {
          history: [],
          lastHr: NaN,
          lastCandidate: null,
          lastUpdateSec: NaN,
          updateCount: 0,
          lastDecision: "uninitialized",
          pending: createPendingState()
        };
      }
      function trimHistory(state, timeSec, historySec) {
        while (state.history.length > 1 && timeSec - state.history[0].timeSec > historySec) {
          state.history.shift();
        }
      }
      function resetPending(state) {
        state.pending = createPendingState();
      }
      function hasMultipleWindowSupport(candidate) {
        return (candidate?.supportWindows?.length || 0) >= 2;
      }
      function supportEvidence(candidate) {
        const key = (candidate?.supportWindows || []).slice().sort((a, b) => a - b).join("+");
        return {
          "10": 0.2,
          "20": 0.35,
          "30": 0.55,
          "10+20": 0.45,
          "10+30": 0.6,
          "20+30": 0.72,
          "10+20+30": 1
        }[key] || 0;
      }
      function candidateScore(candidate) {
        return candidate?.observationScore ?? candidate?.score ?? 0;
      }
      function scoreMargin(candidate, candidates) {
        const selectedScore = candidateScore(candidate);
        let competitorScore = -Infinity;
        for (const other of candidates || []) {
          if (!other || Math.abs(other.hrBpm - candidate.hrBpm) <= 3) continue;
          competitorScore = Math.max(competitorScore, candidateScore(other));
        }
        return Number.isFinite(competitorScore) ? selectedScore - competitorScore : selectedScore;
      }
      function historicalAuthority(state, timeSec, lookbackSec) {
        const targetSec = timeSec - lookbackSec;
        let reference = null;
        for (const item of state.history) {
          if (item.timeSec <= targetSec + 1e-9) reference = item;
          else break;
        }
        return reference;
      }
      function updatePending(state, kind, candidate, config) {
        const stepSec = config.stepSec || 1;
        const matchBpm = config.hrAuthorityCandidateMatchBpm || 6;
        const same = state.pending.kind === kind && Number.isFinite(state.pending.hrBpm) && Math.abs(candidate.hrBpm - state.pending.hrBpm) <= matchBpm;
        if (!same) {
          state.pending = {
            kind,
            hrBpm: candidate.hrBpm,
            durationSec: stepSec,
            startHr: candidate.hrBpm,
            values: [candidate.hrBpm],
            evidence: supportEvidence(candidate),
            hadMultipleWindowSupport: hasMultipleWindowSupport(candidate)
          };
        } else {
          state.pending.durationSec += stepSec;
          state.pending.evidence += supportEvidence(candidate);
          state.pending.hadMultipleWindowSupport = state.pending.hadMultipleWindowSupport || hasMultipleWindowSupport(candidate);
          state.pending.values.push(candidate.hrBpm);
          const maximumValues = Math.max(5, Math.ceil(20 / stepSec));
          if (state.pending.values.length > maximumValues) {
            state.pending.values.shift();
          }
          state.pending.hrBpm = median(state.pending.values);
        }
        return state.pending;
      }
      function commitCandidate(candidate, timeSec, state, config, source, decision) {
        const committedHr = median(state.pending.values) || candidate.hrBpm;
        const committed = {
          ...candidate,
          hrBpm: committedHr,
          frequencyHz: committedHr / 60
        };
        state.history.push({ timeSec, hrBpm: committedHr, source });
        trimHistory(
          state,
          timeSec,
          config.hrAuthorityHistorySec || config.hrRawBeamTrendHistorySec || 15
        );
        state.lastHr = median(state.history.map((item) => item.hrBpm));
        state.lastCandidate = {
          ...committed,
          hrBpm: state.lastHr,
          frequencyHz: state.lastHr / 60
        };
        state.lastUpdateSec = timeSec;
        state.updateCount++;
        state.lastDecision = decision;
        resetPending(state);
        return true;
      }
      function updateAuthoritativeReliableHistory(candidate, timeSec, state, config, context = {}) {
        if (!context.qualityAccepted) {
          state.lastDecision = "quality_rejected_preserve_history";
          resetPending(state);
          return false;
        }
        if (!candidate || !Number.isFinite(candidate.hrBpm) || candidate.hrBpm <= 0) {
          state.lastDecision = "no_finite_final_candidate";
          resetPending(state);
          return false;
        }
        if (candidate.heldByRawBeamTransitionGuard === true || candidate.heldBySixtySecondTrack === true) {
          state.lastDecision = "synthetic_hold_not_reliable";
          resetPending(state);
          return false;
        }
        const minimumQuality = config.hrAuthorityMinimumQuality ?? 0.65;
        const singleWindowMinimumQuality = config.hrAuthoritySingleWindowMinimumQuality ?? 0.45;
        const multipleWindow = hasMultipleWindowSupport(candidate);
        const requiredQuality = multipleWindow ? minimumQuality : singleWindowMinimumQuality;
        if ((candidate.quality || 0) < requiredQuality) {
          state.lastDecision = "insufficient_authority_evidence";
          resetPending(state);
          return false;
        }
        const candidates = context.candidates || [];
        const source = context.source || "final_output";
        const margin = scoreMargin(candidate, candidates);
        const stepSec = config.stepSec || 1;
        if (!Number.isFinite(state.lastHr)) {
          if (margin < (config.hrAuthorityInitialMinimumMargin ?? 0.05)) {
            state.lastDecision = "initial_candidate_ambiguous";
            resetPending(state);
            return false;
          }
          const pending2 = updatePending(state, "initial", candidate, config);
          if (!pending2.hadMultipleWindowSupport || pending2.evidence < (config.hrAuthorityInitialEvidenceRequired || 4) || pending2.durationSec < (config.hrAuthorityInitialConfirmSec || 5)) {
            state.lastDecision = "initial_candidate_pending";
            return false;
          }
          return commitCandidate(
            candidate,
            timeSec,
            state,
            config,
            source,
            "initialized_from_confirmed_trajectory"
          );
        }
        const nearbyBpm = config.hrAuthorityNearbyBpm || 10;
        const anchorHr = state.lastHr;
        const distance = Math.abs(candidate.hrBpm - anchorHr);
        if (distance <= nearbyBpm) {
          const fiveSecondAuthority = historicalAuthority(state, timeSec, 5);
          const fifteenSecondAuthority = historicalAuthority(state, timeSec, 15);
          const exceedsFiveSecondDrift = fiveSecondAuthority && Math.abs(candidate.hrBpm - fiveSecondAuthority.hrBpm) > (config.hrAuthorityLocalMaximumFiveSecondDriftBpm || 8);
          const exceedsFifteenSecondDrift = fifteenSecondAuthority && Math.abs(candidate.hrBpm - fifteenSecondAuthority.hrBpm) > (config.hrAuthorityLocalMaximumFifteenSecondDriftBpm || 12);
          if (exceedsFiveSecondDrift || exceedsFifteenSecondDrift) {
            state.lastDecision = "local_drift_limit_exceeded";
            resetPending(state);
            return false;
          }
          const pending2 = updatePending(state, "local", candidate, config);
          if (pending2.evidence < (config.hrAuthorityLocalEvidenceRequired || 4) || pending2.durationSec < (config.hrAuthorityLocalConfirmSec || 5)) {
            state.lastDecision = "local_candidate_pending";
            return false;
          }
          return commitCandidate(
            candidate,
            timeSec,
            state,
            config,
            source,
            "updated_from_confirmed_local_trajectory"
          );
        }
        const nearbyOldCandidate = candidates.some((other) => {
          if (!other || Math.abs(other.hrBpm - anchorHr) > nearbyBpm) return false;
          const otherMultiple = hasMultipleWindowSupport(other);
          const otherMinimumQuality = otherMultiple ? minimumQuality : singleWindowMinimumQuality;
          const singlePersistent = (other.trackConsecutiveSec || 0) >= 3;
          return (other.quality || 0) >= otherMinimumQuality && (otherMultiple || singlePersistent);
        });
        const matureTrackSource = source === "sixty_second_track";
        if (nearbyOldCandidate && !matureTrackSource) {
          state.lastDecision = "remote_rejected_old_anchor_still_observed";
          resetPending(state);
          return false;
        }
        const kind = matureTrackSource ? "mature_remote" : "remote";
        const pending = updatePending(state, kind, candidate, config);
        const confirmSec = matureTrackSource ? config.hrAuthorityMatureTrackConfirmSec || 5 : config.hrAuthorityRemoteConfirmSec || 5;
        const change = Math.abs(candidate.hrBpm - pending.startHr);
        const requiredEvidence = matureTrackSource ? config.hrAuthorityInitialEvidenceRequired || 4 : config.hrAuthorityRemoteEvidenceRequired || 5;
        if (!pending.hadMultipleWindowSupport || pending.evidence < requiredEvidence || pending.durationSec < confirmSec || change > (config.hrAuthorityMaximumFiveSecondChangeBpm || 16)) {
          state.lastDecision = matureTrackSource ? "mature_track_reanchor_pending" : "remote_reanchor_pending";
          return false;
        }
        return commitCandidate(
          candidate,
          timeSec,
          state,
          config,
          source,
          matureTrackSource ? "reanchored_from_mature_sixty_second_track" : "reanchored_after_old_anchor_disappeared"
        );
      }
      function preserveAuthoritativeReliableHistory(state, reason) {
        state.lastDecision = reason || "preserved_without_update";
        resetPending(state);
      }
      module.exports = {
        createAuthoritativeReliableHistoryState,
        updateAuthoritativeReliableHistory,
        preserveAuthoritativeReliableHistory
      };
    }
  });

  // src/baseline/RespiratoryFamilyFilter.js
  var require_RespiratoryFamilyFilter = __commonJS({
    "src/baseline/RespiratoryFamilyFilter.js"(exports, module) {
      "use strict";
      var { removeDC, clamp } = require_SignalFilters();
      var { periodogramPSD } = require_FFT();
      function median(values) {
        const sorted = Array.from(values || []).filter(Number.isFinite).sort((a, b) => a - b);
        if (sorted.length === 0) return 0;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : 0.5 * (sorted[middle - 1] + sorted[middle]);
      }
      function parabolicOffset(left, center, right) {
        const y0 = Math.log(Math.max(left, 1e-18));
        const y1 = Math.log(Math.max(center, 1e-18));
        const y2 = Math.log(Math.max(right, 1e-18));
        const denominator = y0 - 2 * y1 + y2;
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return 0;
        return clamp(0.5 * (y0 - y2) / denominator, -0.5, 0.5);
      }
      function estimateRespiratoryPeak(signal, sampleRateHz, config) {
        const spectrum = periodogramPSD(
          removeDC(signal),
          sampleRateHz,
          { window: "hann" }
        );
        const lowBpm = Math.max(0, config.respiratoryRateBpmRange?.[0] ?? 0);
        const highBpm = Math.min(30, config.respiratoryRateBpmRange?.[1] ?? 30);
        let bestIndex = -1;
        const bandPower = [];
        for (let index = 1; index < spectrum.freqs.length; index++) {
          const bpm = spectrum.freqs[index] * 60;
          if (bpm < lowBpm || bpm > highBpm) continue;
          bandPower.push(spectrum.psd[index]);
          if (bestIndex < 0 || spectrum.psd[index] > spectrum.psd[bestIndex]) {
            bestIndex = index;
          }
        }
        if (bestIndex < 0) {
          return { bpm: 0, quality: 0, frequencyHz: 0, amplitude: 0 };
        }
        const offset = bestIndex > 0 && bestIndex + 1 < spectrum.psd.length ? parabolicOffset(
          spectrum.psd[bestIndex - 1],
          spectrum.psd[bestIndex],
          spectrum.psd[bestIndex + 1]
        ) : 0;
        const frequencyHz = clamp(
          spectrum.freqs[bestIndex] + offset * spectrum.frequencyResolutionHz,
          lowBpm / 60,
          highBpm / 60
        );
        const floor = median(bandPower);
        const amplitude = spectrum.psd[bestIndex];
        return {
          bpm: frequencyHz * 60,
          quality: clamp((amplitude - floor) / Math.max(amplitude, 1e-18), 0, 1),
          frequencyHz,
          amplitude
        };
      }
      function createRespiratoryFamilyState() {
        return {
          candidateBpm: NaN,
          stableBpm: NaN,
          durationSec: 0,
          missingSec: 0
        };
      }
      function updateRespiratoryFamilyState(state, respiratory, stepSec, config) {
        const minimumQuality = config.respiratoryFamilyMinimumQuality ?? 0.55;
        const matchBpm = config.respiratoryFamilyRateMatchBpm ?? 3;
        if (!(respiratory.bpm > 0) || respiratory.quality < minimumQuality) {
          state.candidateBpm = NaN;
          state.durationSec = 0;
          state.missingSec += stepSec;
          if (state.missingSec >= (config.respiratoryFamilyMaximumMissingSec ?? 10)) {
            state.stableBpm = NaN;
          }
          return state;
        }
        state.missingSec = 0;
        if (Number.isFinite(state.candidateBpm) && Math.abs(respiratory.bpm - state.candidateBpm) <= matchBpm) {
          const weight = Math.min(0.5, stepSec / Math.max(stepSec, state.durationSec + stepSec));
          state.candidateBpm = (1 - weight) * state.candidateBpm + weight * respiratory.bpm;
          state.durationSec += stepSec;
        } else {
          if (Number.isFinite(state.stableBpm) && Math.abs(respiratory.bpm - state.stableBpm) > matchBpm) {
            state.stableBpm = NaN;
          }
          state.candidateBpm = respiratory.bpm;
          state.durationSec = stepSec;
        }
        if (state.durationSec >= (config.respiratoryFamilyConfirmSec ?? 5)) {
          state.stableBpm = state.candidateBpm;
        }
        return state;
      }
      function filterRespiratoryFamily(clusters, state, respiratory, config) {
        if (config.respiratoryFamilyExclusionEnabled === false || !Number.isFinite(state.stableBpm) || !(state.stableBpm > 0)) {
          return { retained: clusters, excluded: [] };
        }
        const orders = config.respiratoryFamilyHarmonicOrders || [2, 3, 4];
        const toleranceBpm = config.respiratoryFamilyToleranceBpm ?? 4;
        const excluded = [];
        const retained = [];
        for (const cluster of clusters) {
          let matchedOrder = 0;
          let matchedBpm = 0;
          for (const order of orders) {
            const familyBpm = state.stableBpm * order;
            if (Math.abs(cluster.hrBpm - familyBpm) <= toleranceBpm) {
              matchedOrder = order;
              matchedBpm = familyBpm;
              break;
            }
          }
          cluster.respiratoryRateBpm = respiratory.bpm || 0;
          cluster.respiratoryFamilyStableBpm = state.stableBpm || 0;
          cluster.respiratoryFamilyOrder = matchedOrder;
          cluster.respiratoryFamilyTargetBpm = matchedBpm;
          cluster.respiratoryFamilyExcluded = matchedOrder > 0;
          if (matchedOrder > 0) excluded.push(cluster);
          else retained.push(cluster);
        }
        return { retained, excluded };
      }
      function linearConfidence(value, low, high, lowValue = 0) {
        if (!(value > low)) return lowValue;
        if (value >= high) return 1;
        return lowValue + (1 - lowValue) * (value - low) / (high - low);
      }
      function applyRespiratoryFamilyPenalty(clusters, state, respiratory, authoritativeHr, config) {
        const summary = { penalized: [], protected: [], family: [] };
        if (config.respiratoryFamilyPenaltyEnabled !== true || !Number.isFinite(state.stableBpm) || !(state.stableBpm > 0) || respiratory.quality < (config.respiratoryFamilyMinimumQuality ?? 0.75) || state.durationSec < (config.respiratoryFamilyConfirmSec ?? 8)) {
          return summary;
        }
        const orders = config.respiratoryFamilyHarmonicOrders || [2, 3, 4];
        const tolerance = config.respiratoryFamilyToleranceBpm ?? 3;
        for (const cluster of clusters) {
          let order = 0;
          let targetBpm = 0;
          let distanceBpm = Infinity;
          for (const candidateOrder of orders) {
            const target = state.stableBpm * candidateOrder;
            const distance = Math.abs(cluster.hrBpm - target);
            if (distance <= tolerance && distance < distanceBpm) {
              order = candidateOrder;
              targetBpm = target;
              distanceBpm = distance;
            }
          }
          cluster.respiratoryFamilyOrder = order;
          cluster.respiratoryFamilyTargetBpm = targetBpm;
          cluster.respiratoryFamilyDistanceBpm = Number.isFinite(distanceBpm) ? distanceBpm : 0;
          cluster.respiratoryFamilyPenalty = 0;
          cluster.respiratoryFamilyProtected = false;
          cluster.respiratoryFamilyProtectionReason = "";
          if (order > 0) summary.family.push(cluster);
        }
        const nonFamilyExists = clusters.some((cluster) => !(cluster.respiratoryFamilyOrder > 0));
        if (!nonFamilyExists) return summary;
        for (const cluster of summary.family) {
          const authorityProtected = Number.isFinite(authoritativeHr) && Math.abs(cluster.hrBpm - authoritativeHr) <= (config.respiratoryFamilyAuthorityProtectionBpm ?? 6);
          const heartbeatProtected = (cluster.relativeHeartbeatScore || 0) >= (config.respiratoryFamilyStrongHeartbeatProtection ?? 0.75);
          if (authorityProtected || heartbeatProtected) {
            cluster.respiratoryFamilyProtected = true;
            cluster.respiratoryFamilyProtectionReason = authorityProtected ? "authoritative_history" : "strong_heartbeat_evidence";
            summary.protected.push(cluster);
            continue;
          }
          const qualityConfidence = linearConfidence(
            respiratory.quality,
            0.65,
            0.85,
            0
          );
          const distanceConfidence = cluster.respiratoryFamilyDistanceBpm <= 1 ? 1 : Math.max(0, (3 - cluster.respiratoryFamilyDistanceBpm) / 2);
          const persistenceConfidence = linearConfidence(
            state.durationSec,
            5,
            8,
            0
          );
          const confidence = qualityConfidence * distanceConfidence * persistenceConfidence;
          const extreme = respiratory.quality >= 0.85 && cluster.respiratoryFamilyDistanceBpm <= 1 && state.durationSec >= 10;
          const maximumPenalty = extreme ? config.respiratoryFamilyExtremePenalty ?? 0.12 : config.respiratoryFamilyNormalPenalty ?? 0.08;
          const penalty = maximumPenalty * confidence;
          cluster.respiratoryFamilyPenalty = penalty;
          cluster.observationScore = Math.max(
            0,
            cluster.observationScore - penalty
          );
          if (penalty > 0) summary.penalized.push(cluster);
        }
        return summary;
      }
      module.exports = {
        estimateRespiratoryPeak,
        createRespiratoryFamilyState,
        updateRespiratoryFamilyState,
        filterRespiratoryFamily,
        applyRespiratoryFamilyPenalty
      };
    }
  });

  // src/baseline/RespiratoryControlAdmission.js
  var require_RespiratoryControlAdmission = __commonJS({
    "src/baseline/RespiratoryControlAdmission.js"(exports, module) {
      "use strict";
      function createRespiratoryControlAdmissionState() {
        return {
          blockedHrBpm: NaN,
          holdUntilSec: -Infinity,
          lastDecision: "inactive",
          lastAlternativeHrBpm: NaN
        };
      }
      function familyRelation(candidate, respiratoryHr, config) {
        if (!candidate || !(respiratoryHr > 0)) return null;
        const orders = config.respiratoryControlHarmonicOrders || [2, 3, 4];
        let best = null;
        for (const order of orders) {
          const targetBpm = order * respiratoryHr;
          const distanceBpm = Math.abs(candidate.hrBpm - targetBpm);
          if (!best || distanceBpm < best.distanceBpm) {
            best = { order, targetBpm, distanceBpm };
          }
        }
        return best;
      }
      function independentHeartbeatEvidenceCount(candidate) {
        let count = 0;
        if ((candidate.relativeIntervalScore || 0) >= 0.75) count++;
        if ((candidate.relativeCrossAxisScore || 0) >= 0.75) count++;
        if ((candidate.relativeAutocorrelationScore || 0) >= 0.75) count++;
        if (candidate.supportWindows?.includes(20) && candidate.supportWindows?.includes(30)) count++;
        return count;
      }
      function isControlUpgrade(context) {
        return !(context.authoritativeHr > 0) || context.beamMode === "beam_initialize" || context.beamMode === "beam_reacquire" || context.trackReason === "mature_track_initialized" || context.trackReason === "local_mature_track_switched" || context.trackReason === "remote_mature_track_switched" || context.rawGuardMode === "remote_confirmed";
      }
      function reviewRespiratoryControlAdmission(selected, candidates, respiratoryState, respiratory, timeSec, state, context, config) {
        const result = {
          selected,
          reviewed: false,
          blocked: false,
          reason: "not_applicable",
          blockedHrBpm: 0,
          alternativeHrBpm: 0,
          familyOrder: 0,
          familyDistanceBpm: 0
        };
        if (config.respiratoryControlAdmissionEnabled !== true || !selected) {
          return result;
        }
        const activeHold = timeSec <= state.holdUntilSec && Number.isFinite(state.blockedHrBpm);
        if (activeHold && Number.isFinite(state.lastAlternativeHrBpm)) {
          const reconnectBpm = config.respiratoryControlAlternativeReconnectBpm ?? 10;
          const heldAlternative = candidates.filter((candidate) => Math.abs(candidate.hrBpm - state.lastAlternativeHrBpm) <= reconnectBpm).sort((left, right) => Math.abs(left.hrBpm - state.lastAlternativeHrBpm) - Math.abs(right.hrBpm - state.lastAlternativeHrBpm))[0];
          if (heldAlternative) {
            state.lastAlternativeHrBpm = heldAlternative.hrBpm;
            state.lastDecision = "respiratory_family_hold_alternative";
            result.selected = heldAlternative;
            result.reviewed = true;
            result.blocked = true;
            result.reason = state.lastDecision;
            result.blockedHrBpm = state.blockedHrBpm;
            result.alternativeHrBpm = heldAlternative.hrBpm;
            return result;
          }
        }
        const qualityMinimum = config.respiratoryControlMinimumQuality ?? 0.75;
        const persistenceMinimum = config.respiratoryControlMinimumPersistenceSec ?? 5;
        const controlRespiratoryBpm = respiratoryState.stableBpm > 0 ? respiratoryState.stableBpm : respiratoryState.candidateBpm;
        if (!(controlRespiratoryBpm > 0) || respiratory.quality < qualityMinimum || respiratoryState.durationSec < persistenceMinimum) {
          state.lastDecision = "insufficient_respiratory_evidence";
          return result;
        }
        const relation = familyRelation(selected, controlRespiratoryBpm, config);
        const strongDistance = config.respiratoryControlStrongDistanceBpm ?? 1.5;
        if ((!relation || relation.distanceBpm > strongDistance) && !activeHold) {
          state.lastDecision = "not_respiratory_family";
          return result;
        }
        result.reviewed = true;
        const authorityProtection = context.authoritativeHr > 0 && Math.abs(selected.hrBpm - context.authoritativeHr) <= (config.respiratoryControlAuthorityProtectionBpm ?? 6);
        const matureProtection = context.authoritativeHr > 0 && (context.selectedTrackAgeSec || 0) >= (config.respiratoryControlSelectedTrackProtectionSec ?? 15);
        const heartbeatProtection = independentHeartbeatEvidenceCount(selected) >= (config.respiratoryControlHeartbeatEvidenceRequired ?? 2);
        if (authorityProtection || matureProtection || heartbeatProtection) {
          result.reason = authorityProtection ? "protected_authority" : matureProtection ? "protected_mature_track" : "protected_heartbeat";
          state.lastDecision = result.reason;
          return result;
        }
        if (!activeHold && !isControlUpgrade(context)) {
          result.reason = "ordinary_tracking_not_reviewed";
          state.lastDecision = result.reason;
          return result;
        }
        const scoreGapMaximum = config.respiratoryControlAlternativeScoreGap ?? 0.15;
        const spectralGapMaximum = config.respiratoryControlAlternativeSpectralGap ?? 0.2;
        let alternatives = candidates.filter((candidate) => {
          if (candidate === selected) return false;
          const candidateRelation = familyRelation(
            candidate,
            controlRespiratoryBpm,
            config
          );
          if (candidateRelation && candidateRelation.distanceBpm <= (config.respiratoryControlFamilyToleranceBpm ?? 3)) return false;
          if (!(candidate.supportWindows?.includes(20) || candidate.supportWindows?.includes(30))) return false;
          const scoreGap = (selected.observationScore || 0) - (candidate.observationScore || 0);
          const spectralGap = (selected.spectralScore || 0) - (candidate.spectralScore || 0);
          return scoreGap <= scoreGapMaximum || spectralGap <= spectralGapMaximum;
        }).sort((left, right) => (right.observationScore || 0) - (left.observationScore || 0));
        if (activeHold && Number.isFinite(state.lastAlternativeHrBpm)) {
          const reconnectBpm = config.respiratoryControlAlternativeReconnectBpm ?? 10;
          const heldAlternatives = candidates.filter((candidate) => {
            const candidateRelation = familyRelation(
              candidate,
              controlRespiratoryBpm,
              config
            );
            if (candidateRelation && candidateRelation.distanceBpm <= (config.respiratoryControlFamilyToleranceBpm ?? 3)) return false;
            return Math.abs(candidate.hrBpm - state.lastAlternativeHrBpm) <= reconnectBpm;
          }).sort((left, right) => Math.abs(left.hrBpm - state.lastAlternativeHrBpm) - Math.abs(right.hrBpm - state.lastAlternativeHrBpm));
          if (heldAlternatives.length > 0) alternatives = heldAlternatives;
        }
        const alternative = alternatives[0] || null;
        if (!alternative) {
          result.reason = "no_competitive_non_respiratory_candidate";
          state.lastDecision = result.reason;
          return result;
        }
        if (!activeHold) {
          state.blockedHrBpm = selected.hrBpm;
          state.holdUntilSec = timeSec + (config.respiratoryControlHoldSec ?? 5) - (config.stepSec || 1);
        }
        state.lastAlternativeHrBpm = alternative.hrBpm;
        state.lastDecision = activeHold ? "respiratory_family_hold_alternative" : "respiratory_family_control_blocked";
        result.selected = alternative;
        result.blocked = true;
        result.reason = state.lastDecision;
        result.blockedHrBpm = selected.hrBpm;
        result.alternativeHrBpm = alternative.hrBpm;
        result.familyOrder = relation?.order || 0;
        result.familyDistanceBpm = relation?.distanceBpm || 0;
        return result;
      }
      module.exports = {
        createRespiratoryControlAdmissionState,
        reviewRespiratoryControlAdmission
      };
    }
  });

  // src/baseline/SlidingWindowEstimator.js
  var require_SlidingWindowEstimator = __commonJS({
    "src/baseline/SlidingWindowEstimator.js"(exports, module) {
      "use strict";
      var baseConfig = require_config();
      var { removeDC, clamp } = require_SignalFilters();
      var { periodogramPSD, magnitudeSquaredCoherence } = require_FFT();
      var {
        computeObservationScores,
        relativePercentile,
        annotateRelativeCandidateEvidence
      } = require_CandidateScoring();
      var { updateCandidateBeam } = require_CandidateBeam();
      var {
        createSixtySecondTrackState,
        selectSixtySecondTrack
      } = require_SixtySecondTrackSelector();
      var {
        createSelectionArbiterState,
        arbitrateSelection
      } = require_SelectionArbiter();
      var {
        createRawBeamTransitionGuardState,
        guardRawBeamSelection
      } = require_RawBeamTransitionGuard();
      var {
        createAuthoritativeReliableHistoryState,
        updateAuthoritativeReliableHistory,
        preserveAuthoritativeReliableHistory
      } = require_AuthoritativeReliableHistory();
      var {
        estimateRespiratoryPeak,
        createRespiratoryFamilyState,
        updateRespiratoryFamilyState,
        applyRespiratoryFamilyPenalty
      } = require_RespiratoryFamilyFilter();
      var {
        createRespiratoryControlAdmissionState,
        reviewRespiratoryControlAdmission
      } = require_RespiratoryControlAdmission();
      function toF64(values) {
        return new Float64Array(Array.from(values || []));
      }
      function mean(values) {
        let sum = 0;
        let count = 0;
        for (const value of values || []) {
          if (!Number.isFinite(value)) continue;
          sum += value;
          count++;
        }
        return count > 0 ? sum / count : 0;
      }
      function median(values) {
        const finite = Array.from(values || []).filter(Number.isFinite).sort((a, b) => a - b);
        if (finite.length === 0) return NaN;
        const middle = Math.floor(finite.length / 2);
        return finite.length % 2 ? finite[middle] : 0.5 * (finite[middle - 1] + finite[middle]);
      }
      function percentile(values, probability) {
        const finite = Array.from(values || []).filter(Number.isFinite).sort((a, b) => a - b);
        if (finite.length === 0) return 0;
        const position = clamp(probability, 0, 1) * (finite.length - 1);
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        if (lower === upper) return finite[lower];
        const weight = position - lower;
        return finite[lower] * (1 - weight) + finite[upper] * weight;
      }
      function standardDeviation(values) {
        const finite = Array.from(values || []).filter(Number.isFinite);
        if (finite.length < 2) return 0;
        const average = mean(finite);
        return Math.sqrt(mean(finite.map((value) => (value - average) ** 2)));
      }
      function parabolicPeakOffset(left, center, right) {
        const y0 = Math.log(Math.max(left, 1e-18));
        const y1 = Math.log(Math.max(center, 1e-18));
        const y2 = Math.log(Math.max(right, 1e-18));
        const denominator = y0 - 2 * y1 + y2;
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return 0;
        return clamp(0.5 * (y0 - y2) / denominator, -0.5, 0.5);
      }
      function bandIndices(freqs, lowBpm, highBpm) {
        const indices = [];
        for (let i = 1; i < freqs.length; i++) {
          const bpm = freqs[i] * 60;
          if (bpm >= lowBpm && bpm <= highBpm) indices.push(i);
        }
        return indices;
      }
      function localPeakIndices(psd, indices) {
        if (indices.length === 0) return [];
        if (indices.length === 1) return [indices[0]];
        const peaks = [];
        for (let position = 0; position < indices.length; position++) {
          const index = indices[position];
          const left = position > 0 ? psd[indices[position - 1]] : -Infinity;
          const right = position + 1 < indices.length ? psd[indices[position + 1]] : -Infinity;
          if (psd[index] > left && psd[index] > right) peaks.push(index);
        }
        return peaks;
      }
      function nearestBin(freqs, frequencyHz) {
        if (!freqs || freqs.length === 0) return -1;
        let best = 0;
        let distance = Math.abs(freqs[0] - frequencyHz);
        for (let i = 1; i < freqs.length; i++) {
          const next = Math.abs(freqs[i] - frequencyHz);
          if (next < distance) {
            best = i;
            distance = next;
          }
        }
        return best;
      }
      function robustImpulseRatio(signal, config) {
        const values = Array.from(signal || []).filter(Number.isFinite);
        if (values.length === 0) return 0;
        const center = median(values);
        const mad = median(values.map((value) => Math.abs(value - center)));
        if (!(mad > 1e-12)) return 0;
        const threshold = config.gyroImpulseMadMultiplier * 1.4826 * mad;
        return values.filter((value) => Math.abs(value - center) > threshold).length / values.length;
      }
      function gyroEnergyScore(relativeEnergy, config) {
        const neutral = Math.max(1.0001, config.gyroEnergyNeutralRatio);
        const high = Math.max(neutral + 1e-6, config.gyroEnergyHighRatio);
        if (!(relativeEnergy > neutral)) return 0;
        return clamp(
          Math.log(relativeEnergy / neutral) / Math.log(high / neutral),
          0,
          1
        );
      }
      function normalizedAutocorrelation(signal, lag, start = 0, end = signal.length) {
        const integerLag = Math.max(1, Math.round(lag));
        const stop = Math.min(signal.length, end) - integerLag;
        if (stop - start < 8) return 0;
        let cross = 0;
        let leftEnergy = 0;
        let rightEnergy = 0;
        for (let i = start; i < stop; i++) {
          const left = signal[i];
          const right = signal[i + integerLag];
          cross += left * right;
          leftEnergy += left * left;
          rightEnergy += right * right;
        }
        if (!(leftEnergy > 0) || !(rightEnergy > 0)) return 0;
        return clamp(cross / Math.sqrt(leftEnergy * rightEnergy), -1, 1);
      }
      function autocorrelationRhythmEvidence(signal, frequencyHz, sampleRateHz) {
        if (!(frequencyHz > 0) || signal.length < 16) {
          return { score: 0, full: 0, firstHalf: 0, secondHalf: 0, stability: 0 };
        }
        const lag = sampleRateHz / frequencyHz;
        const full = Math.max(0, normalizedAutocorrelation(signal, lag));
        const doubleLag = Math.max(0, normalizedAutocorrelation(signal, 2 * lag));
        const middle = Math.floor(signal.length / 2);
        const firstHalf = Math.max(0, normalizedAutocorrelation(signal, lag, 0, middle));
        const secondHalf = Math.max(
          0,
          normalizedAutocorrelation(signal, lag, middle, signal.length)
        );
        const stability = clamp(1 - Math.abs(firstHalf - secondHalf), 0, 1);
        return {
          score: clamp((0.65 * full + 0.35 * doubleLag) * stability, 0, 1),
          full,
          firstHalf,
          secondHalf,
          stability
        };
      }
      function detectTimeDomainEvents(signal, sampleRateHz, config) {
        const center = median(signal);
        const deviation = standardDeviation(signal);
        const threshold = center + config.rhythmPeakThresholdStd * deviation;
        const minimumDistance = Math.max(
          1,
          Math.round(config.rhythmPeakMinDistanceSec * sampleRateHz)
        );
        const peaks = [];
        for (let i = 1; i + 1 < signal.length; i++) {
          if (!(signal[i] > threshold && signal[i] >= signal[i - 1] && signal[i] > signal[i + 1])) {
            continue;
          }
          const previous = peaks[peaks.length - 1];
          if (previous === void 0 || i - previous >= minimumDistance) {
            peaks.push(i);
          } else if (signal[i] > signal[previous]) {
            peaks[peaks.length - 1] = i;
          }
        }
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
          intervals.push((peaks[i] - peaks[i - 1]) / sampleRateHz);
        }
        return { peaks, intervals };
      }
      function intervalRhythmEvidence(events, frequencyHz, config) {
        if (!(frequencyHz > 0) || events.intervals.length < 3) {
          return { score: 0, medianIntervalSec: 0, intervalCv: 1, eventCount: events.peaks.length };
        }
        const expected = 1 / frequencyHz;
        const interval = median(events.intervals);
        const intervalMad = median(events.intervals.map((value) => Math.abs(value - interval)));
        const intervalCv = intervalMad / Math.max(interval, config.epsilon);
        const agreement = Math.exp(
          -0.5 * ((interval - expected) / Math.max(config.rhythmIntervalRelativeSigma * expected, config.epsilon)) ** 2
        );
        const regularity = Math.exp(
          -intervalCv / Math.max(config.rhythmIntervalCvScale, config.epsilon)
        );
        return {
          score: clamp(agreement * regularity, 0, 1),
          medianIntervalSec: interval,
          intervalCv,
          eventCount: events.peaks.length
        };
      }
      function detectSignedAxisEvents(signal, sampleRateHz, config) {
        const centered = removeDC(signal);
        const deviation = standardDeviation(centered);
        const threshold = config.crossAxisEventThresholdStd * deviation;
        const minimumDistance = Math.max(
          1,
          Math.round(config.rhythmPeakMinDistanceSec * sampleRateHz)
        );
        const peaks = [];
        for (let i = 1; i + 1 < centered.length; i++) {
          const value = Math.abs(centered[i]);
          if (!(value > threshold && value >= Math.abs(centered[i - 1]) && value > Math.abs(centered[i + 1]))) continue;
          const previous = peaks[peaks.length - 1];
          if (previous === void 0 || i - previous >= minimumDistance) {
            peaks.push(i);
          } else if (value > Math.abs(centered[previous])) {
            peaks[peaks.length - 1] = i;
          }
        }
        return peaks;
      }
      function buildConsensusEvents(axisEvents, sampleRateHz, config) {
        const tolerance = Math.max(
          1,
          Math.round(config.crossAxisCoincidenceSec * sampleRateHz)
        );
        const proposals = [];
        for (const axis of ["x", "y", "z"]) {
          for (const index of axisEvents[axis] || []) proposals.push({ axis, index });
        }
        proposals.sort((a, b) => a.index - b.index);
        const consensus = [];
        for (const proposal of proposals) {
          const support = /* @__PURE__ */ new Set([proposal.axis]);
          const indices = [proposal.index];
          for (const other of proposals) {
            if (other === proposal || Math.abs(other.index - proposal.index) > tolerance) continue;
            support.add(other.axis);
            indices.push(other.index);
          }
          if (support.size < 2) continue;
          const center = Math.round(median(indices));
          if (consensus.length === 0 || center - consensus[consensus.length - 1] > tolerance) {
            consensus.push(center);
          }
        }
        const intervals = [];
        for (let i = 1; i < consensus.length; i++) {
          intervals.push((consensus[i] - consensus[i - 1]) / sampleRateHz);
        }
        return { peaks: consensus, intervals };
      }
      function gyroSynchronizationRatio(consensusEvents, gyroEvents, sampleRateHz, config) {
        if (consensusEvents.length === 0 || gyroEvents.length === 0) return 0;
        const tolerance = Math.max(
          1,
          Math.round(config.crossAxisCoincidenceSec * sampleRateHz)
        );
        let synchronized = 0;
        for (const event of consensusEvents) {
          if (gyroEvents.some((gyro) => Math.abs(gyro - event) <= tolerance)) synchronized++;
        }
        return synchronized / consensusEvents.length;
      }
      function annotateCrossAxisEventEvidence(candidates, axisWindows, gyroWindow, sampleRateHz, config) {
        const axisEvents = {};
        for (const axis of ["x", "y", "z"]) {
          axisEvents[axis] = detectSignedAxisEvents(
            axisWindows[axis] || [],
            sampleRateHz,
            config
          );
        }
        const consensus = buildConsensusEvents(axisEvents, sampleRateHz, config);
        const gyroEvents = gyroWindow ? detectSignedAxisEvents(gyroWindow, sampleRateHz, config) : [];
        const gyroSyncRatio = gyroSynchronizationRatio(
          consensus.peaks,
          gyroEvents,
          sampleRateHz,
          config
        );
        const maximumAxisEvents = Math.max(
          1,
          ...Object.values(axisEvents).map((events) => events.length)
        );
        const consensusCoverage = clamp(
          consensus.peaks.length / maximumAxisEvents,
          0,
          1
        );
        for (const candidate of candidates) {
          const interval = intervalRhythmEvidence(
            consensus,
            candidate.frequencyHz,
            config
          );
          const enoughEvents = consensus.peaks.length >= config.crossAxisMinConsensusEvents;
          candidate.crossAxisConsensusScore = enoughEvents ? interval.score * consensusCoverage : 0;
          candidate.crossAxisConsensusEvents = consensus.peaks.length;
          candidate.crossAxisConsensusCoverage = consensusCoverage;
          candidate.crossAxisGyroSyncRatio = gyroSyncRatio;
          candidate.crossAxisHeartEvidence = candidate.crossAxisConsensusScore * (1 - gyroSyncRatio);
        }
      }
      function extractTopCandidates(signal, gyroSignal, sampleRateHz, windowSec, config, source = "magnitude") {
        const centered = removeDC(signal);
        const computeMagnitudeRhythm = config.rhythmEvidenceDiagnosticEnabled === true;
        const timeDomainEvents = computeMagnitudeRhythm ? detectTimeDomainEvents(centered, sampleRateHz, config) : null;
        const spectrum = periodogramPSD(centered, sampleRateHz, { window: "hann" });
        const gyroAvailable = gyroSignal && gyroSignal.length === signal.length;
        const gyroCentered = gyroAvailable ? removeDC(gyroSignal) : null;
        const gyroSpectrum = gyroAvailable ? periodogramPSD(gyroCentered, sampleRateHz, { window: "hann" }) : null;
        const gyroBandIndices = gyroSpectrum ? bandIndices(gyroSpectrum.freqs, config.hrPhysLowBpm, config.hrPhysHighBpm) : [];
        const gyroBandMedian = gyroBandIndices.length > 0 ? median(gyroBandIndices.map((index) => gyroSpectrum.psd[index])) : NaN;
        const coherenceResult = gyroAvailable && windowSec >= config.gyroCoherenceMinWindowSec ? magnitudeSquaredCoherence(centered, gyroCentered, sampleRateHz, {
          segmentSec: config.gyroCoherenceSegmentSec,
          overlap: config.gyroCoherenceOverlap
        }) : null;
        const gyroImpulseRatio = gyroAvailable ? robustImpulseRatio(gyroCentered, config) : 0;
        const indices = bandIndices(
          spectrum.freqs,
          config.hrPhysLowBpm,
          config.hrPhysHighBpm
        );
        if (indices.length === 0) return { candidates: [], spectrum };
        const bandPower = indices.map((index) => spectrum.psd[index]);
        const bandMedian = median(bandPower);
        const bandStd = standardDeviation(bandPower) || 1e-12;
        const maxPower = Math.max(...bandPower, 1e-18);
        const peaks = localPeakIndices(spectrum.psd, indices).sort((a, b) => spectrum.psd[b] - spectrum.psd[a]);
        const selected = [];
        const minimumDistanceHz = config.hrMinPeakDistanceHz;
        for (const index of peaks) {
          const gridFrequencyHz = spectrum.freqs[index];
          if (selected.some(
            (candidate) => Math.abs(candidate.gridFrequencyHz - gridFrequencyHz) < minimumDistanceHz
          )) {
            continue;
          }
          const offset = index > 0 && index + 1 < spectrum.psd.length ? parabolicPeakOffset(
            spectrum.psd[index - 1],
            spectrum.psd[index],
            spectrum.psd[index + 1]
          ) : 0;
          const refinedHz = clamp(
            gridFrequencyHz + offset * spectrum.frequencyResolutionHz,
            config.hrPhysLowBpm / 60,
            config.hrPhysHighBpm / 60
          );
          const amplitude = spectrum.psd[index];
          const neighborFloor = median([
            spectrum.psd[Math.max(0, index - 2)],
            spectrum.psd[Math.max(0, index - 1)],
            spectrum.psd[Math.min(spectrum.psd.length - 1, index + 1)],
            spectrum.psd[Math.min(spectrum.psd.length - 1, index + 2)]
          ]);
          const relativeStrength = clamp(
            (amplitude - bandMedian) / Math.max(maxPower - bandMedian, 1e-18),
            0,
            1
          );
          const localProminence = clamp(
            (amplitude - neighborFloor) / Math.max(amplitude, 1e-18),
            0,
            1
          );
          const spectralScore = clamp(
            0.7 * relativeStrength + 0.2 * localProminence + 0.1 * clamp((amplitude - bandMedian) / (3 * bandStd), 0, 1),
            0,
            1
          );
          const gyroIndex = gyroSpectrum ? nearestBin(gyroSpectrum.freqs, refinedHz) : -1;
          const gyroRelativeEnergy = gyroIndex >= 0 && Number.isFinite(gyroBandMedian) ? gyroSpectrum.psd[gyroIndex] / Math.max(gyroBandMedian, config.epsilon) : 0;
          const coherenceIndex = coherenceResult ? nearestBin(coherenceResult.freqs, refinedHz) : -1;
          const gyroCoherence = coherenceIndex >= 0 ? coherenceResult.coherence[coherenceIndex] : 0;
          const autocorrelation = computeMagnitudeRhythm ? autocorrelationRhythmEvidence(centered, refinedHz, sampleRateHz) : { score: 0, full: 0, firstHalf: 0, secondHalf: 0, stability: 0 };
          const intervalEvidence = computeMagnitudeRhythm ? intervalRhythmEvidence(timeDomainEvents, refinedHz, config) : { score: 0, medianIntervalSec: 0, intervalCv: 0, eventCount: 0 };
          selected.push({
            source,
            windowSec,
            windowRank: selected.length + 1,
            gridFrequencyHz,
            frequencyHz: refinedHz,
            hrBpm: refinedHz * 60,
            amplitude,
            relativeStrength,
            localProminence,
            spectralScore,
            autocorrelationScore: autocorrelation.score,
            autocorrelationFull: autocorrelation.full,
            autocorrelationFirstHalf: autocorrelation.firstHalf,
            autocorrelationSecondHalf: autocorrelation.secondHalf,
            autocorrelationStability: autocorrelation.stability,
            intervalScore: intervalEvidence.score,
            eventCount: intervalEvidence.eventCount,
            medianEventIntervalSec: intervalEvidence.medianIntervalSec,
            eventIntervalCv: intervalEvidence.intervalCv,
            gyroRelativeEnergy,
            gyroEnergyScore: gyroEnergyScore(gyroRelativeEnergy, config),
            gyroCoherence,
            gyroCoherenceSegments: coherenceResult?.segmentCount || 0,
            gyroImpulseRatio,
            fftLength: spectrum.fftLength,
            frequencyResolutionHz: spectrum.frequencyResolutionHz,
            physicalResolutionHz: spectrum.physicalResolutionHz
          });
          if (selected.length >= config.hrTopKPeaks) break;
        }
        return { candidates: selected, spectrum };
      }
      function candidateAxisEvidence(cluster) {
        const values = [];
        for (const windowSec of [20, 30]) {
          for (const axis of ["x", "y", "z"]) {
            const value = cluster.axisEnergy?.[windowSec]?.[axis];
            if (Number.isFinite(value)) values.push(value);
          }
        }
        if (values.length === 0) return 0;
        return clamp(Math.log1p(Math.max(...values)) / Math.log(11), 0, 1);
      }
      function annotateCandidateEvidence(clusters, axisSpectraByWindow, config) {
        for (const cluster of clusters) {
          cluster.axisEnergy = {};
          for (const windowSec of [10, 20, 30]) {
            cluster.axisEnergy[windowSec] = {};
            for (const axis of ["x", "y", "z"]) {
              cluster.axisEnergy[windowSec][axis] = normalizedEnergyAtFrequency(
                axisSpectraByWindow[windowSec]?.[axis],
                cluster.frequencyHz,
                config
              );
            }
          }
          cluster.axisEvidenceScore = candidateAxisEvidence(cluster);
        }
      }
      function applySafeCandidateExclusion(clusters, config) {
        for (const cluster of clusters) {
          const longAxisMaximum = Math.max(
            ...[20, 30].flatMap(
              (windowSec) => ["x", "y", "z"].map(
                (axis) => cluster.axisEnergy?.[windowSec]?.[axis] || 0
              )
            )
          );
          cluster.excludedWeakCandidate = cluster.spectralScore < config.hrWeakCandidateSpectralThreshold && longAxisMaximum < config.hrWeakCandidateAxisEnergyThreshold;
          cluster.exclusionReason = cluster.excludedWeakCandidate ? "weak_spectrum_and_all_long_axes_weak" : "";
        }
        const retained = clusters.filter((cluster) => !cluster.excludedWeakCandidate);
        return retained.length > 0 ? retained : clusters;
      }
      function temporalScore(hrBpm, previousHr, sigmaBpm) {
        if (!Number.isFinite(previousHr) || previousHr <= 0) return 0.5;
        return Math.exp(-0.5 * ((hrBpm - previousHr) / sigmaBpm) ** 2);
      }
      function windowBaseWeight(windowSec, windowSecList) {
        const maximum = Math.max(...windowSecList);
        return 0.5 + 0.5 * windowSec / maximum;
      }
      function windowCombinationConfidence(windows) {
        const key = windows.slice().sort((a, b) => a - b).join("+");
        return {
          "10": 0.2,
          "20": 0.35,
          "30": 0.55,
          "10+20": 0.45,
          "10+30": 0.6,
          "20+30": 0.72,
          "10+20+30": 1
        }[key] ?? 0;
      }
      function mergeCandidates(candidates, availableWindowSecs, config, previousHr, baselineHr, state) {
        const toleranceBpm = config.hrCandidateMergeBpm;
        const ordered = candidates.slice().sort((a, b) => a.hrBpm - b.hrBpm);
        const clusters = [];
        for (const candidate of ordered) {
          let bestCluster = null;
          let bestDistance = Infinity;
          for (const cluster of clusters) {
            const distance = Math.abs(candidate.hrBpm - cluster.centerBpm);
            if (distance <= toleranceBpm && distance < bestDistance) {
              bestCluster = cluster;
              bestDistance = distance;
            }
          }
          if (!bestCluster) {
            bestCluster = { members: [], centerBpm: candidate.hrBpm };
            clusters.push(bestCluster);
          }
          bestCluster.members.push(candidate);
          const weights = bestCluster.members.map(
            (member) => windowBaseWeight(member.windowSec, config.windowSecList) * (0.25 + 0.75 * member.spectralScore)
          );
          const totalWeight = weights.reduce((sum, value) => sum + value, 0);
          bestCluster.centerBpm = bestCluster.members.reduce(
            (sum, member, index) => sum + member.hrBpm * weights[index],
            0
          ) / Math.max(totalWeight, 1e-12);
        }
        const moving = state === "moving";
        return clusters.map((cluster) => {
          const windows = [...new Set(cluster.members.map((member) => member.windowSec))].sort((a, b) => a - b);
          const supportScore = windowCombinationConfidence(windows);
          const spectralScore = mean(cluster.members.map((member) => member.spectralScore));
          const contaminationRatio = mean(
            cluster.members.map((member) => member.contaminationRatio || 0)
          );
          const autocorrelationScore = mean(
            cluster.members.map((member) => member.autocorrelationScore || 0)
          );
          const autocorrelationStability = mean(
            cluster.members.map((member) => member.autocorrelationStability || 0)
          );
          const autocorrelationFull = mean(
            cluster.members.map((member) => member.autocorrelationFull || 0)
          );
          const autocorrelationFirstHalf = mean(
            cluster.members.map((member) => member.autocorrelationFirstHalf || 0)
          );
          const autocorrelationSecondHalf = mean(
            cluster.members.map((member) => member.autocorrelationSecondHalf || 0)
          );
          const intervalScore = mean(
            cluster.members.map((member) => member.intervalScore || 0)
          );
          const crossAxisConsensusScore = mean(
            cluster.members.map((member) => member.crossAxisConsensusScore || 0)
          );
          const crossAxisConsensusCoverage = mean(
            cluster.members.map((member) => member.crossAxisConsensusCoverage || 0)
          );
          const crossAxisGyroSyncRatio = mean(
            cluster.members.map((member) => member.crossAxisGyroSyncRatio || 0)
          );
          const crossAxisHeartEvidence = mean(
            cluster.members.map((member) => member.crossAxisHeartEvidence || 0)
          );
          const continuity = temporalScore(
            cluster.centerBpm,
            previousHr,
            config.hrTrackingSigmaBpm
          );
          const baseline = temporalScore(
            cluster.centerBpm,
            baselineHr,
            config.hrBaselineSigmaBpm
          );
          const baseScore = moving ? 0.28 * supportScore + 0.15 * spectralScore + 0.37 * continuity + 0.2 * baseline : 0.25 * supportScore + 0.25 * spectralScore + 0.32 * continuity + 0.18 * baseline;
          const motionReliability = moving ? 0.75 : state === "static" ? 1 : 0.85;
          const strongest = cluster.members.reduce(
            (best, member) => member.amplitude > best.amplitude ? member : best,
            cluster.members[0]
          );
          return {
            hrBpm: cluster.centerBpm,
            frequencyHz: cluster.centerBpm / 60,
            amplitude: strongest.amplitude,
            score: baseScore,
            baseScore,
            quality: clamp(baseScore * motionReliability, 0, 1),
            supportScore,
            spectralScore,
            contaminationRatio,
            autocorrelationScore,
            autocorrelationStability,
            autocorrelationFull,
            autocorrelationFirstHalf,
            autocorrelationSecondHalf,
            intervalScore,
            crossAxisConsensusScore,
            crossAxisConsensusCoverage,
            crossAxisGyroSyncRatio,
            crossAxisHeartEvidence,
            continuityScore: continuity,
            baselineScore: baseline,
            gyroRelativeEnergy: mean(cluster.members.map((member) => member.gyroRelativeEnergy)),
            gyroEnergyScore: mean(cluster.members.map((member) => member.gyroEnergyScore)),
            gyroCoherence: mean(
              cluster.members.filter((member) => member.gyroCoherenceSegments >= 3).map((member) => member.gyroCoherence)
            ),
            gyroImpulseRatio: mean(cluster.members.map((member) => member.gyroImpulseRatio)),
            supportWindows: windows,
            members: cluster.members
          };
        }).sort((a, b) => b.score - a.score);
      }
      function applyGyroPenalty(clusters, previousTracks, config, motionReliability) {
        const nextTracks = [];
        for (const cluster of clusters) {
          const energy = cluster.gyroEnergyScore;
          const coherenceEvidence = cluster.gyroCoherence * energy;
          const impulse = clamp(
            cluster.gyroImpulseRatio / Math.max(config.gyroImpulseFullRatio, 1e-6),
            0,
            1
          );
          const instantaneous = clamp(
            0.5 * energy + 0.4 * coherenceEvidence + 0.1 * impulse,
            0,
            1
          );
          const previous = (previousTracks || []).filter(
            (track) => Math.abs(track.hrBpm - cluster.hrBpm) <= config.hrCandidateMergeBpm
          ).sort(
            (a, b) => Math.abs(a.hrBpm - cluster.hrBpm) - Math.abs(b.hrBpm - cluster.hrBpm)
          )[0];
          const sustained = instantaneous >= config.gyroMotionEvidenceThreshold;
          const durationSec = sustained ? (previous?.durationSec || 0) + config.stepSec : Math.max(0, (previous?.durationSec || 0) - config.stepSec);
          const persistence = clamp(
            durationSec / Math.max(config.gyroPersistenceFullSec, config.stepSec),
            0,
            1
          );
          const penaltyEvidence = clamp(
            0.4 * energy + 0.35 * coherenceEvidence + 0.15 * persistence + 0.1 * impulse,
            0,
            1
          );
          const penalty = config.gyroPenaltyWeight * penaltyEvidence;
          cluster.gyroPersistenceScore = persistence;
          cluster.gyroPenalty = penalty;
          cluster.motionCandidateType = cluster.spectralScore < 0.35 && energy >= 0.6 ? "C_acc_weak_gyro_strong" : energy < 0.25 ? "A_acc_strong_gyro_weak" : cluster.gyroCoherence >= 0.65 ? "B_acc_gyro_coherent" : cluster.spectralScore >= 0.35 ? "D_acc_gyro_not_coherent" : "mixed";
          cluster.score = clamp(cluster.baseScore - penalty, 0, 1);
          cluster.quality = clamp(cluster.score * motionReliability, 0, 1);
          nextTracks.push({ hrBpm: cluster.hrBpm, durationSec });
        }
        clusters.sort((a, b) => b.score - a.score);
        return nextTracks;
      }
      function normalizedEnergyAtFrequency(spectrum, frequencyHz, config) {
        if (!spectrum || !spectrum.freqs || spectrum.freqs.length === 0) return 0;
        const index = nearestBin(spectrum.freqs, frequencyHz);
        const indices = bandIndices(
          spectrum.freqs,
          config.hrPhysLowBpm,
          config.hrPhysHighBpm
        );
        if (index < 0 || indices.length === 0) return 0;
        const background = median(indices.map((item) => spectrum.psd[item]));
        return spectrum.psd[index] / Math.max(background, config.epsilon);
      }
      function updateDiagnosticCandidateTracks(clusters, tracks, timeSec, config) {
        const matchedTrackIds = /* @__PURE__ */ new Set();
        let nextId = tracks.reduce((maximum, track) => Math.max(maximum, track.id), 0) + 1;
        for (const cluster of clusters) {
          const match = tracks.filter(
            (track2) => !matchedTrackIds.has(track2.id) && timeSec - track2.lastSeenSec <= 30 && Math.abs(track2.lastHr - cluster.hrBpm) <= config.hrCandidateMergeBpm
          ).sort(
            (a, b) => Math.abs(a.lastHr - cluster.hrBpm) - Math.abs(b.lastHr - cluster.hrBpm)
          )[0];
          let track = match;
          if (!track) {
            track = {
              id: nextId++,
              firstSeenSec: timeSec,
              lastSeenSec: timeSec,
              lastHr: cluster.hrBpm,
              consecutiveSec: config.stepSec,
              totalSeenSec: config.stepSec,
              reappearanceCount: 0,
              previousGapSec: 0
            };
            tracks.push(track);
          } else {
            const gap = timeSec - track.lastSeenSec;
            if (gap <= 1.5 * config.stepSec) {
              track.consecutiveSec += config.stepSec;
              track.previousGapSec = 0;
            } else {
              track.reappearanceCount++;
              track.previousGapSec = Math.max(0, gap - config.stepSec);
              track.consecutiveSec = config.stepSec;
            }
            track.lastSeenSec = timeSec;
            track.lastHr = cluster.hrBpm;
            track.totalSeenSec += config.stepSec;
          }
          matchedTrackIds.add(track.id);
          cluster.diagnosticTrack = { ...track };
        }
        return tracks.filter((track) => timeSec - track.lastSeenSec <= 60);
      }
      function rms(values) {
        const finite = Array.from(values || []).filter(Number.isFinite);
        if (finite.length === 0) return 0;
        return Math.sqrt(mean(finite.map((value) => value * value)));
      }
      function empiricalPlausibility(value, limits) {
        const magnitude = Math.abs(Number(value));
        const p95 = Number(limits?.[0]);
        const p99 = Number(limits?.[1]);
        if (!Number.isFinite(magnitude) || !(p95 > 0) || !(p99 > p95)) return 0.5;
        if (magnitude <= p95) return 1;
        if (magnitude <= p99) {
          return 1 - 0.65 * (magnitude - p95) / (p99 - p95);
        }
        return 0.35 * Math.exp(-(magnitude - p99) / p99);
      }
      function multiScaleDeltaPlausibility(history, timeSec, hrBpm, config) {
        const limits = config.hrPhysiologyDeltaLimits || {};
        const horizons = [[1, 0.35], [5, 0.25], [15, 0.2], [30, 0.2]];
        let weighted = 0;
        let totalWeight = 0;
        const details = {};
        for (const [horizon, weight] of horizons) {
          const target = timeSec - horizon;
          const previous = history.filter((item) => item.timeSec < timeSec).sort(
            (left, right) => Math.abs(left.timeSec - target) - Math.abs(right.timeSec - target)
          )[0];
          if (!previous || Math.abs(previous.timeSec - target) > Math.max(1.5 * config.stepSec, 1)) continue;
          const delta = hrBpm - previous.hrBpm;
          const score = empiricalPlausibility(delta, limits[horizon]);
          details[`delta${horizon}`] = delta;
          details[`score${horizon}`] = score;
          weighted += weight * score;
          totalWeight += weight;
        }
        return {
          score: totalWeight > 0 ? clamp(weighted / totalWeight, 0, 1) : 0.5,
          details
        };
      }
      function updatePhysiologicCandidateTracks(clusters, tracks, timeSec, config) {
        const matchedIds = /* @__PURE__ */ new Set();
        let nextId = tracks.reduce((maximum, track) => Math.max(maximum, track.id), 0) + 1;
        const possibleMatches = [];
        for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
          const cluster = clusters[clusterIndex];
          for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
            const track = tracks[trackIndex];
            const dt = timeSec - track.lastTimeSec;
            if (!(dt > 0) || dt > config.hrPersistentTrackMaxGapSec) continue;
            const predicted = track.lastHr + track.velocityBpmPerSec * dt;
            const gapIndex = Math.max(1, Math.min(3, Math.ceil(dt)));
            const matchByGap = config.hrTrendMatchBpmByGapSec || {};
            const tolerance = Number(matchByGap[gapIndex]) || config.hrTrendMatchBpm;
            const distance = Math.abs(cluster.hrBpm - predicted);
            if (distance <= tolerance) {
              possibleMatches.push({ clusterIndex, trackIndex, distance, tolerance });
            }
          }
        }
        possibleMatches.sort((left, right) => left.distance / left.tolerance - right.distance / right.tolerance || left.distance - right.distance);
        const assignedTrackByCluster = /* @__PURE__ */ new Map();
        const assignedTrackIndices = /* @__PURE__ */ new Set();
        for (const match of possibleMatches) {
          if (assignedTrackByCluster.has(match.clusterIndex) || assignedTrackIndices.has(match.trackIndex)) continue;
          assignedTrackByCluster.set(match.clusterIndex, tracks[match.trackIndex]);
          assignedTrackIndices.add(match.trackIndex);
        }
        for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
          const cluster = clusters[clusterIndex];
          const match = assignedTrackByCluster.get(clusterIndex) || null;
          let track = match;
          if (!track) {
            track = {
              id: nextId++,
              firstTimeSec: timeSec,
              lastTimeSec: timeSec,
              lastHr: cluster.hrBpm,
              velocityBpmPerSec: 0,
              observations: []
            };
            tracks.push(track);
          } else {
            const dt = timeSec - track.lastTimeSec;
            const measuredVelocity = (cluster.hrBpm - track.lastHr) / dt;
            const alpha = config.hrTrendVelocityAlpha;
            track.velocityBpmPerSec = (1 - alpha) * track.velocityBpmPerSec + alpha * measuredVelocity;
            track.lastTimeSec = timeSec;
            track.lastHr = cluster.hrBpm;
          }
          track.observations.push({ timeSec, hrBpm: cluster.hrBpm });
          const historyStart = timeSec - config.hrTrendHistorySec;
          track.observations = track.observations.filter(
            (item) => item.timeSec >= historyStart
          );
          matchedIds.add(track.id);
          const history = track.observations;
          const recent15 = history.filter((item) => item.timeSec >= timeSec - 15);
          const spanSec = history.length > 1 ? history[history.length - 1].timeSec - history[0].timeSec : 0;
          const steps = [];
          const velocities = [];
          for (let i = 1; i < history.length; i++) {
            const dt = history[i].timeSec - history[i - 1].timeSec;
            if (!(dt > 0)) continue;
            const step = history[i].hrBpm - history[i - 1].hrBpm;
            steps.push(step);
            velocities.push(step / dt);
          }
          const curvature = [];
          for (let i = 1; i < velocities.length; i++) {
            curvature.push(velocities[i] - velocities[i - 1]);
          }
          const expectedHistorySec = Math.min(
            config.hrTrendHistorySec,
            Math.max(config.hrBandInitializationSec, timeSec)
          );
          const coverage = clamp(
            history.length / Math.max(1, expectedHistorySec / config.stepSec),
            0,
            1
          );
          const stepRms = rms(steps);
          const curvatureRms = rms(curvature);
          const maximumStep = steps.length > 0 ? Math.max(...steps.map(Math.abs)) : 0;
          const absoluteSteps = steps.map(Math.abs);
          const stepP95 = percentile(absoluteSteps, 0.95);
          const largeStepCount = absoluteSteps.filter((step) => step > config.hrTrendLargeStepThresholdBpm).length;
          const robustStepStable = stepP95 <= config.hrTrendStepP95MaximumBpm && largeStepCount <= config.hrTrendMaximumLargeStepCount && maximumStep <= config.hrTrendAbsoluteMaximumStepBpm;
          const meanTime = history.reduce((sum, item) => sum + item.timeSec, 0) / Math.max(1, history.length);
          const meanHr = history.reduce((sum, item) => sum + item.hrBpm, 0) / Math.max(1, history.length);
          let timeVariance = 0;
          let timeHrCovariance = 0;
          for (const item of history) {
            const dt = item.timeSec - meanTime;
            timeVariance += dt * dt;
            timeHrCovariance += dt * (item.hrBpm - meanHr);
          }
          const trendSlope = timeVariance > config.epsilon ? timeHrCovariance / timeVariance : 0;
          const trendResidualRms = rms(history.map(
            (item) => item.hrBpm - (meanHr + trendSlope * (item.timeSec - meanTime))
          ));
          const deltaPlausibility = multiScaleDeltaPlausibility(
            history,
            timeSec,
            cluster.hrBpm,
            config
          );
          const slopePlausibility = empiricalPlausibility(
            trendSlope,
            config.hrPhysiologySlopeLimits
          );
          const residualPlausibility = empiricalPlausibility(
            trendResidualRms,
            config.hrPhysiologyResidualLimits
          );
          const accelerationPlausibility = empiricalPlausibility(
            curvatureRms,
            config.hrPhysiologyAccelerationLimits
          );
          const smoothness = Math.exp(
            -stepRms / Math.max(config.hrTrendStepScaleBpm, config.epsilon)
          );
          const directionStability = Math.exp(
            -curvatureRms / Math.max(config.hrTrendCurvatureScaleBpm, config.epsilon)
          );
          const stable = coverage >= config.hrBandMinimumTrackCoverage && robustStepStable && trendResidualRms <= config.hrBandMaximumTrackResidualBpm && Math.abs(trendSlope) <= config.hrBandMaximumTrackSlopeBpmPerSec;
          const eligible = spanSec >= config.hrTrendMinHistorySec;
          const dataDrivenTrendScore = clamp(
            config.hrPhysiologyCoverageWeight * coverage + config.hrPhysiologyDeltaWeight * deltaPlausibility.score + config.hrPhysiologySlopeWeight * slopePlausibility + config.hrPhysiologyResidualWeight * residualPlausibility + config.hrPhysiologyAccelerationWeight * accelerationPlausibility,
            0,
            1
          );
          const trendScore = eligible ? config.hrDataDrivenScoringEnabled === true && config.hrDataDrivenScoringActive === true ? dataDrivenTrendScore : clamp(coverage * smoothness * directionStability, 0, 1) : 0;
          cluster.physiologicTrackId = track.id;
          cluster.physiologicTrendEligible = eligible;
          cluster.physiologicTrendScore = trendScore;
          cluster.physiologicDeltaScore = deltaPlausibility.score;
          cluster.physiologicDeltaDetails = deltaPlausibility.details;
          cluster.physiologicSlopeScore = slopePlausibility;
          cluster.physiologicResidualScore = residualPlausibility;
          cluster.physiologicAccelerationScore = accelerationPlausibility;
          cluster.physiologicTrendCoverage = coverage;
          cluster.physiologicTrendSpanSec = spanSec;
          cluster.physiologicTrendStepRms = stepRms;
          cluster.physiologicTrendCurvatureRms = curvatureRms;
          cluster.physiologicTrendVelocity = track.velocityBpmPerSec;
          cluster.physiologicTrendMaximumStep = maximumStep;
          cluster.physiologicTrendStepP95 = stepP95;
          cluster.physiologicTrendLargeStepCount = largeStepCount;
          cluster.physiologicTrendRobustStepStable = robustStepStable;
          cluster.physiologicTrendResidualRms = trendResidualRms;
          cluster.physiologicTrendSlope = trendSlope;
          cluster.physiologicTrendStable = eligible && stable;
          cluster.physiologicTrendCenter = median(
            history.map((item) => item.hrBpm)
          );
          cluster.physiologicRecent15Coverage = clamp(
            recent15.length / Math.max(1, 15 / config.stepSec),
            0,
            1
          );
        }
        const active = tracks.filter(
          (track) => timeSec - track.lastTimeSec <= config.hrPersistentTrackMaxGapSec
        );
        const haveEstablishedTrack = clusters.some(
          (cluster) => cluster.physiologicTrendEligible
        );
        if (timeSec >= config.hrBandInitializationSec && haveEstablishedTrack) {
          const weight = clamp(config.hrTrendScoreWeight, 0, 1);
          const bestPreTrendScore = clusters.reduce(
            (best, cluster) => Math.max(best, cluster.observationScore || 0),
            0
          );
          for (const cluster of clusters) {
            cluster.preTrendObservationScore = cluster.observationScore;
            if (bestPreTrendScore - cluster.observationScore <= config.hrDataDrivenTieMargin) {
              cluster.observationScore = clamp(
                (1 - weight) * cluster.observationScore + weight * (cluster.physiologicTrendScore || 0),
                0,
                1
              );
            }
          }
        } else {
          for (const cluster of clusters) {
            cluster.preTrendObservationScore = cluster.observationScore;
          }
        }
        return active;
      }
      function createBaselineBandState() {
        return {
          initialized: false,
          centerHr: NaN,
          candidateCenters: [],
          halfWidthBpm: NaN,
          acceptedHistory: [],
          lastSelected: null,
          holdDurationSec: 0,
          pendingCenterHr: NaN,
          pendingDurationSec: 0,
          previousCenterHr: NaN,
          lastRefreshSec: NaN,
          nextRefreshSec: NaN,
          bandEpoch: 0,
          mode: "initializing"
        };
      }
      function rankedBandCandidates(clusters, config) {
        const ranked = clusters.filter(
          (cluster) => cluster.physiologicTrendEligible && cluster.physiologicTrendStable !== false
        ).map((cluster) => ({
          cluster,
          center: Number.isFinite(cluster.physiologicTrendCenter) ? cluster.physiologicTrendCenter : cluster.hrBpm,
          score: (cluster.physiologicTrendCoverage || 0) * (0.45 * cluster.supportScore + 0.45 * cluster.spectralScore + 0.1 * (1 - (cluster.gyroPenalty || 0)))
        })).sort((left, right) => right.score - left.score);
        const retained = [];
        for (const item of ranked) {
          if (retained.some(
            (existing) => Math.abs(existing.center - item.center) < config.hrBandCandidateMergeBpm
          )) continue;
          retained.push(item);
          if (retained.length >= config.hrBandMaximumCandidates) break;
        }
        return retained;
      }
      function rankedInitialBandCandidates(clusters, config) {
        const requiredWindows = Array.isArray(
          config.hrBandInitializationRequiredWindows
        ) ? config.hrBandInitializationRequiredWindows : [20, 30];
        const eligible = clusters.filter((cluster) => requiredWindows.every(
          (windowSec) => cluster.supportWindows.includes(windowSec)
        ));
        const allRanked = rankedBandCandidates(
          eligible,
          { ...config, hrBandMaximumCandidates: Math.max(
            config.hrBandMaximumCandidates,
            eligible.length
          ) }
        );
        const rhythmWeight = clamp(config.rhythmInitializationBlendWeight || 0, 0, 1);
        return allRanked.map((item) => ({
          ...item,
          score: (1 - rhythmWeight) * item.score + rhythmWeight * candidateHeartLikelihood(item.cluster, config)
        })).sort((left, right) => right.score - left.score).slice(0, config.hrBandMaximumCandidates);
      }
      function bandHalfWidth(history, config) {
        const center = median(history);
        const deviation = median(history.map((value) => Math.abs(value - center)));
        const adaptive = Math.max(
          config.hrBandHalfWidthBpm,
          Number.isFinite(deviation) ? 3 * deviation : 0
        );
        return clamp(
          adaptive,
          config.hrBandMinimumHalfWidthBpm,
          config.hrBandMaximumHalfWidthBpm
        );
      }
      function isLowStrongArtifactCandidate(candidate, clusters, anchorHr, config) {
        if (!config.hrLowStrongArtifactGuardEnabled || !candidate || !Number.isFinite(anchorHr) || anchorHr < config.hrLowStrongArtifactMinimumAnchorBpm) return false;
        const band = config.hrLowStrongArtifactBandBpm || [50, 68];
        if (candidate.hrBpm < band[0] || candidate.hrBpm > band[1] || candidate.spectralScore < config.hrLowStrongArtifactMinimumSpectralScore || anchorHr - candidate.hrBpm < config.hrLowStrongArtifactMinimumDistanceBpm) return false;
        const requiredWindows = config.hrLowStrongArtifactRequiredWindows || [20, 30];
        if (!requiredWindows.every((windowSec) => candidate.supportWindows?.includes(windowSec))) return false;
        const anchorMatchBpm = config.hrLowStrongArtifactAnchorMatchBpm || 15;
        const anchorCandidate = clusters.filter(
          (cluster) => Math.abs(cluster.hrBpm - anchorHr) <= anchorMatchBpm && requiredWindows.every((windowSec) => cluster.supportWindows?.includes(windowSec))
        ).sort(
          (left, right) => Math.abs(left.hrBpm - anchorHr) - Math.abs(right.hrBpm - anchorHr) || right.spectralScore - left.spectralScore
        )[0] || null;
        if (!anchorCandidate) return false;
        return candidate.spectralScore / Math.max(anchorCandidate.spectralScore, 0.05) >= config.hrLowStrongArtifactSpectralDominanceRatio;
      }
      function applyRobustCandidateBand(clusters, timeSec, state, config) {
        if (!config.hrBandEnabled) {
          state.mode = "disabled";
          return { eligibleClusters: clusters, forcedSelection: null, resetBeam: false };
        }
        const controlClusters = state.initialized ? clusters.filter((cluster) => !isLowStrongArtifactCandidate(
          cluster,
          clusters,
          state.centerHr,
          config
        )) : clusters;
        if (!state.initialized) {
          if (timeSec < config.hrBandInitializationSec) {
            state.mode = "initializing";
            return { eligibleClusters: clusters, forcedSelection: null, resetBeam: false };
          }
          const initialBands = rankedInitialBandCandidates(clusters, config);
          if (initialBands.length === 0) {
            state.mode = "initializing_wait";
            return { eligibleClusters: clusters, forcedSelection: null, resetBeam: false };
          }
          state.initialized = true;
          state.candidateCenters = initialBands.map((item) => item.center);
          state.centerHr = state.candidateCenters[0];
          state.acceptedHistory = [state.centerHr];
          state.halfWidthBpm = config.hrBandHalfWidthBpm;
          state.lastRefreshSec = timeSec;
          state.nextRefreshSec = timeSec + config.hrBandRefreshSec;
          state.bandEpoch = 1;
          state.mode = "band_initialized";
        }
        let refreshMode = null;
        if (timeSec + 1e-9 >= state.nextRefreshSec) {
          const refreshedBands = rankedBandCandidates(controlClusters, config);
          if (refreshedBands.length > 0) {
            const refreshedCenters = refreshedBands.map((item) => item.center);
            const previousCenters = state.candidateCenters.slice();
            const pathStillSupported = state.lastSelected && refreshedCenters.some(
              (center) => Math.abs(state.lastSelected.hrBpm - center) <= state.halfWidthBpm
            );
            {
              state.previousCenterHr = state.centerHr;
              state.candidateCenters = refreshedCenters;
              state.centerHr = pathStillSupported ? refreshedCenters.slice().sort(
                (a, b) => Math.abs(a - state.lastSelected.hrBpm) - Math.abs(b - state.lastSelected.hrBpm)
              )[0] : refreshedCenters[0];
              state.acceptedHistory = [state.centerHr];
              state.halfWidthBpm = config.hrBandHalfWidthBpm;
              state.holdDurationSec = 0;
              state.pendingCenterHr = NaN;
              state.pendingDurationSec = 0;
              state.bandEpoch += 1;
              const setChanged = previousCenters.length !== refreshedCenters.length || refreshedCenters.some((center) => !previousCenters.some(
                (previous) => Math.abs(previous - center) < config.hrBandCandidateMergeBpm
              ));
              refreshMode = setChanged ? "bands_refreshed" : "bands_retained";
              state.resetAtRefresh = !pathStillSupported;
            }
          } else {
            refreshMode = "band_refresh_kept";
          }
          state.lastRefreshSec = timeSec;
          do {
            state.nextRefreshSec += config.hrBandRefreshSec;
          } while (timeSec + 1e-9 >= state.nextRefreshSec);
        }
        let inBand = controlClusters.filter((cluster) => state.candidateCenters.some(
          (center) => Math.abs(cluster.hrBpm - center) <= state.halfWidthBpm
        ));
        if (state.lastSelected && inBand.length > 0) {
          const maximumTransition = config.hrBandMaximumTransitionBpmPerSec * config.stepSec;
          const reachable = inBand.filter(
            (cluster) => Math.abs(cluster.hrBpm - state.lastSelected.hrBpm) <= maximumTransition
          );
          inBand = reachable;
        }
        if (inBand.length > 0) {
          state.holdDurationSec = 0;
          state.pendingCenterHr = NaN;
          state.pendingDurationSec = 0;
          state.mode = refreshMode || "in_band";
          return {
            eligibleClusters: inBand,
            forcedSelection: null,
            resetBeam: Boolean(refreshMode && state.resetAtRefresh)
          };
        }
        state.pendingCenterHr = NaN;
        state.pendingDurationSec = 0;
        const maximumHoldSec = config.hrBandHoldMaximumSec;
        if (state.lastSelected && state.holdDurationSec < maximumHoldSec) {
          state.holdDurationSec += config.stepSec;
          state.mode = "hold_missing_candidate";
          const held = {
            ...state.lastSelected,
            hrBpm: state.lastSelected.hrBpm,
            frequencyHz: state.lastSelected.hrBpm / 60,
            quality: 0.7 * state.lastSelected.quality,
            observationScore: 0.7 * state.lastSelected.observationScore,
            heldByBaselineBand: true
          };
          return { eligibleClusters: [], forcedSelection: held, resetBeam: false };
        }
        state.mode = "band_unlocked";
        return { eligibleClusters: controlClusters, forcedSelection: null, resetBeam: true };
      }
      function createLowZoneAdmissionState() {
        return {
          mode: "normal",
          candidateHr: NaN,
          candidateDurationSec: 0,
          evidencePassSec: 0,
          anchorMissingSec: 0,
          exitCandidateHr: NaN,
          exitDurationSec: 0
        };
      }
      function applyLowZoneAdmission(clusters, previousReliableHr, state, config) {
        if (config.hrLowZoneEnabled !== true) {
          return { eligibleClusters: clusters, admitted: true };
        }
        const [lowMin, lowMax] = config.hrLowZoneBandBpm || [50, 68];
        const normalBoundary = config.hrLowZoneNormalBoundaryBpm || 75;
        const requiredWindows = config.hrLowZoneRequiredWindows || [20, 30];
        const matchBpm = config.hrLowZoneCandidateMatchBpm || 6;
        const lowCandidates = clusters.filter(
          (cluster) => cluster.hrBpm >= lowMin && cluster.hrBpm <= lowMax && requiredWindows.every((windowSec) => cluster.supportWindows?.includes(windowSec))
        ).sort(
          (left, right) => (right.observationScore || 0) - (left.observationScore || 0) || (right.physiologicTrendCoverage || 0) - (left.physiologicTrendCoverage || 0)
        );
        const nonLowClusters = clusters.filter(
          (cluster) => cluster.hrBpm < lowMin || cluster.hrBpm > lowMax
        );
        const strongestLow = lowCandidates[0] || null;
        if (state.mode === "confirmed") {
          const lowObservation = strongestLow?.observationScore || 0;
          const exitCandidate = clusters.filter(
            (cluster) => cluster.hrBpm >= normalBoundary && requiredWindows.every((windowSec) => cluster.supportWindows?.includes(windowSec)) && (cluster.observationScore || 0) >= lowObservation + (config.hrLowZoneExitObservationAdvantage || 0.05)
          ).sort(
            (left, right) => (right.observationScore || 0) - (left.observationScore || 0)
          )[0] || null;
          if (exitCandidate) {
            const sameExit = Number.isFinite(state.exitCandidateHr) && Math.abs(exitCandidate.hrBpm - state.exitCandidateHr) <= matchBpm;
            state.exitDurationSec = sameExit ? state.exitDurationSec + config.stepSec : config.stepSec;
            state.exitCandidateHr = exitCandidate.hrBpm;
          } else {
            state.exitCandidateHr = NaN;
            state.exitDurationSec = 0;
          }
          if (state.exitDurationSec >= (config.hrLowZoneExitConfirmSec || 5)) {
            Object.assign(state, createLowZoneAdmissionState());
          } else {
            return { eligibleClusters: clusters, admitted: true };
          }
        }
        const anchorHr = Number.isFinite(previousReliableHr) && previousReliableHr >= normalBoundary ? previousReliableHr : NaN;
        const anchorContinuation = clusters.some(
          (cluster) => cluster.hrBpm >= normalBoundary && requiredWindows.every((windowSec) => cluster.supportWindows?.includes(windowSec)) && (!Number.isFinite(anchorHr) || Math.abs(cluster.hrBpm - anchorHr) <= 15)
        );
        const stableHighAlternative = clusters.some(
          (cluster) => cluster.hrBpm >= normalBoundary && requiredWindows.every((windowSec) => cluster.supportWindows?.includes(windowSec)) && (cluster.observationScore || 0) >= (strongestLow?.observationScore || 0) - 0.05
        );
        state.anchorMissingSec = anchorContinuation || stableHighAlternative ? 0 : state.anchorMissingSec + config.stepSec;
        if (strongestLow) {
          const sameLow = Number.isFinite(state.candidateHr) && Math.abs(strongestLow.hrBpm - state.candidateHr) <= matchBpm;
          state.candidateDurationSec = sameLow ? state.candidateDurationSec + config.stepSec : config.stepSec;
          state.evidencePassSec = sameLow ? state.evidencePassSec : 0;
          state.candidateHr = strongestLow.hrBpm;
          state.mode = "pending";
          const criticalBand = config.hrCriticalLowBandBpm || [50, 55];
          const critical = strongestLow.hrBpm >= criticalBand[0] && strongestLow.hrBpm <= criticalBand[1];
          const minimumObservation = critical ? config.hrCriticalLowMinimumObservationScore || 0.65 : config.hrLowZoneMinimumObservationScore || 0.6;
          const minimumCoverage = critical ? config.hrCriticalLowMinimumTrackCoverage || 0.8 : config.hrLowZoneMinimumTrackCoverage || 0.65;
          if ((strongestLow.observationScore || 0) >= minimumObservation && (strongestLow.physiologicTrendCoverage || 0) >= minimumCoverage) {
            state.evidencePassSec += config.stepSec;
          }
          const confirmSec = critical ? config.hrCriticalLowEntryConfirmSec || 30 : config.hrLowZoneEntryConfirmSec || 20;
          const evidenceRatio = state.evidencePassSec / Math.max(config.stepSec, state.candidateDurationSec);
          if (state.candidateDurationSec >= confirmSec && state.anchorMissingSec >= (config.hrLowZoneOldAnchorMissingSec || 15) && evidenceRatio >= (config.hrLowZoneEvidencePassRatio || 0.7)) {
            state.mode = "confirmed";
            state.exitCandidateHr = NaN;
            state.exitDurationSec = 0;
            return { eligibleClusters: clusters, admitted: true };
          }
        } else {
          state.candidateHr = NaN;
          state.candidateDurationSec = 0;
          state.evidencePassSec = 0;
          state.mode = "normal";
        }
        return { eligibleClusters: nonLowClusters, admitted: false };
      }
      function commitRobustCandidateBandSelection(selected, state, config) {
        if (!selected) return;
        state.lastSelected = { ...selected };
        if (!state.initialized || selected.heldByBaselineBand) return;
        const selectedBand = state.candidateCenters.slice().sort((a, b) => Math.abs(a - selected.hrBpm) - Math.abs(b - selected.hrBpm))[0];
        if (!Number.isFinite(selectedBand) || Math.abs(selected.hrBpm - selectedBand) > state.halfWidthBpm) return;
        state.centerHr = selectedBand;
        state.acceptedHistory.push(selected.hrBpm);
        const maximum = Math.max(1, Math.round(config.hrTrendHistorySec / config.stepSec));
        if (state.acceptedHistory.length > maximum) {
          state.acceptedHistory.splice(0, state.acceptedHistory.length - maximum);
        }
        state.halfWidthBpm = bandHalfWidth(state.acceptedHistory, config);
      }
      function candidateHeartLikelihood(candidate, config = {}) {
        if (!candidate) return 0;
        const intervalWeight = config.rhythmContextIntervalWeight ?? 0.45;
        const crossAxisWeight = config.rhythmContextCrossAxisWeight ?? 0.3;
        const autocorrelationWeight = config.rhythmContextAutocorrelationWeight ?? 0.25;
        const weightSum = Math.max(
          intervalWeight + crossAxisWeight + autocorrelationWeight,
          Number.EPSILON
        );
        return clamp(
          (intervalWeight * (candidate.intervalScore || 0) + crossAxisWeight * (candidate.crossAxisHeartEvidence || 0) + autocorrelationWeight * (candidate.autocorrelationScore || 0)) / weightSum,
          0,
          1
        );
      }
      function reacquireCandidate(proposed, clusters, config) {
        const longWindowCandidates = clusters.filter(
          (candidate) => candidate.supportWindows?.includes(20) && candidate.supportWindows?.includes(30)
        );
        const pool = longWindowCandidates.length > 0 ? longWindowCandidates : [proposed];
        const rhythmWeight = clamp(config.rhythmReacquireBlendWeight || 0, 0, 1);
        return pool.slice().sort((left, right) => {
          const leftScore = (1 - rhythmWeight) * (left.observationScore || 0) + rhythmWeight * candidateHeartLikelihood(left, config);
          const rightScore = (1 - rhythmWeight) * (right.observationScore || 0) + rhythmWeight * candidateHeartLikelihood(right, config);
          return rightScore - leftScore;
        })[0] || proposed;
      }
      function createRhythmSwitchState() {
        return {
          current: null,
          challengerHr: NaN,
          challengerDurationSec: 0,
          mode: "initialize",
          oldEvidence: 0,
          newEvidence: 0,
          advantage: 0
        };
      }
      function nearestCandidate(clusters, hrBpm, maximumDistanceBpm) {
        if (!Number.isFinite(hrBpm)) return null;
        const nearest = clusters.slice().sort(
          (left, right) => Math.abs(left.hrBpm - hrBpm) - Math.abs(right.hrBpm - hrBpm)
        )[0];
        return nearest && Math.abs(nearest.hrBpm - hrBpm) <= maximumDistanceBpm ? nearest : null;
      }
      function applyRhythmSwitchController(proposed, clusters, state, config) {
        if (!config.rhythmSwitchControllerEnabled || !proposed) {
          if (proposed) state.current = proposed;
          state.mode = proposed ? "disabled" : "no_candidate";
          return proposed;
        }
        if (!state.current) {
          state.current = proposed;
          state.mode = "initialized";
          return proposed;
        }
        const distance = Math.abs(proposed.hrBpm - state.current.hrBpm);
        if (distance < config.rhythmSwitchRemoteBpm) {
          state.current = proposed;
          state.challengerHr = NaN;
          state.challengerDurationSec = 0;
          state.mode = "track";
          return proposed;
        }
        const oldCandidate = nearestCandidate(
          clusters,
          state.current.hrBpm,
          config.rhythmSwitchOldMatchBpm
        );
        const newEvidence = candidateHeartLikelihood(proposed, config);
        const oldEvidence = candidateHeartLikelihood(oldCandidate, config);
        const advantage = newEvidence - oldEvidence;
        const sameChallenge = Number.isFinite(state.challengerHr) && Math.abs(proposed.hrBpm - state.challengerHr) <= config.rhythmSwitchChallengeMatchBpm;
        state.challengerHr = sameChallenge ? 0.8 * state.challengerHr + 0.2 * proposed.hrBpm : proposed.hrBpm;
        state.challengerDurationSec = sameChallenge ? state.challengerDurationSec + config.stepSec : config.stepSec;
        state.oldEvidence = oldEvidence;
        state.newEvidence = newEvidence;
        state.advantage = advantage;
        if (!oldCandidate) {
          const reacquired = reacquireCandidate(proposed, clusters, config);
          state.current = reacquired;
          state.challengerHr = NaN;
          state.challengerDurationSec = 0;
          state.mode = "reacquired";
          return reacquired;
        }
        const oldClearlyBetter = oldEvidence - newEvidence >= config.rhythmSwitchOldEvidenceAdvantage;
        if (!oldClearlyBetter || state.challengerDurationSec >= config.rhythmSwitchMaximumVetoSec) {
          state.current = proposed;
          state.challengerHr = NaN;
          state.challengerDurationSec = 0;
          state.mode = oldClearlyBetter ? "challenge_timeout_accept" : "evidence_allows_switch";
          return proposed;
        }
        state.mode = state.challengerDurationSec >= config.rhythmSwitchConfirmSec ? "challenge_rejected" : "challenge_hold";
        return {
          ...state.current,
          quality: 0.7 * (state.current.quality || 0),
          observationScore: 0.7 * (state.current.observationScore || 0),
          heldByRhythmController: true
        };
      }
      function resolveStateAtTime(timeSec, windowStates, defaultWindowSec) {
        if (!Array.isArray(windowStates) || windowStates.length === 0) return "unknown";
        const step = windowStates.length > 1 ? Math.max(1e-6, windowStates[1].winEnd_s - windowStates[0].winEnd_s) : 1;
        const firstEnd = Number.isFinite(windowStates[0].winEnd_s) ? windowStates[0].winEnd_s : defaultWindowSec;
        const index = clamp(
          Math.floor((timeSec - firstEnd) / step + 1e-9),
          0,
          windowStates.length - 1
        );
        return windowStates[index]?.state || "unknown";
      }
      function medianFilter(values, windowSize) {
        const source = Array.from(values || []);
        const output = new Float64Array(source.length);
        for (let i = 0; i < source.length; i++) {
          output[i] = median(source.slice(
            Math.max(0, i - windowSize + 1),
            i + 1
          ));
        }
        return output;
      }
      function postProcessHeartRate(timeAxis, rawHeartRate, quality, config) {
        if (rawHeartRate.length === 0) return new Float64Array(0);
        const medians = medianFilter(rawHeartRate, config.hrMedianWindowSize);
        const output = new Float64Array(rawHeartRate.length);
        output[0] = medians[0];
        for (let i = 1; i < rawHeartRate.length; i++) {
          const previous = output[i - 1];
          const raw = Number.isFinite(rawHeartRate[i]) ? rawHeartRate[i] : previous;
          const localMedian = Number.isFinite(medians[i]) ? medians[i] : raw;
          const confidence = Number.isFinite(quality[i]) ? quality[i] : 0;
          const dt = Math.max(1e-6, timeAxis[i] - timeAxis[i - 1]);
          const maxStep = Math.min(
            config.hrHardMaxStepBpm,
            config.hrMaxSlopeBpmPerSec * dt
          );
          let candidate = raw;
          if (confidence < config.hrLowQualityThreshold && Math.abs(raw - localMedian) > config.hrOutlierGapBpm) {
            candidate = localMedian;
          }
          candidate = previous + clamp(candidate - previous, -maxStep, maxStep);
          const alpha = clamp(
            config.hrPostAlpha * (0.65 + 0.35 * confidence),
            0.1,
            0.9
          );
          output[i] = alpha * candidate + (1 - alpha) * previous;
        }
        return output;
      }
      function createEstimatorRuntimeState(config = baseConfig) {
        return {
          initialized: true,
          authoritativeReliableState: createAuthoritativeReliableHistoryState(),
          baselineAcceptedHistory: [],
          previousReliableHr: NaN,
          gyroMotionTracks: [],
          diagnosticCandidateTracks: [],
          physiologicCandidateTracks: [],
          baselineBand: createBaselineBandState(),
          rhythmSwitchState: createRhythmSwitchState(),
          candidateBeam: [],
          lastRespiratoryRate: 0,
          respiratoryFamilyState: createRespiratoryFamilyState(),
          respiratoryControlAdmissionState: createRespiratoryControlAdmissionState(),
          qualityGateGapSec: 0,
          qualityGateResetForCurrentGap: false,
          qualityRecoveryState: {
            active: false,
            type: "none",
            candidateHr: NaN,
            candidateDurationSec: 0,
            oldAnchorHr: NaN,
            oldAnchorWeight: 0
          },
          lowZoneAdmissionState: createLowZoneAdmissionState(),
          sixtySecondTrackState: createSixtySecondTrackState(config),
          selectionArbiterState: createSelectionArbiterState(),
          rawBeamTransitionGuardState: createRawBeamTransitionGuardState(),
          matureTrackTakeover: null,
          matureRemoteCandidateHr: NaN,
          matureRemoteCandidateDurationSec: 0,
          selectedOutputTrack: [],
          boundaryStateResetDone: true
        };
      }
      function estimateHRRRTimeSeries(sResp, sHeart, sampleRateHz, options = {}) {
        const config = Object.assign({}, baseConfig, options);
        const respiratory = toF64(sResp);
        const heart = toF64(sHeart);
        const diagnosticAxes = {
          x: toF64(config.diagnosticHeartAxes?.x),
          y: toF64(config.diagnosticHeartAxes?.y),
          z: toF64(config.diagnosticHeartAxes?.z)
        };
        const artifactMask = config.artifactMask && config.artifactMask.length >= heart.length ? config.artifactMask : null;
        const haveDiagnosticAxes = ["x", "y", "z"].every(
          (axis) => diagnosticAxes[axis].length >= heart.length
        );
        const sampleCount = Math.min(respiratory.length, heart.length);
        const durationSec = sampleCount / sampleRateHz;
        const windowSecList = config.windowSecList.slice().sort((a, b) => a - b);
        const minimumWindowSec = windowSecList[0];
        const stepSec = config.stepSec;
        const runtimeState = config.runtimeState || null;
        const timelineOffsetSec = runtimeState ? Number(config.timelineOffsetSec) || 0 : 0;
        const startTime = runtimeState ? durationSec : minimumWindowSec;
        const endTime = durationSec;
        const stateStore = runtimeState || createEstimatorRuntimeState(config);
        const authoritativeReliableState = stateStore.authoritativeReliableState;
        const acceptedHistory = stateStore.baselineAcceptedHistory;
        let previousReliableHr = stateStore.previousReliableHr;
        let gyroMotionTracks = stateStore.gyroMotionTracks;
        let diagnosticCandidateTracks = stateStore.diagnosticCandidateTracks;
        let physiologicCandidateTracks = stateStore.physiologicCandidateTracks;
        const baselineBand = stateStore.baselineBand;
        const rhythmSwitchState = stateStore.rhythmSwitchState;
        let candidateBeam = stateStore.candidateBeam;
        let lastRespiratoryRate = stateStore.lastRespiratoryRate;
        const respiratoryFamilyState = stateStore.respiratoryFamilyState;
        const respiratoryControlAdmissionState = stateStore.respiratoryControlAdmissionState;
        let qualityGateGapSec = stateStore.qualityGateGapSec;
        let qualityGateResetForCurrentGap = stateStore.qualityGateResetForCurrentGap;
        const qualityRecoveryState = stateStore.qualityRecoveryState;
        const lowZoneAdmissionState = stateStore.lowZoneAdmissionState;
        const sixtySecondTrackState = stateStore.sixtySecondTrackState;
        const selectionArbiterState = stateStore.selectionArbiterState;
        const rawBeamTransitionGuardState = stateStore.rawBeamTransitionGuardState;
        let matureTrackTakeover = stateStore.matureTrackTakeover;
        let matureRemoteCandidateHr = stateStore.matureRemoteCandidateHr;
        let matureRemoteCandidateDurationSec = stateStore.matureRemoteCandidateDurationSec;
        const selectedOutputTrack = stateStore.selectedOutputTrack;
        let boundaryStateResetDone = runtimeState ? true : !(config.stateResetTimeSec > startTime);
        const heartRateTimeSeries = [];
        const respiratoryRateTimeSeries = [];
        const segments = [];
        const candidateDiagnostics = [];
        const timeAxis = [];
        if (!(sampleRateHz > 0) || sampleCount < minimumWindowSec * sampleRateHz) {
          return {
            heartRateTimeSeries,
            respiratoryRateTimeSeries,
            segments,
            timeAxis,
            heartRate: 0,
            respiratoryRate: 0
          };
        }
        for (let localTimeSec = startTime; localTimeSec <= endTime + 1e-9; localTimeSec += stepSec) {
          const timeSec = localTimeSec + timelineOffsetSec;
          if (!boundaryStateResetDone && timeSec + 1e-9 >= config.stateResetTimeSec) {
            candidateBeam = [];
            acceptedHistory.length = 0;
            Object.assign(
              authoritativeReliableState,
              createAuthoritativeReliableHistoryState()
            );
            previousReliableHr = NaN;
            Object.assign(rhythmSwitchState, createRhythmSwitchState());
            Object.assign(lowZoneAdmissionState, createLowZoneAdmissionState());
            Object.assign(selectionArbiterState, createSelectionArbiterState());
            Object.assign(
              rawBeamTransitionGuardState,
              createRawBeamTransitionGuardState()
            );
            Object.assign(
              respiratoryControlAdmissionState,
              createRespiratoryControlAdmissionState()
            );
            qualityRecoveryState.active = false;
            qualityRecoveryState.type = "none";
            qualityRecoveryState.candidateHr = NaN;
            qualityRecoveryState.candidateDurationSec = 0;
            selectedOutputTrack.length = 0;
            boundaryStateResetDone = true;
          }
          const qualityGateDecision = config.rawImuQualityGate && typeof config.rawImuQualityGate.decisionAt === "function" ? config.rawImuQualityGate.decisionAt(localTimeSec) : { accepted: true, validityStatus: "not_evaluated", motionStatus: "not_evaluated", reasons: [] };
          if (!qualityGateDecision.accepted) {
            preserveAuthoritativeReliableHistory(
              authoritativeReliableState,
              "quality_rejected_preserve_history"
            );
            qualityGateGapSec += stepSec;
            candidateBeam = candidateBeam.map((track) => ({
              ...track,
              cumulativeScore: track.cumulativeScore * config.hrTrackMemory,
              ageSec: track.ageSec + stepSec
            }));
            if (baselineBand.mode === "hold_pending_shift") {
              baselineBand.holdDurationSec += stepSec;
            }
            const longGapResetSec = Math.max(
              stepSec,
              config.rawImuQualityLongGapResetSec || 10
            );
            let stateResetThisSecond = false;
            if (!qualityGateResetForCurrentGap && qualityGateGapSec >= longGapResetSec) {
              qualityRecoveryState.oldAnchorHr = Number.isFinite(previousReliableHr) ? previousReliableHr : rhythmSwitchState.current?.hrBpm || baselineBand.lastSelected?.hrBpm || NaN;
              gyroMotionTracks = [];
              diagnosticCandidateTracks = [];
              physiologicCandidateTracks = [];
              candidateBeam = [];
              Object.assign(baselineBand, createBaselineBandState());
              Object.assign(rhythmSwitchState, createRhythmSwitchState());
              Object.assign(lowZoneAdmissionState, createLowZoneAdmissionState());
              Object.assign(
                sixtySecondTrackState,
                createSixtySecondTrackState(config)
              );
              Object.assign(selectionArbiterState, createSelectionArbiterState());
              Object.assign(
                rawBeamTransitionGuardState,
                createRawBeamTransitionGuardState()
              );
              Object.assign(
                respiratoryFamilyState,
                createRespiratoryFamilyState()
              );
              Object.assign(
                respiratoryControlAdmissionState,
                createRespiratoryControlAdmissionState()
              );
              qualityGateResetForCurrentGap = true;
              stateResetThisSecond = true;
            }
            heartRateTimeSeries.push({
              time_s: timeSec,
              hr_bpm: NaN,
              hr_bpm_raw: NaN,
              quality_score: 0,
              peak_hz: NaN,
              peak_mag: NaN,
              state: "quality_rejected",
              candidate_count: 0,
              cluster_count: 0,
              support_count: 0,
              support_windows: "",
              selection_score: 0,
              quality_gate_pass: 0,
              quality_validity_status: qualityGateDecision.validityStatus,
              quality_motion_status: qualityGateDecision.motionStatus,
              quality_reject_reasons: qualityGateDecision.reasons.join("|"),
              quality_gate_gap_sec: qualityGateGapSec,
              quality_gate_state_reset: stateResetThisSecond ? 1 : 0
            });
            respiratoryRateTimeSeries.push({
              time_s: timeSec,
              rr_bpm: NaN,
              quality_score: 0,
              state: "quality_rejected"
            });
            segments.push({
              time_s: timeSec,
              hr_bpm: NaN,
              hr_bpm_raw: NaN,
              state: "quality_rejected",
              quality_gate_pass: 0
            });
            timeAxis.push(timeSec);
            continue;
          }
          const recoveredAfterGapSec = qualityGateGapSec;
          const recoveredAfterStateReset = qualityGateResetForCurrentGap;
          const mediumGapMinSec = config.rawImuQualityMediumGapMinSec || 3;
          if (recoveredAfterGapSec >= mediumGapMinSec) {
            qualityRecoveryState.active = true;
            qualityRecoveryState.type = recoveredAfterGapSec >= (config.rawImuQualityLongGapResetSec || 10) ? "long" : "medium";
            qualityRecoveryState.candidateHr = NaN;
            qualityRecoveryState.candidateDurationSec = 0;
            if (qualityRecoveryState.type === "medium") {
              qualityRecoveryState.oldAnchorHr = Number.isFinite(previousReliableHr) ? previousReliableHr : rhythmSwitchState.current?.hrBpm || NaN;
              qualityRecoveryState.oldAnchorWeight = 0.5;
            } else {
              qualityRecoveryState.oldAnchorWeight = Math.max(
                config.rawImuQualityRecoveryMinimumAnchorWeight || 0.15,
                clamp(0.5 * (30 - recoveredAfterGapSec) / 20, 0, 0.5)
              );
            }
          }
          qualityGateGapSec = 0;
          qualityGateResetForCurrentGap = false;
          previousReliableHr = authoritativeReliableState.lastHr;
          config.hrDataDrivenScoringActive = baselineBand.initialized === true;
          const allCandidates = [];
          const availableWindowSecs = [];
          const axisSpectraByWindow = {};
          let longestRespiratoryWindow = null;
          for (const windowSec of windowSecList) {
            if (localTimeSec - windowSec < 0 || localTimeSec > durationSec) continue;
            const start = Math.round((localTimeSec - windowSec) * sampleRateHz);
            const length = Math.round(windowSec * sampleRateHz);
            if (start < 0 || start + length > sampleCount) continue;
            const heartWindow = heart.subarray(start, start + length);
            const gyroWindow = config.gyroMotionSignal && config.gyroMotionSignal.length >= start + length ? config.gyroMotionSignal.subarray(start, start + length) : null;
            const magnitudeResult = extractTopCandidates(
              heartWindow,
              gyroWindow,
              sampleRateHz,
              windowSec,
              config
            );
            let contaminatedSamples = 0;
            if (artifactMask) {
              for (let index = start; index < start + length; index++) {
                if (artifactMask[index]) contaminatedSamples++;
              }
            }
            const contaminationRatio = length > 0 ? contaminatedSamples / length : 0;
            for (const candidate of magnitudeResult.candidates) {
              candidate.contaminationRatio = contaminationRatio;
            }
            if (haveDiagnosticAxes) {
              axisSpectraByWindow[windowSec] = {};
              const axisWindows = {};
              for (const axis of ["x", "y", "z"]) {
                const axisWindow = diagnosticAxes[axis].subarray(start, start + length);
                axisWindows[axis] = axisWindow;
                axisSpectraByWindow[windowSec][axis] = periodogramPSD(
                  removeDC(axisWindow),
                  sampleRateHz,
                  { window: "hann" }
                );
              }
              annotateCrossAxisEventEvidence(
                magnitudeResult.candidates,
                axisWindows,
                gyroWindow,
                sampleRateHz,
                config
              );
            }
            allCandidates.push(...magnitudeResult.candidates);
            availableWindowSecs.push(windowSec);
            longestRespiratoryWindow = respiratory.subarray(start, start + length);
          }
          const state = resolveStateAtTime(
            localTimeSec,
            config.windowStates,
            config.windowSec
          );
          const baselineHr = median(
            acceptedHistory.slice(-config.hrBaselineHistoryLength).map((item) => item.hrBpm)
          );
          const mergedClusters = mergeCandidates(
            allCandidates,
            availableWindowSecs,
            config,
            previousReliableHr,
            baselineHr,
            state
          );
          const rr = longestRespiratoryWindow ? estimateRespiratoryPeak(
            longestRespiratoryWindow,
            sampleRateHz,
            config
          ) : { bpm: lastRespiratoryRate, quality: 0, frequencyHz: 0, amplitude: 0 };
          if (rr.bpm > 0) lastRespiratoryRate = rr.bpm;
          updateRespiratoryFamilyState(
            respiratoryFamilyState,
            rr,
            stepSec,
            config
          );
          const clusters = mergedClusters;
          const motionReliability = state === "moving" ? 0.75 : state === "static" ? 1 : 0.85;
          gyroMotionTracks = applyGyroPenalty(
            clusters,
            gyroMotionTracks,
            config,
            motionReliability
          );
          diagnosticCandidateTracks = updateDiagnosticCandidateTracks(
            clusters,
            diagnosticCandidateTracks,
            timeSec,
            config
          );
          annotateCandidateEvidence(clusters, axisSpectraByWindow, config);
          const retainedClusters = applySafeCandidateExclusion(clusters, config);
          computeObservationScores(retainedClusters, config);
          const respiratoryFamilyResult = applyRespiratoryFamilyPenalty(
            retainedClusters,
            respiratoryFamilyState,
            rr,
            previousReliableHr,
            config
          );
          physiologicCandidateTracks = updatePhysiologicCandidateTracks(
            retainedClusters,
            physiologicCandidateTracks,
            timeSec,
            config
          );
          const lowZoneResult = applyLowZoneAdmission(
            retainedClusters,
            previousReliableHr,
            lowZoneAdmissionState,
            config
          );
          const selectionClusters = lowZoneResult.eligibleClusters.length > 0 ? lowZoneResult.eligibleClusters : retainedClusters;
          const matureTrackClusters = lowZoneResult.eligibleClusters;
          const sixtySecondTrackResult = selectSixtySecondTrack(
            matureTrackClusters,
            timeSec,
            sixtySecondTrackState,
            config
          );
          matureTrackTakeover = null;
          const bandResult = applyRobustCandidateBand(
            selectionClusters,
            timeSec,
            baselineBand,
            config
          );
          if (bandResult.resetBeam) candidateBeam = [];
          const beamResult = bandResult.forcedSelection ? {
            selected: bandResult.forcedSelection,
            beam: candidateBeam,
            mode: baselineBand.mode
          } : updateCandidateBeam(
            bandResult.eligibleClusters,
            candidateBeam,
            config
          );
          candidateBeam = beamResult.beam;
          const proposedSelection = beamResult.selected;
          const rawBeamSelection = applyRhythmSwitchController(
            proposedSelection,
            selectionClusters,
            rhythmSwitchState,
            config
          );
          const rawGuardResult = guardRawBeamSelection(
            rawBeamSelection,
            selectionClusters,
            timeSec,
            rawBeamTransitionGuardState,
            authoritativeReliableState,
            config
          );
          const rawScoreSelection = rawGuardResult.selected;
          const arbitration = arbitrateSelection(
            rawScoreSelection,
            sixtySecondTrackResult,
            selectionArbiterState,
            config
          );
          const beamSelectedTrack = candidateBeam.find((track) => track.cluster === arbitration.selected);
          const respiratoryControlResult = reviewRespiratoryControlAdmission(
            arbitration.selected,
            selectionClusters,
            respiratoryFamilyState,
            rr,
            timeSec,
            respiratoryControlAdmissionState,
            {
              authoritativeHr: previousReliableHr,
              beamMode: beamResult.mode,
              trackReason: sixtySecondTrackResult.reason,
              rawGuardMode: rawGuardResult.mode,
              selectedTrackAgeSec: beamSelectedTrack?.ageSec || 0
            },
            config
          );
          let selected = respiratoryControlResult.selected;
          let recoveryConfirmedThisSecond = false;
          if (qualityRecoveryState.active) {
            const recoveryPool = selectionClusters.filter(
              (cluster) => qualityRecoveryState.type === "long" ? cluster.supportWindows?.includes(10) && cluster.supportWindows?.includes(20) : cluster.supportWindows?.includes(10)
            );
            const anchorSigma = config.rawImuQualityRecoveryAnchorSigmaBpm || 20;
            const recoveryCandidate = recoveryPool.slice().sort((left, right) => {
              const leftScore = (left.observationScore || left.score || 0) + qualityRecoveryState.oldAnchorWeight * temporalScore(
                left.hrBpm,
                qualityRecoveryState.oldAnchorHr,
                anchorSigma
              );
              const rightScore = (right.observationScore || right.score || 0) + qualityRecoveryState.oldAnchorWeight * temporalScore(
                right.hrBpm,
                qualityRecoveryState.oldAnchorHr,
                anchorSigma
              );
              return rightScore - leftScore;
            })[0] || null;
            if (recoveryCandidate) {
              const sameTrack = Number.isFinite(qualityRecoveryState.candidateHr) && Math.abs(recoveryCandidate.hrBpm - qualityRecoveryState.candidateHr) <= (config.rawImuQualityRecoveryMatchBpm || 6);
              qualityRecoveryState.candidateDurationSec = sameTrack ? qualityRecoveryState.candidateDurationSec + stepSec : stepSec;
              qualityRecoveryState.candidateHr = recoveryCandidate.hrBpm;
              selected = recoveryCandidate;
            } else {
              qualityRecoveryState.candidateDurationSec = 0;
              qualityRecoveryState.candidateHr = NaN;
              selected = null;
            }
            if (qualityRecoveryState.candidateDurationSec >= (config.rawImuQualityRecoveryConfirmSec || 5)) {
              qualityRecoveryState.active = false;
              recoveryConfirmedThisSecond = true;
            }
          }
          const qualityOutputAllowed = !qualityRecoveryState.active;
          commitRobustCandidateBandSelection(selected, baselineBand, config);
          const scoreOrder = clusters.slice().sort((a, b) => b.score - a.score);
          const bestScore = scoreOrder[0]?.score || 0;
          const secondScore = scoreOrder[1]?.score || 0;
          for (let rank = 0; rank < scoreOrder.length; rank++) {
            const cluster = scoreOrder[rank];
            const half = clusters.filter((item) => item !== cluster).sort(
              (a, b) => Math.abs(a.hrBpm - cluster.hrBpm / 2) - Math.abs(b.hrBpm - cluster.hrBpm / 2)
            )[0];
            const double = clusters.filter((item) => item !== cluster).sort(
              (a, b) => Math.abs(a.hrBpm - cluster.hrBpm * 2) - Math.abs(b.hrBpm - cluster.hrBpm * 2)
            )[0];
            const row = {
              time_s: timeSec,
              candidate_rank: rank + 1,
              candidate_hr_bpm: cluster.hrBpm,
              selected: cluster === selected ? 1 : 0,
              state,
              available_windows: availableWindowSecs.join("|"),
              support_windows: cluster.supportWindows.join("|"),
              support_score: cluster.supportScore,
              spectral_score: cluster.spectralScore,
              continuity_score: cluster.continuityScore,
              baseline_score: cluster.baselineScore,
              base_score: cluster.baseScore,
              final_score: cluster.score,
              contamination_ratio: cluster.contaminationRatio || 0,
              pre_artifact_observation_score: cluster.preArtifactObservationScore || 0,
              artifact_penalty: cluster.artifactPenalty || 0,
              autocorrelation_score: cluster.autocorrelationScore || 0,
              autocorrelation_full: cluster.autocorrelationFull || 0,
              autocorrelation_first_half: cluster.autocorrelationFirstHalf || 0,
              autocorrelation_second_half: cluster.autocorrelationSecondHalf || 0,
              autocorrelation_stability: cluster.autocorrelationStability || 0,
              interval_score: cluster.intervalScore || 0,
              cross_axis_consensus_score: cluster.crossAxisConsensusScore || 0,
              cross_axis_consensus_coverage: cluster.crossAxisConsensusCoverage || 0,
              cross_axis_gyro_sync_ratio: cluster.crossAxisGyroSyncRatio || 0,
              cross_axis_heart_evidence: cluster.crossAxisHeartEvidence || 0,
              observation_score: cluster.observationScore || 0,
              data_driven_observation_score: cluster.dataDrivenObservationScore || 0,
              relative_interval_score: cluster.relativeIntervalScore || 0,
              relative_cross_axis_score: cluster.relativeCrossAxisScore || 0,
              relative_autocorrelation_score: cluster.relativeAutocorrelationScore || 0,
              relative_heartbeat_score: cluster.relativeHeartbeatScore || 0,
              respiratory_rate_bpm: rr.bpm || lastRespiratoryRate,
              respiratory_family_stable_bpm: respiratoryFamilyState.stableBpm || 0,
              respiratory_family_order: cluster.respiratoryFamilyOrder || 0,
              respiratory_family_target_bpm: cluster.respiratoryFamilyTargetBpm || 0,
              respiratory_family_distance_bpm: cluster.respiratoryFamilyDistanceBpm || 0,
              respiratory_family_penalty: cluster.respiratoryFamilyPenalty || 0,
              respiratory_family_protected: cluster.respiratoryFamilyProtected ? 1 : 0,
              respiratory_family_protection_reason: cluster.respiratoryFamilyProtectionReason || "",
              pre_trend_observation_score: cluster.preTrendObservationScore || 0,
              physiologic_track_id: cluster.physiologicTrackId || 0,
              physiologic_trend_eligible: cluster.physiologicTrendEligible ? 1 : 0,
              physiologic_trend_score: cluster.physiologicTrendScore || 0,
              physiologic_delta_score: cluster.physiologicDeltaScore || 0,
              physiologic_slope_score: cluster.physiologicSlopeScore || 0,
              physiologic_residual_score: cluster.physiologicResidualScore || 0,
              physiologic_acceleration_score: cluster.physiologicAccelerationScore || 0,
              physiologic_trend_coverage: cluster.physiologicTrendCoverage || 0,
              physiologic_trend_span_s: cluster.physiologicTrendSpanSec || 0,
              physiologic_trend_step_rms: cluster.physiologicTrendStepRms || 0,
              physiologic_trend_curvature_rms: cluster.physiologicTrendCurvatureRms || 0,
              physiologic_trend_velocity: cluster.physiologicTrendVelocity || 0,
              axis_evidence_score: cluster.axisEvidenceScore || 0,
              excluded_weak_candidate: cluster.excludedWeakCandidate ? 1 : 0,
              exclusion_reason: cluster.exclusionReason || "",
              score_gap_to_best: bestScore - cluster.score,
              best_second_score_gap: bestScore - secondScore,
              gyro_relative_energy: cluster.gyroRelativeEnergy,
              gyro_coherence: cluster.gyroCoherence,
              gyro_impulse_ratio: cluster.gyroImpulseRatio,
              gyro_persistence_score: cluster.gyroPersistenceScore || 0,
              gyro_penalty: cluster.gyroPenalty || 0,
              motion_candidate_type: cluster.motionCandidateType,
              track_id: cluster.diagnosticTrack?.id || 0,
              track_consecutive_s: cluster.diagnosticTrack?.consecutiveSec || 0,
              track_total_seen_s: cluster.diagnosticTrack?.totalSeenSec || 0,
              track_previous_gap_s: cluster.diagnosticTrack?.previousGapSec || 0,
              track_reappearance_count: cluster.diagnosticTrack?.reappearanceCount || 0,
              harmonic_half_candidate_bpm: half && Math.abs(half.hrBpm - cluster.hrBpm / 2) <= config.hrCandidateMergeBpm ? half.hrBpm : 0,
              harmonic_double_candidate_bpm: double && Math.abs(double.hrBpm - cluster.hrBpm * 2) <= config.hrCandidateMergeBpm ? double.hrBpm : 0
            };
            for (const windowSec of [10, 20, 30]) {
              const member = cluster.members.find(
                (item) => item.windowSec === windowSec
              );
              row[`window_${windowSec}_rank`] = member?.windowRank || 0;
              row[`window_${windowSec}_spectral`] = member?.spectralScore || 0;
              row[`window_${windowSec}_relative_strength`] = member?.relativeStrength || 0;
              row[`window_${windowSec}_prominence`] = member?.localProminence || 0;
              row[`window_${windowSec}_autocorrelation`] = member?.autocorrelationScore || 0;
              row[`window_${windowSec}_autocorrelation_full`] = member?.autocorrelationFull || 0;
              row[`window_${windowSec}_autocorrelation_first_half`] = member?.autocorrelationFirstHalf || 0;
              row[`window_${windowSec}_autocorrelation_second_half`] = member?.autocorrelationSecondHalf || 0;
              row[`window_${windowSec}_autocorrelation_stability`] = member?.autocorrelationStability || 0;
              row[`window_${windowSec}_interval_score`] = member?.intervalScore || 0;
              row[`window_${windowSec}_event_count`] = member?.eventCount || 0;
              row[`window_${windowSec}_median_event_interval_s`] = member?.medianEventIntervalSec || 0;
              row[`window_${windowSec}_event_interval_cv`] = member?.eventIntervalCv || 0;
              row[`window_${windowSec}_cross_axis_consensus`] = member?.crossAxisConsensusScore || 0;
              row[`window_${windowSec}_cross_axis_event_count`] = member?.crossAxisConsensusEvents || 0;
              row[`window_${windowSec}_cross_axis_coverage`] = member?.crossAxisConsensusCoverage || 0;
              row[`window_${windowSec}_gyro_sync_ratio`] = member?.crossAxisGyroSyncRatio || 0;
              row[`window_${windowSec}_magnitude_psd`] = member?.amplitude || 0;
              for (const axis of ["x", "y", "z"]) {
                row[`axis_${axis}_energy_${windowSec}`] = cluster.axisEnergy?.[windowSec]?.[axis] || 0;
              }
            }
            candidateDiagnostics.push(row);
          }
          let rawHr = selected?.hrBpm || previousReliableHr;
          if (!Number.isFinite(rawHr) || rawHr <= 0) rawHr = 0;
          const trackLockOutputAllowed = true;
          const outputHr = qualityOutputAllowed && trackLockOutputAllowed ? rawHr : NaN;
          const quality = selected?.quality || 0;
          if (qualityOutputAllowed && rawHr > 0) {
            acceptedHistory.push({ timeSec, hrBpm: rawHr });
            const maximumBaselineHistory = Math.max(1, config.hrBaselineHistoryLength || 120);
            if (acceptedHistory.length > maximumBaselineHistory) {
              acceptedHistory.splice(0, acceptedHistory.length - maximumBaselineHistory);
            }
          }
          const authoritativeUpdated = updateAuthoritativeReliableHistory(
            selected,
            timeSec,
            authoritativeReliableState,
            config,
            {
              qualityAccepted: qualityOutputAllowed && trackLockOutputAllowed,
              availableWindowCount: availableWindowSecs.length,
              source: arbitration.mode,
              candidates: clusters
            }
          );
          previousReliableHr = authoritativeReliableState.lastHr;
          heartRateTimeSeries.push({
            time_s: timeSec,
            hr_bpm: outputHr,
            hr_bpm_raw: outputHr,
            quality_score: quality,
            peak_hz: selected?.frequencyHz || 0,
            peak_mag: selected?.amplitude || 0,
            state,
            candidate_count: allCandidates.length,
            cluster_count: clusters.length,
            support_count: selected?.supportWindows.length || 0,
            support_windows: selected?.supportWindows.join("|") || "",
            selection_score: selected?.score || 0,
            base_selection_score: selected?.baseScore || 0,
            support_score: selected?.supportScore || 0,
            spectral_score: selected?.spectralScore || 0,
            continuity_score: selected?.continuityScore || 0,
            gyro_relative_energy: selected?.gyroRelativeEnergy || 0,
            gyro_coherence: selected?.gyroCoherence || 0,
            gyro_impulse_ratio: selected?.gyroImpulseRatio || 0,
            gyro_persistence_score: selected?.gyroPersistenceScore || 0,
            gyro_penalty: selected?.gyroPenalty || 0,
            motion_candidate_type: selected?.motionCandidateType || "none",
            quality_gate_pass: qualityOutputAllowed && trackLockOutputAllowed ? 1 : 0,
            quality_validity_status: qualityGateDecision.validityStatus,
            quality_motion_status: qualityGateDecision.motionStatus,
            quality_reject_reasons: !qualityOutputAllowed ? "recovery_confirmation" : !trackLockOutputAllowed ? "checkpoint_track_missing" : "",
            quality_gate_gap_sec: recoveredAfterGapSec,
            quality_gate_state_reset: recoveredAfterStateReset ? 1 : 0,
            quality_recovery_type: qualityRecoveryState.type,
            quality_recovery_candidate_hr: qualityRecoveryState.candidateHr || 0,
            quality_recovery_confirmed_sec: qualityRecoveryState.candidateDurationSec,
            quality_recovery_old_anchor_hr: qualityRecoveryState.oldAnchorHr || 0,
            quality_recovery_old_anchor_weight: qualityRecoveryState.oldAnchorWeight,
            quality_recovery_confirmed: recoveryConfirmedThisSecond ? 1 : 0,
            mature_track_takeover: matureTrackTakeover ? 1 : 0,
            mature_track_takeover_old_hr: matureTrackTakeover?.oldHr || 0,
            mature_track_takeover_new_hr: matureTrackTakeover?.newHr || 0,
            mature_track_takeover_track_id: matureTrackTakeover?.trackId || 0,
            mature_track_takeover_coverage: matureTrackTakeover?.coverage || 0,
            mature_track_takeover_span_s: matureTrackTakeover?.spanSec || 0,
            mature_remote_candidate_hr: matureRemoteCandidateHr || 0,
            mature_remote_candidate_duration_s: matureRemoteCandidateDurationSec,
            low_zone_mode: lowZoneAdmissionState.mode,
            low_zone_candidate_hr: lowZoneAdmissionState.candidateHr || 0,
            low_zone_candidate_duration_s: lowZoneAdmissionState.candidateDurationSec,
            low_zone_evidence_pass_s: lowZoneAdmissionState.evidencePassSec,
            low_zone_anchor_missing_s: lowZoneAdmissionState.anchorMissingSec,
            checkpoint_track_id: sixtySecondTrackState.activeTrackId,
            checkpoint_track_hr: sixtySecondTrackState.activeHr || 0,
            checkpoint_track_missing_s: sixtySecondTrackState.missingSec,
            checkpoint_track_next_decision_s: sixtySecondTrackState.nextDecisionSec,
            checkpoint_track_decision: sixtySecondTrackState.lastDecision,
            checkpoint_remote_track_id: sixtySecondTrackState.remoteTrackId,
            checkpoint_remote_count: sixtySecondTrackState.remoteCheckpointCount,
            checkpoint_fallback_track_id: 0,
            checkpoint_fallback_hr: 0,
            checkpoint_fallback_anchor_hr: 0,
            diagnostic_candidates_bpm: clusters.slice(0, 8).map((cluster) => cluster.hrBpm.toFixed(3)).join("|"),
            diagnostic_candidates_score: clusters.slice(0, 8).map((cluster) => cluster.score.toFixed(6)).join("|"),
            diagnostic_candidates_base_score: clusters.slice(0, 8).map((cluster) => cluster.baseScore.toFixed(6)).join("|"),
            diagnostic_candidates_spectral: clusters.slice(0, 8).map((cluster) => cluster.spectralScore.toFixed(6)).join("|"),
            diagnostic_candidates_continuity: clusters.slice(0, 8).map((cluster) => cluster.continuityScore.toFixed(6)).join("|"),
            diagnostic_candidates_gyro_penalty: clusters.slice(0, 8).map((cluster) => (cluster.gyroPenalty || 0).toFixed(6)).join("|"),
            diagnostic_candidates_windows: clusters.slice(0, 8).map((cluster) => cluster.supportWindows.join("+")).join("|"),
            track_mode: arbitration.mode,
            mature_takeover_distance_bpm: arbitration.distanceBpm,
            mature_takeover_evidence_ratio: arbitration.evidenceRatio,
            mature_takeover_required_ratio: arbitration.requiredEvidenceRatio,
            mature_takeover_required_confirm_s: arbitration.requiredConfirmSec,
            mature_takeover_evidence_gate_pass: arbitration.evidenceGatePassed ? 1 : 0,
            mature_takeover_decision_reason: arbitration.reason,
            original_score_track_mode: beamResult.mode,
            raw_beam_guard_mode: rawGuardResult.mode,
            raw_beam_guard_reason: rawGuardResult.reason || "",
            authoritative_reliable_hr: authoritativeReliableState.lastHr || 0,
            authoritative_history_updated: authoritativeUpdated ? 1 : 0,
            authoritative_history_decision: authoritativeReliableState.lastDecision,
            authoritative_history_count: authoritativeReliableState.updateCount,
            authoritative_pending_mode: authoritativeReliableState.pending.kind,
            authoritative_pending_hr: authoritativeReliableState.pending.hrBpm || 0,
            authoritative_pending_duration_s: authoritativeReliableState.pending.durationSec,
            authoritative_pending_evidence: authoritativeReliableState.pending.evidence,
            authoritative_pending_had_multi_window: authoritativeReliableState.pending.hadMultipleWindowSupport ? 1 : 0,
            sixty_second_track_valid: sixtySecondTrackResult.valid ? 1 : 0,
            sixty_second_track_reason: sixtySecondTrackResult.reason,
            rhythm_switch_mode: rhythmSwitchState.mode,
            rhythm_switch_challenger_hr: rhythmSwitchState.challengerHr || 0,
            rhythm_switch_challenger_duration_s: rhythmSwitchState.challengerDurationSec,
            rhythm_switch_old_evidence: rhythmSwitchState.oldEvidence,
            rhythm_switch_new_evidence: rhythmSwitchState.newEvidence,
            rhythm_switch_advantage: rhythmSwitchState.advantage,
            baseline_band_mode: baselineBand.mode,
            baseline_band_center_hr: baselineBand.centerHr || 0,
            baseline_band_candidate_centers: baselineBand.candidateCenters.join("|"),
            baseline_band_half_width_bpm: baselineBand.halfWidthBpm || 0,
            baseline_band_hold_duration_s: baselineBand.holdDurationSec,
            baseline_band_pending_hr: baselineBand.pendingCenterHr || 0,
            baseline_band_pending_duration_s: baselineBand.pendingDurationSec,
            baseline_band_epoch: baselineBand.bandEpoch,
            baseline_band_previous_center_hr: baselineBand.previousCenterHr || 0,
            baseline_band_last_refresh_s: Number.isFinite(baselineBand.lastRefreshSec) ? baselineBand.lastRefreshSec : 0,
            baseline_band_next_refresh_s: Number.isFinite(baselineBand.nextRefreshSec) ? baselineBand.nextRefreshSec : 0,
            physiologic_track_id: selected?.physiologicTrackId || 0,
            physiologic_trend_score: selected?.physiologicTrendScore || 0,
            physiologic_trend_coverage: selected?.physiologicTrendCoverage || 0,
            physiologic_trend_step_rms: selected?.physiologicTrendStepRms || 0,
            physiologic_trend_curvature_rms: selected?.physiologicTrendCurvatureRms || 0,
            physiologic_trend_velocity: selected?.physiologicTrendVelocity || 0,
            physiologic_trend_maximum_step: selected?.physiologicTrendMaximumStep || 0,
            physiologic_trend_residual_rms: selected?.physiologicTrendResidualRms || 0,
            physiologic_trend_slope: selected?.physiologicTrendSlope || 0,
            physiologic_trend_stable: selected?.physiologicTrendStable ? 1 : 0,
            beam_size: candidateBeam.length,
            beam_primary_score: candidateBeam[0]?.cumulativeScore || 0,
            contamination_ratio: selected?.contaminationRatio || 0,
            artifact_penalty: selected?.artifactPenalty || 0,
            autocorrelation_score: selected?.autocorrelationScore || 0,
            autocorrelation_full: selected?.autocorrelationFull || 0,
            autocorrelation_first_half: selected?.autocorrelationFirstHalf || 0,
            autocorrelation_second_half: selected?.autocorrelationSecondHalf || 0,
            autocorrelation_stability: selected?.autocorrelationStability || 0,
            interval_score: selected?.intervalScore || 0,
            cross_axis_consensus_score: selected?.crossAxisConsensusScore || 0,
            cross_axis_gyro_sync_ratio: selected?.crossAxisGyroSyncRatio || 0,
            cross_axis_heart_evidence: selected?.crossAxisHeartEvidence || 0,
            available_windows: availableWindowSecs.join("|"),
            respiratory_rate_bpm: rr.bpm || lastRespiratoryRate,
            respiratory_quality_score: rr.quality,
            respiratory_family_stable_bpm: respiratoryFamilyState.stableBpm || 0,
            respiratory_family_pending_s: respiratoryFamilyState.durationSec,
            respiratory_family_excluded_count: 0,
            respiratory_family_excluded_bpm: "",
            respiratory_family_candidate_count: respiratoryFamilyResult.family.length,
            respiratory_family_penalized_count: respiratoryFamilyResult.penalized.length,
            respiratory_family_penalized_bpm: respiratoryFamilyResult.penalized.map((cluster) => cluster.hrBpm.toFixed(3)).join("|"),
            respiratory_family_protected_count: respiratoryFamilyResult.protected.length,
            respiratory_control_reviewed: respiratoryControlResult.reviewed ? 1 : 0,
            respiratory_control_blocked: respiratoryControlResult.blocked ? 1 : 0,
            respiratory_control_reason: respiratoryControlResult.reason,
            respiratory_control_blocked_hr: respiratoryControlResult.blockedHrBpm,
            respiratory_control_alternative_hr: respiratoryControlResult.alternativeHrBpm,
            respiratory_control_family_order: respiratoryControlResult.familyOrder,
            respiratory_control_family_distance_bpm: respiratoryControlResult.familyDistanceBpm
          });
          respiratoryRateTimeSeries.push({
            time_s: timeSec,
            rr_bpm: rr.bpm || lastRespiratoryRate,
            quality_score: rr.quality,
            peak_hz: rr.frequencyHz,
            peak_mag: rr.amplitude,
            state
          });
          segments.push({
            win_start_s: timeSec - Math.max(...availableWindowSecs),
            win_end_s: timeSec,
            hr_bpm: outputHr,
            rr_bpm: rr.bpm || lastRespiratoryRate,
            quality_hr: quality,
            quality_rr: rr.quality,
            state
          });
          timeAxis.push(timeSec);
        }
        stateStore.previousReliableHr = previousReliableHr;
        stateStore.gyroMotionTracks = gyroMotionTracks;
        stateStore.diagnosticCandidateTracks = diagnosticCandidateTracks;
        stateStore.physiologicCandidateTracks = physiologicCandidateTracks;
        stateStore.candidateBeam = candidateBeam;
        stateStore.lastRespiratoryRate = lastRespiratoryRate;
        stateStore.qualityGateGapSec = qualityGateGapSec;
        stateStore.qualityGateResetForCurrentGap = qualityGateResetForCurrentGap;
        stateStore.matureTrackTakeover = matureTrackTakeover;
        stateStore.matureRemoteCandidateHr = matureRemoteCandidateHr;
        stateStore.matureRemoteCandidateDurationSec = matureRemoteCandidateDurationSec;
        stateStore.boundaryStateResetDone = boundaryStateResetDone;
        const smoothed = postProcessHeartRate(
          timeAxis,
          heartRateTimeSeries.map((item) => item.hr_bpm_raw),
          heartRateTimeSeries.map((item) => item.quality_score),
          config
        );
        for (let i = 0; i < heartRateTimeSeries.length; i++) {
          const rejected = heartRateTimeSeries[i].quality_gate_pass === 0;
          heartRateTimeSeries[i].hr_bpm = rejected ? NaN : smoothed[i];
          segments[i].hr_bpm_raw = rejected ? NaN : segments[i].hr_bpm;
          segments[i].hr_bpm = rejected ? NaN : smoothed[i];
        }
        const validHeartRates = heartRateTimeSeries.map((item) => item.hr_bpm).filter((value) => Number.isFinite(value) && value > 0);
        const validRespiratoryRates = respiratoryRateTimeSeries.map((item) => item.rr_bpm).filter((value) => Number.isFinite(value) && value > 0);
        return {
          heartRateTimeSeries,
          respiratoryRateTimeSeries,
          segments,
          candidateDiagnostics,
          timeAxis,
          heartRate: mean(validHeartRates),
          respiratoryRate: mean(validRespiratoryRates)
        };
      }
      module.exports = {
        estimateHRRRTimeSeries,
        createEstimatorRuntimeState,
        _test: {
          autocorrelationRhythmEvidence,
          extractTopCandidates,
          detectTimeDomainEvents,
          intervalRhythmEvidence,
          detectSignedAxisEvents,
          buildConsensusEvents,
          gyroSynchronizationRatio,
          updatePhysiologicCandidateTracks,
          createBaselineBandState,
          applyRobustCandidateBand,
          commitRobustCandidateBandSelection,
          empiricalPlausibility,
          multiScaleDeltaPlausibility,
          relativePercentile,
          annotateRelativeCandidateEvidence,
          candidateHeartLikelihood,
          createRhythmSwitchState,
          applyRhythmSwitchController
        }
      };
    }
  });

  // src/baseline/LowHeartRateObserver.js
  var require_LowHeartRateObserver = __commonJS({
    "src/baseline/LowHeartRateObserver.js"(exports, module) {
      "use strict";
      var baseConfig = require_config();
      var { _test } = require_SlidingWindowEstimator();
      function mean(values) {
        const finite = Array.from(values || []).filter(Number.isFinite);
        return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
      }
      function createLowHeartRateObserverState() {
        return {
          tracks: [],
          nextTrackId: 1,
          primaryMissingSec: 0,
          shadowCandidateHr: NaN,
          shadowCandidateDurationSec: 0,
          shadowAdmission: false,
          lastDecision: "observing"
        };
      }
      function mergeCandidates(candidates, config) {
        const tolerance = config.criticalLowHeartCandidateMergeBpm || 4;
        const clusters = [];
        for (const candidate of candidates.slice().sort((a, b) => a.hrBpm - b.hrBpm)) {
          let cluster = clusters.find((item) => Math.abs(item.hrBpm - candidate.hrBpm) <= tolerance);
          if (!cluster) {
            cluster = { members: [], hrBpm: candidate.hrBpm };
            clusters.push(cluster);
          }
          cluster.members.push(candidate);
          const weights = cluster.members.map((item) => 0.25 + 0.75 * item.spectralScore);
          const total = weights.reduce((sum, value) => sum + value, 0);
          cluster.hrBpm = cluster.members.reduce((sum, item, index) => sum + item.hrBpm * weights[index], 0) / Math.max(total, 1e-12);
        }
        return clusters.map((cluster) => ({
          hrBpm: cluster.hrBpm,
          frequencyHz: cluster.hrBpm / 60,
          spectralScore: mean(cluster.members.map((item) => item.spectralScore)),
          intervalScore: mean(cluster.members.map((item) => item.intervalScore)),
          autocorrelationScore: mean(cluster.members.map((item) => item.autocorrelationScore)),
          crossAxisHeartEvidence: mean(cluster.members.map((item) => item.crossAxisHeartEvidence)),
          supportWindows: [...new Set(cluster.members.map((item) => item.windowSec))].sort((a, b) => a - b),
          members: cluster.members
        })).sort((a, b) => b.spectralScore - a.spectralScore);
      }
      function updateTracks(clusters, timeSec, state, config) {
        const matchBpm = config.criticalLowHeartTrackMatchBpm || 5;
        const maxGap = config.criticalLowHeartTrackMaximumGapSec || 3;
        const historySec = config.criticalLowHeartTrackHistorySec || 60;
        const used = /* @__PURE__ */ new Set();
        for (const cluster of clusters) {
          const track = state.tracks.filter((item) => !used.has(item.id) && timeSec - item.lastTimeSec <= maxGap).sort((a, b) => Math.abs(a.hrBpm - cluster.hrBpm) - Math.abs(b.hrBpm - cluster.hrBpm))[0];
          if (track && Math.abs(track.hrBpm - cluster.hrBpm) <= matchBpm) {
            used.add(track.id);
            track.hrBpm = 0.7 * track.hrBpm + 0.3 * cluster.hrBpm;
            track.lastTimeSec = timeSec;
            track.history.push({ timeSec, hrBpm: cluster.hrBpm });
            cluster.trackId = track.id;
          } else {
            const created = { id: state.nextTrackId++, hrBpm: cluster.hrBpm, firstTimeSec: timeSec, lastTimeSec: timeSec, history: [{ timeSec, hrBpm: cluster.hrBpm }] };
            state.tracks.push(created);
            used.add(created.id);
            cluster.trackId = created.id;
          }
        }
        state.tracks = state.tracks.filter((track) => timeSec - track.lastTimeSec <= maxGap && track.history.some((point) => point.timeSec >= timeSec - historySec));
        for (const track of state.tracks) {
          track.history = track.history.filter((point) => point.timeSec >= timeSec - historySec);
        }
        for (const cluster of clusters) {
          const track = state.tracks.find((item) => item.id === cluster.trackId);
          const span = track ? Math.max(1, Math.min(historySec, timeSec - track.firstTimeSec + 1)) : 1;
          cluster.trackDurationSec = track ? timeSec - track.firstTimeSec + 1 : 1;
          cluster.trackCoverage = track ? Math.min(1, track.history.length / span) : 0;
        }
      }
      function analyzeRelations(candidate, respiratoryRate, primaryCandidates, config) {
        if (!candidate) return { nearRespiratoryHarmonic: false, respiratoryOrder: 0, respiratoryDistanceBpm: 0, nearPrimaryHalf: false, primaryDoubleBpm: 0, primaryDoubleDistanceBpm: 0 };
        let bestResp = { order: 0, distance: Infinity };
        if (respiratoryRate > 0) {
          for (const order of [2, 3, 4]) {
            const distance = Math.abs(candidate.hrBpm - order * respiratoryRate);
            if (distance < bestResp.distance) bestResp = { order, distance };
          }
        }
        const doubled = primaryCandidates.filter(Number.isFinite).map((value) => ({ value, distance: Math.abs(value - 2 * candidate.hrBpm) })).sort((a, b) => a.distance - b.distance)[0];
        return {
          nearRespiratoryHarmonic: bestResp.distance <= (config.criticalLowHeartRespiratoryHarmonicToleranceBpm || 3),
          respiratoryOrder: bestResp.order,
          respiratoryDistanceBpm: Number.isFinite(bestResp.distance) ? bestResp.distance : 0,
          nearPrimaryHalf: Boolean(doubled && doubled.distance <= (config.criticalLowHeartHalfFrequencyToleranceBpm || 6)),
          primaryDoubleBpm: doubled?.value || 0,
          primaryDoubleDistanceBpm: doubled?.distance || 0
        };
      }
      function observeLowHeartRate(lowHeartSignal, lowGyroSignal, sampleRateHz, timeSec, state, context = {}, cfg = {}) {
        const config = Object.assign({}, baseConfig, cfg);
        if (config.criticalLowHeartObservationEnabled !== true) return null;
        const allCandidates = [];
        for (const windowSec of config.windowSecList || [10, 20, 30]) {
          const length = Math.round(windowSec * sampleRateHz);
          if (lowHeartSignal.length < length) continue;
          const start = lowHeartSignal.length - length;
          const result = _test.extractTopCandidates(
            lowHeartSignal.subarray(start),
            lowGyroSignal && lowGyroSignal.length >= length ? lowGyroSignal.subarray(lowGyroSignal.length - length) : null,
            sampleRateHz,
            windowSec,
            Object.assign({}, config, {
              hrPhysLowBpm: config.criticalLowHeartCandidateBandBpm[0],
              hrPhysHighBpm: config.criticalLowHeartCandidateBandBpm[1],
              hrTopKPeaks: 3
            }),
            "critical_low"
          );
          allCandidates.push(...result.candidates);
        }
        const clusters = mergeCandidates(allCandidates, config);
        updateTracks(clusters, timeSec, state, config);
        const required = config.criticalLowHeartRequiredWindows || [20, 30];
        const eligible = clusters.filter((candidate2) => required.every((window) => candidate2.supportWindows.includes(window))).sort((a, b) => b.trackCoverage - a.trackCoverage || b.spectralScore - a.spectralScore);
        const candidate = eligible[0] || null;
        const primaryCandidates = context.primaryCandidates || [];
        const primaryHr = context.primaryHr;
        const primaryPresent = Number.isFinite(primaryHr) && primaryCandidates.some((value) => Math.abs(value - primaryHr) <= (config.criticalLowHeartPrimaryMatchBpm || 12));
        state.primaryMissingSec = primaryPresent ? 0 : state.primaryMissingSec + (config.stepSec || 1);
        const same = candidate && Number.isFinite(state.shadowCandidateHr) && Math.abs(candidate.hrBpm - state.shadowCandidateHr) <= (config.criticalLowHeartTrackMatchBpm || 5);
        state.shadowCandidateDurationSec = candidate ? same ? state.shadowCandidateDurationSec + (config.stepSec || 1) : config.stepSec || 1 : 0;
        state.shadowCandidateHr = candidate?.hrBpm ?? NaN;
        const relations = analyzeRelations(candidate, context.respiratoryRate, primaryCandidates, config);
        const evidencePassed = Boolean(candidate && candidate.spectralScore >= config.criticalLowHeartMinimumSpectralScore && candidate.trackCoverage >= config.criticalLowHeartMinimumCoverage);
        state.shadowAdmission = Boolean(evidencePassed && state.shadowCandidateDurationSec >= config.criticalLowHeartAdmissionConfirmSec && state.primaryMissingSec >= config.criticalLowHeartPrimaryMissingSec);
        state.lastDecision = !candidate ? "no_multwindow_candidate" : !evidencePassed ? "insufficient_low_evidence" : state.shadowCandidateDurationSec < config.criticalLowHeartAdmissionConfirmSec ? "confirming_low_track" : state.primaryMissingSec < config.criticalLowHeartPrimaryMissingSec ? "primary_track_present" : "shadow_would_admit";
        return {
          candidates: clusters,
          selectedCandidate: candidate,
          shadowWouldAdmit: state.shadowAdmission,
          decision: state.lastDecision,
          candidateDurationSec: state.shadowCandidateDurationSec,
          primaryMissingSec: state.primaryMissingSec,
          ...relations
        };
      }
      module.exports = { createLowHeartRateObserverState, observeLowHeartRate };
    }
  });

  // src/realtime/RealtimeImuVitalsEstimator.js
  var require_RealtimeImuVitalsEstimator = __commonJS({
    "src/realtime/RealtimeImuVitalsEstimator.js"(exports, module) {
      "use strict";
      var baseConfig = require_config();
      var AttitudeSolverModule = require_AttitudeSolver();
      var { removeGravity } = require_GravityRemoval();
      var { classifySeriesWindows } = require_MotionClassifier();
      var { buildRawImuQualityGate } = require_RawImuQualityGate();
      var {
        buildRespAndHeartProxies,
        buildGyroMotionProxy
      } = require_ProxySignalBuilder();
      var {
        estimateHRRRTimeSeries,
        createEstimatorRuntimeState
      } = require_SlidingWindowEstimator();
      var {
        createLowHeartRateObserverState,
        observeLowHeartRate
      } = require_LowHeartRateObserver();
      var AttitudeSolver = AttitudeSolverModule.AttitudeSolver || AttitudeSolverModule;
      function finiteNumber(value, fallback = NaN) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      }
      function last(array) {
        return array && array.length ? array[array.length - 1] : null;
      }
      var RealtimeImuVitalsEstimator = class {
        constructor(options = {}) {
          this.config = Object.assign({}, baseConfig, options.config || {});
          this.sampleRateHz = finiteNumber(options.sampleRateHz, this.config.fsDefault || 50);
          this.stepSec = finiteNumber(options.stepSec, this.config.stepSec || 1);
          this.accelUnit = String(options.accelUnit || this.config.accelUnit || "mps2").toLowerCase();
          this.gyroUnit = String(options.gyroUnit || this.config.gyroUnit || "deg").toLowerCase();
          this.frame = options.frame === "body" ? "body" : "world";
          this.resetGapSec = finiteNumber(options.resetGapSec, 10);
          this.replayHistorySec = Math.max(
            Math.max(...this.config.windowSecList),
            finiteNumber(options.replayHistorySec, 70)
          );
          this.includeDiagnostics = options.includeDiagnostics === true;
          this.onPrediction = typeof options.onPrediction === "function" ? options.onPrediction : null;
          if (!(this.sampleRateHz > 0)) throw new Error("sampleRateHz must be positive");
          if (!(this.stepSec > 0)) throw new Error("stepSec must be positive");
          this.reset();
        }
        reset(reason = "manual") {
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
              throw new Error("IMU timestamps must be monotonic");
            }
            if (gapSec > this.resetGapSec) {
              this.reset("timestamp_gap");
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
          const startedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
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
            accelUnit: "mps2",
            gyroUnit: "deg/s",
            gravity: this.config.gravity || 9.81,
            sampleRateHz: this.sampleRateHz
          });
          if (typeof solver.setAlgorithm === "function") solver.setAlgorithm("madgwick");
          const gravity = removeGravity(relativeSamples, solver, {
            accelUnit: "mps2",
            gyroUnit: "deg/s",
            quaternionConvention: this.config.quaternionConvention || "bodyToWorld",
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
          const linearX = this.frame === "body" ? gravity.linAx : gravity.linAxWorld;
          const linearY = this.frame === "body" ? gravity.linAy : gravity.linAyWorld;
          const linearZ = this.frame === "body" ? gravity.linAz : gravity.linAzWorld;
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
          const lowHeartProxies = this.config.criticalLowHeartObservationEnabled === true ? buildRespAndHeartProxies(
            linearX,
            linearY,
            linearZ,
            this.sampleRateHz,
            {
              respProxyBand: this.config.respProxyBand,
              heartProxyBand: this.config.criticalLowHeartProxyBand,
              normalize: false
            }
          ) : null;
          const lowGyroMotion = lowHeartProxies ? buildGyroMotionProxy(
            gravity.gx,
            gravity.gy,
            gravity.gz,
            this.sampleRateHz,
            { heartProxyBand: this.config.criticalLowHeartProxyBand }
          ) : null;
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
              timelineOffsetSec: this.sessionSampleCount / this.sampleRateHz - relativeSamples.length / this.sampleRateHz
            })
          );
          const heart = last(estimate.heartRateTimeSeries);
          const respiratory = last(estimate.respiratoryRateTimeSeries);
          const segment = last(estimate.segments);
          const primaryDiagnosticCandidates = heart?.diagnostic_candidates_bpm ? String(heart.diagnostic_candidates_bpm).split("|").filter(Boolean).map(Number) : [];
          const lowHeartObservation = lowHeartProxies ? observeLowHeartRate(
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
          ) : null;
          const status = this.getStatus();
          const endedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          let rawCurrentHeartRate = heart && Number.isFinite(heart.hr_bpm_raw) && heart.hr_bpm_raw > 0 ? heart.hr_bpm_raw : null;
          const qualityAccepted = heart ? heart.quality_gate_pass !== 0 : false;
          const criticalLowTakeoverApplied = Boolean(
            this.config.criticalLowHeartTakeoverEnabled === true && qualityAccepted && lowHeartObservation?.shadowWouldAdmit && Number.isFinite(lowHeartObservation.selectedCandidate?.hrBpm)
          );
          if (criticalLowTakeoverApplied) {
            rawCurrentHeartRate = lowHeartObservation.selectedCandidate.hrBpm;
          }
          const heartRate = this._stabilizeHeartRate(
            rawCurrentHeartRate,
            heart?.quality_score || 0,
            qualityAccepted
          );
          const respiratoryRate = respiratory && Number.isFinite(respiratory.rr_bpm) && respiratory.rr_bpm > 0 ? respiratory.rr_bpm : null;
          const result = {
            method: "imu-vitals",
            HR_bpm: heartRate,
            RR_bpm: respiratoryRate,
            HR_confidence: heart && Number.isFinite(heart.quality_score) ? heart.quality_score : 0,
            RR_confidence: respiratory && Number.isFinite(respiratory.quality_score) ? respiratory.quality_score : 0,
            samples: this.samples.length,
            fs: this.sampleRateHz,
            timestamp_s: this.lastTimestampSec,
            session_elapsed_s: this.sessionSampleCount / this.sampleRateHz,
            heart_rate_bpm: heartRate,
            respiratory_rate_bpm: respiratoryRate,
            heart_rate_raw_bpm: heart && Number.isFinite(heart.hr_bpm_raw) ? heart.hr_bpm_raw : null,
            heart_rate_pre_takeover_bpm: heart && Number.isFinite(heart.hr_bpm_raw) ? heart.hr_bpm_raw : null,
            critical_low_takeover_applied: criticalLowTakeoverApplied,
            heart_quality: heart && Number.isFinite(heart.quality_score) ? heart.quality_score : 0,
            respiratory_quality: respiratory && Number.isFinite(respiratory.quality_score) ? respiratory.quality_score : 0,
            heart_valid: heartRate !== null,
            respiratory_valid: respiratoryRate !== null,
            quality_gate_passed: qualityAccepted,
            quality_validity_status: heart?.quality_validity_status || "not_evaluated",
            quality_motion_status: heart?.quality_motion_status || segment?.state || "unknown",
            quality_reject_reasons: heart?.quality_reject_reasons ? heart.quality_reject_reasons.split("|").filter(Boolean) : [],
            motion_state: heart?.state || respiratory?.state || segment?.state || "unknown",
            available_windows: heart?.available_windows ? String(heart.available_windows).split("|").filter(Boolean).map(Number) : [],
            window_start_s: segment?.win_start_s ?? null,
            window_end_s: segment?.win_end_s ?? null,
            warmup_progress: status.warmupProgress,
            fully_warmed_up: status.fullyWarmedUp,
            samples_used: this.samples.length,
            runtime_ms: endedAt - startedAt,
            candidates: primaryDiagnosticCandidates,
            critical_low_candidates: lowHeartObservation?.candidates?.map((candidate) => candidate.hrBpm) || [],
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
          if (!input || typeof input !== "object") return null;
          const required = ["ax", "ay", "az", "gx", "gy", "gz"];
          const values = {};
          for (const key of required) {
            values[key] = finiteNumber(input[key]);
            if (!Number.isFinite(values[key])) return null;
          }
          const gravity = this.config.gravity || 9.81;
          if (this.accelUnit === "g") {
            values.ax *= gravity;
            values.ay *= gravity;
            values.az *= gravity;
          }
          if (this.gyroUnit.startsWith("rad")) {
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
            return Number.isFinite(this.lastStableHeartRate) ? this.lastStableHeartRate : null;
          }
          this.outputHeartHistory.push(value);
          const maximum = Math.max(1, this.config.hrMedianWindowSize || 5);
          if (this.outputHeartHistory.length > maximum) this.outputHeartHistory.shift();
          const ordered = this.outputHeartHistory.slice().sort((a, b) => a - b);
          const middle = Math.floor(ordered.length / 2);
          const median = ordered.length % 2 ? ordered[middle] : 0.5 * (ordered[middle - 1] + ordered[middle]);
          if (!Number.isFinite(this.lastStableHeartRate)) {
            this.lastStableHeartRate = median;
            return median;
          }
          const maximumStep = Math.min(
            this.config.hrHardMaxStepBpm || 20,
            (this.config.hrMaxSlopeBpmPerSec || 10) * this.stepSec
          );
          const target = confidence < (this.config.hrLowQualityThreshold || 0.35) ? median : value;
          const limited = this.lastStableHeartRate + Math.max(
            -maximumStep,
            Math.min(maximumStep, target - this.lastStableHeartRate)
          );
          const alpha = Math.max(0.1, Math.min(
            0.9,
            (this.config.hrPostAlpha || 0.5) * (0.65 + 0.35 * confidence)
          ));
          this.lastStableHeartRate = alpha * limited + (1 - alpha) * this.lastStableHeartRate;
          return this.lastStableHeartRate;
        }
      };
      module.exports = RealtimeImuVitalsEstimator;
      module.exports.RealtimeImuVitalsEstimator = RealtimeImuVitalsEstimator;
    }
  });

  // src/realtime/index.js
  var require_realtime = __commonJS({
    "src/realtime/index.js"(exports, module) {
      "use strict";
      var RealtimeImuVitalsEstimator = require_RealtimeImuVitalsEstimator();
      module.exports = {
        RealtimeImuVitalsEstimator: RealtimeImuVitalsEstimator.RealtimeImuVitalsEstimator || RealtimeImuVitalsEstimator
      };
      module.exports.create = function create(options) {
        return new module.exports.RealtimeImuVitalsEstimator(options);
      };
    }
  });

  // src/browser/worker-entry.js
  var require_worker_entry = __commonJS({
    "src/browser/worker-entry.js"() {
      var { RealtimeImuVitalsEstimator } = require_realtime();
      var estimator = null;
      var sessionId = null;
      function post(type, payload = {}) {
        self.postMessage(Object.assign({ type, sessionId }, payload));
      }
      function publicResult(result) {
        return {
          HR_bpm: result.HR_bpm,
          RR_bpm: result.RR_bpm,
          HR_confidence: result.HR_confidence,
          RR_confidence: result.RR_confidence,
          heart_valid: result.heart_valid,
          respiratory_valid: result.respiratory_valid,
          quality_gate_passed: result.quality_gate_passed,
          quality_validity_status: result.quality_validity_status,
          quality_motion_status: result.quality_motion_status,
          quality_reject_reasons: result.quality_reject_reasons,
          motion_state: result.motion_state,
          available_windows: result.available_windows,
          session_elapsed_s: result.session_elapsed_s,
          warmup_progress: result.warmup_progress,
          fully_warmed_up: result.fully_warmed_up,
          samples_used: result.samples_used,
          fs: result.fs,
          runtime_ms: result.runtime_ms,
          candidates: result.candidates || []
        };
      }
      self.onmessage = (event) => {
        const message = event.data || {};
        try {
          if (message.type === "init") {
            sessionId = message.sessionId || `imu-${Date.now()}`;
            estimator = new RealtimeImuVitalsEstimator(Object.assign({
              sampleRateHz: 50,
              stepSec: 1,
              replayHistorySec: 70,
              accelUnit: "g",
              gyroUnit: "deg",
              includeDiagnostics: false
            }, message.options || {}));
            post("ready", { status: estimator.getStatus() });
            return;
          }
          if (message.sessionId && message.sessionId !== sessionId) return;
          if (message.type === "reset") {
            if (estimator) estimator.reset(message.reason || "worker_reset");
            post("reset");
            return;
          }
          if (message.type === "sample") {
            if (!estimator) throw new Error("IMU worker is not initialized");
            const result = estimator.pushSample(message.sample);
            if (result) post("prediction", { result: publicResult(result) });
          }
        } catch (error) {
          post("error", { message: error && error.message ? error.message : String(error) });
        }
      };
    }
  });
  require_worker_entry();
})();
