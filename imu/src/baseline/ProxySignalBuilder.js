'use strict';

const baseConfig = require('../../config');
const { bandpass, removeDC, zscore } = require('../signal/SignalFilters');
const {
  differentialMagnitude3D,
  differentialAxis
} = require('../signal/AxisDifferential');

/**
 * Build respiratory and heart proxies with three-axis differential magnitude.
 *
 * Pipeline:
 *   attitude/gravity processed X/Y/Z -> per-axis DC removal and band-pass
 *   -> combine the three differentiated axes with Euclidean magnitude
 *   -> unchanged downstream sliding-window estimator
 */
function buildRespAndHeartProxies(linAx, linAy, linAz, fs, cfg = {}) {
  const config = Object.assign({}, baseConfig, cfg);
  const respBand = Array.isArray(cfg.respProxyBand)
    ? cfg.respProxyBand
    : (config.respProxyBand || [0.1, 0.5]);
  const heartBand = Array.isArray(cfg.heartProxyBand)
    ? cfg.heartProxyBand
    : (config.heartProxyBand || [1.0, 4.0]);

  const x = new Float64Array(Array.from(linAx || []));
  const y = new Float64Array(Array.from(linAy || []));
  const z = new Float64Array(Array.from(linAz || []));
  const n = Math.min(x.length, y.length, z.length);
  if (!(fs > 0) || n < 4) {
    const zero = new Float64Array(n);
    return {
      s_resp: zero,
      s_heart: zero,
      diagnostic_heart_axes: { x: zero, y: zero, z: zero },
      s_sum: zero,
      meta: {
        method: 'axis_differential_magnitude',
        resp: { band: respBand },
        heart: { band: heartBand }
      }
    };
  }

  const ax = x.subarray(0, n);
  const ay = y.subarray(0, n);
  const az = z.subarray(0, n);

  // Keep the original order exactly: filter each axis first, then combine.
  const axResp = bandpass(ax, fs, respBand[0], respBand[1]);
  const ayResp = bandpass(ay, fs, respBand[0], respBand[1]);
  const azResp = bandpass(az, fs, respBand[0], respBand[1]);
  let sResp = differentialMagnitude3D(axResp, ayResp, azResp, fs);

  const axHeart = bandpass(ax, fs, heartBand[0], heartBand[1]);
  const ayHeart = bandpass(ay, fs, heartBand[0], heartBand[1]);
  const azHeart = bandpass(az, fs, heartBand[0], heartBand[1]);
  let sHeart = differentialMagnitude3D(axHeart, ayHeart, azHeart, fs);
  let diagnosticHeartX = differentialAxis(axHeart, fs);
  let diagnosticHeartY = differentialAxis(ayHeart, fs);
  let diagnosticHeartZ = differentialAxis(azHeart, fs);

  if (cfg.normalize === true) {
    sResp = zscore(sResp);
    sHeart = zscore(sHeart);
    diagnosticHeartX = zscore(diagnosticHeartX);
    diagnosticHeartY = zscore(diagnosticHeartY);
    diagnosticHeartZ = zscore(diagnosticHeartZ);
  }

  return {
    s_resp: sResp,
    s_heart: sHeart,
    diagnostic_heart_axes: {
      x: diagnosticHeartX,
      y: diagnosticHeartY,
      z: diagnosticHeartZ
    },
    s_sum: differentialMagnitude3D(ax, ay, az, fs),
    meta: {
      method: 'axis_differential_magnitude',
      formula: 'sqrt((dx/dt)^2 + (dy/dt)^2 + (dz/dt)^2)',
      resp: { band: respBand },
      heart: { band: heartBand }
    }
  };
}

/**
 * Build an independent rotation/motion reference from the gyroscope. Angular
 * velocity is not differentiated: doing so would amplify sensor noise and
 * make its spectrum incomparable as motion evidence.
 */
function buildGyroMotionProxy(gx, gy, gz, fs, cfg = {}) {
  const config = Object.assign({}, baseConfig, cfg);
  const band = Array.isArray(cfg.heartProxyBand)
    ? cfg.heartProxyBand
    : (config.heartProxyBand || [1, 4]);
  const x = new Float64Array(Array.from(gx || []));
  const y = new Float64Array(Array.from(gy || []));
  const z = new Float64Array(Array.from(gz || []));
  const n = Math.min(x.length, y.length, z.length);
  if (!(fs > 0) || n < 4) {
    return {
      signal: new Float64Array(n),
      meta: { method: 'gyro_bandpassed_magnitude', band }
    };
  }
  const fx = bandpass(x.subarray(0, n), fs, band[0], band[1]);
  const fy = bandpass(y.subarray(0, n), fs, band[0], band[1]);
  const fz = bandpass(z.subarray(0, n), fs, band[0], band[1]);
  const magnitude = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    magnitude[i] = Math.hypot(fx[i], fy[i], fz[i]);
  }
  return {
    signal: removeDC(magnitude),
    meta: {
      method: 'gyro_bandpassed_magnitude',
      formula: 'removeDC(sqrt(gx_band^2 + gy_band^2 + gz_band^2))',
      band
    }
  };
}

module.exports = { buildRespAndHeartProxies, buildGyroMotionProxy };
