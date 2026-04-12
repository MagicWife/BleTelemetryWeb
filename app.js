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
  canvas: document.getElementById("attitudeCanvas"),
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
  drawAttitude(tele);
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
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
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

// ===== 3D Attitude =====
const attitude = {
  ctx: dom.canvas.getContext("2d"),
  dpr: Math.max(1, window.devicePixelRatio || 1),
};

function resizeCanvas() {
  const rect = dom.canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width * attitude.dpr));
  const height = Math.max(240, Math.floor(rect.height * attitude.dpr));
  dom.canvas.width = width;
  dom.canvas.height = height;
  drawAttitude(latestTele || { roll: "0", pitch: "0", yaw: "0" });
}
window.addEventListener("resize", resizeCanvas);

function drawAttitude(tele) {
  const ctx = attitude.ctx;
  const w = dom.canvas.width;
  const h = dom.canvas.height;
  ctx.clearRect(0, 0, w, h);

  const step = Math.max(34, Math.floor(Math.min(w, h) / 9));
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;
  for (let x = step; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const roll = parseFloat(tele.roll) || 0;
  const pitch = parseFloat(tele.pitch) || 0;
  const yaw = parseFloat(tele.yaw) || 0;
  const R = roll * Math.PI / 180;
  const P = pitch * Math.PI / 180;
  const Y = yaw * Math.PI / 180;

  const s = Math.min(w, h) * 0.16;
  const cx = w * 0.50;
  const cy = h * 0.58;

  const V = [
    [-1,-1,-1],[ 1,-1,-1],[ 1, 1,-1],[-1, 1,-1],
    [-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1],
  ].map(p => [p[0]*s, p[1]*s, p[2]*s]);

  const rot = ([x,y,z]) => {
    const x1 = x*Math.cos(Y) - y*Math.sin(Y);
    const y1 = x*Math.sin(Y) + y*Math.cos(Y);
    const z1 = z;

    const x2 = x1*Math.cos(P) + z1*Math.sin(P);
    const y2 = y1;
    const z2 = -x1*Math.sin(P) + z1*Math.cos(P);

    const x3 = x2;
    const y3 = y2*Math.cos(R) - z2*Math.sin(R);
    const z3 = y2*Math.sin(R) + z2*Math.cos(R);
    return [x3,y3,z3];
  };

  const dist = Math.max(w,h) * 0.95;
  const proj = ([x,y,z]) => {
    const k = dist / (dist + z + s*2.0);
    return [cx + x*k, cy + y*k, z];
  };

  const Vr = V.map(rot);
  const P2 = Vr.map(proj);
  const faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]];

  const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const norm = a => { const n = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/n,a[1]/n,a[2]/n]; };
  const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const light = norm([0.55,-0.35,0.82]);

  const faceInfo = faces.map(idx => {
    const a = Vr[idx[0]], b = Vr[idx[1]], c = Vr[idx[2]];
    const n = norm(cross(sub(b,a), sub(c,a)));
    const inten = Math.max(0, dot(n, light));
    const zavg = idx.reduce((sum,i)=>sum + Vr[i][2], 0) / idx.length;
    return { idx, inten, zavg };
  }).sort((A,B)=>A.zavg - B.zavg);

  for (const f of faceInfo) {
    const pts = f.idx.map(i => P2[i]);
    const alpha = 0.08 + f.inten * 0.24;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(106,169,255,${alpha.toFixed(3)})`;
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = Math.max(2, w / 500);
    ctx.fill();
    ctx.stroke();
  }

  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = Math.max(2.2, w / 420);
  for (const [a,b] of edges) {
    ctx.beginPath();
    ctx.moveTo(P2[a][0], P2[a][1]);
    ctx.lineTo(P2[b][0], P2[b][1]);
    ctx.stroke();
  }

  const axisLen = s * 1.7;
  drawAxis([axisLen,0,0], "X", "rgba(106,169,255,.95)");
  drawAxis([0,axisLen,0], "Y", "rgba(55,210,159,.95)");
  drawAxis([0,0,axisLen], "Z", "rgba(255,190,92,.95)");

  function drawAxis(v, label, color) {
    const O = proj(rot([0,0,0]));
    const T = proj(rot(v));
    ctx.beginPath();
    ctx.moveTo(O[0], O[1]);
    ctx.lineTo(T[0], T[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.4, w / 360);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `${Math.max(14, w / 48)}px Inter, sans-serif`;
    ctx.fillText(label, T[0] + 8, T[1] + 4);
  }

  ctx.fillStyle = "rgba(237,244,255,.96)";
  ctx.font = `${Math.max(20, w / 34)}px Inter, sans-serif`;
  ctx.fillText("3D Attitude", 20 * attitude.dpr, 34 * attitude.dpr);

  ctx.fillStyle = "rgba(158,178,206,.95)";
  ctx.font = `${Math.max(13, w / 56)}px Inter, sans-serif`;
  ctx.fillText(`Roll ${roll.toFixed(1)}°   Pitch ${pitch.toFixed(1)}°   Yaw ${yaw.toFixed(1)}°`, 20 * attitude.dpr, 58 * attitude.dpr);
}

renderFrames();
resizeCanvas();
setState("warn", "未连接");
dom.notifyState.textContent = "off";
