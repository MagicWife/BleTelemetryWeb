'use strict';

const { clamp } = require('../signal/SignalFilters');

function relativePercentile(values, value) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const item of finite) {
    if (item < value - 1e-12) below++;
    else if (Math.abs(item - value) <= 1e-12) equal++;
  }
  return clamp((below + 0.5 * Math.max(0, equal - 1)) /
    (finite.length - 1), 0, 1);
}

function annotateRelativeCandidateEvidence(clusters) {
  const fields = [
    ['intervalScore', 'relativeIntervalScore'],
    ['crossAxisHeartEvidence', 'relativeCrossAxisScore'],
    ['autocorrelationScore', 'relativeAutocorrelationScore']
  ];
  for (const [source, target] of fields) {
    const values = clusters.map(cluster => cluster[source] || 0);
    for (const cluster of clusters) {
      cluster[target] = relativePercentile(values, cluster[source] || 0);
    }
  }
  for (const cluster of clusters) {
    cluster.relativeHeartbeatScore = clamp(
      0.45 * cluster.relativeIntervalScore +
      0.30 * cluster.relativeCrossAxisScore +
      0.25 * cluster.relativeAutocorrelationScore,
      0,
      1
    );
  }
}

function computeObservationScores(clusters, config) {
  annotateRelativeCandidateEvidence(clusters);
  const bestValidatedBaseScore = clusters.reduce(
    (best, cluster) => Math.max(
      best,
      clamp(0.7 * cluster.score + 0.3 * cluster.spectralScore, 0, 1)
    ),
    0
  );
  for (const cluster of clusters) {
    if (
      config.hrDataDrivenScoringEnabled === true &&
      config.hrDataDrivenScoringActive === true
    ) {
      const intervalEvidence = clamp(
        (cluster.intervalScore || 0) /
          Math.max(config.hrObservationIntervalScale, config.epsilon), 0, 1
      );
      const crossAxisEvidence = clamp(
        (cluster.crossAxisHeartEvidence || 0) /
          Math.max(config.hrObservationCrossAxisScale, config.epsilon), 0, 1
      );
      const autocorrelationEvidence = clamp(
        (cluster.autocorrelationScore || 0) /
          Math.max(config.hrObservationAutocorrelationScale, config.epsilon), 0, 1
      );
      cluster.dataDrivenObservationScore = clamp(
        config.hrObservationSupportWeight * cluster.supportScore +
        config.hrObservationSpectralWeight * cluster.spectralScore +
        config.hrObservationIntervalWeight * intervalEvidence +
        config.hrObservationCrossAxisWeight * crossAxisEvidence +
        config.hrObservationAutocorrelationWeight * autocorrelationEvidence +
        config.hrObservationContinuityWeight * cluster.continuityScore,
        0,
        1
      );
      const validatedBaseScore = clamp(
        0.7 * cluster.score + 0.3 * cluster.spectralScore,
        0,
        1
      );
      const dataBlendWeight = clamp(
        config.hrObservationDataBlendWeight,
        0,
        1
      );
      const isCompetitive = bestValidatedBaseScore - validatedBaseScore <=
        config.hrDataDrivenTieMargin;
      cluster.preArtifactObservationScore = clamp(
        isCompetitive
          ? (1 - dataBlendWeight) * validatedBaseScore +
            dataBlendWeight * cluster.dataDrivenObservationScore
          : validatedBaseScore,
        0,
        1
      );
    } else {
      cluster.preArtifactObservationScore = clamp(
        0.7 * cluster.score + 0.3 * cluster.spectralScore,
        0,
        1
      );
    }
    cluster.artifactPenalty = clamp(
      config.impactWindowPenaltyWeight * (cluster.contaminationRatio || 0),
      0,
      0.8
    );
    cluster.observationScore = clamp(
      cluster.preArtifactObservationScore * (1 - cluster.artifactPenalty),
      0,
      1
    );
  }
}

module.exports = {
  relativePercentile,
  annotateRelativeCandidateEvidence,
  computeObservationScores
};
