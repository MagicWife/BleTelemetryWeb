'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function harness() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        textContent: '', dataset: {}, style: {}, value: '20', innerHTML: '',
        addEventListener() {}, appendChild() {}, setAttribute() {}
      });
      return elements.get(id);
    },
    createElement() { return { className: '', textContent: '' }; }
  };
  class Chart { constructor(_, config) { this.data = config.data; } update() {} }
  class Worker {
    constructor(url) { this.url = url; this.messages = []; }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    emit(type, result) { this.onmessage({ data: { type, sessionId: this.messages[0].sessionId, result } }); }
  }
  let clock = 100000;
  const context = vm.createContext({
    document, Chart, Worker, Date: class extends Date { static now() { return clock; } },
    navigator: {}, console: { log() {}, warn() {}, error() {} },
    Uint8Array, DataView, TextEncoder, setTimeout() {}, clearTimeout() {},
    setInterval() {}, addEventListener() {}, alert() {}
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(root, 'imu-vitals.js'), 'utf8'), context);
  return {
    context, elements, run: code => vm.runInContext(code, context),
    advance: ms => { clock += ms; },
    controller: () => new context.ImuVitals()
  };
}
function sample(index, period = 20, overrides = {}) {
  return { sequence: index % 65536, ms: (index * period) >>> 0,
    ax: 0.04, ay: 0.03, az: 9.81, gx: 0.01, gy: 0.02, gz: 0, ...overrides };
}
function feed(controller, from, to, period = 20) {
  for (let i = from; i < to; i++) controller.pushSample(sample(i, period));
}
const prediction = {
  HR_bpm: 90, RR_bpm: 18, heart_valid: true, respiratory_valid: true,
  quality_gate_passed: true, HR_confidence: 0.8, RR_confidence: 0.9,
  session_elapsed_s: 10, available_windows: [10], warmup_progress: 1 / 6
};

test('all samples survive calibration; MCU time determines fs and radian input', () => {
  const h = harness(), c = h.controller();
  c.startSession();
  feed(c, 0, 100);
  const messages = c.worker.messages;
  assert.equal(messages[0].options.sampleRateHz, 50);
  assert.equal(messages[0].options.accelUnit, 'mps2');
  assert.equal(messages[0].options.gyroUnit, 'rad');
  assert.equal(messages.filter(m => m.type === 'sample').length, 100);
  assert.equal(messages[1].sample.gx, 0.01);
  assert.equal(messages.at(-1).sample.timestamp_s, 99 / 50);
  c.pushSample(sample(99));
  assert.equal(c.sampleCount, 100, 'duplicate notification must not double count');
});

test('counter rollover continues, packet loss and clock reset restart history', () => {
  const h = harness(), c = h.controller();
  c.startSession();
  for (let i = 0; i < 60; i++) c.pushSample(sample(i, 20, {
    sequence: (65520 + i) % 65536, ms: (4294967200 + i * 20) >>> 0
  }));
  assert.equal(c.sampleCount, 60);
  const old = c.worker;
  c.pushSample(sample(62, 20, { sequence: (65520 + 62) % 65536, ms: (4294967200 + 62 * 20) >>> 0 }));
  assert.equal(old.terminated, true);
  assert.equal(c.pending.length, 1);
  feed(c, 0, 40);
  assert.equal(c.sampleCount, 40, 'new device uptime must start a fresh session');
});

test('actual period changes recalibrate; unsupported fs reports an error', () => {
  const h = harness(), c = h.controller();
  c.startSession(); feed(c, 0, 60);
  const old = c.worker;
  for (let i = 60; i < 130; i++) c.pushSample(sample(i, 20, { ms: 1180 + (i - 59) * 40 }));
  assert.equal(old.terminated, true);
  assert.equal(c.sampleRateHz, 25);
  c.startSession(); feed(c, 0, 8, 200);
  assert.equal(c.active, false);
  assert.match(h.elements.get('vitalsStatus').textContent, /采样率不支持/);
});

test('quality flags do not hide finite results; invalid numbers and disconnect clear values', () => {
  const h = harness(), c = h.controller();
  c.startSession(); feed(c, 0, 50);
  const worker = c.worker;
  worker.emit('prediction', prediction);
  assert.equal(h.elements.get('vitalsHR').textContent, '90.0');
  assert.equal(h.elements.get('vitalsRR').textContent, '18.0');
  worker.emit('prediction', { ...prediction, quality_gate_passed: false, heart_valid: false, respiratory_valid: false });
  assert.equal(h.elements.get('vitalsHR').textContent, '90.0');
  assert.equal(h.elements.get('vitalsRR').textContent, '18.0');
  assert.equal(c.chart.data.datasets[0].data.at(-1).y, 90);
  worker.emit('prediction', { ...prediction, HR_bpm: null, RR_bpm: NaN });
  assert.equal(h.elements.get('vitalsHR').textContent, '--');
  assert.equal(h.elements.get('vitalsRR').textContent, '--');
  c.reset('蓝牙已断开');
  worker.emit('prediction', prediction);
  assert.equal(h.elements.get('vitalsHR').textContent, '--');
  assert.equal(c.chart.data.datasets[0].data.length, 0);
});

test('silent data loss, worker error and backlog cannot leave stale readings', () => {
  const h = harness(), c = h.controller();
  c.startSession(); feed(c, 0, 50);
  c.worker.emit('prediction', prediction);
  h.advance(3001); c.checkFreshness();
  assert.equal(h.elements.get('vitalsHR').textContent, '--');
  assert.equal(c.active, true);
  feed(c, 50, 100);
  c.worker.onerror({ message: 'test failure' });
  assert.equal(c.active, false);
  assert.equal(h.elements.get('vitalsHR').textContent, '--');
  c.startSession(); feed(c, 0, 1100);
  assert.equal(c.active, false);
  assert.match(h.elements.get('vitalsStatus').textContent, /处理滞后/);
});

function frame(sequence) {
  const bytes = new Uint8Array(42), view = new DataView(bytes.buffer);
  bytes.set([0xA5, 0x5A, 2, 42]);
  view.setUint16(4, sequence, true);
  view.setInt16(18, 981, true);
  view.setInt16(20, 100, true);
  view.setUint16(34, 0x49, true);
  view.setUint32(36, sequence * 20, true);
  let crc = 0xFFFF;
  for (const byte of bytes.subarray(0, 40)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
  }
  view.setUint16(40, crc, true);
  return bytes;
}

test('fragmented and batched v2 42-byte Notify frames reach the algorithm only after CRC verification', () => {
  const h = harness();
  h.run(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  h.run('imuVitals.startSession();');
  const good = Array.from({ length: 50 }, (_, i) => frame(i));
  const bad = frame(50); bad[18] ^= 0x01;
  const stream = new Uint8Array(42 * 51);
  [...good, bad].forEach((bytes, index) => stream.set(bytes, index * 42));
  for (let offset = 0; offset < stream.length; offset += 73) {
    const chunk = stream.slice(offset, offset + 73);
    h.context.event = { target: { value: new DataView(chunk.buffer) } };
    h.run('handleNotify(event)');
  }
  assert.equal(h.run('totalFrameCount'), 50);
  assert.equal(h.run('imuVitals.sampleCount'), 50);
  assert.equal(h.run('imuVitals.worker.messages[1].sample.gx'), 1);
  assert.equal(h.run('latestTele.magActive'), true);
  assert.equal(h.run('latestTele.ready'), true);
  assert.equal(h.run('latestTele.calibrated'), true);
  assert.equal(h.run('latestTele.ms'), 49 * 20);
  h.run('onDisconnected()');
  assert.equal(h.run('imuVitals.active'), false);
});

test('bundled browser worker matches source estimator without quality gating', () => {
  const { RealtimeImuVitalsEstimator } = require('../imu/src/realtime');
  const options = { sampleRateHz: 50, accelUnit: 'mps2', gyroUnit: 'rad' };
  const source = new RealtimeImuVitalsEstimator(options);
  const replies = [];
  const self = { postMessage: message => replies.push(message) };
  const context = vm.createContext({ self, performance });
  vm.runInContext(fs.readFileSync(path.join(root, 'imu/dist/imu-vitals.worker.js'), 'utf8'), context);
  self.onmessage({ data: { type: 'init', sessionId: 1, options } });
  let expected;
  for (let i = 0; i < 550; i++) {
    const t = i / 50;
    const input = { timestamp_s: t,
      ax: 0.01 * Math.sin(2 * Math.PI * 1.5 * t),
      ay: 0.008 * Math.cos(2 * Math.PI * 1.5 * t),
      az: 9.81 + 0.02 * Math.sin(2 * Math.PI * 0.3 * t),
      gx: 0.0001 * Math.sin(t), gy: 0.0001 * Math.cos(t), gz: 0 };
    expected = source.pushSample(input) || expected;
    self.onmessage({ data: { type: 'sample', sessionId: 1, sample: input } });
  }
  const predictions = replies.filter(message => message.type === 'prediction');
  assert.equal(predictions.length, 2);
  const actual = predictions.at(-1).result;
  for (const key of ['HR_bpm', 'RR_bpm', 'heart_valid', 'respiratory_valid', 'session_elapsed_s']) {
    assert.equal(actual[key], expected[key], key);
  }
  assert.ok(Math.abs(source.samples[0].gy - 0.0001 * 180 / Math.PI) < 1e-12, 'radians must convert exactly once');
});
