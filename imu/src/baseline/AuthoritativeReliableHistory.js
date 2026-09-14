'use strict';

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return NaN;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2
    ? finite[middle]
    : 0.5 * (finite[middle - 1] + finite[middle]);
}

function createPendingState() {
  return {
    kind: 'none',
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
    lastDecision: 'uninitialized',
    pending: createPendingState()
  };
}

function trimHistory(state, timeSec, historySec) {
  while (state.history.length > 1 &&
      timeSec - state.history[0].timeSec > historySec) {
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
  const key = (candidate?.supportWindows || [])
    .slice().sort((a, b) => a - b).join('+');
  return ({
    '10': 0.20,
    '20': 0.35,
    '30': 0.55,
    '10+20': 0.45,
    '10+30': 0.60,
    '20+30': 0.72,
    '10+20+30': 1.00
  })[key] || 0;
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
  return Number.isFinite(competitorScore)
    ? selectedScore - competitorScore
    : selectedScore;
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
  const same = state.pending.kind === kind &&
    Number.isFinite(state.pending.hrBpm) &&
    Math.abs(candidate.hrBpm - state.pending.hrBpm) <= matchBpm;
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
    state.pending.hadMultipleWindowSupport =
      state.pending.hadMultipleWindowSupport ||
      hasMultipleWindowSupport(candidate);
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
  // The authoritative value is the robust centre of recent confirmed writes,
  // not the newest sample. This prevents a series of sub-threshold errors from
  // walking the anchor away one second at a time.
  state.lastHr = median(state.history.map(item => item.hrBpm));
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

function updateAuthoritativeReliableHistory(
  candidate,
  timeSec,
  state,
  config,
  context = {}
) {
  if (!context.qualityAccepted) {
    state.lastDecision = 'quality_rejected_preserve_history';
    resetPending(state);
    return false;
  }
  if (!candidate || !Number.isFinite(candidate.hrBpm) || candidate.hrBpm <= 0) {
    state.lastDecision = 'no_finite_final_candidate';
    resetPending(state);
    return false;
  }
  if (candidate.heldByRawBeamTransitionGuard === true ||
      candidate.heldBySixtySecondTrack === true) {
    state.lastDecision = 'synthetic_hold_not_reliable';
    resetPending(state);
    return false;
  }

  const minimumQuality = config.hrAuthorityMinimumQuality ?? 0.65;
  const singleWindowMinimumQuality =
    config.hrAuthoritySingleWindowMinimumQuality ?? 0.45;
  const multipleWindow = hasMultipleWindowSupport(candidate);
  const requiredQuality = multipleWindow
    ? minimumQuality
    : singleWindowMinimumQuality;
  if ((candidate.quality || 0) < requiredQuality) {
    state.lastDecision = 'insufficient_authority_evidence';
    resetPending(state);
    return false;
  }

  const candidates = context.candidates || [];
  const source = context.source || 'final_output';
  const margin = scoreMargin(candidate, candidates);
  const stepSec = config.stepSec || 1;

  // A first anchor is written only after the same long-window-supported family
  // remains competitive for several seconds. One isolated high score can no
  // longer create the reference used by every downstream transition guard.
  if (!Number.isFinite(state.lastHr)) {
    if (margin < (config.hrAuthorityInitialMinimumMargin ?? 0.05)) {
      state.lastDecision = 'initial_candidate_ambiguous';
      resetPending(state);
      return false;
    }
    const pending = updatePending(state, 'initial', candidate, config);
    if (!pending.hadMultipleWindowSupport ||
        pending.evidence < (config.hrAuthorityInitialEvidenceRequired || 4) ||
        pending.durationSec < (config.hrAuthorityInitialConfirmSec || 5)) {
      state.lastDecision = 'initial_candidate_pending';
      return false;
    }
    return commitCandidate(
      candidate,
      timeSec,
      state,
      config,
      source,
      'initialized_from_confirmed_trajectory'
    );
  }

  const nearbyBpm = config.hrAuthorityNearbyBpm || 10;
  const anchorHr = state.lastHr;
  const distance = Math.abs(candidate.hrBpm - anchorHr);
  if (distance <= nearbyBpm) {
    const fiveSecondAuthority = historicalAuthority(state, timeSec, 5);
    const fifteenSecondAuthority = historicalAuthority(state, timeSec, 15);
    const exceedsFiveSecondDrift = fiveSecondAuthority &&
      Math.abs(candidate.hrBpm - fiveSecondAuthority.hrBpm) >
        (config.hrAuthorityLocalMaximumFiveSecondDriftBpm || 8);
    const exceedsFifteenSecondDrift = fifteenSecondAuthority &&
      Math.abs(candidate.hrBpm - fifteenSecondAuthority.hrBpm) >
        (config.hrAuthorityLocalMaximumFifteenSecondDriftBpm || 12);
    if (exceedsFiveSecondDrift || exceedsFifteenSecondDrift) {
      state.lastDecision = 'local_drift_limit_exceeded';
      resetPending(state);
      return false;
    }
    const pending = updatePending(state, 'local', candidate, config);
    if (pending.evidence < (config.hrAuthorityLocalEvidenceRequired || 4) ||
        pending.durationSec < (config.hrAuthorityLocalConfirmSec || 5)) {
      state.lastDecision = 'local_candidate_pending';
      return false;
    }
    return commitCandidate(
      candidate,
      timeSec,
      state,
      config,
      source,
      'updated_from_confirmed_local_trajectory'
    );
  }

  const nearbyOldCandidate = candidates.some(other => {
    if (!other || Math.abs(other.hrBpm - anchorHr) > nearbyBpm) return false;
    const otherMultiple = hasMultipleWindowSupport(other);
    const otherMinimumQuality = otherMultiple
      ? minimumQuality
      : singleWindowMinimumQuality;
    const singlePersistent = (other.trackConsecutiveSec || 0) >= 3;
    return (other.quality || 0) >= otherMinimumQuality &&
      (otherMultiple || singlePersistent);
  });
  const matureTrackSource = source === 'sixty_second_track';
  if (nearbyOldCandidate && !matureTrackSource) {
    state.lastDecision = 'remote_rejected_old_anchor_still_observed';
    resetPending(state);
    return false;
  }

  const kind = matureTrackSource ? 'mature_remote' : 'remote';
  const pending = updatePending(state, kind, candidate, config);
  const confirmSec = matureTrackSource
    ? (config.hrAuthorityMatureTrackConfirmSec || 5)
    : (config.hrAuthorityRemoteConfirmSec || 5);
  const change = Math.abs(candidate.hrBpm - pending.startHr);
  const requiredEvidence = matureTrackSource
    ? (config.hrAuthorityInitialEvidenceRequired || 4)
    : (config.hrAuthorityRemoteEvidenceRequired || 5);
  if (!pending.hadMultipleWindowSupport ||
      pending.evidence < requiredEvidence ||
      pending.durationSec < confirmSec ||
      change > (config.hrAuthorityMaximumFiveSecondChangeBpm || 16)) {
    state.lastDecision = matureTrackSource
      ? 'mature_track_reanchor_pending'
      : 'remote_reanchor_pending';
    return false;
  }
  return commitCandidate(
    candidate,
    timeSec,
    state,
    config,
    source,
    matureTrackSource
      ? 'reanchored_from_mature_sixty_second_track'
      : 'reanchored_after_old_anchor_disappeared'
  );
}

function preserveAuthoritativeReliableHistory(state, reason) {
  state.lastDecision = reason || 'preserved_without_update';
  resetPending(state);
}

module.exports = {
  createAuthoritativeReliableHistoryState,
  updateAuthoritativeReliableHistory,
  preserveAuthoritativeReliableHistory
};
