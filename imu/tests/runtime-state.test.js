'use strict';

const assert = require('assert');
const config = require('../config');
const {
  createSixtySecondTrackState,
  selectSixtySecondTrack
} = require('../src/baseline/SixtySecondTrackSelector');

function mature(trackId, hrBpm, score = 0.8) {
  return {
    hrBpm,
    score,
    observationScore: score,
    spectralScore: score,
    supportWindows: [10, 20, 30],
    physiologicTrackId: trackId,
    physiologicTrendStable: true,
    physiologicTrendSpanSec: 60,
    physiologicTrendCoverage: 1,
    physiologicRecent15Coverage: 1,
    physiologicTrendMaximumStep: 1,
    physiologicDeltaScore: 1,
    physiologicSlopeScore: 1,
    physiologicResidualScore: 1,
    relativeHeartbeatScore: 1,
    physiologicTrendVelocity: 0
  };
}

const state = createSixtySecondTrackState(config);
let result = selectSixtySecondTrack([mature(1, 100)], 70, state, config);
assert.strictEqual(result.valid, true);
assert.strictEqual(state.activeTrackId, 1);
assert.strictEqual(state.nextDecisionSec, 85);

result = selectSixtySecondTrack([mature(1, 100)], 85, state, config);
assert.strictEqual(result.valid, true);
assert.strictEqual(state.nextDecisionSec, 100);
assert.strictEqual(state.lastDecision, 'current_mature_track_retained');

console.log('Persistent checkpoint tests passed');
