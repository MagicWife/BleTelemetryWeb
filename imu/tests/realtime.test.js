'use strict';

const assert = require('assert');
const { RealtimeImuVitalsEstimator } = require('../src/realtime');

function sampleAt(timeSec, fs) {
  return {
    time_s: timeSec,
    ax: 0.04 * Math.sin(2 * Math.PI * 1.5 * timeSec),
    ay: 0.03 * Math.cos(2 * Math.PI * 1.5 * timeSec),
    az: 9.81 + 0.15 * Math.sin(2 * Math.PI * 0.3 * timeSec),
    gx: 0.02 * Math.sin(timeSec),
    gy: 0.02 * Math.cos(timeSec),
    gz: 0
  };
}

const fs = 50;
const estimator = new RealtimeImuVitalsEstimator({
  sampleRateHz: fs,
  replayHistorySec: 70,
  config: { rawImuQualityGateEnabled: false }
});
assert.strictEqual(estimator.isReady(), false);
const results = [];
for (let index = 0; index < 65 * fs; index++) {
  const result = estimator.addSample(sampleAt(index / fs, fs));
  if (result) results.push(result);
}

assert.strictEqual(results.length, 56, 'predictions should start at 10 s and repeat once per second');
assert.strictEqual(results[0].session_elapsed_s, 10);
assert.strictEqual(results[0].method, 'imu-vitals');
assert.strictEqual(results[0].HR_bpm, results[0].heart_rate_bpm);
assert.strictEqual(results[0].RR_bpm, results[0].respiratory_rate_bpm);
assert.strictEqual(results[0].fs, fs);
assert.strictEqual(estimator.isReady(), true);
assert.deepStrictEqual(results[0].available_windows, [10]);
assert.deepStrictEqual(results[10].available_windows, [10, 20]);
assert.deepStrictEqual(results[20].available_windows, [10, 20, 30]);
assert.strictEqual(results[20].window_end_s, 30);
assert.strictEqual(results[20].window_start_s, 0);
assert.strictEqual(results[results.length - 1].fully_warmed_up, true);
assert.ok(results.every(result => result.runtime_ms >= 0));

const beforeReset = estimator.getStatus().sessionSampleCount;
assert.strictEqual(beforeReset, 65 * fs);
estimator.reset('test');
assert.strictEqual(estimator.getStatus().sessionSampleCount, 0);
assert.strictEqual(estimator.getStatus().lastResetReason, 'test');

const gapEstimator = new RealtimeImuVitalsEstimator({ sampleRateHz: fs });
gapEstimator.addSample(sampleAt(0, fs));
gapEstimator.addSample(sampleAt(11, fs));
assert.strictEqual(gapEstimator.getStatus().sessionSampleCount, 1);
assert.strictEqual(gapEstimator.getStatus().lastResetReason, 'timestamp_gap');

console.log('RealtimeImuVitalsEstimator tests passed');
