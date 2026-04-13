const SERVICE_HINT = "fff0";
const CHAR_NOTIFY = "fff1";
const CHAR_WRITE = "fff2";
const START = "$";
const END = "*";

let bleDevice = null;
let gattServer = null;
let notifyChar = null;
let writeChar = null;
let rxBuffer = "";
let frames = [];
let rowsForCsv = [];
let latestTele = null;

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
  mapStatus: document.getElementById("mapStatus"),
  coordMode: document.getElementById("coordMode"),
  frames: document.getElementById("frames"),
  tcycleInput: document.getElementById("tcycleInput"),
  hudRoll: document.getElementById("hudRoll"),
  hudPitch: document.getElementById("hudPitch"),
  hudYaw: document.getElementById("hudYaw"),
  aircraft3d: document.getElementById("aircraft3d"),
  tele: {
    mac: document.getElementById("tele-mac"),
    time: document.getElementById("tele-time"),
    lon: document.getElementById("tele-lon"),
    lat: document.getElementById("tele-lat"),
    roll: document.getElementById("tele-roll"),
    pitch: document.getElementById("tele-pitch"),
    yaw: document.getElementById("tele-yaw"),
    acc: document.getElementById("tele-acc"),
    gyro: document.getElementById("tele-gyro"),
  },
  v1Text: document.getElementById("v1Text"),
  v5Text: document.getElementById("v5Text"),
  v6Text: document.getElementById("v6Text"),
  v1Bar: document.getElementById("v1Bar"),
  v5Bar: document.getElementById("v5Bar"),
  v6Bar: document.getElementById("v6Bar"),
};

document.getElementById("btnConnect").addEventListener("click", connectBle);
document.getElementById("btnDisconnect").addEventListener("click", disconnectBle);
document.getElementById("btnSetTcycle").addEventListener("click", sendTcycle);
document.getElementById("btnExport").addEventListener("click", exportCsv);
document.getElementById("btnClearFrames").addEventListener("click", () => {
  frames = [];
  renderFrames();
});

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
}

async function disconnectBle() {
  try {
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
    dom.notifyState.textContent = "off";
    setState("warn", "已断开");
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

  renderTelemetry(tele);
  updateVoltageBars(tele);
  updateAircraftAttitude(tele);
  updateMapFromTele(tele);
  renderFrames();
}

function parseTelemetry(csv) {
  const p = csv.split(",");
  if (p.length < 16) return null;
  const f = p.slice(0, 16).map(x => (x || "").trim());

  const t = f[1] || "";
  let timeStr = "-";
  if (t.length >= 12) {
    const YY = t.slice(0, 2), MM = t.slice(2, 4), DD = t.slice(4, 6);
    const hh = t.slice(6, 8), mm = t.slice(8, 10), ss = t.slice(10, 12);
    const ms = t.length >= 15 ? t.slice(12, 15) : "000";
    timeStr = `20${YY}-${MM}-${DD} ${hh}:${mm}:${ss}.${ms}`;
  } else if (t) {
    timeStr = t;
  }

  const f2 = x => {
    const v = parseFloat(x);
    return Number.isFinite(v) ? v.toFixed(2) : "-";
  };
  const f3 = x => {
    const v = parseFloat(x);
    return Number.isFinite(v) ? v.toFixed(3) : "-";
  };

  return {
    mac: f[0] || "-",
    timeStr,
    lonStr: f[2] || "-",
    latStr: f[3] || "-",
    ax: f2(f[4]), ay: f2(f[5]), az: f2(f[6]),
    gx: f2(f[7]), gy: f2(f[8]), gz: f2(f[9]),
    roll: f2(f[10]), pitch: f2(f[11]), yaw: f2(f[12]),
    v1: f3(f[13]), v5: f3(f[14]), v6: f3(f[15])
  };
}

function renderTelemetry(tele) {
  dom.tele.mac.textContent = tele.mac;
  dom.tele.time.textContent = tele.timeStr;
  dom.tele.lon.textContent = tele.lonStr;
  dom.tele.lat.textContent = tele.latStr;
  dom.tele.roll.textContent = `${tele.roll}°`;
  dom.tele.pitch.textContent = `${tele.pitch}°`;
  dom.tele.yaw.textContent = `${tele.yaw}°`;
  dom.tele.acc.textContent = `${tele.ax} / ${tele.ay} / ${tele.az}`;
  dom.tele.gyro.textContent = `${tele.gx} / ${tele.gy} / ${tele.gz}`;
  dom.hudRoll.textContent = `${Number(tele.roll).toFixed(1)}°`;
  dom.hudPitch.textContent = `${Number(tele.pitch).toFixed(1)}°`;
  dom.hudYaw.textContent = `${Number(tele.yaw).toFixed(1)}°`;
}

function updateVoltageBars(tele) {
  const v1 = Number(tele.v1) || 0;
  const v5 = Number(tele.v5) || 0;
  const v6 = Number(tele.v6) || 0;
  const range = Math.max(v1, v5, v6) > 6 ? 12 : 6;
  const pct = v => Math.max(0, Math.min(100, (v / range) * 100));
  dom.v1Text.textContent = `${v1.toFixed(3)} V`;
  dom.v5Text.textContent = `${v5.toFixed(3)} V`;
  dom.v6Text.textContent = `${v6.toFixed(3)} V`;
  dom.v1Bar.style.width = `${pct(v1)}%`;
  dom.v5Bar.style.width = `${pct(v5)}%`;
  dom.v6Bar.style.width = `${pct(v6)}%`;
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
  let ms = parseInt(dom.tcycleInput.value || "500", 10);
  if (!Number.isFinite(ms) || ms <= 0) ms = 500;
  ms = Math.max(10, Math.min(10000, ms));
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

// ===== Map =====
let map = null;
let mapMarker = null;

function initMap() {
  map = L.map("map", { zoomControl: true, attributionControl: true }).setView([22.3193, 114.1694], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  L.control.scale().addTo(map);
}
initMap();

function parseCoord(rawStr) {
  const s = (rawStr || "").trim();
  if (!s || s === "-") return null;
  const dir = s[0];
  const num = parseFloat(s.slice(1));
  if (!Number.isFinite(num)) return null;
  const sign = (dir === "W" || dir === "S") ? -1 : 1;
  return sign * num;
}

function outOfChina(lat, lon) {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
}
function transformLat(x, y) {
  let ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
  ret += (20.0*Math.sin(6.0*x*Math.PI) + 20.0*Math.sin(2.0*x*Math.PI)) * 2.0 / 3.0;
  ret += (20.0*Math.sin(y*Math.PI) + 40.0*Math.sin(y/3.0*Math.PI)) * 2.0 / 3.0;
  ret += (160.0*Math.sin(y/12.0*Math.PI) + 320.0*Math.sin(y*Math.PI/30.0)) * 2.0 / 3.0;
  return ret;
}
function transformLon(x, y) {
  let ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
  ret += (20.0*Math.sin(6.0*x*Math.PI) + 20.0*Math.sin(2.0*x*Math.PI)) * 2.0 / 3.0;
  ret += (20.0*Math.sin(x*Math.PI) + 40.0*Math.sin(x/3.0*Math.PI)) * 2.0 / 3.0;
  ret += (150.0*Math.sin(x/12.0*Math.PI) + 300.0*Math.sin(x/30.0*Math.PI)) * 2.0 / 3.0;
  return ret;
}
function wgs84ToGcj02(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [lat, lon, "Invalid"];
  if (outOfChina(lat, lon)) return [lat, lon, "WGS84"];
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLon = transformLon(lon - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
  dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [lat + dLat, lon + dLon, "WGS84→GCJ02"];
}

function updateMapFromTele(tele) {
  const lon = parseCoord(tele.lonStr);
  const lat = parseCoord(tele.latStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (Math.abs(lat) < 1e-8 && Math.abs(lon) < 1e-8)) {
    dom.mapStatus.textContent = "No Fix";
    return;
  }
  const [mLat, mLon, mode] = wgs84ToGcj02(lat, lon);
  dom.coordMode.textContent = mode;
  dom.mapStatus.textContent = "GPS Fix";

  const deviceLabel = bleDevice?.name || "BLE Device";
  const icon = L.divIcon({
    className: "custom-marker-wrapper",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="padding:5px 10px;border-radius:999px;background:rgba(8,17,31,.92);border:1px solid rgba(255,255,255,.14);font-size:12px;color:#eef5ff;white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,.26);">${deviceLabel}</div>
        <div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#6aa9ff,#37d29f);border:3px solid rgba(255,255,255,.95);margin-top:6px;box-shadow:0 0 20px rgba(106,169,255,.55);"></div>
      </div>`,
    iconSize: [150, 54],
    iconAnchor: [75, 49]
  });

  if (!mapMarker) {
    mapMarker = L.marker([mLat, mLon], { icon }).addTo(map);
  } else {
    mapMarker.setLatLng([mLat, mLon]);
    mapMarker.setIcon(icon);
  }
  map.setView([mLat, mLon], Math.max(map.getZoom(), 15), { animate: true });
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
