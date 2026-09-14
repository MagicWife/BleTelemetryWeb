'use strict';

const RealtimeImuVitalsEstimator = require('./RealtimeImuVitalsEstimator');

module.exports = {
  RealtimeImuVitalsEstimator:
    RealtimeImuVitalsEstimator.RealtimeImuVitalsEstimator || RealtimeImuVitalsEstimator
};

module.exports.create = function create(options) {
  return new module.exports.RealtimeImuVitalsEstimator(options);
};
