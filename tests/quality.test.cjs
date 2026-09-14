const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../imu/config');
const { buildRawImuQualityGate } = require('../imu/src/quality/RawImuQualityGate');

function decision(samples) {
  return buildRawImuQualityGate(samples, 50, {
    enabled: true, windowSec: 10, acceptConfirmSec: config.rawImuQualityAcceptConfirmSec,
    validityThresholds: config.rawImuQualityValidity,
    motionThresholds: config.rawImuQualityMotion
  }).decisionAt(10);
}
const sample = (extra = {}) => ({ ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, ...extra });

test('quantized static input with sparse changes and one-step gyro offset is accepted', () => {
  const samples = Array.from({ length: 500 }, (_, i) => sample({
    az: 9.81 + (Math.floor(i / 25) % 2) * 0.01,
    gx: 0.01 * 180 / Math.PI
  }));
  const result = decision(samples);
  assert.ok(result.metrics.stuckRatio > 0.95);
  assert.equal(result.accepted, true);
  assert.equal(result.motionStatus, 'static');
});

test('quantization steps are not classified as impacts when jerk MAD is zero', () => {
  const samples = Array.from({ length: 500 }, (_, i) => sample({ ax: i % 5 === 0 ? 0.01 : 0 }));
  const result = decision(samples);
  assert.equal(result.metrics.shockRatio, 0);
  assert.equal(result.accepted, true);
});

test('flat, non-finite, strong-motion and repeated-impact data remain rejected', () => {
  assert.equal(decision(Array.from({ length: 500 }, () => sample())).accepted, false);
  assert.equal(decision(Array.from({ length: 500 }, () => sample({ ax: NaN }))).accepted, false);
  const moving = decision(Array.from({ length: 500 }, (_, i) => sample({ gx: 10, ax: 0.01 * (i % 2) })));
  assert.equal(moving.accepted, false);
  assert.equal(moving.motionStatus, 'strong_motion');
  const impact = decision(Array.from({ length: 500 }, (_, i) => sample({ ax: i % 5 === 0 ? 2 : 0 })));
  assert.equal(impact.accepted, false);
  assert.equal(impact.motionStatus, 'impact');
});
