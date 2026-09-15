'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const vitals = fs.readFileSync(path.join(root, 'imu-vitals.js'), 'utf8');

function captures(source, expression) {
  return Array.from(source.matchAll(expression), match => match[1]);
}

test('all JavaScript DOM references exist and the vitals adapter loads first', () => {
  const htmlIds = new Set(captures(html, /\bid=["']([^"']+)["']/g));
  const references = new Set([
    ...captures(app, /getElementById\(["']([^"']+)["']\)/g),
    ...captures(vitals, /getElementById\(["']([^"']+)["']\)/g),
    ...captures(vitals, /\btext\(["']([^"']+)["']/g)
  ]);
  const missing = Array.from(references).filter(id => !htmlIds.has(id));
  assert.deepEqual(missing, []);
  assert.ok(html.indexOf('imu-vitals.js') < html.indexOf('app.js'));
});

test('browser parser is locked to the current v2 42-byte protocol', () => {
  assert.match(app, /const TELEMETRY_VERSION = 0x02;/);
  assert.match(app, /const TELEMETRY_FRAME_LENGTH = 42;/);
  assert.match(app, /decodeAttitudeStatus\(view\.getUint16\(34, true\)\)/);
  assert.match(app, /ms: view\.getUint32\(36, true\)/);
  assert.match(app, /imuVitals\.pushSample\(tele\)/);
});
