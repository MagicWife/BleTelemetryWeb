'use strict';

const { RealtimeImuVitalsEstimator } = require('../realtime');

let estimator = null;
let sessionId = null;

function post(type, payload = {}) {
  self.postMessage(Object.assign({ type, sessionId }, payload));
}

function publicResult(result) {
  return {
    HR_bpm: result.HR_bpm,
    RR_bpm: result.RR_bpm,
    HR_confidence: result.HR_confidence,
    RR_confidence: result.RR_confidence,
    heart_valid: result.heart_valid,
    respiratory_valid: result.respiratory_valid,
    quality_gate_passed: result.quality_gate_passed,
    quality_validity_status: result.quality_validity_status,
    quality_motion_status: result.quality_motion_status,
    quality_reject_reasons: result.quality_reject_reasons,
    motion_state: result.motion_state,
    available_windows: result.available_windows,
    session_elapsed_s: result.session_elapsed_s,
    warmup_progress: result.warmup_progress,
    fully_warmed_up: result.fully_warmed_up,
    samples_used: result.samples_used,
    fs: result.fs,
    runtime_ms: result.runtime_ms,
    candidates: result.candidates || []
  };
}

self.onmessage = event => {
  const message = event.data || {};
  try {
    if (message.type === 'init') {
      sessionId = message.sessionId || `imu-${Date.now()}`;
      estimator = new RealtimeImuVitalsEstimator(Object.assign({
        sampleRateHz: 50,
        stepSec: 1,
        replayHistorySec: 70,
        accelUnit: 'g',
        gyroUnit: 'deg',
        includeDiagnostics: false
      }, message.options || {}));
      post('ready', { status: estimator.getStatus() });
      return;
    }
    if (message.sessionId && message.sessionId !== sessionId) return;
    if (message.type === 'reset') {
      if (estimator) estimator.reset(message.reason || 'worker_reset');
      post('reset');
      return;
    }
    if (message.type === 'sample') {
      if (!estimator) throw new Error('IMU worker is not initialized');
      const result = estimator.pushSample(message.sample);
      if (result) post('prediction', { result: publicResult(result) });
    }
  } catch (error) {
    post('error', { message: error && error.message ? error.message : String(error) });
  }
};
