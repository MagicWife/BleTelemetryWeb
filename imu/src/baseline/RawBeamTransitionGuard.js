'use strict';

const { clamp } = require('../signal/SignalFilters');

function createRawBeamTransitionGuardState() {
  return {
    remoteCandidateHr: NaN,
    remoteStartHr: NaN,
    remoteDurationSec: 0,
    holdDurationSec: 0,
    lastMode: 'initializing'
  };
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] :
    0.5 * (finite[middle - 1] + finite[middle]);
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
  if (fiveSecond && Math.abs(candidate.hrBpm - fiveSecond.hrBpm) >
      (config.hrRawBeamRemoteMaximumFiveSecondChangeBpm || 16)) return false;
  if (fifteenSecond && Math.abs(candidate.hrBpm - fifteenSecond.hrBpm) >
      (config.hrRawBeamMaximumFifteenSecondChangeBpm || 21)) return false;
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
  return { selected: accepted, mode, acceptedRemote: mode === 'remote_confirmed' };
}

function holdTrend(timeSec, state, authoritativeState, config, reason) {
  if (!authoritativeState.lastCandidate) {
    return { selected: null, mode: 'no_reliable_history', reason };
  }
  const lastHr = authoritativeState.lastHr;
  const predicted = reason === 'remote_unconfirmed_hold'
    ? lastHr
    : trendPrediction(authoritativeState.history, timeSec);
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
    mode: 'trend_hold',
    reason
  };
}

function guardRawBeamSelection(
  proposed,
  clusters,
  timeSec,
  state,
  authoritativeState,
  config
) {
  if (config.hrRawBeamTransitionGuardEnabled !== true || !proposed) {
    if (proposed) return acceptSelection(proposed, state, 'guard_disabled');
    return { selected: proposed || null, mode: 'no_candidate' };
  }
  const reliableHistory = authoritativeState.history;
  if (!authoritativeState.lastCandidate || reliableHistory.length === 0) {
    return acceptSelection(proposed, state, 'awaiting_authoritative_history');
  }

  const trendHr = trendPrediction(reliableHistory, timeSec);
  const remoteThreshold = config.hrRawBeamRemoteDeviationBpm || 15;
  if ((!Number.isFinite(trendHr) ||
      Math.abs(proposed.hrBpm - trendHr) <= remoteThreshold) &&
      passesReliableChangeLimits(
        proposed,
        timeSec,
        reliableHistory,
        config
      )) {
    return acceptSelection(proposed, state, 'normal');
  }

  const previousReliableHr = authoritativeState.lastHr;
  const nearbyBpm = config.hrRawBeamNearbyCandidateBpm || 10;
  const nearby = clusters.filter(candidate =>
    Math.abs(candidate.hrBpm - previousReliableHr) <= nearbyBpm &&
    passesReliableChangeLimits(
      candidate,
      timeSec,
      reliableHistory,
      config
    )
  ).sort((left, right) => candidateScore(right) - candidateScore(left))[0] || null;
  if (nearby) {
    return acceptSelection(nearby, state, 'nearby_candidate');
  }

  const stepSec = config.stepSec || 1;
  const remoteMatchBpm = config.hrRawBeamRemoteMatchBpm || 6;
  const sameRemote = Number.isFinite(state.remoteCandidateHr) &&
    Math.abs(proposed.hrBpm - state.remoteCandidateHr) <= remoteMatchBpm;
  if (sameRemote) {
    state.remoteDurationSec += stepSec;
  } else {
    state.remoteCandidateHr = proposed.hrBpm;
    // The five-second physiological limit applies to the complete transition
    // from the last reliable output, not merely to stability inside the new
    // remote family. A stationary 70 bpm artifact must not qualify as a valid
    // transition from a reliable 160 bpm trajectory.
    state.remoteStartHr = previousReliableHr;
    state.remoteDurationSec = stepSec;
  }
  state.remoteCandidateHr = proposed.hrBpm;
  state.holdDurationSec += stepSec;

  const supportsLongWindows = proposed.supportWindows?.includes(20) &&
    proposed.supportWindows?.includes(30);
  const fiveSecondChange = Math.abs(proposed.hrBpm - state.remoteStartHr);
  const remoteConfirmed = state.remoteDurationSec >=
      (config.hrRawBeamRemoteConfirmSec || 5) &&
    supportsLongWindows &&
    fiveSecondChange <= (config.hrRawBeamRemoteMaximumFiveSecondChangeBpm || 16);
  if (remoteConfirmed) {
    return acceptSelection(proposed, state, 'remote_confirmed');
  }

  const maximumHoldSec = config.hrRawBeamMaximumTrendHoldSec || 5;
  return holdTrend(
    timeSec,
    state,
    authoritativeState,
    config,
    state.holdDurationSec <= maximumHoldSec
      ? 'remote_pending'
      : 'remote_unconfirmed_hold'
  );
}

module.exports = {
  createRawBeamTransitionGuardState,
  guardRawBeamSelection,
  trendPrediction
};
