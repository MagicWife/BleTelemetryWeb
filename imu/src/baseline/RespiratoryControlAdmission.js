'use strict';

function createRespiratoryControlAdmissionState() {
  return {
    blockedHrBpm: NaN,
    holdUntilSec: -Infinity,
    lastDecision: 'inactive',
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
  if (candidate.supportWindows?.includes(20) &&
      candidate.supportWindows?.includes(30)) count++;
  return count;
}

function isControlUpgrade(context) {
  return !(context.authoritativeHr > 0) ||
    context.beamMode === 'beam_initialize' ||
    context.beamMode === 'beam_reacquire' ||
    context.trackReason === 'mature_track_initialized' ||
    context.trackReason === 'local_mature_track_switched' ||
    context.trackReason === 'remote_mature_track_switched' ||
    context.rawGuardMode === 'remote_confirmed';
}

function reviewRespiratoryControlAdmission(
  selected,
  candidates,
  respiratoryState,
  respiratory,
  timeSec,
  state,
  context,
  config
) {
  const result = {
    selected,
    reviewed: false,
    blocked: false,
    reason: 'not_applicable',
    blockedHrBpm: 0,
    alternativeHrBpm: 0,
    familyOrder: 0,
    familyDistanceBpm: 0
  };
  if (config.respiratoryControlAdmissionEnabled !== true || !selected) {
    return result;
  }
  const activeHold = timeSec <= state.holdUntilSec &&
    Number.isFinite(state.blockedHrBpm);
  if (activeHold && Number.isFinite(state.lastAlternativeHrBpm)) {
    const reconnectBpm = config.respiratoryControlAlternativeReconnectBpm ?? 10;
    const heldAlternative = candidates
      .filter(candidate =>
        Math.abs(candidate.hrBpm - state.lastAlternativeHrBpm) <= reconnectBpm)
      .sort((left, right) =>
        Math.abs(left.hrBpm - state.lastAlternativeHrBpm) -
        Math.abs(right.hrBpm - state.lastAlternativeHrBpm))[0];
    if (heldAlternative) {
      state.lastAlternativeHrBpm = heldAlternative.hrBpm;
      state.lastDecision = 'respiratory_family_hold_alternative';
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
  const controlRespiratoryBpm = respiratoryState.stableBpm > 0
    ? respiratoryState.stableBpm
    : respiratoryState.candidateBpm;
  if (!(controlRespiratoryBpm > 0) ||
      respiratory.quality < qualityMinimum ||
      respiratoryState.durationSec < persistenceMinimum) {
    state.lastDecision = 'insufficient_respiratory_evidence';
    return result;
  }

  const relation = familyRelation(selected, controlRespiratoryBpm, config);
  const strongDistance = config.respiratoryControlStrongDistanceBpm ?? 1.5;
  if ((!relation || relation.distanceBpm > strongDistance) && !activeHold) {
    state.lastDecision = 'not_respiratory_family';
    return result;
  }
  result.reviewed = true;
  const authorityProtection = context.authoritativeHr > 0 &&
    Math.abs(selected.hrBpm - context.authoritativeHr) <=
      (config.respiratoryControlAuthorityProtectionBpm ?? 6);
  const matureProtection = context.authoritativeHr > 0 &&
    (context.selectedTrackAgeSec || 0) >=
    (config.respiratoryControlSelectedTrackProtectionSec ?? 15);
  const heartbeatProtection = independentHeartbeatEvidenceCount(selected) >=
    (config.respiratoryControlHeartbeatEvidenceRequired ?? 2);
  if (authorityProtection || matureProtection || heartbeatProtection) {
    result.reason = authorityProtection ? 'protected_authority' :
      (matureProtection ? 'protected_mature_track' : 'protected_heartbeat');
    state.lastDecision = result.reason;
    return result;
  }
  if (!activeHold && !isControlUpgrade(context)) {
    result.reason = 'ordinary_tracking_not_reviewed';
    state.lastDecision = result.reason;
    return result;
  }

  const scoreGapMaximum = config.respiratoryControlAlternativeScoreGap ?? 0.15;
  const spectralGapMaximum = config.respiratoryControlAlternativeSpectralGap ?? 0.20;
  let alternatives = candidates.filter(candidate => {
    if (candidate === selected) return false;
    const candidateRelation = familyRelation(
      candidate,
      controlRespiratoryBpm,
      config
    );
    if (candidateRelation && candidateRelation.distanceBpm <=
        (config.respiratoryControlFamilyToleranceBpm ?? 3)) return false;
    if (!(candidate.supportWindows?.includes(20) ||
        candidate.supportWindows?.includes(30))) return false;
    const scoreGap = (selected.observationScore || 0) -
      (candidate.observationScore || 0);
    const spectralGap = (selected.spectralScore || 0) -
      (candidate.spectralScore || 0);
    return scoreGap <= scoreGapMaximum || spectralGap <= spectralGapMaximum;
  }).sort((left, right) =>
    (right.observationScore || 0) - (left.observationScore || 0));
  // The score comparison is an admission test, not a requirement that the
  // accepted replacement must win again every second.  During the short hold
  // period, keep following the same non-respiratory trajectory when it remains
  // locally available; otherwise a one-second score fluctuation immediately
  // hands control back to the respiratory harmonic.
  if (activeHold && Number.isFinite(state.lastAlternativeHrBpm)) {
    const reconnectBpm = config.respiratoryControlAlternativeReconnectBpm ?? 10;
    const heldAlternatives = candidates.filter(candidate => {
      const candidateRelation = familyRelation(
        candidate,
        controlRespiratoryBpm,
        config
      );
      if (candidateRelation && candidateRelation.distanceBpm <=
          (config.respiratoryControlFamilyToleranceBpm ?? 3)) return false;
      return Math.abs(candidate.hrBpm - state.lastAlternativeHrBpm) <= reconnectBpm;
    }).sort((left, right) =>
      Math.abs(left.hrBpm - state.lastAlternativeHrBpm) -
      Math.abs(right.hrBpm - state.lastAlternativeHrBpm));
    if (heldAlternatives.length > 0) alternatives = heldAlternatives;
  }
  const alternative = alternatives[0] || null;
  if (!alternative) {
    result.reason = 'no_competitive_non_respiratory_candidate';
    state.lastDecision = result.reason;
    return result;
  }
  if (!activeHold) {
    state.blockedHrBpm = selected.hrBpm;
    state.holdUntilSec = timeSec +
      (config.respiratoryControlHoldSec ?? 5) - (config.stepSec || 1);
  }
  state.lastAlternativeHrBpm = alternative.hrBpm;
  state.lastDecision = activeHold
    ? 'respiratory_family_hold_alternative'
    : 'respiratory_family_control_blocked';
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
