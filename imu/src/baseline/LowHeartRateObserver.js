'use strict';

const baseConfig = require('../../config');
const { _test } = require('./SlidingWindowEstimator');

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
    lastDecision: 'observing'
  };
}

function mergeCandidates(candidates, config) {
  const tolerance = config.criticalLowHeartCandidateMergeBpm || 4;
  const clusters = [];
  for (const candidate of candidates.slice().sort((a, b) => a.hrBpm - b.hrBpm)) {
    let cluster = clusters.find(item => Math.abs(item.hrBpm - candidate.hrBpm) <= tolerance);
    if (!cluster) {
      cluster = { members: [], hrBpm: candidate.hrBpm };
      clusters.push(cluster);
    }
    cluster.members.push(candidate);
    const weights = cluster.members.map(item => 0.25 + 0.75 * item.spectralScore);
    const total = weights.reduce((sum, value) => sum + value, 0);
    cluster.hrBpm = cluster.members.reduce((sum, item, index) => sum + item.hrBpm * weights[index], 0) / Math.max(total, 1e-12);
  }
  return clusters.map(cluster => ({
    hrBpm: cluster.hrBpm,
    frequencyHz: cluster.hrBpm / 60,
    spectralScore: mean(cluster.members.map(item => item.spectralScore)),
    intervalScore: mean(cluster.members.map(item => item.intervalScore)),
    autocorrelationScore: mean(cluster.members.map(item => item.autocorrelationScore)),
    crossAxisHeartEvidence: mean(cluster.members.map(item => item.crossAxisHeartEvidence)),
    supportWindows: [...new Set(cluster.members.map(item => item.windowSec))].sort((a, b) => a - b),
    members: cluster.members
  })).sort((a, b) => b.spectralScore - a.spectralScore);
}

function updateTracks(clusters, timeSec, state, config) {
  const matchBpm = config.criticalLowHeartTrackMatchBpm || 5;
  const maxGap = config.criticalLowHeartTrackMaximumGapSec || 3;
  const historySec = config.criticalLowHeartTrackHistorySec || 60;
  const used = new Set();
  for (const cluster of clusters) {
    const track = state.tracks.filter(item => !used.has(item.id) && timeSec - item.lastTimeSec <= maxGap)
      .sort((a, b) => Math.abs(a.hrBpm - cluster.hrBpm) - Math.abs(b.hrBpm - cluster.hrBpm))[0];
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
  state.tracks = state.tracks.filter(track => timeSec - track.lastTimeSec <= maxGap && track.history.some(point => point.timeSec >= timeSec - historySec));
  for (const track of state.tracks) {
    track.history = track.history.filter(point => point.timeSec >= timeSec - historySec);
  }
  for (const cluster of clusters) {
    const track = state.tracks.find(item => item.id === cluster.trackId);
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
  const doubled = primaryCandidates.filter(Number.isFinite).map(value => ({ value, distance: Math.abs(value - 2 * candidate.hrBpm) })).sort((a, b) => a.distance - b.distance)[0];
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
      'critical_low'
    );
    allCandidates.push(...result.candidates);
  }
  const clusters = mergeCandidates(allCandidates, config);
  updateTracks(clusters, timeSec, state, config);
  const required = config.criticalLowHeartRequiredWindows || [20, 30];
  const eligible = clusters.filter(candidate => required.every(window => candidate.supportWindows.includes(window)))
    .sort((a, b) => b.trackCoverage - a.trackCoverage || b.spectralScore - a.spectralScore);
  const candidate = eligible[0] || null;
  const primaryCandidates = context.primaryCandidates || [];
  const primaryHr = context.primaryHr;
  const primaryPresent = Number.isFinite(primaryHr) && primaryCandidates.some(value => Math.abs(value - primaryHr) <= (config.criticalLowHeartPrimaryMatchBpm || 12));
  state.primaryMissingSec = primaryPresent ? 0 : state.primaryMissingSec + (config.stepSec || 1);
  const same = candidate && Number.isFinite(state.shadowCandidateHr) && Math.abs(candidate.hrBpm - state.shadowCandidateHr) <= (config.criticalLowHeartTrackMatchBpm || 5);
  state.shadowCandidateDurationSec = candidate ? (same ? state.shadowCandidateDurationSec + (config.stepSec || 1) : (config.stepSec || 1)) : 0;
  state.shadowCandidateHr = candidate?.hrBpm ?? NaN;
  const relations = analyzeRelations(candidate, context.respiratoryRate, primaryCandidates, config);
  const evidencePassed = Boolean(candidate && candidate.spectralScore >= config.criticalLowHeartMinimumSpectralScore && candidate.trackCoverage >= config.criticalLowHeartMinimumCoverage);
  state.shadowAdmission = Boolean(evidencePassed && state.shadowCandidateDurationSec >= config.criticalLowHeartAdmissionConfirmSec && state.primaryMissingSec >= config.criticalLowHeartPrimaryMissingSec);
  state.lastDecision = !candidate ? 'no_multwindow_candidate' : !evidencePassed ? 'insufficient_low_evidence' : state.shadowCandidateDurationSec < config.criticalLowHeartAdmissionConfirmSec ? 'confirming_low_track' : state.primaryMissingSec < config.criticalLowHeartPrimaryMissingSec ? 'primary_track_present' : 'shadow_would_admit';
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
