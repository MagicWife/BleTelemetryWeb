'use strict';

const { removeDC, clamp } = require('../signal/SignalFilters');
const { periodogramPSD } = require('../signal/FFT');

function median(values) {
  const sorted = Array.from(values || []).filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : 0.5 * (sorted[middle - 1] + sorted[middle]);
}

function parabolicOffset(left, center, right) {
  const y0 = Math.log(Math.max(left, 1e-18));
  const y1 = Math.log(Math.max(center, 1e-18));
  const y2 = Math.log(Math.max(right, 1e-18));
  const denominator = y0 - 2 * y1 + y2;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return 0;
  return clamp(0.5 * (y0 - y2) / denominator, -0.5, 0.5);
}

/**
 * Select the strongest non-DC spectral component in the configured
 * respiratory range. With a 30 s observation the first physically resolved
 * non-zero component is about 2 breaths/min, so a nominal lower bound of zero
 * does not accidentally select DC.
 */
function estimateRespiratoryPeak(signal, sampleRateHz, config) {
  const spectrum = periodogramPSD(
    removeDC(signal),
    sampleRateHz,
    { window: 'hann' }
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
  const offset = bestIndex > 0 && bestIndex + 1 < spectrum.psd.length
    ? parabolicOffset(
        spectrum.psd[bestIndex - 1],
        spectrum.psd[bestIndex],
        spectrum.psd[bestIndex + 1]
      )
    : 0;
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
  if (Number.isFinite(state.candidateBpm) &&
      Math.abs(respiratory.bpm - state.candidateBpm) <= matchBpm) {
    const weight = Math.min(0.5, stepSec / Math.max(stepSec, state.durationSec + stepSec));
    state.candidateBpm = (1 - weight) * state.candidateBpm + weight * respiratory.bpm;
    state.durationSec += stepSec;
  } else {
    if (Number.isFinite(state.stableBpm) &&
        Math.abs(respiratory.bpm - state.stableBpm) > matchBpm) {
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
  if (config.respiratoryFamilyExclusionEnabled === false ||
      !Number.isFinite(state.stableBpm) || !(state.stableBpm > 0)) {
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
  // Do not manufacture a missing HR value. If every candidate belongs to the
  // respiratory family, keep the previous HR through the existing fallback
  // path by returning an empty selectable set.
  return { retained, excluded };
}

function linearConfidence(value, low, high, lowValue = 0) {
  if (!(value > low)) return lowValue;
  if (value >= high) return 1;
  return lowValue + (1 - lowValue) * (value - low) / (high - low);
}

/**
 * Respiratory harmonic membership is evidence, not a veto. Every candidate is
 * retained. A penalty is applied only after the ordinary observation score is
 * available and only when a non-family alternative exists.
 */
function applyRespiratoryFamilyPenalty(
  clusters,
  state,
  respiratory,
  authoritativeHr,
  config
) {
  const summary = { penalized: [], protected: [], family: [] };
  if (config.respiratoryFamilyPenaltyEnabled !== true ||
      !Number.isFinite(state.stableBpm) || !(state.stableBpm > 0) ||
      respiratory.quality < (config.respiratoryFamilyMinimumQuality ?? 0.75) ||
      state.durationSec < (config.respiratoryFamilyConfirmSec ?? 8)) {
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
    cluster.respiratoryFamilyDistanceBpm = Number.isFinite(distanceBpm)
      ? distanceBpm : 0;
    cluster.respiratoryFamilyPenalty = 0;
    cluster.respiratoryFamilyProtected = false;
    cluster.respiratoryFamilyProtectionReason = '';
    if (order > 0) summary.family.push(cluster);
  }
  const nonFamilyExists = clusters.some(cluster =>
    !(cluster.respiratoryFamilyOrder > 0));
  if (!nonFamilyExists) return summary;

  for (const cluster of summary.family) {
    const authorityProtected = Number.isFinite(authoritativeHr) &&
      Math.abs(cluster.hrBpm - authoritativeHr) <=
        (config.respiratoryFamilyAuthorityProtectionBpm ?? 6);
    const heartbeatProtected =
      (cluster.relativeHeartbeatScore || 0) >=
        (config.respiratoryFamilyStrongHeartbeatProtection ?? 0.75);
    if (authorityProtected || heartbeatProtected) {
      cluster.respiratoryFamilyProtected = true;
      cluster.respiratoryFamilyProtectionReason = authorityProtected
        ? 'authoritative_history' : 'strong_heartbeat_evidence';
      summary.protected.push(cluster);
      continue;
    }
    const qualityConfidence = linearConfidence(
      respiratory.quality, 0.65, 0.85, 0
    );
    const distanceConfidence = cluster.respiratoryFamilyDistanceBpm <= 1
      ? 1
      : Math.max(0, (3 - cluster.respiratoryFamilyDistanceBpm) / 2);
    const persistenceConfidence = linearConfidence(
      state.durationSec, 5, 8, 0
    );
    const confidence = qualityConfidence * distanceConfidence *
      persistenceConfidence;
    const extreme = respiratory.quality >= 0.85 &&
      cluster.respiratoryFamilyDistanceBpm <= 1 &&
      state.durationSec >= 10;
    const maximumPenalty = extreme
      ? (config.respiratoryFamilyExtremePenalty ?? 0.12)
      : (config.respiratoryFamilyNormalPenalty ?? 0.08);
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
