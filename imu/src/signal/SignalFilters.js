'use strict';

const config = require('../../config');

function toFloat64Array(signal) {
  if (signal instanceof Float64Array) return new Float64Array(signal);
  return new Float64Array(Array.from(signal || []));
}

function mean(signal) {
  if (!signal || !signal.length) return 0;
  let sum = 0;
  for (let index = 0; index < signal.length; index++) sum += signal[index];
  return sum / signal.length;
}

function variance(signal) {
  if (!signal || signal.length < 2) return 0;
  const center = mean(signal);
  let sum = 0;
  for (let index = 0; index < signal.length; index++) {
    const difference = signal[index] - center;
    sum += difference * difference;
  }
  return sum / signal.length;
}

function removeDC(signal) {
  const output = toFloat64Array(signal);
  const center = mean(output);
  for (let index = 0; index < output.length; index++) output[index] -= center;
  return output;
}

function zscore(signal, epsilon = config.epsilon || 1e-10) {
  const output = toFloat64Array(signal);
  const center = mean(output);
  const deviation = Math.sqrt(variance(output));
  const scale = deviation > epsilon ? deviation : 1;
  for (let index = 0; index < output.length; index++) {
    output[index] = (output[index] - center) / scale;
  }
  return output;
}

function lowPass1(signal, sampleRateHz, cutoffHz) {
  const input = toFloat64Array(signal);
  if (!input.length || !(sampleRateHz > 0) || !(cutoffHz > 0)) return input;
  const dt = 1 / sampleRateHz;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  const output = new Float64Array(input.length);
  output[0] = input[0];
  for (let index = 1; index < input.length; index++) {
    output[index] = output[index - 1] + alpha * (input[index] - output[index - 1]);
  }
  return output;
}

function highPass1(signal, sampleRateHz, cutoffHz) {
  const input = toFloat64Array(signal);
  if (!input.length || !(sampleRateHz > 0) || !(cutoffHz > 0)) return input;
  const dt = 1 / sampleRateHz;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = rc / (rc + dt);
  const output = new Float64Array(input.length);
  for (let index = 1; index < input.length; index++) {
    output[index] = alpha * (output[index - 1] + input[index] - input[index - 1]);
  }
  return output;
}

// Forward-only band-pass. There is deliberately no zero-phase/filtfilt mode
// in the runtime package because it would make earlier results depend on
// samples that arrive later.
function bandpass(signal, sampleRateHz, lowCutHz, highCutHz) {
  let output = toFloat64Array(signal);
  const low = Math.min(lowCutHz, highCutHz);
  const high = Math.max(lowCutHz, highCutHz);
  if (!output.length || !(sampleRateHz > 0) || !(low > 0) || !(high > low)) return output;
  output = highPass1(output, sampleRateHz, low);
  output = highPass1(output, sampleRateHz, low);
  output = lowPass1(output, sampleRateHz, high);
  return lowPass1(output, sampleRateHz, high);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

module.exports = { removeDC, zscore, bandpass, clamp };
