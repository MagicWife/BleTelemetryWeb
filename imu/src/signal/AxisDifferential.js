'use strict';

/**
 * Differentiate each filtered acceleration axis and combine the three jerk
 * components with their Euclidean norm:
 *
 *   jerkMagnitude = sqrt((dx/dt)^2 + (dy/dt)^2 + (dz/dt)^2)
 *
 * A backward first difference is used. The first sample is zero because no
 * previous sample exists. Non-finite input samples are treated as zero.
 */
function differentialMagnitude3D(x, y, z, sampleRateHz) {
  const n = Math.min(x?.length || 0, y?.length || 0, z?.length || 0);
  const out = new Float64Array(n);
  if (n === 0 || !(sampleRateHz > 0)) return out;

  out[0] = 0;
  for (let i = 1; i < n; i++) {
    const x0 = Number.isFinite(x[i - 1]) ? x[i - 1] : 0;
    const y0 = Number.isFinite(y[i - 1]) ? y[i - 1] : 0;
    const z0 = Number.isFinite(z[i - 1]) ? z[i - 1] : 0;
    const x1 = Number.isFinite(x[i]) ? x[i] : 0;
    const y1 = Number.isFinite(y[i]) ? y[i] : 0;
    const z1 = Number.isFinite(z[i]) ? z[i] : 0;
    const dxdt = (x1 - x0) * sampleRateHz;
    const dydt = (y1 - y0) * sampleRateHz;
    const dzdt = (z1 - z0) * sampleRateHz;
    out[i] = Math.sqrt(dxdt * dxdt + dydt * dydt + dzdt * dzdt);
  }

  return out;
}

function differentialAxis(signal, sampleRateHz) {
  const source = new Float64Array(Array.from(signal || []));
  const out = new Float64Array(source.length);
  if (source.length === 0 || !(sampleRateHz > 0)) return out;
  for (let i = 1; i < source.length; i++) {
    const previous = Number.isFinite(source[i - 1]) ? source[i - 1] : 0;
    const current = Number.isFinite(source[i]) ? source[i] : 0;
    out[i] = (current - previous) * sampleRateHz;
  }
  return out;
}

module.exports = { differentialMagnitude3D, differentialAxis };
