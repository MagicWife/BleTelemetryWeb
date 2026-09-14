'use strict';

const { clamp } = require('../signal/SignalFilters');

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
    return { selected: null, beam: [], mode: 'no_candidate' };
  }
  const next = [];
  for (const cluster of clusters) {
    const predecessors = previousBeam.filter(track =>
      Math.abs(track.hrBpm - cluster.hrBpm) <= config.hrTrackMaxMatchBpm
    );
    let best = null;
    for (const predecessor of predecessors) {
      const jump = Math.abs(predecessor.hrBpm - cluster.hrBpm);
      const transitionPenalty = config.hrTrackTransitionPenalty *
        clamp(jump / config.hrTrackTransitionScaleBpm, 0, 1);
      const physiologicTransitionPenalty =
        config.hrDataDrivenScoringActive === true
          ? config.hrPhysiologyTransitionPenaltyWeight *
            (1 - empiricalPlausibility(
              jump,
              config.hrPhysiologyDeltaLimits?.[1]
            ))
          : 0;
      const memory = (cluster.contaminationRatio || 0) >=
          config.impactHighContaminationRatio
        ? Math.min(config.hrTrackMemory, 0.45)
        : config.hrTrackMemory;
      const cumulative = memory * predecessor.cumulativeScore +
        cluster.observationScore - transitionPenalty - physiologicTransitionPenalty;
      if (!best || cumulative > best.cumulativeScore) {
        best = {
          cumulativeScore: cumulative,
          ageSec: predecessor.ageSec + config.stepSec,
          stableHr: 0.95 * predecessor.stableHr + 0.05 * cluster.hrBpm
        };
      }
    }
    if (!best) {
      const nearestPreviousDistance = previousBeam.length > 0
        ? Math.min(...previousBeam.map(track =>
          Math.abs(track.hrBpm - cluster.hrBpm)))
        : 0;
      const newTrackPenalty = config.hrDataDrivenScoringActive === true &&
          previousBeam.length > 0
        ? config.hrPhysiologyNewTrackPenaltyWeight *
          (1 - empiricalPlausibility(
            nearestPreviousDistance,
            config.hrPhysiologyDeltaLimits?.[1]
          ))
        : 0;
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
  const mode = !previousPrimary
    ? 'beam_initialize'
    : Math.abs(previousPrimary.hrBpm - selectedTrack.hrBpm) >
        config.hrTrackMaxMatchBpm
      ? 'beam_reacquire'
      : 'beam_tracking';
  return { selected: selectedTrack.cluster, beam, mode };
}

module.exports = { updateCandidateBeam };
