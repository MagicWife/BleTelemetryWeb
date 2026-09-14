'use strict';

/**
 * Parameters used by the current three-axis differential-magnitude pipeline.
 */
module.exports = {
  // Raw IMU units and attitude/gravity processing.
  accelUnit: 'mps2',
  gyroUnit: 'deg',
  fsDefault: 100,
  gravity: 9.81,
  // AttitudeSolver defines q as the body -> world rotation. Keep the whole
  // pipeline on that single convention.
  quaternionConvention: 'bodyToWorld',

  // Sliding-window estimation.
  windowSec: 20,
  windowSecList: [10, 20, 30],
  stepSec: 1,

  // Raw-IMU quality gate. Rejected seconds remain on the original timeline as
  // NaN and must not update HR candidate/trajectory state.
  rawImuQualityGateEnabled: true,
  estimatorResetAtGoldStartEnabled: true,
  estimatorHistoryWarmupSec: 60,
  rawImuQualityWindowSec: 10,
  rawImuQualityMinimumRejectRunSec: 1,
  rawImuQualityAcceptConfirmSec: 3,
  rawImuQualityLongGapResetSec: 10,
  rawImuQualityMediumGapMinSec: 3,
  rawImuQualityRecoveryConfirmSec: 5,
  rawImuQualityRecoveryMatchBpm: 6,
  rawImuQualityRecoveryAnchorSigmaBpm: 20,
  rawImuQualityRecoveryMinimumAnchorWeight: 0.15,
  rawImuQualityRejectMotionStatuses: ['strong_motion', 'impact'],
  rawImuQualityValidity: {
    validCoverage: 0.80,
    invalidCoverage: 0.50,
    validFiniteRatio: 0.99,
    invalidFiniteRatio: 0.80,
    validStuckRatio: 0.05,
    invalidStuckRatio: 0.50
  },
  rawImuQualityMotion: {
    accMadP95: 0.02933569594836624,
    accMadP99: 0.0560047932263039,
    gyroRmsP95: 0.11012278065735638,
    gyroRmsP99: 0.3628267925229166,
    shockP95: 0.05267967548330664,
    shockP99: 0.10793587174348677
  },

  // Frequency bands.
  respiratoryBand: [10 / 60, 0.5],
  heartBand: [30 / 60, 220 / 60],
  // Keep the formal RR output at 10-30 bpm, but retain slower components in
  // the proxy because they change the relative evidence of the 10-30 bpm peak.
  respProxyBand: [1 / 60, 0.5],
  respiratoryRateBpmRange: [10, 30],
  respiratoryFamilyExclusionEnabled: false,
  respiratoryFamilyPenaltyEnabled: false,
  respiratoryFamilyMinimumQuality: 0.75,
  respiratoryFamilyConfirmSec: 8,
  respiratoryFamilyRateMatchBpm: 3,
  respiratoryFamilyMaximumMissingSec: 3,
  respiratoryFamilyHarmonicOrders: [2, 3, 4],
  respiratoryFamilyToleranceBpm: 3,
  respiratoryFamilyNormalPenalty: 0.08,
  respiratoryFamilyExtremePenalty: 0.12,
  respiratoryFamilyAuthorityProtectionBpm: 6,
  respiratoryFamilyStrongHeartbeatProtection: 0.75,
  respiratoryControlAdmissionEnabled: true,
  respiratoryControlMinimumQuality: 0.75,
  respiratoryControlMinimumPersistenceSec: 5,
  respiratoryControlHarmonicOrders: [2, 3, 4],
  respiratoryControlStrongDistanceBpm: 1.5,
  respiratoryControlFamilyToleranceBpm: 3,
  respiratoryControlAlternativeScoreGap: 0.15,
  respiratoryControlAlternativeSpectralGap: 0.20,
  respiratoryControlAuthorityProtectionBpm: 6,
  respiratoryControlSelectedTrackProtectionSec: 15,
  respiratoryControlHeartbeatEvidenceRequired: 2,
  respiratoryControlBlockedMatchBpm: 6,
  respiratoryControlHoldSec: 12,
  respiratoryControlAlternativeReconnectBpm: 10,
  heartProxyBand: [30 / 60, 220 / 60],

  // Perioperative critical-low HR observation channel. This is deliberately
  // separate from the validated 50-220 bpm production channel: widening the
  // production filter would change its PSD floor, Top-K competition and gyro
  // normalization even when the true HR remains above 50 bpm.
  criticalLowHeartObservationEnabled: false,
  criticalLowHeartProxyBand: [30 / 60, 55 / 60],
  criticalLowHeartCandidateBandBpm: [30, 50],
  criticalLowHeartCandidateMergeBpm: 4,
  criticalLowHeartTrackMatchBpm: 5,
  criticalLowHeartTrackHistorySec: 60,
  criticalLowHeartTrackMaximumGapSec: 3,
  criticalLowHeartRequiredWindows: [20, 30],
  criticalLowHeartAdmissionConfirmSec: 30,
  criticalLowHeartMinimumCoverage: 0.80,
  criticalLowHeartMinimumSpectralScore: 0.45,
  criticalLowHeartPrimaryMissingSec: 15,
  criticalLowHeartPrimaryMatchBpm: 12,
  criticalLowHeartRespiratoryHarmonicToleranceBpm: 3,
  criticalLowHeartHalfFrequencyToleranceBpm: 6,
  // Stage 1/2 default: observe and simulate admission without changing HR.
  criticalLowHeartTakeoverEnabled: false,

  // Heart-rate candidate selection.
  hrPhysLowBpm: 30,
  hrPhysHighBpm: 220,
  hrTopKPeaks: 5,
  hrMinPeakDistanceHz: 0.15,
  hrCandidateMergeBpm: 6,
  hrTrackingSigmaBpm: 12,
  hrReliableUpdateMaxDeviationBpm: 15,
  hrBaselineSigmaBpm: 20,
  hrBaselineHistoryLength: 120,
  hrHistoryMinQuality: 0.42,
  // A single authoritative HR history is deliberately harder to update than
  // the ordinary Beam. Thresholds were selected from all 28 aligned segments:
  // correct outputs have markedly higher 20/30 s support and quality, while a
  // score threshold alone still admits many stable motion/respiratory peaks.
  // Quality is only a floor here; persistence, 20/30 s support, score margin
  // and old-anchor visibility provide the actual discrimination. A higher
  // absolute floor incorrectly excludes low-amplitude but valid 7.2 tracks.
  hrAuthorityMinimumQuality: 0.65,
  hrAuthorityInitialMinimumMargin: 0.05,
  hrAuthorityInitialConfirmSec: 5,
  hrAuthorityLocalConfirmSec: 5,
  hrAuthorityRemoteConfirmSec: 5,
  hrAuthorityMatureTrackConfirmSec: 5,
  hrAuthorityCandidateMatchBpm: 6,
  hrAuthorityNearbyBpm: 10,
  hrAuthorityHistorySec: 15,
  hrAuthorityMaximumFiveSecondChangeBpm: 16,
  hrAuthoritySingleWindowMinimumQuality: 0.45,
  hrAuthorityLocalEvidenceRequired: 4.0,
  // Confirmed authoritative writes are intentionally limited to the p95
  // physiological envelopes measured from all aligned gold data. Faster
  // movement may still be output, but must use remote/mature re-anchoring
  // instead of walking the unique anchor through several small local steps.
  hrAuthorityLocalMaximumFiveSecondDriftBpm: 8,
  hrAuthorityLocalMaximumFifteenSecondDriftBpm: 12,
  hrAuthorityInitialEvidenceRequired: 4.0,
  hrAuthorityRemoteEvidenceRequired: 5.0,

  // Data-supported candidate selection. The weak-candidate veto was selected
  // by leave-one-segment-out analysis of the fixed-alignment diagnostics.
  hrWeakCandidateSpectralThreshold: 0.25,
  hrWeakCandidateAxisEnergyThreshold: 2,
  hrTrackBeamWidth: 5,
  hrTrackMemory: 0.82,
  hrTrackTransitionScaleBpm: 18,
  hrTrackTransitionPenalty: 0.18,
  hrTrackMaxMatchBpm: 18,
  // Data-driven candidate observation score. Values are normalized near the
  // empirical scale of candidates within 10 bpm of gold, then combined using
  // features that separated correct and incorrect peaks in fixed-alignment
  // diagnostics. Autocorrelation stability, gyro penalty and contamination
  // are not rewarded here because they showed little/no class separation.
  hrDataDrivenScoringEnabled: true,
  hrObservationSupportWeight: 0.00,
  hrObservationSpectralWeight: 0.35,
  hrObservationIntervalWeight: 0.26,
  hrObservationCrossAxisWeight: 0.10,
  hrObservationAutocorrelationWeight: 0.12,
  hrObservationContinuityWeight: 0.17,
  hrObservationDataBlendWeight: 0.20,
  hrDataDrivenTieMargin: 0.05,
  hrPhysiologyTransitionPenaltyWeight: 0.12,
  hrPhysiologyNewTrackPenaltyWeight: 0.18,
  hrObservationIntervalScale: 0.35,
  hrObservationCrossAxisScale: 0.12,
  hrObservationAutocorrelationScale: 0.20,
  // Thirty-second candidate-history evidence. During the first 30 seconds all
  // viable candidates are tracked without changing the selected peak. Once a
  // track has enough history, smooth and persistent candidate trajectories
  // contribute to peak selection.
  // Candidate stability is evaluated over the latest rolling 30 s. This is
  // long enough to reject transient peak switches without delaying genuine
  // gradual HR changes for a full minute.
  hrTrendHistorySec: 60,
  hrTrendMinHistorySec: 20,
  hrTrendMaxGapSec: 3,
  // Unselected candidates remain in the trajectory bank through short peak
  // dropouts. This preserves primary, secondary and harmonic alternatives
  // independently of which trajectory currently drives the output.
  hrPersistentTrackMaxGapSec: 3,
  hrTrendMatchBpm: 12,
  // Candidate-to-track relinking follows the empirical 1 s and 5 s HR-change
  // envelopes instead of using the same permissive 12 bpm gate at every gap.
  hrTrendMatchBpmByGapSec: { 1: 6, 2: 9, 3: 11 },
  hrTrendVelocityAlpha: 0.25,
  hrTrendStepScaleBpm: 4,
  hrTrendCurvatureScaleBpm: 3,
  // Robust trajectory stability: normal changes dominate the rolling minute,
  // while one or two interpolation/peak-centre shifts do not veto all 60 s.
  hrTrendStepP95MaximumBpm: 4,
  hrTrendLargeStepThresholdBpm: 6,
  hrTrendMaximumLargeStepCount: 2,
  hrTrendAbsoluteMaximumStepBpm: 8,
  // The 0.28 experiment is preserved under results/30秒候选趋势. It helped
  // several difficult 7.18 segments but reduced aggregate generalization, so
  // keep the trajectory fields diagnostic-only in the default pipeline.
  hrTrendScoreWeight: 0.10,
  // A fully observed, physiologically stable 60 s candidate trajectory may
  // replace a stale previousReliableHr even when the gap exceeds the ordinary
  // 15 bpm reliable-update limit.
  hrMatureTrackTakeoverEnabled: true,
  hrMatureTrackTakeoverSpanSec: 60,
  hrMatureTrackTakeoverMinimumCoverage: 0.95,
  hrMatureTrackTakeoverRequiredWindows: [20, 30],
  hrMatureTrackCurrentMatchBpm: 15,
  hrMatureTrackRemoteConfirmSec: 10,
  hrMatureTrackRemoteMatchBpm: 6,
  hrMatureTrackTakeoverCooldownSec: 60,
  hrMatureTrackMaximumStepBpm: 8,
  hrMatureTrackSelectedConfirmSec: 30,
  hrMatureTrackSelectedMatchBpm: 10,
  // A very strong 50-68 bpm component can be a respiratory harmonic. When a
  // supported high-HR anchor is still present, keep the low candidate for
  // diagnostics/tracking but prevent it from taking over control state.
  hrLowStrongArtifactGuardEnabled: true,
  hrLowStrongArtifactBandBpm: [50, 68],
  hrLowStrongArtifactMinimumSpectralScore: 0.80,
  hrLowStrongArtifactRequiredWindows: [20, 30],
  hrLowStrongArtifactMinimumAnchorBpm: 90,
  hrLowStrongArtifactMinimumDistanceBpm: 25,
  hrLowStrongArtifactAnchorMatchBpm: 15,
  hrLowStrongArtifactSpectralDominanceRatio: 3.0,
  // 50-68 bpm is retained as a possible physiological range, but it uses an
  // asymmetric admission rule because respiratory harmonics are common here.
  // Low candidates keep accumulating diagnostic/trajectory evidence while
  // pending, but cannot control the band, Beam or reliable anchor.
  hrLowZoneEnabled: true,
  hrLowZoneBandBpm: [30, 68],
  hrLowZoneNormalBoundaryBpm: 75,
  hrLowZoneRequiredWindows: [20, 30],
  hrLowZoneEntryConfirmSec: 20,
  hrLowZoneOldAnchorMissingSec: 15,
  hrLowZoneMinimumObservationScore: 0.60,
  hrLowZoneMinimumTrackCoverage: 0.65,
  hrLowZoneCandidateMatchBpm: 6,
  hrLowZoneEvidencePassRatio: 0.70,
  hrCriticalLowBandBpm: [30, 55],
  hrCriticalLowEntryConfirmSec: 30,
  hrCriticalLowMinimumObservationScore: 0.65,
  hrCriticalLowMinimumTrackCoverage: 0.80,
  hrLowZoneExitConfirmSec: 5,
  hrLowZoneExitObservationAdvantage: 0.05,
  // Cleaned-gold trajectory limits. Inside p95 is fully plausible; p95-p99
  // is progressively less likely; beyond p99 decays rather than being vetoed.
  hrPhysiologyDeltaLimits: {
    1: [3, 6],
    5: [8, 16],
    15: [12, 21],
    30: [15, 24]
  },
  hrPhysiologySlopeLimits: [0.525, 0.891],
  hrPhysiologyResidualLimits: [5.33, 7.79],
  hrPhysiologyAccelerationLimits: [4, 8],
  hrPhysiologyCoverageWeight: 0.25,
  hrPhysiologyDeltaWeight: 0.40,
  hrPhysiologySlopeWeight: 0.12,
  hrPhysiologyResidualWeight: 0.13,
  hrPhysiologyAccelerationWeight: 0.10,

  // Robust 30 s candidate band. This is a gate, not a smoothness reward.
  // The first full experiment is preserved under results/30秒稳健候选带.
  // It removed transient spikes but could lock onto a wrong initial band, so
  // keep it disabled by default until multi-band initialization is added.
  // Retained as an experimental feature. Across all 16 fixed-alignment
  // segments, the rolling multi-band gate reached 50.66% within 10 bpm versus
  // 53.27% for the current baseline, so it must not be enabled by default.
  // The rolling 30 s stable-band experiment reduced MAE from 14.67 to 14.14
  // bpm and improved +/-10 accuracy from 53.27% to 53.96%, while reacting
  // sooner than the 60 s variant.
  hrBandEnabled: false,
  // Track identity is reconsidered only at fixed 15 s checkpoints. Between
  // checkpoints the selected physiological track may move normally, but a
  // different candidate family cannot take control.
  hrCheckpointTrackLockEnabled: true,
  hrCheckpointTrackInitializationSec: 30,
  hrCheckpointTrackDecisionSec: 15,
  hrCheckpointTrackShortHoldSec: 2,
  hrCheckpointTrackRelinkBpm: 6,
  hrCheckpointTrackLocalSwitchBpm: 10,
  hrCheckpointTrackRemoteSwitchBpm: 15,
  hrCheckpointTrackCurrentMinimumCoverage15: 0.60,
  hrCheckpointTrackCurrentInvalidCoverage15: 0.40,
  hrCheckpointTrackCurrentMissingSec: 5,
  hrCheckpointTrackChallengerCoverage15: 0.80,
  hrCheckpointTrackLocalMinimumSpanSec: 15,
  hrCheckpointTrackRemoteMinimumSpanSec: 30,
  hrCheckpointTrackLocalScoreAdvantage: 0.05,
  hrCheckpointTrackRemoteScoreAdvantage: 0.10,
  hrCheckpointTrackRemoteRequiredCheckpoints: 2,
  // The mature 60-second selector and the original-score selector run in
  // parallel. These values control only which branch owns the final output;
  // they never filter candidates from the original-score Beam.
  hrSixtySecondTrackEnterConfirmSec: 5,
  hrSixtySecondTrackExitConfirmSec: 2,
  // A mature trajectory may only take over a remote raw selection when its
  // competitive evidence grows with the requested HR distance.
  hrMatureTakeoverEvidenceGateEnabled: true,
  hrMatureTakeoverEvidenceGateStartBpm: 15,
  hrMatureTakeoverBaseRatio: 0.60,
  hrMatureTakeoverRatioPerBpm: 0.004,
  hrMatureTakeoverMaximumRatio: 0.95,
  hrMatureTakeoverConfirmBaseSec: 5,
  hrMatureTakeoverConfirmStepBpm: 20,
  hrMatureTakeoverConfirmStepSec: 2,
  hrMatureTakeoverMaximumConfirmSec: 15,
  hrRawBeamTransitionGuardEnabled: true,
  hrRawBeamTrendHistorySec: 15,
  hrRawBeamRemoteDeviationBpm: 12,
  hrRawBeamNearbyCandidateBpm: 10,
  hrRawBeamMaximumTrendHoldSec: 5,
  hrRawBeamHoldMaximumDriftBpm: 6,
  hrRawBeamRemoteConfirmSec: 5,
  hrRawBeamRemoteMatchBpm: 6,
  hrRawBeamRemoteMaximumFiveSecondChangeBpm: 16,
  hrRawBeamMaximumFifteenSecondChangeBpm: 21,
  hrCheckpointFallbackBandBpm: 10,
  hrBandInitializationSec: 30,
  // Initial band creation is deliberately stricter than later tracking.
  // Keep up to three established trajectories, but do not lock the 60 s band
  // until a trajectory is present in both long candidate windows.
  hrBandInitializationRequiredWindows: [20, 30],
  // Rebuild every 15 s: 0-30, 15-45, 30-60, 45-75, and so on.
  hrBandRefreshSec: 15,
  hrBandMaximumCandidates: 3,
  hrBandCandidateMergeBpm: 6,
  hrBandMinimumTrackCoverage: 0.65,
  // Candidate trajectories include FFT-bin and clustering jitter, so their
  // hard limits must be wider than the cleaned-gold p95 values. Retain the
  // established step/residual margins and only tighten sustained slope from
  // the original 1.5 bpm/s to 1.0 bpm/s.
  hrBandMaximumTrackStepBpm: 5,
  hrBandMaximumTrackResidualBpm: 6,
  hrBandMaximumTrackSlopeBpmPerSec: 1.0,
  hrBandMaximumTransitionBpmPerSec: 6,
  hrBandHalfWidthBpm: 10,
  hrBandMinimumHalfWidthBpm: 8,
  hrBandMaximumHalfWidthBpm: 12,
  hrBandCenterMaxStepBpm: 1,
  hrBandHoldMaximumSec: 15,
  hrBandShiftConfirmSec: 10,
  hrBandPendingMatchBpm: 6,
  hrBandShiftMinimumSpectralScore: 0.30,
  hrBandShiftMinimumSupportWindows: 2,

  // Pre-FFT impact/artifact handling.
  impactJerkMadMultiplier: 8,
  impactExtremeJerkMadMultiplier: 15,
  impactGyroMadMultiplier: 6,
  impactPaddingSec: 0.20,
  impactMaxInterpolationSec: 0.25,
  impactWindowPenaltyWeight: 0.60,
  impactHighContaminationRatio: 0.15,

  // Candidate verification from pre-FFT time-domain rhythm evidence.
  // The 0.12/0.08 scoring experiment is preserved under results/节律验证,
  // but reduced overall ±10 accuracy. Keep the evidence diagnostic-only in
  // the production path until it can distinguish stable artifacts.
  // Compute/export rhythm evidence even when its scoring weights remain zero.
  rhythmEvidenceDiagnosticEnabled: true,
  rhythmPeakThresholdStd: 0.35,
  rhythmPeakMinDistanceSec: 0.22,
  rhythmIntervalRelativeSigma: 0.18,
  rhythmIntervalCvScale: 0.30,

  // Rhythm-aware switch controller layered on top of the reproduced 60 s
  // candidate band. It does not rescore ordinary nearby candidates. Only a
  // remote proposed switch enters a short evidence-accumulation challenge.
  rhythmSwitchControllerEnabled: true,
  rhythmSwitchRemoteBpm: 10,
  rhythmSwitchOldMatchBpm: 6,
  rhythmSwitchChallengeMatchBpm: 6,
  rhythmSwitchOldEvidenceAdvantage: 0.05,
  rhythmSwitchConfirmSec: 6,
  rhythmSwitchMaximumVetoSec: 10,
  // Context-only heartbeat evidence. These weights are never added to the
  // ordinary per-second candidate/beam score. They are used only while
  // initializing, comparing a remote challenger, or reacquiring after the
  // remembered peak disappears.
  rhythmContextIntervalWeight: 0.45,
  rhythmContextCrossAxisWeight: 0.30,
  rhythmContextAutocorrelationWeight: 0.25,
  rhythmInitializationBlendWeight: 0.25,
  rhythmReacquireBlendWeight: 0.35,
  // Signed-axis time-domain consensus. A cardiac event must appear on at
  // least two acceleration axes; gyro-synchronous consensus is penalized.
  // The 0.12/0.08 experiment is preserved under results/三轴事件共识 but
  // slightly reduced aggregate accuracy. Keep these diagnostic-only.
  crossAxisEventThresholdStd: 0.45,
  crossAxisCoincidenceSec: 0.10,
  crossAxisMinConsensusEvents: 4,

  // Gyroscope evidence is a soft motion-artifact penalty, never a hard veto.
  // Coherence needs repeated subsegments, so it is used only by 20/30 s
  // candidate windows. The 10 s window continues to provide fast HR changes.
  gyroCoherenceMinWindowSec: 20,
  gyroCoherenceSegmentSec: 5,
  gyroCoherenceOverlap: 0.5,
  gyroEnergyNeutralRatio: 2,
  gyroEnergyHighRatio: 12,
  gyroImpulseMadMultiplier: 6,
  gyroImpulseFullRatio: 0.05,
  gyroMotionEvidenceThreshold: 0.45,
  gyroPersistenceFullSec: 10,
  gyroPenaltyWeight: 0.14,

  // Final quality-aware smoothing.
  hrMedianWindowSize: 5,
  hrMaxSlopeBpmPerSec: 10,
  hrHardMaxStepBpm: 20,
  hrPostAlpha: 0.5,
  hrLowQualityThreshold: 0.35,
  hrOutlierGapBpm: 18,

  // Motion classification.
  staticAccVarThreshold: 0.2,
  staticGyrMagThreshold: 3,

  epsilon: 1e-10
};
