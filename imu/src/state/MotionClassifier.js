/**
 * MotionClassifier.js
 *
 * Window-level static/moving classifier for IMU sequences.
 * Uses:
 *  - accVar: variance of acceleration magnitude in the window
 *  - gyrRMS: RMS of gyroscope magnitude in the window
 *
 * Rule:
 *   if accVar < staticAccVarThreshold AND gyrRMS < staticGyrMagThreshold → 'static'
 *   else → 'moving'
 *
 * Exports:
 *  - classifyWindowState(axWin, ayWin, azWin, gxWin, gyWin, gzWin, fs, cfg)
 *  - classifySeriesWindows(series, fs, options)
 *  - labelSeriesByWindows(n, windows)
 */

const baseConfig = require('../../config');

/**
 * Convert input to Float64Array (copy)
 */
function toF64(arr) {
  if (!arr) return new Float64Array(0);
  return new Float64Array(Array.from(arr));
}

/**
 * Mean ignoring non-finite values
 */
function mean(arr) {
  let s = 0;
  let c = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      s += v;
      c++;
    }
  }
  return c > 0 ? s / c : 0;
}

/**
 * Variance ignoring non-finite values
 */
function variance(arr) {
  const mu = mean(arr);
  let s = 0;
  let c = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      const d = v - mu;
      s += d * d;
      c++;
    }
  }
  return c > 0 ? s / c : 0;
}

/**
 * Compute magnitude for 3-axis signals
 */
function magnitude3(ax, ay, az) {
  const n = Math.min(ax.length, ay.length, az.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = Number.isFinite(ax[i]) ? ax[i] : 0;
    const y = Number.isFinite(ay[i]) ? ay[i] : 0;
    const z = Number.isFinite(az[i]) ? az[i] : 0;
    out[i] = Math.sqrt(x * x + y * y + z * z);
  }
  return out;
}

/**
 * RMS ignoring non-finite values
 */
function rms(arr) {
  let s2 = 0;
  let c = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      s2 += v * v;
      c++;
    }
  }
  return c > 0 ? Math.sqrt(s2 / c) : 0;
}

/**
 * Classify a single window.
 * Inputs: window arrays for ax, ay, az, gx, gy, gz (numbers in SI units preferred)
 * fs is not strictly needed here but kept for compatibility.
 */
function classifyWindowState(axWin, ayWin, azWin, gxWin, gyWin, gzWin, fs, cfg = {}) {
  const config = Object.assign({}, baseConfig, cfg);

  const ax = toF64(axWin);
  const ay = toF64(ayWin);
  const az = toF64(azWin);
  const gx = toF64(gxWin);
  const gy = toF64(gyWin);
  const gz = toF64(gzWin);

  // Acc magnitude variance
  const accMag = magnitude3(ax, ay, az);
  const accVar = variance(accMag);

  // Gyro magnitude RMS (deg/s expected)
  const gyrMag = magnitude3(gx, gy, gz);
  const gyrRMS = rms(gyrMag);

  const isStatic =
    accVar < (config.staticAccVarThreshold || 15) &&
    gyrRMS < (config.staticGyrMagThreshold || 3);

  return {
    state: isStatic ? 'static' : 'moving',
    accVar,
    gyrRMS
  };
}

/**
 * Classify an entire series by sliding windows.
 * series: { ax, ay, az, gx, gy, gz } Float64Array-like
 * fs: sampling rate
 * options:
 *  - windowSec (default from config)
 *  - stepSec (default from config)
 *  - thresholds override (see config)
 *
 * Returns: array of windows
 * [
 *   {
 *     winStartIdx, winEndIdx,
 *     winStart_s, winEnd_s,
 *     state, accVar, gyrRMS
 *   }, ...
 * ]
 */
function classifySeriesWindows(series, fs, options = {}) {
  const config = Object.assign({}, baseConfig, options);

  const ax = toF64(series.ax);
  const ay = toF64(series.ay);
  const az = toF64(series.az);
  const gx = toF64(series.gx);
  const gy = toF64(series.gy);
  const gz = toF64(series.gz);

  const n = Math.min(ax.length, ay.length, az.length, gx.length, gy.length, gz.length);
  if (!(fs > 0) || n === 0) return [];

  const winLen = Math.max(1, Math.round((config.windowSec || 10) * fs));
  const step = Math.max(1, Math.round((config.stepSec || 1) * fs));

  const windows = [];

  // Timestamp each classification at the end of a trailing window. This keeps
  // state lookup causal: the state at T describes [T-windowSec, T].
  for (let end = winLen; end <= n; end += step) {
    const start = end - winLen;
    const axWin = ax.subarray(start, end);
    const ayWin = ay.subarray(start, end);
    const azWin = az.subarray(start, end);
    const gxWin = gx.subarray(start, end);
    const gyWin = gy.subarray(start, end);
    const gzWin = gz.subarray(start, end);

    const res = classifyWindowState(axWin, ayWin, azWin, gxWin, gyWin, gzWin, fs, config);

    windows.push({
      winStartIdx: start,
      winEndIdx: end - 1,
      winStart_s: start / fs,
      winEnd_s: end / fs,
      state: res.state,
      accVar: res.accVar,
      gyrRMS: res.gyrRMS
    });
  }

  return windows;
}

module.exports = {
  classifySeriesWindows
};
