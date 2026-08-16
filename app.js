const SERVICE_HINT = "fff0";
const CHAR_NOTIFY = "fff1";
const CHAR_WRITE = "fff2";
const START = "$";
const END = "*";
const BATTERY_FULL_VOLTAGE = 3.7;

let bleDevice = null;
let gattServer = null;
let notifyChar = null;
let writeChar = null;
let rxBuffer = "";
let frames = [];
let rowsForCsv = [];
let latestTele = null;

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
    v5: document.getElementById("tele-v5"),
    v6: document.getElementById("tele-v6"),
    mag: document.getElementById("tele-mag"),
    uptime: document.getElementById("tele-uptime"),
  },
};

document.getElementById("btnConnect").addEventListener("click", connectBle);
document.getElementById("btnDisconnect").addEventListener("click", disconnectBle);
document.getElementById("btnSetTcycle").addEventListener("click", sendTcycle);
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

    await notifyChar.startNotifications();
    notifyChar.addEventListener("characteristicvaluechanged", handleNotify);

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
  frames = [];
  rowsForCsv = [];
  rxBuffer = "";
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
  const header = "tmp,ax,ay,az,v1,battery_percent,v5,v6,mx,my,mz,ms";
  const content = [header, ...recordBuffer].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ble_record_${Date.now()}.txt`;
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
  const chunk = new TextDecoder("utf-8").decode(event.target.value);
  handleChunk(chunk);
}

function handleChunk(chunk) {
  if (!chunk) return;
  rxBuffer += chunk;

  if (rxBuffer.length > 20000) {
    const last = rxBuffer.lastIndexOf(START);
    rxBuffer = last >= 0 ? rxBuffer.slice(last) : "";
  }

  while (true) {
    const s = rxBuffer.indexOf(START);
    if (s < 0) return;
    const e = rxBuffer.indexOf(END, s + 1);
    if (e < 0) {
      rxBuffer = rxBuffer.slice(s);
      return;
    }
    const payload = rxBuffer.slice(s + 1, e).replace(/\r|\n/g, "").trim();
    rxBuffer = rxBuffer.slice(e + 1);
    if (!payload) continue;
    onFrame(payload);
  }
}

function onFrame(payloadCsv) {
  const tele = parseTelemetry(payloadCsv);
  if (!tele) return;

  latestTele = tele;
  const frame = `$${payloadCsv}*`;
  frames.unshift(frame);
  frames = frames.slice(0, 20);

  rowsForCsv.push({
    receive_time: new Date().toISOString(),
    raw_frame: frame,
    ...tele
  });

  dom.frameCount.textContent = String(rowsForCsv.length);
  dom.lastReceive.textContent = fmtNow();

  if (isRecording) {
    recordBuffer.push(`${tele.tmp},${tele.ax},${tele.ay},${tele.az},${tele.v1},${tele.battery},${tele.v5},${tele.v6},${tele.mx},${tele.my},${tele.mz},${tele.ms}`);
  }

  renderTelemetry(tele);
  pushWaveSample(tele);
  updateAircraftAttitude(tele);
  renderFrames();
}

function voltageToBatteryPercent(voltage) {
  return Math.min(100, Math.max(0, voltage / BATTERY_FULL_VOLTAGE * 100));
}

function parseTelemetry(csv) {
  const f = csv.split(",").map(x => (x || "").trim());
  // MCU frame: MAC,tmp,AccX,AccY,AccZ,GyroX,GyroY,GyroZ,
  //            Roll,Pitch,Yaw,PA1,PA5,PA6,MagX,MagY,MagZ,uptime_ms
  if (f.length !== 18) {
    console.warn(`忽略字段数不匹配的遥测帧：期望 18，实际 ${f.length}`, csv);
    return null;
  }

  if (!/^[0-9a-f]{12}$/i.test(f[0])) {
    console.warn("忽略 MAC 格式无效的遥测帧", csv);
    return null;
  }

  const numericValues = f.slice(1).map(Number);
  if (numericValues.some(value => !Number.isFinite(value))) {
    console.warn("忽略包含非数值字段的遥测帧", csv);
    return null;
  }

  const f2 = x => {
    const v = parseFloat(x);
    return Number.isFinite(v) ? v.toFixed(2) : "-";
  };
  const f3 = x => {
    const v = parseFloat(x);
    return Number.isFinite(v) ? v.toFixed(4) : "-";
  };

  const batteryPercent = voltageToBatteryPercent(numericValues[10]);

  return {
    mac: f[0],
    tmp: f2(f[1]),
    ax: f2(f[2]), ay: f2(f[3]), az: f2(f[4]),
    gx: f2(f[5]), gy: f2(f[6]), gz: f2(f[7]),
    roll: f2(f[8]), pitch: f2(f[9]), yaw: f2(f[10]),
    v1: f3(f[11]), v5: f3(f[12]), v6: f3(f[13]),
    mx: f3(f[14]), my: f3(f[15]), mz: f3(f[16]),
    battery: batteryPercent.toFixed(1),
    ms: String(Math.trunc(numericValues[16]))
  };
}

function renderTelemetry(tele) {
  dom.tele.mac.textContent = tele.mac;
  dom.tele.temp.textContent = `${tele.tmp} °C`;
  dom.tele.roll.textContent = `${tele.roll}°`;
  dom.tele.pitch.textContent = `${tele.pitch}°`;
  dom.tele.yaw.textContent = `${tele.yaw}°`;
  dom.tele.acc.textContent = `${tele.ax} / ${tele.ay} / ${tele.az}`;
  dom.tele.gyro.textContent = `${tele.gx} / ${tele.gy} / ${tele.gz}`;
  dom.tele.v1.textContent = `${tele.v1} V`;
  const batteryPercent = Number(tele.battery);
  dom.tele.battery.textContent = `${tele.battery} %`;
  dom.tele.batteryTrack.setAttribute("aria-valuenow", tele.battery);
  dom.tele.batteryFill.style.width = `${batteryPercent}%`;
  dom.tele.batteryFill.style.background = batteryPercent <= 20
    ? "var(--red)"
    : batteryPercent <= 50
      ? "var(--amber)"
      : "var(--green)";
  dom.tele.v5.textContent = `${tele.v5} V`;
  dom.tele.v6.textContent = `${tele.v6} V`;
  dom.tele.mag.textContent = `${tele.mx} / ${tele.my} / ${tele.mz} G`;
  dom.tele.uptime.textContent = `${tele.ms} ms`;
  dom.hudRoll.textContent = `${Number(tele.roll).toFixed(1)}°`;
  dom.hudPitch.textContent = `${Number(tele.pitch).toFixed(1)}°`;
  dom.hudYaw.textContent = `${Number(tele.yaw).toFixed(1)}°`;
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
  waveCharts.v5 = new Chart(document.getElementById('chartV5'), makeCfg('V5', '#ff7b88'));
  waveCharts.v6 = new Chart(document.getElementById('chartV6'), makeCfg('V6', '#c57bff'));
  waveCharts.mx = new Chart(document.getElementById('chartMx'), makeCfg('Magnetic X', '#4dd0e1'));
  waveCharts.my = new Chart(document.getElementById('chartMy'), makeCfg('Magnetic Y', '#f48fb1'));
  waveCharts.mz = new Chart(document.getElementById('chartMz'), makeCfg('Magnetic Z', '#dce775'));
}

function pushWaveSample(tele) {
  const now = Date.now();
  waveBuffer.push({
    t: now,
    ax: parseFloat(tele.ax) || 0,
    ay: parseFloat(tele.ay) || 0,
    az: parseFloat(tele.az) || 0,
    tmp: parseFloat(tele.tmp) || 0,
    v5: parseFloat(tele.v5) || 0,
    v6: parseFloat(tele.v6) || 0,
    mx: parseFloat(tele.mx) || 0,
    my: parseFloat(tele.my) || 0,
    mz: parseFloat(tele.mz) || 0,
  });
  const cutoff = now - WAVE_WINDOW_MS;
  while (waveBuffer.length && waveBuffer[0].t < cutoff) waveBuffer.shift();

  if (now - lastChartRender < CHART_RENDER_INTERVAL) return;
  lastChartRender = now;
  renderWaveCharts();
}

function renderWaveCharts() {
  for (const key of ['ax', 'ay', 'az', 'tmp', 'v5', 'v6', 'mx', 'my', 'mz']) {
    const ch = waveCharts[key];
    ch.data.labels = waveBuffer.map(() => '');
    ch.data.datasets[0].data = waveBuffer.map(d => d[key]);
    ch.update('none');
  }
}

function clearWaveCharts() {
  waveBuffer.length = 0;
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

async function sendTcycle() {
  if (!writeChar) {
    alert("还没有可写特征 FFF2");
    return;
  }
  let ms = parseInt(dom.tcycleInput.value || "10", 10);
  if (!Number.isFinite(ms) || ms <= 0) ms = 10;
  ms = Math.max(5, Math.min(10000, ms));
  const cmd = `$AT+Tcycle=${ms}*\r\n`;
  const data = new TextEncoder().encode(cmd);

  try {
    if (writeChar.writeValueWithResponse) {
      await writeChar.writeValueWithResponse(data);
    } else if (writeChar.writeValueWithoutResponse) {
      await writeChar.writeValueWithoutResponse(data);
    } else {
      await writeChar.writeValue(data);
    }
    alert(`已发送: ${cmd}`);
  } catch (err) {
    console.error(err);
    alert("发送失败: " + (err.message || String(err)));
  }
}

function exportCsv() {
  if (!rowsForCsv.length) {
    alert("暂无数据");
    return;
  }
  const headers = Object.keys(rowsForCsv[0]);
  const lines = [headers.join(",")];
  for (const row of rowsForCsv) {
    lines.push(headers.map(h => csvEscape(row[h])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ble_telemetry_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
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
