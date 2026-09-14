'use strict';

/**
 * AttitudeSolver
 *
 * Convention:
 * - Quaternion q represents body -> world rotation.
 * - q is stored as { w, x, y, z }.
 * - Gravity in body frame can be obtained by rotating world gravity [0, 0, 1]
 *   from world to body with q^-1.
 *
 * Supported algorithms:
 * - mahony: cross-product error feedback with Kp / Ki
 * - madgwick: gradient-descent correction with beta
 */

class AttitudeSolver {
  constructor(options = {}) {
    this.algorithm = String(options.algorithm || 'mahony').toLowerCase();

    // Mahony gains
    this.kp = this._num(options.kp, 1.0);
    this.ki = this._num(options.ki, 0.0);

    // Madgwick gain
    this.beta = this._num(options.beta, 0.05);

    // Sampling / dt
    this.sampleRateHz = this._num(options.sampleRateHz, 50.0);
    this.defaultDt = this.sampleRateHz > 0 ? 1.0 / this.sampleRateHz : 0.02;
    this.clampDtMin = this._num(options.clampDtMin, 1e-4);
    this.clampDtMax = this._num(options.clampDtMax, 0.1);

    // Units
    this.accelUnit = String(options.accelUnit || 'mps2').toLowerCase(); // 'mps2' | 'g'
    this.gyroUnit = String(options.gyroUnit || 'rad/s').toLowerCase();   // 'rad/s' | 'deg/s'
    this.gravity = this._num(options.gravity, 9.80665);

    // Accelerometer confidence gating
    this.useAccConfidence = options.useAccConfidence !== false;
    this.accConfLow = this._num(options.accConfLow, 0.05);   // in g
    this.accConfHigh = this._num(options.accConfHigh, 0.15); // in g
    this.accConfMinForIntegral = this._num(options.accConfMinForIntegral, 0.5);

    // Safeguards
    this.eps = this._num(options.eps, 1e-12);
    this.integralLimit = this._num(options.integralLimit, 0.5);

    // Internal state
    this.reset(options.initialQuaternion);

    // Diagnostics
    this.lastAccNorm = 0;
    this.lastAccConfidence = 0;
    this.lastDt = this.defaultDt;
    this.lastError = { x: 0, y: 0, z: 0 };
  }

  reset(initialQuaternion) {
    if (initialQuaternion && this._isValidQuat(initialQuaternion)) {
      const q = this._normalizeQuat({
        w: this._num(initialQuaternion.w, 1.0),
        x: this._num(initialQuaternion.x, 0.0),
        y: this._num(initialQuaternion.y, 0.0),
        z: this._num(initialQuaternion.z, 0.0),
      });
      this.q = q;
    } else {
      this.q = { w: 1, x: 0, y: 0, z: 0 };
    }

    this.integral = { x: 0, y: 0, z: 0 };
    this.lastError = { x: 0, y: 0, z: 0 };
    this.lastAccNorm = 0;
    this.lastAccConfidence = 0;
    this.lastDt = this.defaultDt;
  }

  setAlgorithm(algorithm) {
    this.algorithm = String(algorithm || 'mahony').toLowerCase();
  }

  setQuaternion(q) {
    if (!this._isValidQuat(q)) return false;
    this.q = this._normalizeQuat({
      w: this._num(q.w, 1.0),
      x: this._num(q.x, 0.0),
      y: this._num(q.y, 0.0),
      z: this._num(q.z, 0.0),
    });
    return true;
  }

  getQuaternion() {
    return {
      w: this.q.w,
      x: this.q.x,
      y: this.q.y,
      z: this.q.z,
    };
  }

  getState() {
    const gBody = this.getGravityBody();
    return {
      quaternion: this.getQuaternion(),
      gravityBody: gBody,
      gravityWorld: this.getGravityWorld(),
      accNorm: this.lastAccNorm,
      accConfidence: this.lastAccConfidence,
      dt: this.lastDt,
      error: {
        x: this.lastError.x,
        y: this.lastError.y,
        z: this.lastError.z,
      },
      integral: {
        x: this.integral.x,
        y: this.integral.y,
        z: this.integral.z,
      },
      algorithm: this.algorithm,
    };
  }

  /**
   * Update orientation.
   *
   * Inputs:
   * - gx, gy, gz: angular rate
   * - ax, ay, az: accelerometer
   * - dt: seconds
   *
   * Returns:
   * - state object with quaternion and diagnostics
   */
  update(gx, gy, gz, ax, ay, az, dt) {
    const dti = this._clampDt(this._num(dt, this.defaultDt));
    this.lastDt = dti;

    let gyro = this._toRadPerSec(gx, gy, gz);
    let acc = this._toG(ax, ay, az);

    const accNorm = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    this.lastAccNorm = accNorm;

    const hasAcc = Number.isFinite(accNorm) && accNorm > this.eps;
    const accConfidence = hasAcc ? this._accConfidence(accNorm) : 0.0;
    this.lastAccConfidence = accConfidence;

    if (this.algorithm === 'madgwick') {
      this._updateMadgwick(gyro, acc, accConfidence, dti);
    } else {
      this._updateMahony(gyro, acc, accConfidence, dti);
    }

    return this.getState();
  }

  /**
   * Gravity vector in body frame, in g units.
   * At rest and level, this should be approximately [0, 0, 1].
   */
  getGravityBody() {
    return this._rotateWorldToBody({ x: 0, y: 0, z: 1 }, this.q);
  }

  /**
   * Gravity vector in world frame, in g units.
   * For the chosen convention, this is always [0, 0, 1].
   */
  getGravityWorld() {
    return { x: 0, y: 0, z: 1 };
  }

  /**
   * Optional helper: linear acceleration in body frame.
   * Input can be in m/s^2 or g, but the result is always in g.
   */
  removeGravity(ax, ay, az) {
    const acc = this._toG(ax, ay, az);
    const gBody = this.getGravityBody();
    return {
      x: acc.x - gBody.x,
      y: acc.y - gBody.y,
      z: acc.z - gBody.z,
    };
  }

  /**
   * Euler angles in radians.
   * roll  = rotation about X
   * pitch = rotation about Y
   * yaw   = rotation about Z
   */
  getEuler() {
    const q = this.q;
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    let sinp = 2 * (q.w * q.y - q.z * q.x);
    sinp = Math.max(-1, Math.min(1, sinp));
    const pitch = Math.asin(sinp);

    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return { roll, pitch, yaw };
  }

  // -------------------------
  // Mahony
  // -------------------------

  _updateMahony(gyro, acc, accConfidence, dt) {
    const q = this.q;

    let gx = gyro.x;
    let gy = gyro.y;
    let gz = gyro.z;

    if (accConfidence > 0 && Number.isFinite(acc.x) && Number.isFinite(acc.y) && Number.isFinite(acc.z)) {
      const an = this._normalizeVec(acc);
      if (an) {
        const gEst = this.getGravityBody();

        // Error is cross(measured, estimated)
        const ex = an.y * gEst.z - an.z * gEst.y;
        const ey = an.z * gEst.x - an.x * gEst.z;
        const ez = an.x * gEst.y - an.y * gEst.x;

        this.lastError = { x: ex, y: ey, z: ez };

        // Integral term only when accelerometer is trustworthy enough
        if (this.ki > 0 && accConfidence >= this.accConfMinForIntegral) {
          this.integral.x += ex * dt;
          this.integral.y += ey * dt;
          this.integral.z += ez * dt;

          this.integral.x = this._clamp(this.integral.x, -this.integralLimit, this.integralLimit);
          this.integral.y = this._clamp(this.integral.y, -this.integralLimit, this.integralLimit);
          this.integral.z = this._clamp(this.integral.z, -this.integralLimit, this.integralLimit);
        }

        gx += accConfidence * (this.kp * ex + this.ki * this.integral.x);
        gy += accConfidence * (this.kp * ey + this.ki * this.integral.y);
        gz += accConfidence * (this.kp * ez + this.ki * this.integral.z);
      }
    } else {
      this.lastError = { x: 0, y: 0, z: 0 };
    }

    this._integrateQuaternion(gx, gy, gz, dt);
  }

  // -------------------------
  // Madgwick
  // -------------------------

  _updateMadgwick(gyro, acc, accConfidence, dt) {
    let q1 = this.q.w;
    let q2 = this.q.x;
    let q3 = this.q.y;
    let q4 = this.q.z;

    let gx = gyro.x;
    let gy = gyro.y;
    let gz = gyro.z;

    const accNorm = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    if (!(Number.isFinite(accNorm) && accNorm > this.eps && accConfidence > 0)) {
      this.lastError = { x: 0, y: 0, z: 0 };
      this._integrateQuaternion(gx, gy, gz, dt);
      return;
    }

    const ax = acc.x / accNorm;
    const ay = acc.y / accNorm;
    const az = acc.z / accNorm;

    // Objective function f(q, a) for gravity alignment
    const f1 = 2 * (q2 * q4 - q1 * q3) - ax;
    const f2 = 2 * (q1 * q2 + q3 * q4) - ay;
    const f3 = 2 * (0.5 - q2 * q2 - q3 * q3) - az;

    // Jacobian transpose times f
    let s1 = (-2 * q3) * f1 + (2 * q2) * f2;
    let s2 = (2 * q4) * f1 + (2 * q1) * f2 - (4 * q2) * f3;
    let s3 = (-2 * q1) * f1 + (2 * q4) * f2 - (4 * q3) * f3;
    let s4 = (2 * q2) * f1 + (2 * q3) * f2;

    const sn = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3 + s4 * s4);
    if (sn > this.eps) {
      s1 /= sn;
      s2 /= sn;
      s3 /= sn;
      s4 /= sn;
    } else {
      s1 = 0;
      s2 = 0;
      s3 = 0;
      s4 = 0;
    }

    this.lastError = { x: f1, y: f2, z: f3 };

    // qDot = 0.5 * q ⊗ omega - beta * gradient
    const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz) - this.beta * s1;
    const qDot2 = 0.5 * ( q1 * gx + q3 * gz - q4 * gy) - this.beta * s2;
    const qDot3 = 0.5 * ( q1 * gy - q2 * gz + q4 * gx) - this.beta * s3;
    const qDot4 = 0.5 * ( q1 * gz + q2 * gy - q3 * gx) - this.beta * s4;

    q1 += qDot1 * dt;
    q2 += qDot2 * dt;
    q3 += qDot3 * dt;
    q4 += qDot4 * dt;

    this.q = this._normalizeQuat({ w: q1, x: q2, y: q3, z: q4 });
  }

  // -------------------------
  // Quaternion helpers
  // -------------------------

  _integrateQuaternion(gx, gy, gz, dt) {
    let q1 = this.q.w;
    let q2 = this.q.x;
    let q3 = this.q.y;
    let q4 = this.q.z;

    // qDot = 0.5 * q ⊗ omega
    const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz);
    const qDot2 = 0.5 * ( q1 * gx + q3 * gz - q4 * gy);
    const qDot3 = 0.5 * ( q1 * gy - q2 * gz + q4 * gx);
    const qDot4 = 0.5 * ( q1 * gz + q2 * gy - q3 * gx);

    q1 += qDot1 * dt;
    q2 += qDot2 * dt;
    q3 += qDot3 * dt;
    q4 += qDot4 * dt;

    this.q = this._normalizeQuat({ w: q1, x: q2, y: q3, z: q4 });
  }

  _rotateWorldToBody(v, qBodyToWorld) {
    const qc = { w: qBodyToWorld.w, x: -qBodyToWorld.x, y: -qBodyToWorld.y, z: -qBodyToWorld.z };
    return this._rotateByQuat(v, qc);
  }

  _rotateBodyToWorld(v, qBodyToWorld) {
    return this._rotateByQuat(v, qBodyToWorld);
  }

  _rotateByQuat(v, q) {
    const p = { w: 0, x: v.x, y: v.y, z: v.z };
    const qp = this._quatMul(q, p);
    const r = this._quatMul(qp, { w: q.w, x: -q.x, y: -q.y, z: -q.z });
    return { x: r.x, y: r.y, z: r.z };
  }

  _quatMul(a, b) {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
  }

  _normalizeQuat(q) {
    const n = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    if (!(Number.isFinite(n) && n > this.eps)) {
      return { w: 1, x: 0, y: 0, z: 0 };
    }
    return {
      w: q.w / n,
      x: q.x / n,
      y: q.y / n,
      z: q.z / n,
    };
  }

  _normalizeVec(v) {
    const n = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (!(Number.isFinite(n) && n > this.eps)) return null;
    return { x: v.x / n, y: v.y / n, z: v.z / n };
  }

  _accConfidence(accNormG) {
    const err = Math.abs(accNormG - 1.0);

    if (err <= this.accConfLow) return 1.0;
    if (err >= this.accConfHigh) return 0.0;

    return (this.accConfHigh - err) / (this.accConfHigh - this.accConfLow);
  }

  _clampDt(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return this.defaultDt;
    return this._clamp(dt, this.clampDtMin, this.clampDtMax);
  }

  _toG(ax, ay, az) {
    if (this.accelUnit === 'g') {
      return { x: ax, y: ay, z: az };
    }

    // Default: m/s^2 -> g
    const s = 1.0 / this.gravity;
    return { x: ax * s, y: ay * s, z: az * s };
  }

  _toRadPerSec(gx, gy, gz) {
    if (this.gyroUnit === 'deg/s' || this.gyroUnit === 'degs' || this.gyroUnit === 'deg') {
      const s = Math.PI / 180.0;
      return { x: gx * s, y: gy * s, z: gz * s };
    }
    return { x: gx, y: gy, z: gz };
  }

  _isValidQuat(q) {
    return q && Number.isFinite(q.w) && Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z);
  }

  _num(v, fallback) {
    return Number.isFinite(v) ? v : fallback;
  }

  _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}

module.exports = AttitudeSolver;
module.exports.AttitudeSolver = AttitudeSolver;