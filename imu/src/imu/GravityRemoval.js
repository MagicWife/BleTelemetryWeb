/**
 * GravityRemoval.js
 * 
 * Purpose:
 * - Use AttitudeSolver quaternion to remove gravity from raw accelerometer
 * - Return linear acceleration in body (sensor) frame and world frame
 * - Handle unit conversions (g ↔ m/s^2)
 * - Estimate sampling rate if not provided
 *
 * Inputs:
 *   samples: [ { time_s, ax, ay, az, gx, gy, gz }, ... ]
 *   solver: an instance of AttitudeSolver (必须有 update()、getQuaternion()，最好有 getGravityBody()/getState())
 *   cfg: optional config override (defaults to ../../config)
 *
 * Outputs:
 *   {
 *     time_s: Float64Array,
 *     fs: number,
 *     ax: Float64Array, ay: Float64Array, az: Float64Array,              // raw accel (m/s^2)
 *     gx: Float64Array, gy: Float64Array, gz: Float64Array,              // raw gyro (deg/s)
 *     linAx: Float64Array, linAy: Float64Array, linAz: Float64Array,     // linear accel (body, m/s^2)
 *     linAxWorld: Float64Array, linAyWorld: Float64Array, linAzWorld: Float64Array, // linear accel (world, m/s^2)
 *     // 诊断输出：
 *     gravityBodyX: Float64Array,
 *     gravityBodyY: Float64Array,
 *     gravityBodyZ: Float64Array,
 *     gravityResidual: Float64Array,
 *     accNorm: Float64Array,
 *     accConfidence: Float64Array,
 *     attitudeErrorX: Float64Array,
 *     attitudeErrorY: Float64Array,
 *     attitudeErrorZ: Float64Array
 *   }
 */

'use strict';

const defaultConfig = require('../../config');

/**
 * Estimate sampling rate from time_s array (median dt)
 */
function estimateFs(time_s, fsDefault = 100) {
  const n = time_s.length;
  if (n < 2) return fsDefault;
  const dts = [];
  for (let i = 1; i < n; i++) {
    const dt = time_s[i] - time_s[i - 1];
    if (dt > 0 && isFinite(dt)) dts.push(dt);
  }
  if (dts.length === 0) return fsDefault;
  dts.sort((a, b) => a - b);
  const mid = Math.floor(dts.length / 2);
  const medianDt = dts.length % 2 ? dts[mid] : 0.5 * (dts[mid - 1] + dts[mid]);
  const fs = medianDt > 0 ? (1.0 / medianDt) : fsDefault;
  return fs;
}

/**
 * Quaternion utilities
 */
function qConjugate(q) {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

function qMultiply(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  };
}

/**
 * Rotate a vector by quaternion: v' = q ⊗ v ⊗ q*
 * Vector is treated as pure quaternion (0, vx, vy, vz)
 */
function rotateVectorByQuaternion(v, q) {
  const vq = { w: 0, x: v[0], y: v[1], z: v[2] };
  const qConj = qConjugate(q);
  const t = qMultiply(q, vq);
  const r = qMultiply(t, qConj);
  return [r.x, r.y, r.z];
}

/**
 * Remove gravity given samples and attitude solver.
 * 
 * Options inside cfg:
 * - accelUnit: 'mps2' | 'g'          (default 'mps2')
 * - gyroUnit: 'deg/s' | 'rad/s'      (default 'deg/s')
 * - gravity: 9.81                     (m/s^2)
 * - fsDefault: number                 (for time_s missing)
 * - quaternionConvention: 'worldToBody' | 'bodyToWorld'
 *     Default 'bodyToWorld' (与上面 AttitudeSolver 推荐配置一致)：
 *       q: body → world
 *       gravity_body = rotate([0,0,g], q_conj)
 *       world linear accel = rotate(bodyLinear, q)
 *     如果使用 'worldToBody'：
 *       q: world → body
 *       gravity_body = rotate([0,0,g], q)
 *       world linear accel = rotate(bodyLinear, q_conj)
 */
function removeGravity(samples, solver, cfg = {}) {
  const config = Object.assign({}, defaultConfig, cfg);

  const gravity = config.gravity || 9.81;
  const accelUnit = (config.accelUnit || 'mps2').toLowerCase();
  const gyroUnit = (config.gyroUnit || 'deg/s').toLowerCase();
  const quatConv = (config.quaternionConvention || 'bodyToWorld');

  const fsDefault = config.fsDefault || 100;

  const n = samples.length;
  const time_s = new Float64Array(n);
  const ax_raw_mps2 = new Float64Array(n);
  const ay_raw_mps2 = new Float64Array(n);
  const az_raw_mps2 = new Float64Array(n);
  const gx_deg = new Float64Array(n);
  const gy_deg = new Float64Array(n);
  const gz_deg = new Float64Array(n);

  // Prepare outputs: linear acceleration (body, world)
  const linAx = new Float64Array(n);
  const linAy = new Float64Array(n);
  const linAz = new Float64Array(n);

  const linAxWorld = new Float64Array(n);
  const linAyWorld = new Float64Array(n);
  const linAzWorld = new Float64Array(n);

  // Diagnostics
  const gravityBodyX = new Float64Array(n);
  const gravityBodyY = new Float64Array(n);
  const gravityBodyZ = new Float64Array(n);
  const gravityResidual = new Float64Array(n);

  const accNorm = new Float64Array(n);
  const accConfidence = new Float64Array(n);
  const attitudeErrorX = new Float64Array(n);
  const attitudeErrorY = new Float64Array(n);
  const attitudeErrorZ = new Float64Array(n);

  // Populate raw arrays with unit conversion
  for (let i = 0; i < n; i++) {
    const s = samples[i] || {};
    if (typeof s.time_s === 'number') {
      time_s[i] = s.time_s;
    } else if (i > 0) {
      time_s[i] = time_s[i - 1] + 1.0 / fsDefault;
    } else {
      time_s[i] = 0;
    }

    // accel → m/s^2
    if (accelUnit === 'g') {
      ax_raw_mps2[i] = (s.ax || 0) * gravity;
      ay_raw_mps2[i] = (s.ay || 0) * gravity;
      az_raw_mps2[i] = (s.az || 0) * gravity;
    } else {
      ax_raw_mps2[i] = s.ax || 0;
      ay_raw_mps2[i] = s.ay || 0;
      az_raw_mps2[i] = s.az || 0;
    }

    // gyro → deg/s (交给 AttitudeSolver 再转成 rad/s)
    if (gyroUnit.startsWith('rad')) {
      const r2d = 180 / Math.PI;
      gx_deg[i] = (s.gx || 0) * r2d;
      gy_deg[i] = (s.gy || 0) * r2d;
      gz_deg[i] = (s.gz || 0) * r2d;
    } else {
      gx_deg[i] = s.gx || 0;
      gy_deg[i] = s.gy || 0;
      gz_deg[i] = s.gz || 0;
    }
  }

  // Estimate sampling rate (median dt)
  const fs = estimateFs(time_s, fsDefault);
  if (typeof solver.setSampleRate === 'function') {
    solver.setSampleRate(fs);
  }

  // Feed samples into solver and remove gravity
  for (let i = 0; i < n; i++) {
    const ax = ax_raw_mps2[i];
    const ay = ay_raw_mps2[i];
    const az = az_raw_mps2[i];

    const gx = gx_deg[i];
    const gy = gy_deg[i];
    const gz = gz_deg[i];

    // 真实 dt：首样本用 1/fsDefault 或 1/fs
    let dt;
    if (i === 0) {
      dt = 1.0 / fs;
    } else {
      dt = time_s[i] - time_s[i - 1];
      if (!isFinite(dt) || dt <= 0) {
        dt = 1.0 / fs;
      }
    }

    // 直接传 m/s^2 + deg/s 给 AttitudeSolver，让它内部处理单位和 gating
    solver.update(gx, gy, gz, ax, ay, az, dt);

    // 取姿态和诊断信息（尽量使用 getState，如果不可用就 fallback）
    let state = null;
    if (typeof solver.getState === 'function') {
      state = solver.getState();
    }

    let q = null;
    let gBodyG = null; // in g
    let accNormG = NaN;
    let accConf = NaN;
    let errX = NaN;
    let errY = NaN;
    let errZ = NaN;

    if (state) {
      q = state.quaternion;
      const gBody = state.gravityBody || { x: 0, y: 0, z: 1 };
      gBodyG = gBody;
      accNormG = state.accNorm;
      accConf = state.accConfidence;
      if (state.error) {
        errX = state.error.x;
        errY = state.error.y;
        errZ = state.error.z;
      }
    } else {
      // fallback：手动计算 gBody (以 g 为单位)
      q = solver.getQuaternion();
      if (quatConv === 'bodyToWorld') {
        const qConj = qConjugate(q);
        const gBodyArr = rotateVectorByQuaternion([0, 0, 1], qConj);
        gBodyG = { x: gBodyArr[0], y: gBodyArr[1], z: gBodyArr[2] };
      } else {
        const gBodyArr = rotateVectorByQuaternion([0, 0, 1], q);
        gBodyG = { x: gBodyArr[0], y: gBodyArr[1], z: gBodyArr[2] };
      }
      // 估计 accNorm、confidence
      accNormG = Math.sqrt(
        (ax / gravity) * (ax / gravity) +
        (ay / gravity) * (ay / gravity) +
        (az / gravity) * (az / gravity)
      );
      accConf = NaN; // 没有 AttitudeSolver 内部 gating 信息，只能后续单独计算
    }

    // 重力估计从 g → m/s^2
    const gBx = gBodyG.x * gravity;
    const gBy = gBodyG.y * gravity;
    const gBz = gBodyG.z * gravity;

    gravityBodyX[i] = gBx;
    gravityBodyY[i] = gBy;
    gravityBodyZ[i] = gBz;

    accNorm[i] = accNormG;
    accConfidence[i] = accConf;
    attitudeErrorX[i] = errX;
    attitudeErrorY[i] = errY;
    attitudeErrorZ[i] = errZ;

    // Linear accel in body frame (m/s^2)
    const linBx = ax - gBx;
    const linBy = ay - gBy;
    const linBz = az - gBz;

    linAx[i] = linBx;
    linAy[i] = linBy;
    linAz[i] = linBz;

    // 重力残差（如果想要理想情况下为 0，可以用 raw - gravity 的 norm）
    gravityResidual[i] = Math.sqrt(
      (ax - gBx) * (ax - gBx) +
      (ay - gBy) * (ay - gBy) +
      (az - gBz) * (az - gBz)
    );

    // Linear accel in world frame
    let linWorld;
    if (quatConv === 'bodyToWorld') {
      // q: body -> world
      linWorld = rotateVectorByQuaternion([linBx, linBy, linBz], q);
    } else {
      // q: world -> body
      const qConj = qConjugate(q);
      linWorld = rotateVectorByQuaternion([linBx, linBy, linBz], qConj);
    }

    linAxWorld[i] = linWorld[0];
    linAyWorld[i] = linWorld[1];
    linAzWorld[i] = linWorld[2];
  }

  return {
    time_s,
    fs,
    ax: ax_raw_mps2,
    ay: ay_raw_mps2,
    az: az_raw_mps2,
    gx: gx_deg,
    gy: gy_deg,
    gz: gz_deg,
    linAx,
    linAy,
    linAz,
    linAxWorld,
    linAyWorld,
    linAzWorld,
    gravityBodyX,
    gravityBodyY,
    gravityBodyZ,
    gravityResidual,
    accNorm,
    accConfidence,
    attitudeErrorX,
    attitudeErrorY,
    attitudeErrorZ
  };
}

module.exports = { removeGravity };
