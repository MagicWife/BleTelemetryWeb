/* Loaded only by browser-smoke.html, never by the production page. */
(function () {
  const predictions = [];
  const render = imuVitals.renderPrediction.bind(imuVitals);
  imuVitals.renderPrediction = result => { predictions.push(result); render(result); };
  imuVitals.startSession('合成数据测试：预热中');
  let index = 0;
  function bytesFor(i) {
    const bytes = new Uint8Array(46), view = new DataView(bytes.buffer), t = i / 50;
    bytes.set([0xA5, 0x5A, 1, 46]);
    view.setUint16(4, i, true);
    view.setInt16(14, Math.round(4 * Math.sin(2 * Math.PI * 1.5 * t)), true);
    view.setInt16(16, Math.round(3 * Math.cos(2 * Math.PI * 1.5 * t)), true);
    view.setInt16(18, 981 + Math.round(15 * Math.sin(2 * Math.PI * 0.3 * t)), true);
    view.setUint16(32, 3700, true);
    view.setUint32(40, i * 20, true);
    view.setUint16(44, crc16Ccitt(bytes.subarray(0, 44)), true);
    return bytes;
  }
  const timer = window.setInterval(() => {
    // Multiple frames per Notify, split across an arbitrary byte boundary.
    const bytes = new Uint8Array(46 * 50);
    for (let i = 0; i < 50; i++) bytes.set(bytesFor(index++), i * 46);
    for (const part of [bytes.slice(0, 71), bytes.slice(71)]) {
      handleNotify({ target: { value: new DataView(part.buffer) } });
    }
    if (index < 650) return;
    window.clearInterval(timer);
    window.setTimeout(() => {
      const last = predictions.at(-1);
      const result = {
        status: predictions.length === 4 && imuVitals.sampleCount === 650 ? 'PASS' : 'FAIL',
        frames: totalFrameCount, algorithmSamples: imuVitals.sampleCount,
        predictionCount: predictions.length, sampleRateHz: last?.fs,
        firstPredictionSeconds: predictions[0]?.session_elapsed_s,
        lastPredictionSeconds: last?.session_elapsed_s,
        qualityPassed: last?.quality_gate_passed,
        displayedHeartRate: document.getElementById('vitalsHR').textContent,
        displayedRespiratoryRate: document.getElementById('vitalsRR').textContent
      };
      onDisconnected();
      result.disconnectClearedValues = document.getElementById('vitalsHR').textContent === '--'
        && document.getElementById('vitalsRR').textContent === '--' && imuVitals.worker === null;
      if (!result.disconnectClearedValues) result.status = 'FAIL';
      parent.postMessage({ type: 'imu-smoke-result', result }, location.origin);
    }, 1000);
  }, 150);
})();
