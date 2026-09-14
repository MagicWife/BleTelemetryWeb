'use strict';

const baseConfig = require('../../config');
const { removeDC, clamp } = require('../signal/SignalFilters');
const { periodogramPSD, magnitudeSquaredCoherence } = require('../signal/FFT');
const {
  computeObservationScores,
  relativePercentile,
  annotateRelativeCandidateEvidence
} = require('./CandidateScoring');
const { updateCandidateBeam } = require('./CandidateBeam');
const {
  createSixtySecondTrackState,
  selectSixtySecondTrack
} = require('./SixtySecondTrackSelector');
const {
  createSelectionArbiterState,
  arbitrateSelection
} = require('./SelectionArbiter');
const {
  createRawBeamTransitionGuardState,
  guardRawBeamSelection
} = require('./RawBeamTransitionGuard');
const {
  createAuthoritativeReliableHistoryState,
  updateAuthoritativeReliableHistory,
  preserveAuthoritativeReliableHistory
} = require('./AuthoritativeReliableHistory');
const {
  estimateRespiratoryPeak,
  createRespiratoryFamilyState,
  updateRespiratoryFamilyState,
  applyRespiratoryFamilyPenalty
} = require('./RespiratoryFamilyFilter');
const {
  createRespiratoryControlAdmissionState,
  reviewRespiratoryControlAdmission
} = require('./RespiratoryControlAdmission');

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
  return finite.length % 2
    ? finite[middle]
    : 0.5 * (finite[middle - 1] + finite[middle]);
}

function percentile(values, probability) {
  const finite = Array.from(values || []).filter(Number.isFinite)
    .sort((a, b) => a - b);
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
  return Math.sqrt(mean(finite.map(value => (value - average) ** 2)));
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
  const mad = median(values.map(value => Math.abs(value - center)));
  if (!(mad > 1e-12)) return 0;
  const threshold = config.gyroImpulseMadMultiplier * 1.4826 * mad;
  return values.filter(value => Math.abs(value - center) > threshold).length / values.length;
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
    if (previous === undefined || i - previous >= minimumDistance) {
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
  const intervalMad = median(events.intervals.map(value => Math.abs(value - interval)));
  const intervalCv = intervalMad / Math.max(interval, config.epsilon);
  const agreement = Math.exp(
    -0.5 * ((interval - expected) /
      Math.max(config.rhythmIntervalRelativeSigma * expected, config.epsilon)) ** 2
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
    if (!(value > threshold && value >= Math.abs(centered[i - 1]) &&
      value > Math.abs(centered[i + 1]))) continue;
    const previous = peaks[peaks.length - 1];
    if (previous === undefined || i - previous >= minimumDistance) {
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
  for (const axis of ['x', 'y', 'z']) {
    for (const index of axisEvents[axis] || []) proposals.push({ axis, index });
  }
  proposals.sort((a, b) => a.index - b.index);
  const consensus = [];
  for (const proposal of proposals) {
    const support = new Set([proposal.axis]);
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
    if (gyroEvents.some(gyro => Math.abs(gyro - event) <= tolerance)) synchronized++;
  }
  return synchronized / consensusEvents.length;
}

function annotateCrossAxisEventEvidence(
  candidates,
  axisWindows,
  gyroWindow,
  sampleRateHz,
  config
) {
  const axisEvents = {};
  for (const axis of ['x', 'y', 'z']) {
    axisEvents[axis] = detectSignedAxisEvents(
      axisWindows[axis] || [],
      sampleRateHz,
      config
    );
  }
  const consensus = buildConsensusEvents(axisEvents, sampleRateHz, config);
  const gyroEvents = gyroWindow
    ? detectSignedAxisEvents(gyroWindow, sampleRateHz, config)
    : [];
  const gyroSyncRatio = gyroSynchronizationRatio(
    consensus.peaks,
    gyroEvents,
    sampleRateHz,
    config
  );
  const maximumAxisEvents = Math.max(
    1,
    ...Object.values(axisEvents).map(events => events.length)
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
    const enoughEvents = consensus.peaks.length >=
      config.crossAxisMinConsensusEvents;
    candidate.crossAxisConsensusScore = enoughEvents
      ? interval.score * consensusCoverage
      : 0;
    candidate.crossAxisConsensusEvents = consensus.peaks.length;
    candidate.crossAxisConsensusCoverage = consensusCoverage;
    candidate.crossAxisGyroSyncRatio = gyroSyncRatio;
    candidate.crossAxisHeartEvidence = candidate.crossAxisConsensusScore *
      (1 - gyroSyncRatio);
  }
}

function signedCorrelation(left, right) {
  const n = Math.min(left.length, right.length);
  if (n === 0) return 0;
  let dot = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let i = 0; i < n; i++) {
    dot += left[i] * right[i];
    leftEnergy += left[i] * left[i];
    rightEnergy += right[i] * right[i];
  }
  if (!(leftEnergy > 0) || !(rightEnergy > 0)) return 0;
  return dot / Math.sqrt(leftEnergy * rightEnergy);
}

function extractTopCandidates(
  signal,
  gyroSignal,
  sampleRateHz,
  windowSec,
  config,
  source = 'magnitude'
) {
  const centered = removeDC(signal);
  const computeMagnitudeRhythm =
    config.rhythmEvidenceDiagnosticEnabled === true;
  const timeDomainEvents = computeMagnitudeRhythm
    ? detectTimeDomainEvents(centered, sampleRateHz, config)
    : null;
  const spectrum = periodogramPSD(centered, sampleRateHz, { window: 'hann' });
  const gyroAvailable = gyroSignal && gyroSignal.length === signal.length;
  const gyroCentered = gyroAvailable ? removeDC(gyroSignal) : null;
  const gyroSpectrum = gyroAvailable
    ? periodogramPSD(gyroCentered, sampleRateHz, { window: 'hann' })
    : null;
  const gyroBandIndices = gyroSpectrum
    ? bandIndices(gyroSpectrum.freqs, config.hrPhysLowBpm, config.hrPhysHighBpm)
    : [];
  const gyroBandMedian = gyroBandIndices.length > 0
    ? median(gyroBandIndices.map(index => gyroSpectrum.psd[index]))
    : NaN;
  const coherenceResult = gyroAvailable &&
      windowSec >= config.gyroCoherenceMinWindowSec
    ? magnitudeSquaredCoherence(centered, gyroCentered, sampleRateHz, {
        segmentSec: config.gyroCoherenceSegmentSec,
        overlap: config.gyroCoherenceOverlap
      })
    : null;
  const gyroImpulseRatio = gyroAvailable
    ? robustImpulseRatio(gyroCentered, config)
    : 0;
  const indices = bandIndices(
    spectrum.freqs,
    config.hrPhysLowBpm,
    config.hrPhysHighBpm
  );
  if (indices.length === 0) return { candidates: [], spectrum };

  // Differentiation multiplies amplitude by 2πf and power by (2πf)².
  // Compensate that known transfer function when ranking signed-axis peaks;
  // otherwise high-frequency noise is systematically preferred. The raw
  // differentiated signal and its signed phase are still retained.
  const bandPower = indices.map(index => spectrum.psd[index]);
  const bandMedian = median(bandPower);
  const bandStd = standardDeviation(bandPower) || 1e-12;
  const maxPower = Math.max(...bandPower, 1e-18);
  const peaks = localPeakIndices(spectrum.psd, indices)
    .sort((a, b) => spectrum.psd[b] - spectrum.psd[a]);

  const selected = [];
  const minimumDistanceHz = config.hrMinPeakDistanceHz;
  for (const index of peaks) {
    const gridFrequencyHz = spectrum.freqs[index];
    if (selected.some(candidate =>
      Math.abs(candidate.gridFrequencyHz - gridFrequencyHz) < minimumDistanceHz
    )) {
      continue;
    }

    const offset = index > 0 && index + 1 < spectrum.psd.length
      ? parabolicPeakOffset(
          spectrum.psd[index - 1],
          spectrum.psd[index],
          spectrum.psd[index + 1]
        )
      : 0;
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
      0.7 * relativeStrength +
      0.2 * localProminence +
      0.1 * clamp((amplitude - bandMedian) / (3 * bandStd), 0, 1),
      0,
      1
    );
    const gyroIndex = gyroSpectrum
      ? nearestBin(gyroSpectrum.freqs, refinedHz)
      : -1;
    const gyroRelativeEnergy = gyroIndex >= 0 && Number.isFinite(gyroBandMedian)
      ? gyroSpectrum.psd[gyroIndex] / Math.max(gyroBandMedian, config.epsilon)
      : 0;
    const coherenceIndex = coherenceResult
      ? nearestBin(coherenceResult.freqs, refinedHz)
      : -1;
    const gyroCoherence = coherenceIndex >= 0
      ? coherenceResult.coherence[coherenceIndex]
      : 0;
    const autocorrelation = computeMagnitudeRhythm
      ? autocorrelationRhythmEvidence(centered, refinedHz, sampleRateHz)
      : { score: 0, full: 0, firstHalf: 0, secondHalf: 0, stability: 0 };
    const intervalEvidence = computeMagnitudeRhythm
      ? intervalRhythmEvidence(timeDomainEvents, refinedHz, config)
      : { score: 0, medianIntervalSec: 0, intervalCv: 0, eventCount: 0 };
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
    for (const axis of ['x', 'y', 'z']) {
      const value = cluster.axisEnergy?.[windowSec]?.[axis];
      if (Number.isFinite(value)) values.push(value);
    }
  }
  if (values.length === 0) return 0;
  // Energy is normalized by the HR-band median. Saturation prevents a single
  // extreme axis from dominating the observation score.
  return clamp(Math.log1p(Math.max(...values)) / Math.log(11), 0, 1);
}

function annotateCandidateEvidence(clusters, axisSpectraByWindow, config) {
  for (const cluster of clusters) {
    cluster.axisEnergy = {};
    for (const windowSec of [10, 20, 30]) {
      cluster.axisEnergy[windowSec] = {};
      for (const axis of ['x', 'y', 'z']) {
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
      ...[20, 30].flatMap(windowSec =>
        ['x', 'y', 'z'].map(axis =>
          cluster.axisEnergy?.[windowSec]?.[axis] || 0
        )
      )
    );
    cluster.excludedWeakCandidate =
      cluster.spectralScore < config.hrWeakCandidateSpectralThreshold &&
      longAxisMaximum < config.hrWeakCandidateAxisEnergyThreshold;
    cluster.exclusionReason = cluster.excludedWeakCandidate
      ? 'weak_spectrum_and_all_long_axes_weak'
      : '';
  }
  const retained = clusters.filter(cluster => !cluster.excludedWeakCandidate);
  // Never manufacture a missing estimate by deleting the whole candidate set.
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
  const key = windows.slice().sort((a, b) => a - b).join('+');
  return ({
    '10': 0.20,
    '20': 0.35,
    '30': 0.55,
    '10+20': 0.45,
    '10+30': 0.60,
    '20+30': 0.72,
    '10+20+30': 1.00
  })[key] ?? 0;
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
    const weights = bestCluster.members.map(member =>
      windowBaseWeight(member.windowSec, config.windowSecList) *
      (0.25 + 0.75 * member.spectralScore)
    );
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    bestCluster.centerBpm = bestCluster.members.reduce(
      (sum, member, index) => sum + member.hrBpm * weights[index],
      0
    ) / Math.max(totalWeight, 1e-12);
  }

  const moving = state === 'moving';

  return clusters.map(cluster => {
    const windows = [...new Set(cluster.members.map(member => member.windowSec))].sort((a, b) => a - b);
    // Support is graded by the actual window combination. A single-window
    // candidate remains selectable; longer and repeated support earns a bonus.
    const supportScore = windowCombinationConfidence(windows);
    const spectralScore = mean(cluster.members.map(member => member.spectralScore));
    const contaminationRatio = mean(
      cluster.members.map(member => member.contaminationRatio || 0)
    );
    const autocorrelationScore = mean(
      cluster.members.map(member => member.autocorrelationScore || 0)
    );
    const autocorrelationStability = mean(
      cluster.members.map(member => member.autocorrelationStability || 0)
    );
    const autocorrelationFull = mean(
      cluster.members.map(member => member.autocorrelationFull || 0)
    );
    const autocorrelationFirstHalf = mean(
      cluster.members.map(member => member.autocorrelationFirstHalf || 0)
    );
    const autocorrelationSecondHalf = mean(
      cluster.members.map(member => member.autocorrelationSecondHalf || 0)
    );
    const intervalScore = mean(
      cluster.members.map(member => member.intervalScore || 0)
    );
    const crossAxisConsensusScore = mean(
      cluster.members.map(member => member.crossAxisConsensusScore || 0)
    );
    const crossAxisConsensusCoverage = mean(
      cluster.members.map(member => member.crossAxisConsensusCoverage || 0)
    );
    const crossAxisGyroSyncRatio = mean(
      cluster.members.map(member => member.crossAxisGyroSyncRatio || 0)
    );
    const crossAxisHeartEvidence = mean(
      cluster.members.map(member => member.crossAxisHeartEvidence || 0)
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
    // Window support is added exactly once here. CandidateScoring deliberately
    // omits it, preventing the previous double reward without erasing support.
    const baseScore = moving
      ? 0.28 * supportScore + 0.15 * spectralScore +
        0.37 * continuity + 0.20 * baseline
      : 0.25 * supportScore + 0.25 * spectralScore +
        0.32 * continuity + 0.18 * baseline;
    const motionReliability = moving ? 0.75 : (state === 'static' ? 1 : 0.85);
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
      gyroRelativeEnergy: mean(cluster.members.map(member => member.gyroRelativeEnergy)),
      gyroEnergyScore: mean(cluster.members.map(member => member.gyroEnergyScore)),
      gyroCoherence: mean(
        cluster.members
          .filter(member => member.gyroCoherenceSegments >= 3)
          .map(member => member.gyroCoherence)
      ),
      gyroImpulseRatio: mean(cluster.members.map(member => member.gyroImpulseRatio)),
      supportWindows: windows,
      members: cluster.members
    };
  }).sort((a, b) => b.score - a.score);
}

function applyGyroPenalty(clusters, previousTracks, config, motionReliability) {
  const nextTracks = [];
  for (const cluster of clusters) {
    const energy = cluster.gyroEnergyScore;
    // High coherence is suspicious only when gyro energy is also elevated.
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
    const previous = (previousTracks || [])
      .filter(track =>
        Math.abs(track.hrBpm - cluster.hrBpm) <= config.hrCandidateMergeBpm
      )
      .sort((a, b) =>
        Math.abs(a.hrBpm - cluster.hrBpm) - Math.abs(b.hrBpm - cluster.hrBpm)
      )[0];
    const sustained = instantaneous >= config.gyroMotionEvidenceThreshold;
    const durationSec = sustained
      ? (previous?.durationSec || 0) + config.stepSec
      : Math.max(0, (previous?.durationSec || 0) - config.stepSec);
    const persistence = clamp(
      durationSec / Math.max(config.gyroPersistenceFullSec, config.stepSec),
      0,
      1
    );
    const penaltyEvidence = clamp(
      0.4 * energy +
      0.35 * coherenceEvidence +
      0.15 * persistence +
      0.1 * impulse,
      0,
      1
    );
    const penalty = config.gyroPenaltyWeight * penaltyEvidence;
    cluster.gyroPersistenceScore = persistence;
    cluster.gyroPenalty = penalty;
    cluster.motionCandidateType =
      cluster.spectralScore < 0.35 && energy >= 0.6 ? 'C_acc_weak_gyro_strong' :
      energy < 0.25 ? 'A_acc_strong_gyro_weak' :
      cluster.gyroCoherence >= 0.65 ? 'B_acc_gyro_coherent' :
      cluster.spectralScore >= 0.35 ? 'D_acc_gyro_not_coherent' :
      'mixed';
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
  const background = median(indices.map(item => spectrum.psd[item]));
  return spectrum.psd[index] / Math.max(background, config.epsilon);
}

function updateDiagnosticCandidateTracks(
  clusters,
  tracks,
  timeSec,
  config
) {
  const matchedTrackIds = new Set();
  let nextId = tracks.reduce((maximum, track) =>
    Math.max(maximum, track.id), 0) + 1;
  for (const cluster of clusters) {
    const match = tracks
      .filter(track =>
        !matchedTrackIds.has(track.id) &&
        timeSec - track.lastSeenSec <= 30 &&
        Math.abs(track.lastHr - cluster.hrBpm) <= config.hrCandidateMergeBpm
      )
      .sort((a, b) =>
        Math.abs(a.lastHr - cluster.hrBpm) -
        Math.abs(b.lastHr - cluster.hrBpm)
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
  return tracks.filter(track => timeSec - track.lastSeenSec <= 60);
}

function rms(values) {
  const finite = Array.from(values || []).filter(Number.isFinite);
  if (finite.length === 0) return 0;
  return Math.sqrt(mean(finite.map(value => value * value)));
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
  const horizons = [[1, 0.35], [5, 0.25], [15, 0.20], [30, 0.20]];
  let weighted = 0;
  let totalWeight = 0;
  const details = {};
  for (const [horizon, weight] of horizons) {
    const target = timeSec - horizon;
    const previous = history
      .filter(item => item.timeSec < timeSec)
      .sort((left, right) =>
        Math.abs(left.timeSec - target) - Math.abs(right.timeSec - target)
      )[0];
    if (!previous || Math.abs(previous.timeSec - target) >
        Math.max(1.5 * config.stepSec, 1)) continue;
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

/**
 * Preserve every viable candidate as a short trajectory and measure whether
 * it follows a physiologically plausible, gradual trend. This is candidate
 * evidence rather than output smoothing: an unstable selected peak can be
 * replaced only when another spectral candidate has a stable rolling 30 s
 * history.
 */
function updatePhysiologicCandidateTracks(
  clusters,
  tracks,
  timeSec,
  config
) {
  const matchedIds = new Set();
  let nextId = tracks.reduce((maximum, track) =>
    Math.max(maximum, track.id), 0) + 1;

  // Match the whole candidate set against the whole trajectory bank before
  // updating either side. This prevents an early/high-ranked candidate from
  // claiming a trajectory that is substantially closer to another candidate.
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
  possibleMatches.sort((left, right) =>
    left.distance / left.tolerance - right.distance / right.tolerance ||
    left.distance - right.distance);
  const assignedTrackByCluster = new Map();
  const assignedTrackIndices = new Set();
  for (const match of possibleMatches) {
    if (assignedTrackByCluster.has(match.clusterIndex) ||
        assignedTrackIndices.has(match.trackIndex)) continue;
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
      track.velocityBpmPerSec =
        (1 - alpha) * track.velocityBpmPerSec + alpha * measuredVelocity;
      track.lastTimeSec = timeSec;
      track.lastHr = cluster.hrBpm;
    }

    track.observations.push({ timeSec, hrBpm: cluster.hrBpm });
    const historyStart = timeSec - config.hrTrendHistorySec;
    track.observations = track.observations.filter(
      item => item.timeSec >= historyStart
    );
    matchedIds.add(track.id);

    const history = track.observations;
    const recent15 = history.filter(item => item.timeSec >= timeSec - 15);
    const spanSec = history.length > 1
      ? history[history.length - 1].timeSec - history[0].timeSec
      : 0;
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
    const maximumStep = steps.length > 0
      ? Math.max(...steps.map(Math.abs))
      : 0;
    const absoluteSteps = steps.map(Math.abs);
    const stepP95 = percentile(absoluteSteps, 0.95);
    const largeStepCount = absoluteSteps.filter(step =>
      step > config.hrTrendLargeStepThresholdBpm).length;
    const robustStepStable =
      stepP95 <= config.hrTrendStepP95MaximumBpm &&
      largeStepCount <= config.hrTrendMaximumLargeStepCount &&
      maximumStep <= config.hrTrendAbsoluteMaximumStepBpm;
    const meanTime = history.reduce((sum, item) => sum + item.timeSec, 0) /
      Math.max(1, history.length);
    const meanHr = history.reduce((sum, item) => sum + item.hrBpm, 0) /
      Math.max(1, history.length);
    let timeVariance = 0;
    let timeHrCovariance = 0;
    for (const item of history) {
      const dt = item.timeSec - meanTime;
      timeVariance += dt * dt;
      timeHrCovariance += dt * (item.hrBpm - meanHr);
    }
    const trendSlope = timeVariance > config.epsilon
      ? timeHrCovariance / timeVariance
      : 0;
    const trendResidualRms = rms(history.map(item =>
      item.hrBpm - (meanHr + trendSlope * (item.timeSec - meanTime))
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
      -curvatureRms /
        Math.max(config.hrTrendCurvatureScaleBpm, config.epsilon)
    );
    const stable =
      coverage >= config.hrBandMinimumTrackCoverage &&
      robustStepStable &&
      trendResidualRms <= config.hrBandMaximumTrackResidualBpm &&
      Math.abs(trendSlope) <= config.hrBandMaximumTrackSlopeBpmPerSec;
    const eligible = spanSec >= config.hrTrendMinHistorySec;
    const dataDrivenTrendScore = clamp(
      config.hrPhysiologyCoverageWeight * coverage +
      config.hrPhysiologyDeltaWeight * deltaPlausibility.score +
      config.hrPhysiologySlopeWeight * slopePlausibility +
      config.hrPhysiologyResidualWeight * residualPlausibility +
      config.hrPhysiologyAccelerationWeight * accelerationPlausibility,
      0,
      1
    );
    const trendScore = eligible
      ? (config.hrDataDrivenScoringEnabled === true &&
          config.hrDataDrivenScoringActive === true
          ? dataDrivenTrendScore
          : clamp(coverage * smoothness * directionStability, 0, 1))
      : 0;

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
      history.map(item => item.hrBpm)
    );
    cluster.physiologicRecent15Coverage = clamp(
      recent15.length / Math.max(1, 15 / config.stepSec),
      0,
      1
    );
  }

  const active = tracks.filter(
    track => timeSec - track.lastTimeSec <= config.hrPersistentTrackMaxGapSec
  );
  const haveEstablishedTrack = clusters.some(
    cluster => cluster.physiologicTrendEligible
  );
  if (timeSec >= config.hrBandInitializationSec && haveEstablishedTrack) {
    const weight = clamp(config.hrTrendScoreWeight, 0, 1);
    const bestPreTrendScore = clusters.reduce(
      (best, cluster) => Math.max(best, cluster.observationScore || 0),
      0
    );
    for (const cluster of clusters) {
      cluster.preTrendObservationScore = cluster.observationScore;
      if (bestPreTrendScore - cluster.observationScore <=
          config.hrDataDrivenTieMargin) {
        cluster.observationScore = clamp(
          (1 - weight) * cluster.observationScore +
            weight * (cluster.physiologicTrendScore || 0),
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
    mode: 'initializing'
  };
}

function initialBandCandidate(clusters) {
  return rankedBandCandidates(clusters, { hrBandMaximumCandidates: 1,
    hrBandCandidateMergeBpm: 0 })[0]?.cluster || null;
}

function rankedBandCandidates(clusters, config) {
  const ranked = clusters
    .filter(cluster =>
      cluster.physiologicTrendEligible &&
      cluster.physiologicTrendStable !== false
    )
    .map(cluster => ({
      cluster,
      center: Number.isFinite(cluster.physiologicTrendCenter)
        ? cluster.physiologicTrendCenter
        : cluster.hrBpm,
      score:
        (cluster.physiologicTrendCoverage || 0) *
        (0.45 * cluster.supportScore +
          0.45 * cluster.spectralScore +
          0.10 * (1 - (cluster.gyroPenalty || 0)))
    }))
    .sort((left, right) => right.score - left.score);
  const retained = [];
  for (const item of ranked) {
    if (retained.some(existing =>
      Math.abs(existing.center - item.center) < config.hrBandCandidateMergeBpm
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
  const eligible = clusters.filter(cluster => requiredWindows.every(windowSec =>
    cluster.supportWindows.includes(windowSec)
  ));
  const allRanked = rankedBandCandidates(
    eligible,
    { ...config, hrBandMaximumCandidates: Math.max(
      config.hrBandMaximumCandidates,
      eligible.length
    ) }
  );
  const rhythmWeight = clamp(config.rhythmInitializationBlendWeight || 0, 0, 1);
  return allRanked
    .map(item => ({
      ...item,
      score: (1 - rhythmWeight) * item.score +
        rhythmWeight * candidateHeartLikelihood(item.cluster, config)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, config.hrBandMaximumCandidates);
}

function bandHalfWidth(history, config) {
  const center = median(history);
  const deviation = median(history.map(value => Math.abs(value - center)));
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

function strongShiftCandidate(clusters, state, config) {
  return clusters
    .filter(cluster =>
      cluster.supportWindows.length >= config.hrBandShiftMinimumSupportWindows &&
      cluster.supportWindows.includes(20) &&
      cluster.supportWindows.includes(30) &&
      cluster.spectralScore >= config.hrBandShiftMinimumSpectralScore
    )
    .sort((left, right) => right.observationScore - left.observationScore)[0] || null;
}

function isLowStrongArtifactCandidate(candidate, clusters, anchorHr, config) {
  if (!config.hrLowStrongArtifactGuardEnabled || !candidate ||
      !Number.isFinite(anchorHr) ||
      anchorHr < config.hrLowStrongArtifactMinimumAnchorBpm) return false;
  const band = config.hrLowStrongArtifactBandBpm || [50, 68];
  if (candidate.hrBpm < band[0] || candidate.hrBpm > band[1] ||
      candidate.spectralScore <
        config.hrLowStrongArtifactMinimumSpectralScore ||
      anchorHr - candidate.hrBpm <
        config.hrLowStrongArtifactMinimumDistanceBpm) return false;
  const requiredWindows = config.hrLowStrongArtifactRequiredWindows || [20, 30];
  if (!requiredWindows.every(windowSec =>
    candidate.supportWindows?.includes(windowSec))) return false;
  const anchorMatchBpm = config.hrLowStrongArtifactAnchorMatchBpm || 15;
  const anchorCandidate = clusters.filter(cluster =>
    Math.abs(cluster.hrBpm - anchorHr) <= anchorMatchBpm &&
    requiredWindows.every(windowSec =>
      cluster.supportWindows?.includes(windowSec))
  ).sort((left, right) =>
    Math.abs(left.hrBpm - anchorHr) - Math.abs(right.hrBpm - anchorHr) ||
    right.spectralScore - left.spectralScore
  )[0] || null;
  if (!anchorCandidate) return false;
  return candidate.spectralScore /
    Math.max(anchorCandidate.spectralScore, 0.05) >=
      config.hrLowStrongArtifactSpectralDominanceRatio;
}

function applyRobustCandidateBand(clusters, timeSec, state, config) {
  if (!config.hrBandEnabled) {
    state.mode = 'disabled';
    return { eligibleClusters: clusters, forcedSelection: null, resetBeam: false };
  }
  const controlClusters = state.initialized
    ? clusters.filter(cluster => !isLowStrongArtifactCandidate(
        cluster, clusters, state.centerHr, config
      ))
    : clusters;
  if (!state.initialized) {
    if (timeSec < config.hrBandInitializationSec) {
      state.mode = 'initializing';
      return { eligibleClusters: clusters, forcedSelection: null, resetBeam: false };
    }
    const initialBands = rankedInitialBandCandidates(clusters, config);
    if (initialBands.length === 0) {
      state.mode = 'initializing_wait';
      return { eligibleClusters: clusters, forcedSelection: null, resetBeam: false };
    }
    state.initialized = true;
    state.candidateCenters = initialBands.map(item => item.center);
    state.centerHr = state.candidateCenters[0];
    state.acceptedHistory = [state.centerHr];
    state.halfWidthBpm = config.hrBandHalfWidthBpm;
    state.lastRefreshSec = timeSec;
    state.nextRefreshSec = timeSec + config.hrBandRefreshSec;
    state.bandEpoch = 1;
    state.mode = 'band_initialized';
  }

  // At each 15 s boundary, rebuild the gate from tracks measured over the
  // latest 30 s. This makes the gate causal while allowing a sustained new
  // heart-rate family to replace the previous one.
  let refreshMode = null;
  if (timeSec + 1e-9 >= state.nextRefreshSec) {
    const refreshedBands = rankedBandCandidates(controlClusters, config);
    if (refreshedBands.length > 0) {
      const refreshedCenters = refreshedBands.map(item => item.center);
      const previousCenters = state.candidateCenters.slice();
      const pathStillSupported = state.lastSelected && refreshedCenters.some(center =>
        Math.abs(state.lastSelected.hrBpm - center) <= state.halfWidthBpm
      );
      {
        state.previousCenterHr = state.centerHr;
        state.candidateCenters = refreshedCenters;
        state.centerHr = pathStillSupported
          ? refreshedCenters.slice().sort((a, b) =>
              Math.abs(a - state.lastSelected.hrBpm) -
              Math.abs(b - state.lastSelected.hrBpm)
            )[0]
          : refreshedCenters[0];
        state.acceptedHistory = [state.centerHr];
        state.halfWidthBpm = config.hrBandHalfWidthBpm;
        state.holdDurationSec = 0;
        state.pendingCenterHr = NaN;
        state.pendingDurationSec = 0;
        state.bandEpoch += 1;
        const setChanged = previousCenters.length !== refreshedCenters.length ||
          refreshedCenters.some(center => !previousCenters.some(previous =>
            Math.abs(previous - center) < config.hrBandCandidateMergeBpm
          ));
        refreshMode = setChanged ? 'bands_refreshed' : 'bands_retained';
        state.resetAtRefresh = !pathStillSupported;
      }
    } else {
      refreshMode = 'band_refresh_kept';
    }
    state.lastRefreshSec = timeSec;
    do {
      state.nextRefreshSec += config.hrBandRefreshSec;
    } while (timeSec + 1e-9 >= state.nextRefreshSec);
  }

  let inBand = controlClusters.filter(cluster => state.candidateCenters.some(center =>
    Math.abs(cluster.hrBpm - center) <= state.halfWidthBpm
  ));
  if (state.lastSelected && inBand.length > 0) {
    const maximumTransition =
      config.hrBandMaximumTransitionBpmPerSec * config.stepSec;
    const reachable = inBand.filter(cluster =>
      Math.abs(cluster.hrBpm - state.lastSelected.hrBpm) <= maximumTransition
    );
    inBand = reachable;
  }
  if (inBand.length > 0) {
    state.holdDurationSec = 0;
    state.pendingCenterHr = NaN;
    state.pendingDurationSec = 0;
    state.mode = refreshMode || 'in_band';
    return {
      eligibleClusters: inBand,
      forcedSelection: null,
      resetBeam: Boolean(refreshMode && state.resetAtRefresh)
    };
  }

  // Direct remote-band switching has been removed. A strong out-of-band
  // candidate no longer accumulates a 10-second challenge and can never
  // trigger `confirmed_shift` or rewrite the band center through this path.
  state.pendingCenterHr = NaN;
  state.pendingDurationSec = 0;

  const maximumHoldSec = config.hrBandHoldMaximumSec;
  if (state.lastSelected && state.holdDurationSec < maximumHoldSec) {
    state.holdDurationSec += config.stepSec;
    state.mode = 'hold_missing_candidate';
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

  state.mode = 'band_unlocked';
  return { eligibleClusters: controlClusters, forcedSelection: null, resetBeam: true };
}

function createLowZoneAdmissionState() {
  return {
    mode: 'normal',
    candidateHr: NaN,
    candidateDurationSec: 0,
    evidencePassSec: 0,
    anchorMissingSec: 0,
    exitCandidateHr: NaN,
    exitDurationSec: 0
  };
}

/**
 * Keep 50-68 bpm candidates observable, but require sustained multi-window
 * physiological evidence before allowing them to control selection state.
 */
function applyLowZoneAdmission(clusters, previousReliableHr, state, config) {
  if (config.hrLowZoneEnabled !== true) {
    return { eligibleClusters: clusters, admitted: true };
  }
  const [lowMin, lowMax] = config.hrLowZoneBandBpm || [50, 68];
  const normalBoundary = config.hrLowZoneNormalBoundaryBpm || 75;
  const requiredWindows = config.hrLowZoneRequiredWindows || [20, 30];
  const matchBpm = config.hrLowZoneCandidateMatchBpm || 6;
  const lowCandidates = clusters.filter(cluster =>
    cluster.hrBpm >= lowMin && cluster.hrBpm <= lowMax &&
    requiredWindows.every(windowSec => cluster.supportWindows?.includes(windowSec))
  ).sort((left, right) =>
    (right.observationScore || 0) - (left.observationScore || 0) ||
    (right.physiologicTrendCoverage || 0) -
      (left.physiologicTrendCoverage || 0)
  );
  const nonLowClusters = clusters.filter(cluster =>
    cluster.hrBpm < lowMin || cluster.hrBpm > lowMax
  );
  const strongestLow = lowCandidates[0] || null;

  if (state.mode === 'confirmed') {
    const lowObservation = strongestLow?.observationScore || 0;
    const exitCandidate = clusters.filter(cluster =>
      cluster.hrBpm >= normalBoundary &&
      requiredWindows.every(windowSec => cluster.supportWindows?.includes(windowSec)) &&
      (cluster.observationScore || 0) >= lowObservation +
        (config.hrLowZoneExitObservationAdvantage || 0.05)
    ).sort((left, right) =>
      (right.observationScore || 0) - (left.observationScore || 0)
    )[0] || null;
    if (exitCandidate) {
      const sameExit = Number.isFinite(state.exitCandidateHr) &&
        Math.abs(exitCandidate.hrBpm - state.exitCandidateHr) <= matchBpm;
      state.exitDurationSec = sameExit
        ? state.exitDurationSec + config.stepSec
        : config.stepSec;
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

  const anchorHr = Number.isFinite(previousReliableHr) &&
      previousReliableHr >= normalBoundary
    ? previousReliableHr
    : NaN;
  const anchorContinuation = clusters.some(cluster =>
    cluster.hrBpm >= normalBoundary &&
    requiredWindows.every(windowSec => cluster.supportWindows?.includes(windowSec)) &&
    (!Number.isFinite(anchorHr) || Math.abs(cluster.hrBpm - anchorHr) <= 15)
  );
  const stableHighAlternative = clusters.some(cluster =>
    cluster.hrBpm >= normalBoundary &&
    requiredWindows.every(windowSec => cluster.supportWindows?.includes(windowSec)) &&
    (cluster.observationScore || 0) >=
      (strongestLow?.observationScore || 0) - 0.05
  );
  state.anchorMissingSec = anchorContinuation || stableHighAlternative
    ? 0
    : state.anchorMissingSec + config.stepSec;

  if (strongestLow) {
    const sameLow = Number.isFinite(state.candidateHr) &&
      Math.abs(strongestLow.hrBpm - state.candidateHr) <= matchBpm;
    state.candidateDurationSec = sameLow
      ? state.candidateDurationSec + config.stepSec
      : config.stepSec;
    state.evidencePassSec = sameLow ? state.evidencePassSec : 0;
    state.candidateHr = strongestLow.hrBpm;
    state.mode = 'pending';
    const criticalBand = config.hrCriticalLowBandBpm || [50, 55];
    const critical = strongestLow.hrBpm >= criticalBand[0] &&
      strongestLow.hrBpm <= criticalBand[1];
    const minimumObservation = critical
      ? (config.hrCriticalLowMinimumObservationScore || 0.65)
      : (config.hrLowZoneMinimumObservationScore || 0.60);
    const minimumCoverage = critical
      ? (config.hrCriticalLowMinimumTrackCoverage || 0.80)
      : (config.hrLowZoneMinimumTrackCoverage || 0.65);
    if ((strongestLow.observationScore || 0) >= minimumObservation &&
        (strongestLow.physiologicTrendCoverage || 0) >= minimumCoverage) {
      state.evidencePassSec += config.stepSec;
    }
    const confirmSec = critical
      ? (config.hrCriticalLowEntryConfirmSec || 30)
      : (config.hrLowZoneEntryConfirmSec || 20);
    const evidenceRatio = state.evidencePassSec /
      Math.max(config.stepSec, state.candidateDurationSec);
    if (state.candidateDurationSec >= confirmSec &&
        state.anchorMissingSec >= (config.hrLowZoneOldAnchorMissingSec || 15) &&
        evidenceRatio >= (config.hrLowZoneEvidencePassRatio || 0.70)) {
      state.mode = 'confirmed';
      state.exitCandidateHr = NaN;
      state.exitDurationSec = 0;
      return { eligibleClusters: clusters, admitted: true };
    }
  } else {
    state.candidateHr = NaN;
    state.candidateDurationSec = 0;
    state.evidencePassSec = 0;
    state.mode = 'normal';
  }

  return { eligibleClusters: nonLowClusters, admitted: false };
}

function commitRobustCandidateBandSelection(selected, state, config) {
  if (!selected) return;
  state.lastSelected = { ...selected };
  if (!state.initialized || selected.heldByBaselineBand) return;
  const selectedBand = state.candidateCenters
    .slice()
    .sort((a, b) => Math.abs(a - selected.hrBpm) - Math.abs(b - selected.hrBpm))[0];
  if (!Number.isFinite(selectedBand) ||
      Math.abs(selected.hrBpm - selectedBand) > state.halfWidthBpm) return;
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
  const crossAxisWeight = config.rhythmContextCrossAxisWeight ?? 0.30;
  const autocorrelationWeight =
    config.rhythmContextAutocorrelationWeight ?? 0.25;
  const weightSum = Math.max(
    intervalWeight + crossAxisWeight + autocorrelationWeight,
    Number.EPSILON
  );
  // Deliberately exclude spectral strength, continuity, support and gyro here.
  // Those fields already establish that a candidate exists; this context-only
  // score asks the independent question: does the candidate look heartbeat-like?
  return clamp(
    (intervalWeight * (candidate.intervalScore || 0) +
      crossAxisWeight * (candidate.crossAxisHeartEvidence || 0) +
      autocorrelationWeight * (candidate.autocorrelationScore || 0)) /
      weightSum,
    0,
    1
  );
}

function reacquireCandidate(proposed, clusters, config) {
  const longWindowCandidates = clusters.filter(candidate =>
    candidate.supportWindows?.includes(20) &&
    candidate.supportWindows?.includes(30)
  );
  const pool = longWindowCandidates.length > 0
    ? longWindowCandidates
    : [proposed];
  const rhythmWeight = clamp(config.rhythmReacquireBlendWeight || 0, 0, 1);
  return pool.slice().sort((left, right) => {
    const leftScore = (1 - rhythmWeight) * (left.observationScore || 0) +
      rhythmWeight * candidateHeartLikelihood(left, config);
    const rightScore = (1 - rhythmWeight) * (right.observationScore || 0) +
      rhythmWeight * candidateHeartLikelihood(right, config);
    return rightScore - leftScore;
  })[0] || proposed;
}

function createRhythmSwitchState() {
  return {
    current: null,
    challengerHr: NaN,
    challengerDurationSec: 0,
    mode: 'initialize',
    oldEvidence: 0,
    newEvidence: 0,
    advantage: 0
  };
}

function nearestCandidate(clusters, hrBpm, maximumDistanceBpm) {
  if (!Number.isFinite(hrBpm)) return null;
  const nearest = clusters.slice().sort((left, right) =>
    Math.abs(left.hrBpm - hrBpm) - Math.abs(right.hrBpm - hrBpm)
  )[0];
  return nearest && Math.abs(nearest.hrBpm - hrBpm) <= maximumDistanceBpm
    ? nearest
    : null;
}

function applyRhythmSwitchController(proposed, clusters, state, config) {
  if (!config.rhythmSwitchControllerEnabled || !proposed) {
    if (proposed) state.current = proposed;
    state.mode = proposed ? 'disabled' : 'no_candidate';
    return proposed;
  }
  if (!state.current) {
    state.current = proposed;
    state.mode = 'initialized';
    return proposed;
  }
  const distance = Math.abs(proposed.hrBpm - state.current.hrBpm);
  if (distance < config.rhythmSwitchRemoteBpm) {
    state.current = proposed;
    state.challengerHr = NaN;
    state.challengerDurationSec = 0;
    state.mode = 'track';
    return proposed;
  }

  const oldCandidate = nearestCandidate(
    clusters, state.current.hrBpm, config.rhythmSwitchOldMatchBpm
  );
  const newEvidence = candidateHeartLikelihood(proposed, config);
  const oldEvidence = candidateHeartLikelihood(oldCandidate, config);
  const advantage = newEvidence - oldEvidence;
  const sameChallenge = Number.isFinite(state.challengerHr) &&
    Math.abs(proposed.hrBpm - state.challengerHr) <=
      config.rhythmSwitchChallengeMatchBpm;
  state.challengerHr = sameChallenge
    ? 0.8 * state.challengerHr + 0.2 * proposed.hrBpm
    : proposed.hrBpm;
  state.challengerDurationSec = sameChallenge
    ? state.challengerDurationSec + config.stepSec
    : config.stepSec;
  state.oldEvidence = oldEvidence;
  state.newEvidence = newEvidence;
  state.advantage = advantage;

  // If the remembered old peak is absent, reacquire immediately. Protecting a
  // value that no longer exists was the main failure of the first controller.
  if (!oldCandidate) {
    const reacquired = reacquireCandidate(proposed, clusters, config);
    state.current = reacquired;
    state.challengerHr = NaN;
    state.challengerDurationSec = 0;
    state.mode = 'reacquired';
    return reacquired;
  }

  // Use rhythm only as a negative, time-bounded veto. The observed rhythm
  // features are not specific enough to positively choose a new peak.
  const oldClearlyBetter = oldEvidence - newEvidence >=
    config.rhythmSwitchOldEvidenceAdvantage;
  if (!oldClearlyBetter ||
      state.challengerDurationSec >= config.rhythmSwitchMaximumVetoSec) {
    state.current = proposed;
    state.challengerHr = NaN;
    state.challengerDurationSec = 0;
    state.mode = oldClearlyBetter
      ? 'challenge_timeout_accept'
      : 'evidence_allows_switch';
    return proposed;
  }

  state.mode = state.challengerDurationSec >= config.rhythmSwitchConfirmSec
    ? 'challenge_rejected'
    : 'challenge_hold';
  return {
    ...state.current,
    quality: 0.7 * (state.current.quality || 0),
    observationScore: 0.7 * (state.current.observationScore || 0),
    heldByRhythmController: true
  };
}

function resolveStateAtTime(timeSec, windowStates, defaultWindowSec) {
  if (!Array.isArray(windowStates) || windowStates.length === 0) return 'unknown';
  const step = windowStates.length > 1
    ? Math.max(1e-6, windowStates[1].winEnd_s - windowStates[0].winEnd_s)
    : 1;
  const firstEnd = Number.isFinite(windowStates[0].winEnd_s)
    ? windowStates[0].winEnd_s
    : defaultWindowSec;
  const index = clamp(
    Math.floor((timeSec - firstEnd) / step + 1e-9),
    0,
    windowStates.length - 1
  );
  return windowStates[index]?.state || 'unknown';
}

function estimateRateFromBand(signal, sampleRateHz, lowHz, highHz) {
  const spectrum = periodogramPSD(removeDC(signal), sampleRateHz, { window: 'hann' });
  let bestIndex = -1;
  for (let i = 1; i < spectrum.freqs.length; i++) {
    if (spectrum.freqs[i] < lowHz || spectrum.freqs[i] > highHz) continue;
    if (bestIndex < 0 || spectrum.psd[i] > spectrum.psd[bestIndex]) bestIndex = i;
  }
  if (bestIndex < 0) {
    return { bpm: 0, quality: 0, frequencyHz: 0, amplitude: 0 };
  }
  const band = [];
  for (let i = 1; i < spectrum.freqs.length; i++) {
    if (spectrum.freqs[i] >= lowHz && spectrum.freqs[i] <= highHz) {
      band.push(spectrum.psd[i]);
    }
  }
  const floor = median(band);
  const quality = clamp(
    (spectrum.psd[bestIndex] - floor) / Math.max(spectrum.psd[bestIndex], 1e-18),
    0,
    1
  );
  return {
    bpm: spectrum.freqs[bestIndex] * 60,
    quality,
    frequencyHz: spectrum.freqs[bestIndex],
    amplitude: spectrum.psd[bestIndex]
  };
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
    if (
      confidence < config.hrLowQualityThreshold &&
      Math.abs(raw - localMedian) > config.hrOutlierGapBpm
    ) {
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

/**
 * Estimate HR once per step after pooling Top-K candidates from all currently
 * available 10/20/30-second windows.
 */
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
      active: false, type: 'none', candidateHr: NaN,
      candidateDurationSec: 0, oldAnchorHr: NaN, oldAnchorWeight: 0
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
  const artifactMask = config.artifactMask &&
      config.artifactMask.length >= heart.length
    ? config.artifactMask
    : null;
  const haveDiagnosticAxes = ['x', 'y', 'z'].every(
    axis => diagnosticAxes[axis].length >= heart.length
  );
  const sampleCount = Math.min(respiratory.length, heart.length);
  const durationSec = sampleCount / sampleRateHz;
  const windowSecList = config.windowSecList.slice().sort((a, b) => a - b);
  const minimumWindowSec = windowSecList[0];
  const stepSec = config.stepSec;
  // Causal replay: a prediction stamped T may only use samples at or before T.
  // The first prediction is therefore available after the shortest window has
  // accumulated, and predictions continue through the end of the recording.
  const runtimeState = config.runtimeState || null;
  const timelineOffsetSec = runtimeState
    ? (Number(config.timelineOffsetSec) || 0)
    : 0;
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
  // Kept as diagnostics-only compatibility fields for existing CSV consumers.
  let matureTrackTakeover = stateStore.matureTrackTakeover;
  let matureRemoteCandidateHr = stateStore.matureRemoteCandidateHr;
  let matureRemoteCandidateDurationSec = stateStore.matureRemoteCandidateDurationSec;
  const selectedOutputTrack = stateStore.selectedOutputTrack;
  let boundaryStateResetDone = runtimeState
    ? true
    : !(config.stateResetTimeSec > startTime);

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
      qualityRecoveryState.type = 'none';
      qualityRecoveryState.candidateHr = NaN;
      qualityRecoveryState.candidateDurationSec = 0;
      selectedOutputTrack.length = 0;
      boundaryStateResetDone = true;
    }
    const qualityGateDecision = config.rawImuQualityGate &&
      typeof config.rawImuQualityGate.decisionAt === 'function'
      ? config.rawImuQualityGate.decisionAt(localTimeSec)
      : { accepted: true, validityStatus: 'not_evaluated', motionStatus: 'not_evaluated', reasons: [] };
    if (!qualityGateDecision.accepted) {
      preserveAuthoritativeReliableHistory(
        authoritativeReliableState,
        'quality_rejected_preserve_history'
      );
      qualityGateGapSec += stepSec;
      // A short missing interval keeps the hypotheses alive, but their stored
      // evidence must lose weight for every elapsed second.
      candidateBeam = candidateBeam.map(track => ({
        ...track,
        cumulativeScore: track.cumulativeScore * config.hrTrackMemory,
        ageSec: track.ageSec + stepSec
      }));
      if (baselineBand.mode === 'hold_pending_shift') {
        baselineBand.holdDurationSec += stepSec;
      }
      const longGapResetSec = Math.max(
        stepSec,
        config.rawImuQualityLongGapResetSec || 10
      );
      let stateResetThisSecond = false;
      if (!qualityGateResetForCurrentGap && qualityGateGapSec >= longGapResetSec) {
        qualityRecoveryState.oldAnchorHr = Number.isFinite(previousReliableHr)
          ? previousReliableHr
          : (rhythmSwitchState.current?.hrBpm || baselineBand.lastSelected?.hrBpm || NaN);
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
        time_s: timeSec, hr_bpm: NaN, hr_bpm_raw: NaN,
        quality_score: 0, peak_hz: NaN, peak_mag: NaN,
        state: 'quality_rejected', candidate_count: 0, cluster_count: 0,
        support_count: 0, support_windows: '', selection_score: 0,
        quality_gate_pass: 0,
        quality_validity_status: qualityGateDecision.validityStatus,
        quality_motion_status: qualityGateDecision.motionStatus,
        quality_reject_reasons: qualityGateDecision.reasons.join('|'),
        quality_gate_gap_sec: qualityGateGapSec,
        quality_gate_state_reset: stateResetThisSecond ? 1 : 0
      });
      respiratoryRateTimeSeries.push({
        time_s: timeSec, rr_bpm: NaN, quality_score: 0,
        state: 'quality_rejected'
      });
      segments.push({
        time_s: timeSec, hr_bpm: NaN, hr_bpm_raw: NaN,
        state: 'quality_rejected', quality_gate_pass: 0
      });
      timeAxis.push(timeSec);
      continue;
    }
    const recoveredAfterGapSec = qualityGateGapSec;
    const recoveredAfterStateReset = qualityGateResetForCurrentGap;
    const mediumGapMinSec = config.rawImuQualityMediumGapMinSec || 3;
    if (recoveredAfterGapSec >= mediumGapMinSec) {
      qualityRecoveryState.active = true;
      qualityRecoveryState.type = recoveredAfterGapSec >=
        (config.rawImuQualityLongGapResetSec || 10) ? 'long' : 'medium';
      qualityRecoveryState.candidateHr = NaN;
      qualityRecoveryState.candidateDurationSec = 0;
      if (qualityRecoveryState.type === 'medium') {
        qualityRecoveryState.oldAnchorHr = Number.isFinite(previousReliableHr)
          ? previousReliableHr
          : (rhythmSwitchState.current?.hrBpm || NaN);
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
    // Preserve the validated startup/initial-band behavior exactly. The
    // data-driven correction becomes active only after that anchor exists.
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
      const gyroWindow = config.gyroMotionSignal &&
          config.gyroMotionSignal.length >= start + length
        ? config.gyroMotionSignal.subarray(start, start + length)
        : null;
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
      const contaminationRatio = length > 0
        ? contaminatedSamples / length
        : 0;
      for (const candidate of magnitudeResult.candidates) {
        candidate.contaminationRatio = contaminationRatio;
      }
      if (haveDiagnosticAxes) {
        axisSpectraByWindow[windowSec] = {};
        const axisWindows = {};
        for (const axis of ['x', 'y', 'z']) {
          const axisWindow = diagnosticAxes[axis].subarray(start, start + length);
          axisWindows[axis] = axisWindow;
          axisSpectraByWindow[windowSec][axis] = periodogramPSD(
            removeDC(axisWindow),
            sampleRateHz,
            { window: 'hann' }
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
      acceptedHistory.slice(-config.hrBaselineHistoryLength)
        .map(item => item.hrBpm)
    );
    const mergedClusters = mergeCandidates(
      allCandidates,
      availableWindowSecs,
      config,
      previousReliableHr,
      baselineHr,
      state
    );
    const rr = longestRespiratoryWindow
      ? estimateRespiratoryPeak(
          longestRespiratoryWindow,
          sampleRateHz,
          config
        )
      : { bpm: lastRespiratoryRate, quality: 0, frequencyHz: 0, amplitude: 0 };
    if (rr.bpm > 0) lastRespiratoryRate = rr.bpm;
    updateRespiratoryFamilyState(
      respiratoryFamilyState,
      rr,
      stepSec,
      config
    );
    const clusters = mergedClusters;
    const motionReliability = state === 'moving'
      ? 0.75
      : (state === 'static' ? 1 : 0.85);
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
    // The original-score branch always receives the complete admitted set.
    // The 60-second branch observes the same candidates independently and is
    // never allowed to filter the Beam input.
    // Preserve low-zone admission when alternatives exist, but never let that
    // admission layer erase the original-score fallback completely. If every
    // spectral candidate is pending in the low zone, the raw branch still
    // receives the original retained candidates as designed.
    const selectionClusters = lowZoneResult.eligibleClusters.length > 0
      ? lowZoneResult.eligibleClusters
      : retainedClusters;
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
    const beamResult = bandResult.forcedSelection
      ? {
          selected: bandResult.forcedSelection,
          beam: candidateBeam,
          mode: baselineBand.mode
        }
      : updateCandidateBeam(
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
    const beamSelectedTrack = candidateBeam.find(track =>
      track.cluster === arbitration.selected);
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
      const recoveryPool = selectionClusters.filter(cluster =>
        qualityRecoveryState.type === 'long'
          ? cluster.supportWindows?.includes(10) &&
            cluster.supportWindows?.includes(20)
          : cluster.supportWindows?.includes(10)
      );
      const anchorSigma = config.rawImuQualityRecoveryAnchorSigmaBpm || 20;
      const recoveryCandidate = recoveryPool.slice().sort((left, right) => {
        const leftScore = (left.observationScore || left.score || 0) +
          qualityRecoveryState.oldAnchorWeight * temporalScore(
            left.hrBpm,
            qualityRecoveryState.oldAnchorHr,
            anchorSigma
          );
        const rightScore = (right.observationScore || right.score || 0) +
          qualityRecoveryState.oldAnchorWeight * temporalScore(
            right.hrBpm,
            qualityRecoveryState.oldAnchorHr,
            anchorSigma
          );
        return rightScore - leftScore;
      })[0] || null;
      if (recoveryCandidate) {
        const sameTrack = Number.isFinite(qualityRecoveryState.candidateHr) &&
          Math.abs(recoveryCandidate.hrBpm - qualityRecoveryState.candidateHr) <=
            (config.rawImuQualityRecoveryMatchBpm || 6);
        qualityRecoveryState.candidateDurationSec = sameTrack
          ? qualityRecoveryState.candidateDurationSec + stepSec
          : stepSec;
        qualityRecoveryState.candidateHr = recoveryCandidate.hrBpm;
        selected = recoveryCandidate;
      } else {
        qualityRecoveryState.candidateDurationSec = 0;
        qualityRecoveryState.candidateHr = NaN;
        selected = null;
      }
      if (qualityRecoveryState.candidateDurationSec >=
          (config.rawImuQualityRecoveryConfirmSec || 5)) {
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
      const half = clusters
        .filter(item => item !== cluster)
        .sort((a, b) =>
          Math.abs(a.hrBpm - cluster.hrBpm / 2) -
          Math.abs(b.hrBpm - cluster.hrBpm / 2)
        )[0];
      const double = clusters
        .filter(item => item !== cluster)
        .sort((a, b) =>
          Math.abs(a.hrBpm - cluster.hrBpm * 2) -
          Math.abs(b.hrBpm - cluster.hrBpm * 2)
        )[0];
      const row = {
        time_s: timeSec,
        candidate_rank: rank + 1,
        candidate_hr_bpm: cluster.hrBpm,
        selected: cluster === selected ? 1 : 0,
        state,
        available_windows: availableWindowSecs.join('|'),
        support_windows: cluster.supportWindows.join('|'),
        support_score: cluster.supportScore,
        spectral_score: cluster.spectralScore,
        continuity_score: cluster.continuityScore,
        baseline_score: cluster.baselineScore,
        base_score: cluster.baseScore,
        final_score: cluster.score,
        contamination_ratio: cluster.contaminationRatio || 0,
        pre_artifact_observation_score:
          cluster.preArtifactObservationScore || 0,
        artifact_penalty: cluster.artifactPenalty || 0,
        autocorrelation_score: cluster.autocorrelationScore || 0,
        autocorrelation_full: cluster.autocorrelationFull || 0,
        autocorrelation_first_half:
          cluster.autocorrelationFirstHalf || 0,
        autocorrelation_second_half:
          cluster.autocorrelationSecondHalf || 0,
        autocorrelation_stability:
          cluster.autocorrelationStability || 0,
        interval_score: cluster.intervalScore || 0,
        cross_axis_consensus_score:
          cluster.crossAxisConsensusScore || 0,
        cross_axis_consensus_coverage:
          cluster.crossAxisConsensusCoverage || 0,
        cross_axis_gyro_sync_ratio:
          cluster.crossAxisGyroSyncRatio || 0,
        cross_axis_heart_evidence:
          cluster.crossAxisHeartEvidence || 0,
        observation_score: cluster.observationScore || 0,
        data_driven_observation_score:
          cluster.dataDrivenObservationScore || 0,
        relative_interval_score: cluster.relativeIntervalScore || 0,
        relative_cross_axis_score: cluster.relativeCrossAxisScore || 0,
        relative_autocorrelation_score:
          cluster.relativeAutocorrelationScore || 0,
        relative_heartbeat_score: cluster.relativeHeartbeatScore || 0,
        respiratory_rate_bpm: rr.bpm || lastRespiratoryRate,
        respiratory_family_stable_bpm:
          respiratoryFamilyState.stableBpm || 0,
        respiratory_family_order: cluster.respiratoryFamilyOrder || 0,
        respiratory_family_target_bpm:
          cluster.respiratoryFamilyTargetBpm || 0,
        respiratory_family_distance_bpm:
          cluster.respiratoryFamilyDistanceBpm || 0,
        respiratory_family_penalty:
          cluster.respiratoryFamilyPenalty || 0,
        respiratory_family_protected:
          cluster.respiratoryFamilyProtected ? 1 : 0,
        respiratory_family_protection_reason:
          cluster.respiratoryFamilyProtectionReason || '',
        pre_trend_observation_score:
          cluster.preTrendObservationScore || 0,
        physiologic_track_id: cluster.physiologicTrackId || 0,
        physiologic_trend_eligible:
          cluster.physiologicTrendEligible ? 1 : 0,
        physiologic_trend_score: cluster.physiologicTrendScore || 0,
        physiologic_delta_score: cluster.physiologicDeltaScore || 0,
        physiologic_slope_score: cluster.physiologicSlopeScore || 0,
        physiologic_residual_score: cluster.physiologicResidualScore || 0,
        physiologic_acceleration_score:
          cluster.physiologicAccelerationScore || 0,
        physiologic_trend_coverage:
          cluster.physiologicTrendCoverage || 0,
        physiologic_trend_span_s: cluster.physiologicTrendSpanSec || 0,
        physiologic_trend_step_rms:
          cluster.physiologicTrendStepRms || 0,
        physiologic_trend_curvature_rms:
          cluster.physiologicTrendCurvatureRms || 0,
        physiologic_trend_velocity:
          cluster.physiologicTrendVelocity || 0,
        axis_evidence_score: cluster.axisEvidenceScore || 0,
        excluded_weak_candidate: cluster.excludedWeakCandidate ? 1 : 0,
        exclusion_reason: cluster.exclusionReason || '',
        score_gap_to_best: bestScore - cluster.score,
        best_second_score_gap: bestScore - secondScore,
        gyro_relative_energy: cluster.gyroRelativeEnergy,
        gyro_coherence: cluster.gyroCoherence,
        gyro_impulse_ratio: cluster.gyroImpulseRatio,
        gyro_persistence_score: cluster.gyroPersistenceScore || 0,
        gyro_penalty: cluster.gyroPenalty || 0,
        motion_candidate_type: cluster.motionCandidateType,
        track_id: cluster.diagnosticTrack?.id || 0,
        track_consecutive_s:
          cluster.diagnosticTrack?.consecutiveSec || 0,
        track_total_seen_s:
          cluster.diagnosticTrack?.totalSeenSec || 0,
        track_previous_gap_s:
          cluster.diagnosticTrack?.previousGapSec || 0,
        track_reappearance_count:
          cluster.diagnosticTrack?.reappearanceCount || 0,
        harmonic_half_candidate_bpm:
          half && Math.abs(half.hrBpm - cluster.hrBpm / 2) <=
            config.hrCandidateMergeBpm
            ? half.hrBpm
            : 0,
        harmonic_double_candidate_bpm:
          double && Math.abs(double.hrBpm - cluster.hrBpm * 2) <=
            config.hrCandidateMergeBpm
            ? double.hrBpm
            : 0
      };
      for (const windowSec of [10, 20, 30]) {
        const member = cluster.members.find(item =>
          item.windowSec === windowSec
        );
        row[`window_${windowSec}_rank`] = member?.windowRank || 0;
        row[`window_${windowSec}_spectral`] =
          member?.spectralScore || 0;
        row[`window_${windowSec}_relative_strength`] =
          member?.relativeStrength || 0;
        row[`window_${windowSec}_prominence`] =
          member?.localProminence || 0;
        row[`window_${windowSec}_autocorrelation`] =
          member?.autocorrelationScore || 0;
        row[`window_${windowSec}_autocorrelation_full`] =
          member?.autocorrelationFull || 0;
        row[`window_${windowSec}_autocorrelation_first_half`] =
          member?.autocorrelationFirstHalf || 0;
        row[`window_${windowSec}_autocorrelation_second_half`] =
          member?.autocorrelationSecondHalf || 0;
        row[`window_${windowSec}_autocorrelation_stability`] =
          member?.autocorrelationStability || 0;
        row[`window_${windowSec}_interval_score`] =
          member?.intervalScore || 0;
        row[`window_${windowSec}_event_count`] =
          member?.eventCount || 0;
        row[`window_${windowSec}_median_event_interval_s`] =
          member?.medianEventIntervalSec || 0;
        row[`window_${windowSec}_event_interval_cv`] =
          member?.eventIntervalCv || 0;
        row[`window_${windowSec}_cross_axis_consensus`] =
          member?.crossAxisConsensusScore || 0;
        row[`window_${windowSec}_cross_axis_event_count`] =
          member?.crossAxisConsensusEvents || 0;
        row[`window_${windowSec}_cross_axis_coverage`] =
          member?.crossAxisConsensusCoverage || 0;
        row[`window_${windowSec}_gyro_sync_ratio`] =
          member?.crossAxisGyroSyncRatio || 0;
        row[`window_${windowSec}_magnitude_psd`] =
          member?.amplitude || 0;
        for (const axis of ['x', 'y', 'z']) {
          row[`axis_${axis}_energy_${windowSec}`] =
            cluster.axisEnergy?.[windowSec]?.[axis] || 0;
        }
      }
      candidateDiagnostics.push(row);
    }

    let rawHr = selected?.hrBpm || previousReliableHr;
    if (!Number.isFinite(rawHr) || rawHr <= 0) rawHr = 0;
    // Track invalidity no longer suppresses output: the original-score branch
    // is the fallback and therefore remains available every valid second.
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
      support_windows: selected?.supportWindows.join('|') || '',
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
      motion_candidate_type: selected?.motionCandidateType || 'none',
      quality_gate_pass: qualityOutputAllowed && trackLockOutputAllowed ? 1 : 0,
      quality_validity_status: qualityGateDecision.validityStatus,
      quality_motion_status: qualityGateDecision.motionStatus,
      quality_reject_reasons: !qualityOutputAllowed
        ? 'recovery_confirmation'
        : (!trackLockOutputAllowed ? 'checkpoint_track_missing' : ''),
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
      diagnostic_candidates_bpm: clusters.slice(0, 8)
        .map(cluster => cluster.hrBpm.toFixed(3)).join('|'),
      diagnostic_candidates_score: clusters.slice(0, 8)
        .map(cluster => cluster.score.toFixed(6)).join('|'),
      diagnostic_candidates_base_score: clusters.slice(0, 8)
        .map(cluster => cluster.baseScore.toFixed(6)).join('|'),
      diagnostic_candidates_spectral: clusters.slice(0, 8)
        .map(cluster => cluster.spectralScore.toFixed(6)).join('|'),
      diagnostic_candidates_continuity: clusters.slice(0, 8)
        .map(cluster => cluster.continuityScore.toFixed(6)).join('|'),
      diagnostic_candidates_gyro_penalty: clusters.slice(0, 8)
        .map(cluster => (cluster.gyroPenalty || 0).toFixed(6)).join('|'),
      diagnostic_candidates_windows: clusters.slice(0, 8)
        .map(cluster => cluster.supportWindows.join('+')).join('|'),
      track_mode: arbitration.mode,
      mature_takeover_distance_bpm: arbitration.distanceBpm,
      mature_takeover_evidence_ratio: arbitration.evidenceRatio,
      mature_takeover_required_ratio: arbitration.requiredEvidenceRatio,
      mature_takeover_required_confirm_s: arbitration.requiredConfirmSec,
      mature_takeover_evidence_gate_pass:
        arbitration.evidenceGatePassed ? 1 : 0,
      mature_takeover_decision_reason: arbitration.reason,
      original_score_track_mode: beamResult.mode,
      raw_beam_guard_mode: rawGuardResult.mode,
      raw_beam_guard_reason: rawGuardResult.reason || '',
      authoritative_reliable_hr: authoritativeReliableState.lastHr || 0,
      authoritative_history_updated: authoritativeUpdated ? 1 : 0,
      authoritative_history_decision: authoritativeReliableState.lastDecision,
      authoritative_history_count: authoritativeReliableState.updateCount,
      authoritative_pending_mode: authoritativeReliableState.pending.kind,
      authoritative_pending_hr: authoritativeReliableState.pending.hrBpm || 0,
      authoritative_pending_duration_s:
        authoritativeReliableState.pending.durationSec,
      authoritative_pending_evidence:
        authoritativeReliableState.pending.evidence,
      authoritative_pending_had_multi_window:
        authoritativeReliableState.pending.hadMultipleWindowSupport ? 1 : 0,
      sixty_second_track_valid: sixtySecondTrackResult.valid ? 1 : 0,
      sixty_second_track_reason: sixtySecondTrackResult.reason,
      rhythm_switch_mode: rhythmSwitchState.mode,
      rhythm_switch_challenger_hr: rhythmSwitchState.challengerHr || 0,
      rhythm_switch_challenger_duration_s:
        rhythmSwitchState.challengerDurationSec,
      rhythm_switch_old_evidence: rhythmSwitchState.oldEvidence,
      rhythm_switch_new_evidence: rhythmSwitchState.newEvidence,
      rhythm_switch_advantage: rhythmSwitchState.advantage,
      baseline_band_mode: baselineBand.mode,
      baseline_band_center_hr: baselineBand.centerHr || 0,
      baseline_band_candidate_centers: baselineBand.candidateCenters.join('|'),
      baseline_band_half_width_bpm: baselineBand.halfWidthBpm || 0,
      baseline_band_hold_duration_s: baselineBand.holdDurationSec,
      baseline_band_pending_hr: baselineBand.pendingCenterHr || 0,
      baseline_band_pending_duration_s: baselineBand.pendingDurationSec,
      baseline_band_epoch: baselineBand.bandEpoch,
      baseline_band_previous_center_hr: baselineBand.previousCenterHr || 0,
      baseline_band_last_refresh_s: Number.isFinite(baselineBand.lastRefreshSec)
        ? baselineBand.lastRefreshSec
        : 0,
      baseline_band_next_refresh_s: Number.isFinite(baselineBand.nextRefreshSec)
        ? baselineBand.nextRefreshSec
        : 0,
      physiologic_track_id: selected?.physiologicTrackId || 0,
      physiologic_trend_score: selected?.physiologicTrendScore || 0,
      physiologic_trend_coverage:
        selected?.physiologicTrendCoverage || 0,
      physiologic_trend_step_rms:
        selected?.physiologicTrendStepRms || 0,
      physiologic_trend_curvature_rms:
        selected?.physiologicTrendCurvatureRms || 0,
      physiologic_trend_velocity:
        selected?.physiologicTrendVelocity || 0,
      physiologic_trend_maximum_step:
        selected?.physiologicTrendMaximumStep || 0,
      physiologic_trend_residual_rms:
        selected?.physiologicTrendResidualRms || 0,
      physiologic_trend_slope: selected?.physiologicTrendSlope || 0,
      physiologic_trend_stable: selected?.physiologicTrendStable ? 1 : 0,
      beam_size: candidateBeam.length,
      beam_primary_score: candidateBeam[0]?.cumulativeScore || 0,
      contamination_ratio: selected?.contaminationRatio || 0,
      artifact_penalty: selected?.artifactPenalty || 0,
      autocorrelation_score: selected?.autocorrelationScore || 0,
      autocorrelation_full: selected?.autocorrelationFull || 0,
      autocorrelation_first_half:
        selected?.autocorrelationFirstHalf || 0,
      autocorrelation_second_half:
        selected?.autocorrelationSecondHalf || 0,
      autocorrelation_stability:
        selected?.autocorrelationStability || 0,
      interval_score: selected?.intervalScore || 0,
      cross_axis_consensus_score:
        selected?.crossAxisConsensusScore || 0,
      cross_axis_gyro_sync_ratio:
        selected?.crossAxisGyroSyncRatio || 0,
      cross_axis_heart_evidence:
        selected?.crossAxisHeartEvidence || 0,
      available_windows: availableWindowSecs.join('|')
      ,respiratory_rate_bpm: rr.bpm || lastRespiratoryRate
      ,respiratory_quality_score: rr.quality
      ,respiratory_family_stable_bpm: respiratoryFamilyState.stableBpm || 0
      ,respiratory_family_pending_s: respiratoryFamilyState.durationSec
      ,respiratory_family_excluded_count: 0
      ,respiratory_family_excluded_bpm: ''
      ,respiratory_family_candidate_count: respiratoryFamilyResult.family.length
      ,respiratory_family_penalized_count: respiratoryFamilyResult.penalized.length
      ,respiratory_family_penalized_bpm: respiratoryFamilyResult.penalized
        .map(cluster => cluster.hrBpm.toFixed(3)).join('|')
      ,respiratory_family_protected_count: respiratoryFamilyResult.protected.length
      ,respiratory_control_reviewed: respiratoryControlResult.reviewed ? 1 : 0
      ,respiratory_control_blocked: respiratoryControlResult.blocked ? 1 : 0
      ,respiratory_control_reason: respiratoryControlResult.reason
      ,respiratory_control_blocked_hr: respiratoryControlResult.blockedHrBpm
      ,respiratory_control_alternative_hr: respiratoryControlResult.alternativeHrBpm
      ,respiratory_control_family_order: respiratoryControlResult.familyOrder
      ,respiratory_control_family_distance_bpm:
        respiratoryControlResult.familyDistanceBpm
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
    heartRateTimeSeries.map(item => item.hr_bpm_raw),
    heartRateTimeSeries.map(item => item.quality_score),
    config
  );
  for (let i = 0; i < heartRateTimeSeries.length; i++) {
    const rejected = heartRateTimeSeries[i].quality_gate_pass === 0;
    heartRateTimeSeries[i].hr_bpm = rejected ? NaN : smoothed[i];
    segments[i].hr_bpm_raw = rejected ? NaN : segments[i].hr_bpm;
    segments[i].hr_bpm = rejected ? NaN : smoothed[i];
  }

  const validHeartRates = heartRateTimeSeries
    .map(item => item.hr_bpm)
    .filter(value => Number.isFinite(value) && value > 0);
  const validRespiratoryRates = respiratoryRateTimeSeries
    .map(item => item.rr_bpm)
    .filter(value => Number.isFinite(value) && value > 0);

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
    commitRobustCandidateBandSelection
    ,empiricalPlausibility
    ,multiScaleDeltaPlausibility
    ,relativePercentile
    ,annotateRelativeCandidateEvidence
    ,candidateHeartLikelihood
    ,createRhythmSwitchState
    ,applyRhythmSwitchController
  }
};
