const SERVICE_HINT = "fff0";
const CHAR_NOTIFY = "fff1";
const CHAR_WRITE = "fff2";
const BATTERY_FULL_VOLTAGE = 3.7;
const TELEMETRY_SYNC_0 = 0xA5;
const TELEMETRY_SYNC_1 = 0x5A;
const TELEMETRY_VERSION = 0x01;
const TELEMETRY_FRAME_LENGTH = 46;
const DISPLAY_INTERVAL_MS = 40; // 25 FPS

let bleDevice = null;
let gattServer = null;
let notifyChar = null;
let writeChar = null;
let rxBuffer = new Uint8Array(0);
let frames = [];
let latestTele = null;
let latestReceiveText = "-";
let totalFrameCount = 0;
let lastRenderedSequence = null;
let lastDisplayRender = 0;
let isWritingTcycle = false;

let isRecording = false;
let recordBuffer = [];

const dom = {
  btState: document.getElementById("btState"),
  deviceName: document.getElementById("deviceName"),
  deviceId: document.getElementById("deviceId"),
  notifyState: document.getElementById("notifyState"),
  sessionTime: document.getElementById("sessionTime"),
  frameCount: document.getElementById("frameCount"),
  lastReceive: document.getElementById("lastReceive"),
  heroStatusText: document.getElementById("heroStatusText"),
  heroDot: document.getElementById("heroDot"),
  frames: document.getElementById("frames"),
  tcycleInput: document.getElementById("tcycleInput"),
  btnSetTcycle: document.getElementById("btnSetTcycle"),
  hudRoll: document.getElementById("hudRoll"),
  hudPitch: document.getElementById("hudPitch"),
  hudYaw: document.getElementById("hudYaw"),
  aircraft3d: document.getElementById("aircraft3d"),
  tele: {
    mac: document.getElementById("tele-mac"),
    temp: document.getElementById("tele-temp"),
    roll: document.getElementById("tele-roll"),
    pitch: document.getElementById("tele-pitch"),
    yaw: document.getElementById("tele-yaw"),
    acc: document.getElementById("tele-acc"),
    gyro: document.getElementById("tele-gyro"),
    v1: document.getElementById("tele-v1"),
    battery: document.getElementById("tele-battery"),
    batteryTrack: document.getElementById("battery-track"),
    batteryFill: document.getElementById("battery-fill"),
    mag: document.getElementById("tele-mag"),
    uptime: document.getElementById("tele-uptime"),
  },
};

document.getElementById("btnConnect").addEventListener("click", connectBle);
document.getElementById("btnDisconnect").addEventListener("click", disconnectBle);
dom.btnSetTcycle.addEventListener("click", sendTcycle);
document.getElementById("btnRecord").addEventListener("click", toggleRecord);

function setState(kind, text) {
  dom.btState.textContent = text;
  dom.heroStatusText.textContent = text;
  dom.btState.className = "pill " + (kind === "ok" ? "pill-ok" : kind === "danger" ? "pill-danger" : "pill-warn");
  dom.heroDot.style.background = kind === "ok" ? "var(--green)" : kind === "danger" ? "var(--red)" : "var(--amber)";
  dom.heroDot.style.boxShadow = `0 0 12px ${kind === "ok" ? "var(--green)" : kind === "danger" ? "var(--red)" : "var(--amber)"}`;
}

function fmtNow() {
  return new Date().toLocaleString();
}

async function connectBle() {
  if (!navigator.bluetooth) {
    alert("当前浏览器不支持 Web Bluetooth，请使用 Chrome / Edge。");
    return;
  }
  try {
    setState("warn", "请求设备中...");
    bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [0xfff0]
    });
    bleDevice.addEventListener("gattserverdisconnected", onDisconnected);
    gattServer = await bleDevice.gatt.connect();

    const services = await gattServer.getPrimaryServices();
    let targetService = null;
    for (const s of services) {
      const uuid = (s.uuid || "").toLowerCase();
      if (uuid.includes(SERVICE_HINT)) {
        targetService = s;
        break;
      }
    }
    if (!targetService) throw new Error("未找到 FFF0 service");

    const chars = await targetService.getCharacteristics();
    notifyChar = null;
    writeChar = null;
    for (const ch of chars) {
      const uuid = (ch.uuid || "").toLowerCase();
      if (uuid.includes(CHAR_NOTIFY)) notifyChar = ch;
      if (uuid.includes(CHAR_WRITE)) writeChar = ch;
    }
    if (!notifyChar) throw new Error("未找到 FFF1 notify characteristic");

    notifyChar.addEventListener("characteristicvaluechanged", handleNotify);
    await notifyChar.startNotifications();

    dom.deviceName.textContent = bleDevice.name || "Unknown";
    dom.deviceId.textContent = bleDevice.id || "(opaque id)";
    dom.notifyState.textContent = "on";
    dom.sessionTime.textContent = fmtNow();
    setState("ok", "已连接");
  } catch (err) {
    console.error(err);
    setState("danger", "连接失败");
    alert(err.message || String(err));
  }
}

function onDisconnected() {
  dom.notifyState.textContent = "off";
  setState("warn", "已断开");
  notifyChar = null;
  writeChar = null;
  gattServer = null;
  frames = [];
  latestTele = null;
  latestReceiveText = "-";
  totalFrameCount = 0;
  lastRenderedSequence = null;
  lastDisplayRender = 0;
  rxBuffer = new Uint8Array(0);
  dom.frameCount.textContent = "0";
  dom.lastReceive.textContent = "-";
  renderFrames();
  clearWaveCharts();
  if (isRecording) stopRecord();
}

function toggleRecord() {
  if (!isRecording) {
    isRecording = true;
    recordBuffer = [];
    const btn = document.getElementById("btnRecord");
    btn.textContent = "停止记录";
    btn.style.background = "rgba(255,123,136,.25)";
    btn.style.border = "1px solid rgba(255,123,136,.4)";
  } else {
    stopRecord();
  }
}

function stopRecord() {
  isRecording = false;
  const btn = document.getElementById("btnRecord");
  btn.textContent = "开始记录";
  btn.style.background = "";
  btn.style.border = "";

  if (!recordBuffer.length) return;
  const header = [
    "receive_time_iso", "raw_frame_hex", "protocol_version", "frame_length",
    "sequence", "mac", "tmp_c", "acc_x_mps2", "acc_y_mps2", "acc_z_mps2",
    "gyro_x_rads", "gyro_y_rads", "gyro_z_rads", "roll_deg", "pitch_deg",
    "yaw_deg", "battery_v", "mag_x_gauss", "mag_y_gauss", "mag_z_gauss",
    "uptime_ms", "crc16"
  ].join(",");
  const content = `\uFEFF${[header, ...recordBuffer].join("\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ble_record_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function disconnectBle() {
  try {
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
  } catch (err) {
    console.error(err);
  }
}

function handleNotify(event) {
  const value = event.target.value;
  const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  appendTelemetryBytes(chunk);
}

function appendTelemetryBytes(chunk) {
  if (!chunk.length) return;

  const combined = new Uint8Array(rxBuffer.length + chunk.length);
  combined.set(rxBuffer);
  combined.set(chunk, rxBuffer.length);
  rxBuffer = combined;

  while (rxBuffer.length >= 4) {
    let syncIndex = -1;
    for (let i = 0; i < rxBuffer.length - 1; i++) {
      if (rxBuffer[i] === TELEMETRY_SYNC_0 && rxBuffer[i + 1] === TELEMETRY_SYNC_1) {
        syncIndex = i;
        break;
      }
    }

    if (syncIndex < 0) {
      rxBuffer = rxBuffer[rxBuffer.length - 1] === TELEMETRY_SYNC_0
        ? rxBuffer.slice(-1)
        : new Uint8Array(0);
      return;
    }
    if (syncIndex > 0) rxBuffer = rxBuffer.slice(syncIndex);
    if (rxBuffer.length < 4) return;

    const version = rxBuffer[2];
    const frameLength = rxBuffer[3];
    if (version !== TELEMETRY_VERSION || frameLength !== TELEMETRY_FRAME_LENGTH) {
      rxBuffer = rxBuffer.slice(1);
      continue;
    }
    if (rxBuffer.length < frameLength) return;

    const frame = rxBuffer.slice(0, frameLength);
    const expectedCrc = frame[frameLength - 2] | (frame[frameLength - 1] << 8);
    const actualCrc = crc16Ccitt(frame.subarray(0, frameLength - 2));
    if (expectedCrc !== actualCrc) {
      console.warn("忽略 CRC16 校验失败的遥测帧");
      rxBuffer = rxBuffer.slice(1);
      continue;
    }

    rxBuffer = rxBuffer.slice(frameLength);
    const tele = parseTelemetryFrame(frame);
    if (tele) acceptTelemetryFrame(tele);
  }
}

function crc16Ccitt(bytes) {
  let crc = 0xFFFF;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc;
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function parseTelemetryFrame(frame) {
  if (frame.length !== TELEMETRY_FRAME_LENGTH) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const scaleI16 = (offset, scale) => view.getInt16(offset, true) / scale;
  const mac = Array.from(frame.subarray(6, 12), byte => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const batteryVoltage = view.getUint16(32, true) / 1000;

  return {
    receiveTimeIso: new Date().toISOString(),
    rawHex: bytesToHex(frame),
    version: frame[2],
    frameLength: frame[3],
    sequence: view.getUint16(4, true),
    mac,
    tmp: scaleI16(12, 100),
    ax: scaleI16(14, 100), ay: scaleI16(16, 100), az: scaleI16(18, 100),
    gx: scaleI16(20, 100), gy: scaleI16(22, 100), gz: scaleI16(24, 100),
    roll: scaleI16(26, 100), pitch: scaleI16(28, 100), yaw: scaleI16(30, 100),
    v1: batteryVoltage,
    mx: scaleI16(34, 1000), my: scaleI16(36, 1000), mz: scaleI16(38, 1000),
    battery: voltageToBatteryPercent(batteryVoltage),
    ms: view.getUint32(40, true),
    crc16: view.getUint16(44, true)
  };
}

function telemetryToRecordLine(tele) {
  return [
    tele.receiveTimeIso, tele.rawHex, tele.version, tele.frameLength, tele.sequence, tele.mac,
    tele.tmp.toFixed(2), tele.ax.toFixed(2), tele.ay.toFixed(2), tele.az.toFixed(2),
    tele.gx.toFixed(2), tele.gy.toFixed(2), tele.gz.toFixed(2), tele.roll.toFixed(2),
    tele.pitch.toFixed(2), tele.yaw.toFixed(2), tele.v1.toFixed(3), tele.mx.toFixed(3),
    tele.my.toFixed(3), tele.mz.toFixed(3), tele.ms,
    `0x${tele.crc16.toString(16).padStart(4, "0").toUpperCase()}`
  ].map(csvEscape).join(",");
}

function acceptTelemetryFrame(tele) {
  latestTele = tele;
  latestReceiveText = fmtNow();
  totalFrameCount += 1;

  if (isRecording) {
    recordBuffer.push(telemetryToRecordLine(tele));
  }
}

function voltageToBatteryPercent(voltage) {
  return Math.min(100, Math.max(0, voltage / BATTERY_FULL_VOLTAGE * 100));
}

function renderTelemetry(tele) {
  dom.tele.mac.textContent = tele.mac;
  dom.tele.temp.textContent = `${tele.tmp.toFixed(2)} °C`;
  dom.tele.roll.textContent = `${tele.roll.toFixed(2)}°`;
  dom.tele.pitch.textContent = `${tele.pitch.toFixed(2)}°`;
  dom.tele.yaw.textContent = `${tele.yaw.toFixed(2)}°`;
  dom.tele.acc.textContent = `${tele.ax.toFixed(2)} / ${tele.ay.toFixed(2)} / ${tele.az.toFixed(2)}`;
  dom.tele.gyro.textContent = `${tele.gx.toFixed(2)} / ${tele.gy.toFixed(2)} / ${tele.gz.toFixed(2)}`;
  dom.tele.v1.textContent = `${tele.v1.toFixed(3)} V`;
  const batteryPercent = tele.battery;
  dom.tele.battery.textContent = `${tele.battery.toFixed(1)} %`;
  dom.tele.batteryTrack.setAttribute("aria-valuenow", tele.battery.toFixed(1));
  dom.tele.batteryFill.style.width = `${batteryPercent}%`;
  dom.tele.batteryFill.style.background = batteryPercent <= 20
    ? "var(--red)"
    : batteryPercent <= 50
      ? "var(--amber)"
      : "var(--green)";
  dom.tele.mag.textContent = `${tele.mx.toFixed(3)} / ${tele.my.toFixed(3)} / ${tele.mz.toFixed(3)} G`;
  dom.tele.uptime.textContent = `${tele.ms} ms`;
  dom.hudRoll.textContent = `${tele.roll.toFixed(1)}°`;
  dom.hudPitch.textContent = `${tele.pitch.toFixed(1)}°`;
  dom.hudYaw.textContent = `${tele.yaw.toFixed(1)}°`;
}

// ===== Wave Charts =====
const WAVE_WINDOW_MS = 5000;
const waveBuffer = [];
let lastChartRender = 0;
const CHART_RENDER_INTERVAL = 100;
const waveCharts = {};

function initWaveCharts() {
  const makeCfg = (label, color) => ({
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          ticks: { color: '#96aac7', font: { size: 10 }, maxTicksLimit: 4 },
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
  waveCharts.ax = new Chart(document.getElementById('chartAx'), makeCfg('AX', '#6aa9ff'));
  waveCharts.ay = new Chart(document.getElementById('chartAy'), makeCfg('AY', '#37d29f'));
  waveCharts.az = new Chart(document.getElementById('chartAz'), makeCfg('AZ', '#ffbe5c'));
  waveCharts.tmp = new Chart(document.getElementById('chartTemp'), makeCfg('Temperature', '#56c7ff'));
  waveCharts.mx = new Chart(document.getElementById('chartMx'), makeCfg('Magnetic X', '#4dd0e1'));
  waveCharts.my = new Chart(document.getElementById('chartMy'), makeCfg('Magnetic Y', '#f48fb1'));
  waveCharts.mz = new Chart(document.getElementById('chartMz'), makeCfg('Magnetic Z', '#dce775'));
}

function pushWaveSample(tele) {
  const now = Date.now();
  waveBuffer.push({
    t: now,
    ax: tele.ax || 0,
    ay: tele.ay || 0,
    az: tele.az || 0,
    tmp: tele.tmp || 0,
    mx: tele.mx || 0,
    my: tele.my || 0,
    mz: tele.mz || 0,
  });
  const cutoff = now - WAVE_WINDOW_MS;
  while (waveBuffer.length && waveBuffer[0].t < cutoff) waveBuffer.shift();

  if (now - lastChartRender < CHART_RENDER_INTERVAL) return;
  lastChartRender = now;
  renderWaveCharts();
}

function renderWaveCharts() {
  for (const key of ['ax', 'ay', 'az', 'tmp', 'mx', 'my', 'mz']) {
    const ch = waveCharts[key];
    ch.data.labels = waveBuffer.map(() => '');
    ch.data.datasets[0].data = waveBuffer.map(d => d[key]);
    ch.update('none');
  }
}

function clearWaveCharts() {
  waveBuffer.length = 0;
  lastChartRender = 0;
  for (const ch of Object.values(waveCharts)) {
    ch.data.labels = [];
    ch.data.datasets[0].data = [];
    ch.update('none');
  }
}

function renderFrames() {
  dom.frames.innerHTML = "";
  if (!frames.length) {
    const empty = document.createElement("div");
    empty.className = "frame-item";
    empty.textContent = "暂无帧数据";
    dom.frames.appendChild(empty);
    return;
  }
  for (const f of frames) {
    const div = document.createElement("div");
    div.className = "frame-item";
    div.textContent = f;
    dom.frames.appendChild(div);
  }
}

function renderDisplayFrame(timestamp) {
  requestAnimationFrame(renderDisplayFrame);
  if (!latestTele || timestamp - lastDisplayRender < DISPLAY_INTERVAL_MS) return;

  lastDisplayRender = timestamp;
  const tele = latestTele;

  renderTelemetry(tele);
  pushWaveSample(tele);
  updateAircraftAttitude(tele);
  dom.frameCount.textContent = String(totalFrameCount);
  dom.lastReceive.textContent = latestReceiveText;

  if (tele.sequence !== lastRenderedSequence) {
    frames.unshift(`#${tele.sequence} ${tele.rawHex}`);
    frames = frames.slice(0, 20);
    lastRenderedSequence = tele.sequence;
    renderFrames();
  }
}

async function sendTcycle() {
  if (!writeChar) {
    alert("还没有可写特征 FFF2");
    return;
  }
  if (isWritingTcycle) return;
  let ms = parseInt(dom.tcycleInput.value || "10", 10);
  if (!Number.isFinite(ms) || ms <= 0) ms = 10;
  ms = Math.max(5, Math.min(10000, ms));
  const cmd = `$AT+Tcycle=${ms}*\r\n`;
  const data = new TextEncoder().encode(cmd);

  try {
    isWritingTcycle = true;
    dom.btnSetTcycle.disabled = true;
    if (writeChar.properties.write && writeChar.writeValueWithResponse) {
      await writeChar.writeValueWithResponse(data);
    } else if (writeChar.properties.writeWithoutResponse && writeChar.writeValueWithoutResponse) {
      await writeChar.writeValueWithoutResponse(data);
    } else {
      await writeChar.writeValue(data);
    }
    alert(`已发送: ${cmd}`);
  } catch (err) {
    console.error(err);
    alert("发送失败: " + (err.message || String(err)));
  } finally {
    isWritingTcycle = false;
    dom.btnSetTcycle.disabled = false;
  }
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ===== Three.js aircraft =====
function createAircraftHUD(container) {
  if (!window.THREE) {
    console.error("THREE not loaded");
    return { setAttitude: () => {}, setSize: () => {} };
  }
  const THREE = window.THREE;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x081220, 12, 30);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

// ✔ 相机完全对准中心
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  root.position.set(0, -0.1, 0);
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xa9c7ff, 0.95);
  scene.add(ambient);

  const dir1 = new THREE.DirectionalLight(0xa0c8ff, 1.8);
  dir1.position.set(5, 7, 7);
  scene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0x49ffc8, 0.55);
  dir2.position.set(-4, -1, -3);
  scene.add(dir2);

  const hemi = new THREE.HemisphereLight(0x4a84ff, 0x08111f, 0.75);
  scene.add(hemi);

  const ringMat = new THREE.LineBasicMaterial({ color: 0x3f6ecb, transparent: true, opacity: 0.26 });
  for (let i = 0; i < 4; i++) {
    const radius = 2.2 + i * 1.0;
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(120).map(p => new THREE.Vector3(p.x, -1.55, p.y));
    const g = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(g, ringMat);
    line.rotation.x = Math.PI / 2;
    root.add(line);
  }

  const grid = new THREE.GridHelper(14, 14, 0x2e4e89, 0x1b2c49);
  grid.position.y = -2.2;
  grid.material.transparent = true;
  grid.material.opacity = 0.24;
  root.add(grid);

  const skySphere = new THREE.Mesh(
    new THREE.SphereGeometry(28, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x0b1730, side: THREE.BackSide })
  );
  scene.add(skySphere);

  const aircraftPivot = new THREE.Group();
  aircraftPivot.position.set(-1.60, 1.50, 0);
  root.add(aircraftPivot);

  const aircraft = new THREE.Group();
  aircraftPivot.add(aircraft);
  aircraft.scale.set(0.66, 0.66, 0.66);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6efff,
    metalness: 0.42,
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.26,
    emissive: 0x081421
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x57a0ff,
    metalness: 0.58,
    roughness: 0.28,
    emissive: 0x12304f
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd9ff,
    metalness: 0.04,
    roughness: 0.08,
    transmission: 0.86,
    transparent: true,
    opacity: 0.84
  });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 2.5, 8, 18), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  aircraft.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 24), accentMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.65;
  aircraft.add(nose);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 20), bodyMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -1.6;
  aircraft.add(tail);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), glassMat);
  cockpit.scale.set(1.42, 0.86, 0.82);
  cockpit.position.set(0.58, 0.16, 0);
  aircraft.add(cockpit);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 3.2), accentMat);
  wing.position.set(0.0, 0, 0);
  aircraft.add(wing);

  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.18), bodyMat);
  wingTipL.position.set(0.08, 0.03, 1.66);
  aircraft.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.z = -1.66;
  aircraft.add(wingTipR);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.26), bodyMat);
  tailWing.position.set(-1.28, 0.1, 0);
  aircraft.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.07), accentMat);
  fin.position.set(-1.34, 0.42, 0);
  fin.rotation.z = 0.12;
  aircraft.add(fin);

  const engineL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.54, 18), bodyMat);
  engineL.rotation.z = Math.PI / 2;
  engineL.position.set(0.0, -0.14, 0.78);
  aircraft.add(engineL);
  const engineR = engineL.clone();
  engineR.position.z = -0.78;
  aircraft.add(engineR);

  const engineGlowMat = new THREE.MeshBasicMaterial({ color: 0x56c7ff, transparent: true, opacity: 0.62 });
  const glowL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), engineGlowMat);
  glowL.position.set(-0.24, -0.14, 0.78);
  aircraft.add(glowL);
  const glowR = glowL.clone();
  glowR.position.z = -0.78;
  aircraft.add(glowR);

  const trailMat = new THREE.LineBasicMaterial({ color: 0x5ba0ff, transparent: true, opacity: 0.18 });
  const pathPoints = [];
  for (let i = 0; i < 70; i++) pathPoints.push(new THREE.Vector3(-i * 0.055, 0, 0));
  const trailGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
  const trail = new THREE.Line(trailGeo, trailMat);
  trail.position.set(-1.2, 0, 0);
  aircraft.add(trail);

  const targetQuat = new THREE.Quaternion();
  const currentQuat = new THREE.Quaternion();

  function setSize() {
    const w = Math.max(320, container.clientWidth);
    const h = Math.max(240, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  setSize();
  window.addEventListener('resize', setSize);

  function setAttitude(rollDeg, pitchDeg, yawDeg) {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(-pitchDeg),
      THREE.MathUtils.degToRad(-yawDeg),
      THREE.MathUtils.degToRad(-rollDeg),
      'YXZ'
    );
    targetQuat.setFromEuler(euler);
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    currentQuat.slerp(targetQuat, 0.14);
    aircraftPivot.quaternion.copy(currentQuat);

    glowL.material.opacity = 0.48 + 0.16 * Math.sin(t * 3.2);
    glowR.material.opacity = 0.48 + 0.16 * Math.sin(t * 3.2 + 1.2);

    aircraft.rotation.y = 0.06 * Math.sin(t * 0.9);
    renderer.render(scene, camera);
  }
  animate();

  return { setAttitude };
}

const aircraftView = createAircraftHUD(dom.aircraft3d);

function updateAircraftAttitude(tele) {
  const roll = -(parseFloat(tele.roll) || 0);
  const pitch = parseFloat(tele.pitch) || 0;
  const yaw = parseFloat(tele.yaw) || 0;
  if (aircraftView && aircraftView.setAttitude) aircraftView.setAttitude(roll, pitch, yaw);
}

window.addEventListener("error", (e) => {
  console.error("Page error:", e.error || e.message);
});

if (!navigator.bluetooth) {
  console.warn("Web Bluetooth unavailable in this environment.");
}

renderFrames();
setState("warn", "未连接");
dom.notifyState.textContent = "off";
initWaveCharts();
requestAnimationFrame(renderDisplayFrame);
