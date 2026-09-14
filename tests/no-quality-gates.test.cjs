const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RealtimeImuVitalsEstimator } = require('../imu/src/realtime');
const { estimateHRRRTimeSeries } = require('../imu/src/baseline/SlidingWindowEstimator');

test('static, repetitive, moving and impact-like windows all reach prediction', () => {
  for (const kind of ['flat', 'quantized', 'moving', 'impact']) {
    const estimator = new RealtimeImuVitalsEstimator({ sampleRateHz: 50, gyroUnit: 'rad' });
    const results = [];
    for (let i = 0; i < 550; i++) {
      const result = estimator.pushSample({ timestamp_s: i / 50,
        ax: kind === 'impact' && i % 5 === 0 ? 2 : 0,
        ay: kind === 'moving' ? Math.sin(i / 5) : 0,
        az: 9.81 + (kind === 'quantized' ? Math.floor(i / 25) % 2 * 0.01 : 0),
        gx: kind === 'moving' ? 0.2 : 0, gy: 0, gz: 0 });
      if (result) results.push(result);
    }
    assert.equal(results.length, 2, kind);
    for (const result of results) {
      assert.equal('quality_gate_passed' in result, false);
      assert.equal('quality_reject_reasons' in result, false);
      assert.ok(result.HR_bpm === null || Number.isFinite(result.HR_bpm));
      assert.ok(result.RR_bpm === null || Number.isFinite(result.RR_bpm));
    }
  }
});

test('legacy quality gate callback cannot suppress windows', () => {
  const heart = Float64Array.from({ length: 550 }, (_, i) => Math.sin(2 * Math.PI * 1.5 * i / 50));
  const resp = Float64Array.from({ length: 550 }, (_, i) => Math.sin(2 * Math.PI * 0.3 * i / 50));
  let calls = 0;
  const result = estimateHRRRTimeSeries(resp, heart, 50, {
    rawImuQualityGate: { decisionAt() { calls++; throw new Error('Removed gate must never run'); } }
  });
  assert.equal(calls, 0);
  assert.ok(result.heartRateTimeSeries.length > 0);
  assert.ok(result.heartRateTimeSeries.every(row => !('quality_gate_pass' in row)));
});

test('source and shipped Worker contain no signal quality rejection pipeline', () => {
  for (const name of ['imu/src/realtime/RealtimeImuVitalsEstimator.js',
    'imu/src/baseline/SlidingWindowEstimator.js', 'imu/dist/imu-vitals.worker.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    assert.doesNotMatch(source, /buildRawImuQualityGate|qualityRecoveryState|quality_gate_pass|quality_rejected/);
  }
  assert.equal(fs.existsSync(path.join(__dirname, '../imu/src/quality/RawImuQualityGate.js')), false);
});
