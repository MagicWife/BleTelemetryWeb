import {UUID,FLAGS,FEATURE_NAMES,FEATURE_LABELS,FEATURE_UNITS,FrameStream,TelemetryStats,parseStatus,bytes,hex32,csvText,parseFrame} from './protocol.mjs';
import {OtaClient,validateFirmware,parseOtaResult,verifyResult,uploadFirmware} from './ota.mjs';
const $=id=>document.getElementById(id),fmt=(x,d=4)=>x===null||x===undefined?'—':Number(x).toFixed(d),nowText=()=>new Date().toLocaleTimeString('zh-CN',{hour12:false});
let device=null,server=null,statusChar=null,dataChar=null,commandChar=null,otaRx=null,otaNotify=null,client=null,status=null,installResult=null,otaBusy=false,connecting=false,demo=false,latest=null,stats=new TelemetryStats(),history=[],recording=false,recorded=[],firmware=null,fileInfo=null,poll=null,disconnectListener=null;
let gattQueue=Promise.resolve();
function gatt(fn){const p=gattQueue.then(fn);gattQueue=p.catch(()=>{});return p;}
function log(message){const lines=$('log').textContent.split('\n');lines.push(`[${nowText()}] ${message}`);$('log').textContent=lines.slice(-180).join('\n');$('log').scrollTop=$('log').scrollHeight;}
function badge(id,text,type='muted'){const n=$(id);n.textContent=text;n.className='badge '+type;}
function pendingKey(){return `pethealthai-fw17-ota:${device?.id??'none'}`;}
function pendingTarget(){try{return JSON.parse(localStorage.getItem(pendingKey())??'null');}catch{return null;}}
function persistTarget(target){try{localStorage.setItem(pendingKey(),JSON.stringify(target));}catch{log('浏览器存储不可用，请保存本次文件版本和CRC用于重连核对');}}
function connected(){return !!device?.gatt?.connected;}
function hasFreshData(){return !!latest&&(demo||(connected()&&Date.now()-(stats.lastFreshAt??0)<=3000));}
function controls(){
 $('connect').disabled=connecting||connected()||otaBusy;$('disconnect').disabled=!connected()||otaBusy;
 for(const id of ['start','stop','sync','history','diagnostic'])$(id).disabled=!connected()||!commandChar||otaBusy||status?.protocol!==7;
 $('refresh').disabled=!connected()||otaBusy;$('otaResult').disabled=!connected()||!otaNotify||otaBusy;
 $('otaStart').disabled=!connected()||!client||otaBusy||!fileInfo||!$('otaConfirm').checked||!installResult||installResult.runningVersion<16;
 $('firmware').disabled=otaBusy;$('otaConfirm').disabled=otaBusy;$('otaAbort').disabled=!otaBusy;$('demo').disabled=connected()||otaBusy||connecting;
}
function clearLive(){latest=null;stats=new TelemetryStats();history=[];stream.reset();render();}
const stream=new FrameStream(frame=>{
 const fresh=stats.accept(frame);
 if(frame.health!==undefined&&frame.health!==null){const labels=[];for(const [bit,label] of [[1,'IMU读取'],[2,'采样时序'],[4,'队列/跳样'],[32,'存储'],[64,'蓝牙'],[128,'内存'],[256,'看门狗'],[512,'低电压(<3.5V)']])if(frame.health&bit)labels.push(label);$('health').textContent=frame.health?`${hex32(frame.health)} ${labels.join(' / ')}`:'正常 (0x0000)';}
 if(frame.record&&(frame.kind===0x32||fresh)&&recording){
  if(recorded.length>=20000){recording=false;$('record').textContent='开始记录';log('记录达到20000条，已暂停记录；请导出文件');}else{recorded.push(frame);$('record').textContent=`停止记录 (${recorded.length})`;$('export').disabled=false;}
 }
 if(fresh){latest=frame;history.push(frame);if(history.length>120)history.shift();render();}
 else renderStats();
},e=>{stats.error(e);renderStats();log(`接收检查：${e.message}`);});
function renderStats(){
 $('rxCount').textContent=stats.live;$('freshAge').textContent=stats.lastFreshAt===null?'尚未收到数据':`新记录 ${stats.live-stats.duplicates} · ${((Date.now()-stats.lastFreshAt)/1000).toFixed(1)}秒前`;
 const errors=Object.values(stats.errors).reduce((a,b)=>a+b,0);$('integrity').textContent=stats.frames?`${errors} 个错误`:'—';$('integrityDetail').textContent=`序号缺口 ${stats.sequenceGaps} · 重复 ${stats.duplicates} · 历史 ${stats.history}`;
 $('integrity').style.color=errors?'var(--red)':'var(--green)';
}
function render(){
 renderStats();const f=hasFreshData()?latest:null,r=f?.record;
 $('behavior').textContent=r?.behaviorLabel??'—';$('hr').textContent=r?.heartRate===null||!r?'—':`${r.heartRate} bpm`;$('rr').textContent=r?.respiratoryRate===null||!r?'—':`${r.respiratoryRate} 次/分`;
 $('temperature').textContent=r?.temperatureC===null||!r?'—':`${fmt(r.temperatureC,2)} °C`;$('activity').textContent=r?.activityG===null||!r?'—':`${fmt(r.activityG,5)} g`;
 $('uptime').textContent=r?`${(r.uptimeMs/1000).toFixed(2)} s · #${r.recordId}`:'—';$('radio').textContent=`${r?.rssi===null||!r?'—':r.rssi+' dBm'} / ${status?.batteryAdc??'—'}`;
 $('featureState').textContent=!f?.values?(latest?'数据已过期':'等待数据'):f.valid?'完整就绪':f.coreValid?'核心就绪':f.flags&FLAGS.ACTIVE?'预热中':'状态门控';
 $('windowState').textContent=f?.values?`核心 ${f.coreValid?'有效':'无效'} / 周期 ${f.periodValid?'有效':'无效'}`:'1秒核心 / 4秒周期';
 badge('historyCount',`历史 ${f?.samples??0} / 200点`,f?.periodValid?'':'muted');
 const tags=[];if(f?.values){for(const [bit,text,type] of [[1,'31维有效',''],[2,'窗口预热','warn'],[4,'输入断档','warn'],[8,'已佩戴非静息',''],[16,'1秒混合状态','warn'],[1024,'4秒混合状态','warn'],[128,'已重采样','muted'],[2048,'加速度有周期',''],[4096,'角速度有周期','']])if(f.flags&bit)tags.push([text,type]);if(!(f.flags&8))tags.push(['静息 / 未佩戴：特征无效','muted']);}
 $('flags').replaceChildren(...tags.map(([text,type])=>{const n=document.createElement('span');n.className='badge '+type;n.textContent=text;return n;}));
 FEATURE_NAMES.forEach((_,i)=>{const ok=f?.usable?.[i]??false;$(`value-${i}`).textContent=ok?fmt(f.values[i]):'—';const node=$(`valid-${i}`);node.textContent=ok?'有效':i>=27&&f?.flags&2?'4秒预热':'无效';node.className='badge '+(ok?'':i>=27&&f?.flags&2?'warn':'muted');});
 drawChart();
}
function drawChart(){
 const i=Number($('signal').value),canvas=$('chart'),ctx=canvas.getContext('2d');if(!ctx)return;
 const width=canvas.clientWidth||600,height=210,dpr=window.devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
 const data=history.map(f=>f.usable?.[i]?f.values[i]:null),finite=data.filter(x=>x!==null);let min=finite.length?Math.min(...finite):0,max=finite.length?Math.max(...finite):1;if(max-min<1e-8){max+=.5;min-=.5;}const pad=(max-min)*.12;min-=pad;max+=pad;
 ctx.font='10px system-ui';ctx.fillStyle='#8a9587';ctx.strokeStyle='#edf0e9';ctx.lineWidth=1;
 for(let k=0;k<4;k++){const y=18+k*55;ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(width-12,y);ctx.stroke();ctx.fillText((max-(max-min)*k/3).toFixed(2),0,y+4);}
 const px=j=>45+(width-60)*j/Math.max(data.length-1,1),py=v=>18+165*(max-v)/(max-min);ctx.strokeStyle='#ed713d';ctx.lineWidth=2;ctx.beginPath();let started=false;
 data.forEach((v,j)=>{if(v===null){started=false;return;}if(!started)ctx.moveTo(px(j),py(v));else ctx.lineTo(px(j),py(v));started=true;});ctx.stroke();
 const last=data.length-1;if(last>=0&&data[last]!==null){ctx.fillStyle='#ed713d';ctx.beginPath();ctx.arc(px(last),py(data[last]),3,0,Math.PI*2);ctx.fill();}
 const ok=hasFreshData()&&latest?.usable?.[i];$('signalValue').textContent=ok?fmt(latest.values[i]):'—';$('signalUnit').textContent=FEATURE_UNITS[i];badge('signalValidity',ok?'窗口有效':'当前无效',ok?'':'muted');$('signalWindow').textContent=i>=27?'4秒历史窗口':'1秒历史窗口';
}
async function writeCommand(payload){if(otaBusy)throw Error('OTA进行中，遥测命令暂不可用');if(!connected()||!commandChar)throw Error('请先连接设备');await gatt(()=>commandChar.writeValueWithResponse(new Uint8Array(payload)));}
async function refreshStatus(){if(!statusChar||otaBusy)return;status=parseStatus(await gatt(()=>statusChar.readValue()));$('deviceDetail').textContent=`协议v${status.protocol} · MTU ${status.mtu} · ${status.sampleHz}Hz采样`;
 $('transportHint').textContent=status.protocol!==7?`当前协议v${status.protocol}，本页只解析FW17/v7遥测；FW16相同新分区可通过下方OTA升级。`:`实时168B / MTU ${status.mtu}${status.mtu<171?'，不足171，特征通知无法发送':'，满足传输要求'} · 设备TX丢弃 ${status.txDropped} · 离线记录 ${status.storedRecords}`;controls();}
async function readInstallResult(){
 if(!otaNotify||otaBusy)throw Error('安装结果暂不可读');installResult=parseOtaResult(await gatt(()=>otaNotify.readValue()));$('runningVersion').textContent=`运行固件：FW${installResult.runningVersion}`;
 const q=verifyResult(installResult,pendingTarget());$('resultInfo').textContent=`${q.message} · 目标FW${installResult.targetVersion} · CRC ${hex32(installResult.targetCrc)} · 尝试${installResult.attempt}`;
 if(q.state==='verified'){progress('已核对安装成功',100);$('otaMessage').textContent=q.message;}else if(q.state==='image-verified'){progress('已核对运行镜像',100);$('otaMessage').textContent=q.message;}
 log(q.message);controls();return installResult;
}
function progress(phase,percent){$('otaPhase').textContent=phase;$('otaPercent').textContent=`${Math.round(percent)}%`;$('progress').value=percent;}
function onDisconnect(){
 if(poll)clearInterval(poll);poll=null;client?.close();badge('connection','已断开','muted');statusChar=dataChar=commandChar=otaRx=otaNotify=null;server=null;controls();
 render();log(otaBusy?'OTA连接已断开：等待手动重连核对，不能据此判成功':'蓝牙已断开');
}
async function connect(){
 if(!navigator.bluetooth)throw Error('当前浏览器不支持Web Bluetooth；请使用桌面Chrome/Edge');connecting=true;controls();
 try{
  if(disconnectListener&&device)device.removeEventListener('gattserverdisconnected',disconnectListener);
  device=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'Petvewi'}],optionalServices:[UUID.service,UUID.otaService]});demo=false;clearLive();status=null;installResult=null;client=null;otaRx=otaNotify=null;
  $('deviceName').textContent=device.name??'Petvewi';badge('connection','正在连接','warn');disconnectListener=onDisconnect;device.addEventListener('gattserverdisconnected',disconnectListener);
  server=await device.gatt.connect();const svc=await server.getPrimaryService(UUID.service);statusChar=await svc.getCharacteristic(UUID.status);commandChar=await svc.getCharacteristic(UUID.command);dataChar=await svc.getCharacteristic(UUID.data);
  dataChar.addEventListener('characteristicvaluechanged',e=>stream.push(e.target.value));await dataChar.startNotifications();await refreshStatus();
  try{
   const ota=await server.getPrimaryService(UUID.otaService);otaRx=await ota.getCharacteristic(UUID.otaRx);otaNotify=await ota.getCharacteristic(UUID.otaNotify);
   client=new OtaClient(packet=>gatt(()=>otaRx.writeValueWithResponse(packet)));otaNotify.addEventListener('characteristicvaluechanged',e=>client?.receive(e.target.value));await otaNotify.startNotifications();await readInstallResult();
  }catch(e){log(`OTA服务或只读安装结果不可用：${e.message}`);client=null;}
  badge('connection','蓝牙已连接','');$('environment').className='notice';$('environment').textContent='设备已连接。所有数据在本机处理；先观察窗口有效性，再开始记录或升级。';log(`连接 ${device.name}；协议v${status.protocol} / MTU${status.mtu}`);
  if(fileInfo)validateSelection();poll=setInterval(()=>{if(!otaBusy)refreshStatus().catch(e=>log(`状态读取：${e.message}`));},5000);
 }catch(e){if(connected())device.gatt.disconnect();throw e;}finally{connecting=false;controls();}
}
function validateSelection(){
 fileInfo=null;if(!firmware){controls();return;}try{fileInfo=validateFirmware(firmware,status?`Petvewi${status.deviceId}`:null);$('fileInfo').textContent=`${fileInfo.deviceName} · FW${fileInfo.version} · ${fileInfo.length.toLocaleString()}字节 · ${fileInfo.sectors}扇区 · CRC ${hex32(fileInfo.crc)} · 布局 ${hex32(fileInfo.layout)}`;}catch(e){$('fileInfo').textContent=e.message;log(`镜像检查：${e.message}`);}controls();
}
async function startOta(){
 if(!fileInfo||!$('otaConfirm').checked||!connected()||!client||otaBusy)throw Error('请连接设备、选择有效应用镜像并勾选升级确认');
 await refreshStatus();const preexisting=await readInstallResult();validateFirmware(firmware,`Petvewi${status.deviceId}`);otaBusy=true;controls();
 const connectionDevice=device;const activeClient=client;log('开始OTA：逐扇区擦除、顺序写入，每条应答匹配后继续；不自动重发写命令');
 try{
  const target=await uploadFirmware(activeClient,firmware,{deviceName:`Petvewi${status.deviceId}`,mtu:status.mtu,runningVersion:preexisting.runningVersion,preexistingResult:preexisting,onProgress:p=>{progress({erase:'擦除暂存扇区',write:'写入应用镜像',commit:'提交校验与重启'}[p.phase],p.percent);$('otaMessage').textContent=p.phase==='write'?`${p.done.toLocaleString()} / ${p.total.toLocaleString()} 字节；逐包ACK已校验`:p.phase==='erase'?`${p.done} / ${p.total} 扇区，只擦除C暂存区`:'等待设备校验镜像并重启';},onCommit:t=>persistTarget({...t,deviceId:connectionDevice.id,requestedAt:Date.now()})});
  progress('已提交，待重连核对',95);$('otaMessage').textContent=`${target.acknowledged?'设备已确认提交':'最后应答未收到，安装状态未知'}。请重新连接同一设备，读取安装结果；上传完成不等于安装成功。`;log('传输结束，保留目标版本与CRC，等待重连核对');
 }catch(e){progress('升级中止 / 未确认',Number($('progress').value));$('otaMessage').textContent=`${e.message}。未确认安装成功；未提交时设备约10秒超时恢复采样。重新上传将从头擦写。`;log(`OTA：${e.message}`);}
 finally{otaBusy=false;$('otaConfirm').checked=false;controls();}
}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportData(){
 if(!recorded.length)return;const rows=[['received_at_utc','kind','frame_sequence','device_id','record_id','uptime_ms','utc_seconds','behavior','heart_bpm','resp_per_min','temperature_C','activity_g','schema','history_samples','feature_flags',...FEATURE_NAMES,'frame_hex']];
 for(const f of recorded){const r=f.record;rows.push([new Date(f.receivedAt).toISOString(),f.kind===0x32?'history':'live',f.sequence,r.deviceId,r.recordId,r.uptimeMs,r.timeValid?r.utcSeconds:'',r.behavior,r.heartRate,r.respiratoryRate,r.temperatureC,r.activityG,f.schema??'',f.samples??'',f.flags??'',...FEATURE_NAMES.map((_,i)=>f.usable?.[i]?f.values[i]:''),f.rawHex]);}
 download(`Petvewi_FW17_${Date.now()}.csv`,csvText(rows),'text/csv;charset=utf-8');log(`已导出 ${recorded.length} 条记录，含原始HEX和有效特征`);
}
function bind(id,fn){$(id).addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>{log(e.message);$('environment').textContent=e.message;$('environment').className='notice warn';}));}
FEATURE_NAMES.forEach((name,i)=>{const o=document.createElement('option');o.value=i;o.textContent=FEATURE_LABELS[i];$('signal').append(o);const tr=document.createElement('tr');if(i>=27)tr.className='period-row';tr.innerHTML=`<td>${String(i+1).padStart(2,'0')}</td><td><strong>${FEATURE_LABELS[i]}</strong><small>${name}</small></td><td>${i>=27?'4秒':'1秒'}</td><td id="value-${i}" class="value">—</td><td>${FEATURE_UNITS[i]}</td><td><span id="valid-${i}" class="badge muted">无效</span></td>`;$('featureRows').append(tr);});
bind('connect',connect);bind('disconnect',()=>device?.gatt.disconnect());for(const id of ['start','stop','history'])bind(id,()=>writeCommand([Number($(id).dataset.command)]));bind('refresh',refreshStatus);bind('sync',()=>{const b=new Uint8Array(5);b[0]=6;new DataView(b.buffer).setUint32(1,Math.floor(Date.now()/1000),true);return writeCommand(b);});bind('diagnostic',()=>writeCommand([7,2]));
bind('otaStart',startOta);bind('otaResult',readInstallResult);bind('otaAbort',()=>{client?.close('用户中止并断开');device?.gatt.disconnect();});
bind('record',()=>{recording=!recording;$('record').textContent=recording?`停止记录 (${recorded.length})`:'继续记录';log(recording?'开始记录有效解析帧，静息/预热无效特征导出为空':'已暂停记录，可导出CSV');});bind('export',exportData);bind('clearLog',()=>{$('log').textContent='';});
bind('demo',async()=>{demo=true;clearLive();const text=await(await fetch('sample.hex')).text();stream.push(Uint8Array.from(text.trim().split(/\s+/),h=>parseInt(h,16)));$('deviceName').textContent='Petvewi002';$('deviceDetail').textContent='固件参考帧 · 非实时设备';badge('connection','示例数据 / 未连接','warn');$('environment').textContent='当前展示固件生成的示例帧，不是实时蓝牙接收。OTA仅在连接真实设备后可用。';$('environment').className='notice warn';log('载入FW17 C序列化器生成的168B参考帧');});
// Register an async file handler once; changing files while OTA is running is disabled.
$('firmware').addEventListener('change',async e=>{try{firmware=e.target.files[0]?new Uint8Array(await e.target.files[0].arrayBuffer()):null;validateSelection();}catch(err){log(err.message);}});
$('otaConfirm').addEventListener('change',controls);$('signal').addEventListener('change',drawChart);window.addEventListener('resize',drawChart);
setInterval(()=>{if(latest&&!demo&&Date.now()-(stats.lastFreshAt??0)>3000)render();else renderStats();},1000);window.addEventListener('beforeunload',e=>{if(otaBusy||recorded.length&&recording){e.preventDefault();e.returnValue='';}});
if(!window.isSecureContext){$('environment').textContent='当前不是安全上下文。请通过HTTPS或 http://localhost 打开，Web Bluetooth无法在此运行。';$('environment').className='notice warn';}else if(!navigator.bluetooth){$('environment').textContent='当前浏览器不支持Web Bluetooth。可载入示例查看；连接真机请使用桌面Chrome/Edge。';$('environment').className='notice warn';}
render();controls();
