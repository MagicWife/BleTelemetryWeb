'use strict';

const assert = require('assert');
const {
  createLowHeartRateObserverState,
  observeLowHeartRate
} = require('../src/baseline/LowHeartRateObserver');

const fs = 50;
const durationSec = 75;
const heart = new Float64Array(fs * durationSec);
const gyro = new Float64Array(heart.length);
for (let index = 0; index < heart.length; index++) {
  const time = index / fs;
  heart[index] = Math.sin(2 * Math.PI * (40 / 60) * time) +
    0.15 * Math.sin(2 * Math.PI * (80 / 60) * time);
}

const state = createLowHeartRateObserverState();
let result = null;
for (let timeSec = 30; timeSec <= durationSec; timeSec++) {
  const end = Math.min(heart.length, timeSec * fs);
  result = observeLowHeartRate(
    heart.subarray(0, end),
    gyro.subarray(0, end),
    fs,
    timeSec,
    state,
    { primaryHr: 90, primaryCandidates: [], respiratoryRate: 16 },
    {
      criticalLowHeartObservationEnabled: true,
      criticalLowHeartMinimumSpectralScore: 0.30,
      criticalLowHeartAdmissionConfirmSec: 30,
      criticalLowHeartPrimaryMissingSec: 15
    }
  );
}

assert(result, 'observer should return diagnostics');
assert(result.selectedCandidate, '40 bpm candidate should be selected');
assert(Math.abs(result.selectedCandidate.hrBpm - 40) <= 3, `expected ~40 bpm, got ${result.selectedCandidate.hrBpm}`);
assert(result.selectedCandidate.supportWindows.includes(20));
assert(result.selectedCandidate.supportWindows.includes(30));
assert(result.selectedCandidate.trackCoverage >= 0.8);
assert.strictEqual(result.shadowWouldAdmit, true);
console.log('LowHeartRateObserver tests passed');
