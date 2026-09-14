'use strict';

function createSelectionArbiterState() {
  return {
    mode: 'original_score',
    trackValidSec: 0,
    trackInvalidSec: 0,
    lastReason: 'initializing'
  };
}

function candidateScore(candidate) {
  return candidate?.score ?? candidate?.observationScore ?? 0;
}

function arbitrateSelection(rawSelection, trackResult, state, config) {
  const stepSec = config.stepSec || 1;
  const haveComparison = Boolean(rawSelection && trackResult.selected);
  const distanceBpm = haveComparison
    ? Math.abs(trackResult.selected.hrBpm - rawSelection.hrBpm)
    : 0;
  const trackScore = candidateScore(trackResult.selected);
  const rawScore = candidateScore(rawSelection);
  const evidenceRatio = haveComparison
    ? trackScore / Math.max(rawScore, 0.001)
    : 1;
  const gateStartBpm = config.hrMatureTakeoverEvidenceGateStartBpm ?? 15;
  const requiredEvidenceRatio = Math.min(
    config.hrMatureTakeoverMaximumRatio ?? 0.95,
    (config.hrMatureTakeoverBaseRatio ?? 0.60) +
      (config.hrMatureTakeoverRatioPerBpm ?? 0.004) * distanceBpm
  );
  const evidenceGatePassed =
    config.hrMatureTakeoverEvidenceGateEnabled !== true ||
    !haveComparison ||
    distanceBpm <= gateStartBpm ||
    evidenceRatio >= requiredEvidenceRatio;
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

  const baseEnterSec = config.hrMatureTakeoverConfirmBaseSec ??
    config.hrSixtySecondTrackEnterConfirmSec ?? 5;
  const extraDistance = Math.max(0, distanceBpm - gateStartBpm);
  const confirmStepBpm = Math.max(
    1,
    config.hrMatureTakeoverConfirmStepBpm ?? 20
  );
  const enterSec = Math.min(
    config.hrMatureTakeoverMaximumConfirmSec ?? 15,
    baseEnterSec + Math.ceil(extraDistance / confirmStepBpm) *
      (config.hrMatureTakeoverConfirmStepSec ?? 2)
  );
  const exitSec = config.hrSixtySecondTrackExitConfirmSec ?? 2;
  if (state.mode !== 'sixty_second_track' &&
      state.trackValidSec >= enterSec) {
    state.mode = 'sixty_second_track';
    state.lastReason = 'mature_track_confirmed';
  }
  if (state.mode === 'sixty_second_track' &&
      state.trackInvalidSec >= exitSec) {
    state.mode = 'original_score';
    state.lastReason = 'mature_track_invalid';
  }

  if (state.mode === 'sixty_second_track' && takeoverEligible) {
    return {
      selected: trackResult.selected,
      mode: 'sixty_second_track',
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
    mode: 'original_score_fallback',
    reason: !evidenceGatePassed
      ? 'mature_takeover_insufficient_distance_evidence'
      : (trackResult.reason || state.lastReason),
    distanceBpm,
    evidenceRatio,
    requiredEvidenceRatio,
    requiredConfirmSec: enterSec,
    evidenceGatePassed
  };
}

module.exports = { createSelectionArbiterState, arbitrateSelection };
