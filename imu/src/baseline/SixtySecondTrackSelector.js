'use strict';

const { clamp } = require('../signal/SignalFilters');

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
    lastDecision: 'waiting_for_mature_track'
  };
}

function trackScore(cluster) {
  const longSupport = cluster.supportWindows?.includes(20) &&
      cluster.supportWindows?.includes(30) ? 1 : 0;
  const trendShape = 0.5 * (cluster.physiologicSlopeScore || 0) +
    0.5 * (cluster.physiologicResidualScore || 0);
  return clamp(
    0.20 * (cluster.physiologicRecent15Coverage || 0) +
    0.20 * longSupport +
    0.15 * (cluster.spectralScore || 0) +
    0.20 * (cluster.physiologicDeltaScore || 0) +
    0.15 * trendShape +
    0.10 * (cluster.relativeHeartbeatScore || 0),
    0,
    1
  );
}

function isMatureTrack(cluster, config) {
  const requiredWindows = config.hrMatureTrackTakeoverRequiredWindows || [20, 30];
  return cluster &&
    cluster.physiologicTrendStable === true &&
    (cluster.physiologicTrendSpanSec || 0) >=
      (config.hrMatureTrackTakeoverSpanSec || 60) &&
    (cluster.physiologicTrendCoverage || 0) >=
      (config.hrMatureTrackTakeoverMinimumCoverage || 0.95) &&
    (cluster.physiologicRecent15Coverage || 0) >=
      (config.hrCheckpointTrackCurrentMinimumCoverage15 || 0.60) &&
    (cluster.physiologicTrendMaximumStep || 0) <=
      (config.hrMatureTrackMaximumStepBpm || 6) &&
    requiredWindows.every(windowSec =>
      cluster.supportWindows?.includes(windowSec));
}

function selectSixtySecondTrack(clusters, timeSec, state, config) {
  if (config.hrCheckpointTrackLockEnabled !== true) {
    return { selected: null, valid: false, reason: 'disabled' };
  }
  const decisionSec = config.hrCheckpointTrackDecisionSec || 15;
  const mature = clusters.filter(cluster => isMatureTrack(cluster, config))
    .sort((left, right) => trackScore(right) - trackScore(left) ||
      (right.observationScore || 0) - (left.observationScore || 0));

  let current = mature.find(cluster =>
    cluster.physiologicTrackId === state.activeTrackId) || null;
  if (!current && state.activeTrackId &&
      state.missingSec < (config.hrCheckpointTrackShortHoldSec || 2)) {
    const predicted = state.activeHr + state.activeVelocity * (config.stepSec || 1);
    current = mature.filter(cluster =>
      Math.abs(cluster.hrBpm - predicted) <=
        (config.hrCheckpointTrackRelinkBpm || 6))
      .sort((left, right) =>
        Math.abs(left.hrBpm - predicted) - Math.abs(right.hrBpm - predicted))[0] || null;
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
    state.lastDecision = 'mature_track_initialized';
  } else if (current) {
    const previousHr = state.activeHr;
    state.activeHr = current.hrBpm;
    state.activeVelocity = Number.isFinite(current.physiologicTrendVelocity)
      ? current.physiologicTrendVelocity
      : current.hrBpm - previousHr;
    state.heldCluster = current;
    state.missingSec = 0;
  } else if (state.activeTrackId) {
    state.missingSec += config.stepSec || 1;
  }

  if (timeSec + 1e-9 >= state.nextDecisionSec && state.activeTrackId) {
    const activeScore = current ? trackScore(current) :
      trackScore(state.heldCluster || {});
    const anchorHr = Number.isFinite(state.activeHr) ? state.activeHr :
      state.heldCluster?.hrBpm;
    const challenger = mature.find(cluster =>
      cluster.physiologicTrackId !== state.activeTrackId) || null;
    if (challenger) {
      const distance = Math.abs(challenger.hrBpm - anchorHr);
      const advantage = trackScore(challenger) - activeScore;
      const activeInvalid = !current || state.missingSec >=
        (config.hrCheckpointTrackCurrentMissingSec || 5);
      const local = distance <= (config.hrCheckpointTrackLocalSwitchBpm || 10);
      if (activeInvalid && local && advantage >=
          (config.hrCheckpointTrackLocalScoreAdvantage || 0.05)) {
        state.activeTrackId = challenger.physiologicTrackId || 0;
        state.activeHr = challenger.hrBpm;
        state.activeVelocity = challenger.physiologicTrendVelocity || 0;
        state.heldCluster = challenger;
        state.missingSec = 0;
        state.remoteTrackId = 0;
        state.remoteCheckpointCount = 0;
        current = challenger;
        state.lastDecision = 'local_mature_track_switched';
      } else if (activeInvalid &&
          distance > (config.hrCheckpointTrackRemoteSwitchBpm || 15) &&
          advantage >= (config.hrCheckpointTrackRemoteScoreAdvantage || 0.10)) {
        const sameRemote = state.remoteTrackId === challenger.physiologicTrackId;
        state.remoteTrackId = challenger.physiologicTrackId || 0;
        state.remoteCheckpointCount = sameRemote
          ? state.remoteCheckpointCount + 1
          : 1;
        state.lastDecision = 'remote_mature_track_pending';
        if (state.remoteCheckpointCount >=
            (config.hrCheckpointTrackRemoteRequiredCheckpoints || 2)) {
          state.activeTrackId = challenger.physiologicTrackId || 0;
          state.activeHr = challenger.hrBpm;
          state.activeVelocity = challenger.physiologicTrendVelocity || 0;
          state.heldCluster = challenger;
          state.missingSec = 0;
          state.remoteTrackId = 0;
          state.remoteCheckpointCount = 0;
          current = challenger;
          state.lastDecision = 'remote_mature_track_switched';
        }
      } else {
        state.remoteTrackId = 0;
        state.remoteCheckpointCount = 0;
        state.lastDecision = current
          ? 'current_mature_track_retained'
          : 'challenger_rejected';
      }
    } else {
      state.remoteTrackId = 0;
      state.remoteCheckpointCount = 0;
      state.lastDecision = current
        ? 'current_mature_track_retained'
        : 'no_mature_challenger';
    }
    do {
      state.nextDecisionSec += decisionSec;
    } while (timeSec + 1e-9 >= state.nextDecisionSec);
  }

  if (current && isMatureTrack(current, config)) {
    return { selected: current, valid: true, reason: state.lastDecision };
  }
  const shortHoldSec = config.hrCheckpointTrackShortHoldSec || 2;
  if (state.heldCluster && state.missingSec > 0 &&
      state.missingSec < shortHoldSec) {
    return {
      selected: { ...state.heldCluster, hrBpm: state.activeHr,
        frequencyHz: state.activeHr / 60, heldBySixtySecondTrack: true },
      valid: true,
      reason: 'short_track_hold'
    };
  }
  return {
    selected: null,
    valid: false,
    reason: state.activeTrackId ? 'mature_track_missing' : 'no_mature_track'
  };
}

module.exports = {
  createSixtySecondTrackState,
  selectSixtySecondTrack,
  trackScore,
  isMatureTrack
};
