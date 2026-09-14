'use strict';

function nextPow2(value) {
  let n = Math.max(1, Math.ceil(Number(value) || 1));
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fftComplex(re, im) {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) {
    throw new Error('FFT length must be a power of two');
  }

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wLenRe = Math.cos(angle);
    const wLenIm = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let offset = 0; offset < half; offset++) {
        const even = start + offset;
        const odd = even + half;
        const oddRe = re[odd] * wRe - im[odd] * wIm;
        const oddIm = re[odd] * wIm + im[odd] * wRe;
        const evenRe = re[even];
        const evenIm = im[even];
        re[even] = evenRe + oddRe;
        im[even] = evenIm + oddIm;
        re[odd] = evenRe - oddRe;
        im[odd] = evenIm - oddIm;
        const nextWRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextWRe;
      }
    }
  }
}

/**
 * Full-window Hann periodogram.
 *
 * Every available sample participates in one FFT. Zero-padding to the next
 * power of two makes the frequency grid denser but does not increase the
 * physical resolution set by the observation duration.
 */
function periodogramPSD(signal, sampleRateHz, options = {}) {
  const source = new Float64Array(Array.from(signal || []));
  const n = source.length;
  if (!(sampleRateHz > 0) || n < 2) {
    return {
      psd: new Float64Array(0),
      freqs: new Float64Array(0),
      fftLength: 0,
      sampleCount: n,
      frequencyResolutionHz: NaN,
      physicalResolutionHz: NaN
    };
  }

  const useHann = options.window !== 'none';
  const fftLength = options.fftLength
    ? nextPow2(Math.max(n, options.fftLength))
    : nextPow2(n);
  const re = new Float64Array(fftLength);
  const im = new Float64Array(fftLength);
  let windowEnergy = 0;

  for (let i = 0; i < n; i++) {
    const weight = useHann && n > 1
      ? 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)))
      : 1;
    const value = Number.isFinite(source[i]) ? source[i] : 0;
    re[i] = value * weight;
    windowEnergy += weight * weight;
  }

  fftComplex(re, im);

  const bins = fftLength >> 1;
  const psd = new Float64Array(bins);
  const freqs = new Float64Array(bins);
  const scale = sampleRateHz * Math.max(windowEnergy, 1e-12);
  const df = sampleRateHz / fftLength;
  for (let i = 0; i < bins; i++) {
    const oneSided = i === 0 ? 1 : 2;
    psd[i] = oneSided * (re[i] * re[i] + im[i] * im[i]) / scale;
    freqs[i] = i * df;
  }

  return {
    psd,
    freqs,
    fftLength,
    sampleCount: n,
    frequencyResolutionHz: df,
    physicalResolutionHz: sampleRateHz / n
  };
}

/**
 * Magnitude-squared coherence estimated from multiple overlapping Hann
 * subsegments. A single FFT cannot estimate coherence (it degenerates to 1),
 * hence this routine is deliberately separate from the full-window HR
 * periodogram.
 */
function magnitudeSquaredCoherence(signalA, signalB, sampleRateHz, options = {}) {
  const a = new Float64Array(Array.from(signalA || []));
  const b = new Float64Array(Array.from(signalB || []));
  const n = Math.min(a.length, b.length);
  const requested = Math.round((options.segmentSec || 5) * sampleRateHz);
  const segmentLength = Math.min(n, Math.max(8, requested));
  const overlap = Math.min(0.9, Math.max(0, options.overlap ?? 0.5));
  const step = Math.max(1, Math.round(segmentLength * (1 - overlap)));
  const fftLength = nextPow2(segmentLength);
  const bins = fftLength >> 1;
  const sxx = new Float64Array(bins);
  const syy = new Float64Array(bins);
  const sxyRe = new Float64Array(bins);
  const sxyIm = new Float64Array(bins);
  let segmentCount = 0;

  if (!(sampleRateHz > 0) || segmentLength < 8 || n < segmentLength) {
    return {
      coherence: new Float64Array(0),
      freqs: new Float64Array(0),
      segmentCount: 0,
      segmentLength,
      fftLength: 0
    };
  }

  for (let start = 0; start + segmentLength <= n; start += step) {
    const ar = new Float64Array(fftLength);
    const ai = new Float64Array(fftLength);
    const br = new Float64Array(fftLength);
    const bi = new Float64Array(fftLength);
    for (let i = 0; i < segmentLength; i++) {
      const weight = segmentLength > 1
        ? 0.5 * (1 - Math.cos(2 * Math.PI * i / (segmentLength - 1)))
        : 1;
      ar[i] = (Number.isFinite(a[start + i]) ? a[start + i] : 0) * weight;
      br[i] = (Number.isFinite(b[start + i]) ? b[start + i] : 0) * weight;
    }
    fftComplex(ar, ai);
    fftComplex(br, bi);
    for (let k = 0; k < bins; k++) {
      sxx[k] += ar[k] * ar[k] + ai[k] * ai[k];
      syy[k] += br[k] * br[k] + bi[k] * bi[k];
      sxyRe[k] += ar[k] * br[k] + ai[k] * bi[k];
      sxyIm[k] += ai[k] * br[k] - ar[k] * bi[k];
    }
    segmentCount++;
  }

  const coherence = new Float64Array(bins);
  const freqs = new Float64Array(bins);
  const df = sampleRateHz / fftLength;
  for (let k = 0; k < bins; k++) {
    const numerator = sxyRe[k] * sxyRe[k] + sxyIm[k] * sxyIm[k];
    const denominator = sxx[k] * syy[k];
    coherence[k] = denominator > 1e-24
      ? Math.min(1, Math.max(0, numerator / denominator))
      : 0;
    freqs[k] = k * df;
  }
  return { coherence, freqs, segmentCount, segmentLength, fftLength };
}

module.exports = {
  nextPow2,
  periodogramPSD,
  magnitudeSquaredCoherence
};
