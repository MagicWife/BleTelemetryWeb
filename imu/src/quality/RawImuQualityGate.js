'use strict';

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : 0.5 * (sorted[middle - 1] + sorted[middle]);
}

function mad(values) {
  const center = median(values);
  return Number.isFinite(center) ? median(values.map(value => Math.abs(value - center))) : NaN;
}

function rms(values) {
  if (!values.length) return NaN;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function classifyValidity(metrics, thresholds) {
  if (metrics.sampleCoverage < thresholds.invalidCoverage ||
      metrics.finiteRatio < thresholds.invalidFiniteRatio ||
      metrics.stuckRatio > thresholds.invalidStuckRatio) return 'invalid';
  if (metrics.sampleCoverage < thresholds.validCoverage ||
      metrics.finiteRatio < thresholds.validFiniteRatio ||
      metrics.stuckRatio > thresholds.validStuckRatio) return 'degraded';
  return 'valid';
}

function classifyMotion(metrics, thresholds) {
  const over95 = Number(metrics.accNormMad > thresholds.accMadP95) +
    Number(metrics.gyroRms > thresholds.gyroRmsP95) +
    Number(metrics.shockRatio > thresholds.shockP95);
  if (metrics.shockRatio > thresholds.shockP99) return 'impact';
  if (metrics.accNormMad > thresholds.accMadP99 ||
      metrics.gyroRms > thresholds.gyroRmsP99 || over95 >= 2) return 'strong_motion';
  if (over95 >= 1) return 'mild_motion';
  return 'static';
}

function buildRawImuQualityGate(samples, sampleRateHz, options = {}) {
  const enabled = options.enabled !== false;
  const windowSec = options.windowSec || 10;
  const validityThresholds = options.validityThresholds;
  const motionThresholds = options.motionThresholds;
  const rejectedMotion = new Set(options.rejectMotionStatuses || ['strong_motion', 'impact']);
  const timeQuality = options.timeQuality || {};
  const minimumRejectRunSec = Math.max(1, options.minimumRejectRunSec || 5);
  const acceptConfirmSec = Math.max(1, options.acceptConfirmSec || 3);
  const decisions = [];
  const durationSec = samples.length / sampleRateHz;
  const pauseStart = Number.isFinite(timeQuality.detectedPauseAfterSample)
    ? timeQuality.detectedPauseAfterSample / sampleRateHz : NaN;
  const pauseEnd = Number.isFinite(pauseStart) && Number.isFinite(timeQuality.detectedPauseSec)
    ? pauseStart + Math.max(0, timeQuality.detectedPauseSec) : NaN;

  function evaluateAt(timeSec) {
    if (!enabled) return { accepted: true, validityStatus: 'disabled', motionStatus: 'disabled', reasons: [] };
    const startSec = Math.max(0, timeSec - windowSec);
    const endSec = Math.min(durationSec, timeSec);
    const start = Math.max(0, Math.floor(startSec * sampleRateHz));
    const end = Math.min(samples.length, Math.ceil(endSec * sampleRateHz));
    const selected = samples.slice(start, end);
    const finite = selected.filter(sample => ['ax', 'ay', 'az', 'gx', 'gy', 'gz']
      .every(axis => Number.isFinite(sample[axis])));
    const expected = Math.max(1, (endSec - startSec) * sampleRateHz);
    let unavailableSec = 0;
    if (Number.isFinite(pauseStart) && Number.isFinite(pauseEnd)) {
      unavailableSec = Math.max(0, Math.min(endSec, pauseEnd) - Math.max(startSec, pauseStart));
    }
    const observableCoverage = Math.max(0, selected.length / expected - unavailableSec / Math.max(1e-9, endSec - startSec));
    let repeated = 0;
    const jerk = [];
    for (let index = 1; index < finite.length; index++) {
      if (['ax', 'ay', 'az', 'gx', 'gy', 'gz'].every(axis =>
        finite[index][axis] === finite[index - 1][axis])) repeated++;
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
      accNormMad: mad(finite.map(sample => Math.hypot(sample.ax, sample.ay, sample.az))),
      gyroRms: rms(finite.map(sample => Math.hypot(sample.gx, sample.gy, sample.gz))),
      shockRatio: jerk.length ? jerk.filter(value => value > shockThreshold).length / jerk.length : 1,
      unavailableSec
    };
    const validityStatus = classifyValidity(metrics, validityThresholds);
    const motionStatus = classifyMotion(metrics, motionThresholds);
    const reasons = [
      validityStatus === 'invalid' ? 'invalid_window' : '',
      rejectedMotion.has(motionStatus) ? motionStatus : ''
    ].filter(Boolean);
    return { accepted: reasons.length === 0, validityStatus, motionStatus, reasons, metrics };
  }

  for (let timeSec = 0; timeSec <= durationSec + 1e-9; timeSec += 1) {
    decisions.push({ time_s: timeSec, ...evaluateAt(timeSec) });
  }
  // Reject an abnormal trailing window immediately. Once rejected, require
  // consecutive raw-normal windows before reopening the gate.
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
      decision.reasons = ['quality_recovery_pending'];
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
    if (decision.accepted) result.accepted++; else result.rejected++;
    result.validity[decision.validityStatus] = (result.validity[decision.validityStatus] || 0) + 1;
    result.motion[decision.motionStatus] = (result.motion[decision.motionStatus] || 0) + 1;
    return result;
  }, { enabled, minimumRejectRunSec, acceptConfirmSec,
    total: 0, accepted: 0, rejected: 0,
    validity: {}, motion: {} });
  return { enabled, decisions, summary, decisionAt };
}

module.exports = { buildRawImuQualityGate };
