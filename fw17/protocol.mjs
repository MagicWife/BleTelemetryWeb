export const UUID = Object.freeze({
  service:'e12a0000-7d9b-4f2c-8a3e-5b6c7d8e9f10',status:'e12a0001-7d9b-4f2c-8a3e-5b6c7d8e9f10',data:'e12a0002-7d9b-4f2c-8a3e-5b6c7d8e9f10',command:'e12a0003-7d9b-4f2c-8a3e-5b6c7d8e9f10',
  otaService:'02f00000-0000-0000-0000-00000000fe00',otaRx:'02f00000-0000-0000-0000-00000000ff01',otaNotify:'02f00000-0000-0000-0000-00000000ff02',otaVersion:'02f00000-0000-0000-0000-00000000ff03'
});
export const FLAGS=Object.freeze({VALID:1,WARMUP:2,GAP:4,ACTIVE:8,MIXED:16,ACC_SPECTRUM:32,GYRO_SPECTRUM:64,RESAMPLED:128,CORE_VALID:256,PERIOD_VALID:512,MIXED4:1024,ACC_PERIOD_FOUND:2048,GYRO_PERIOD_FOUND:4096});
export const FEATURE_NAMES=[
 'ax_std__1s','ay_std__1s','az_std__1s','gx_std__1s','gy_std__1s','gz_std__1s','acc_norm_std__1s','dynamic_norm_rms__1s','dynamic_norm_p95__1s','dynamic_norm_std__1s','gyro_norm_rms__1s','gyro_norm_p95__1s','gyro_norm_std__1s','jerk_rms__1s',
 'acc_norm_dominant_hz__1s','acc_norm_centroid_hz__1s','acc_norm_spectral_entropy__1s','acc_norm_band_0_2__1s','acc_norm_band_2_5__1s','acc_norm_band_5_10__1s','gyro_norm_dominant_hz__1s','gyro_norm_centroid_hz__1s','gyro_norm_spectral_entropy__1s','gyro_norm_band_0_2__1s','gyro_norm_band_2_5__1s','gyro_norm_band_5_10__1s','gravity_direction_change_deg__1s',
 'acc_norm_acf_strength__4s','acc_norm_acf_hz__4s','gyro_norm_acf_strength__4s','gyro_norm_acf_hz__4s'];
export const FEATURE_LABELS=['AX 标准差','AY 标准差','AZ 标准差','GX 标准差','GY 标准差','GZ 标准差','加速度模长标准差','动态加速度 RMS','动态加速度 P95','动态加速度标准差','角速度模长 RMS','角速度模长 P95','角速度模长标准差','Jerk RMS','加速度主频','加速度频谱重心','加速度谱熵','加速度 0–2Hz 占比','加速度 2–5Hz 占比','加速度 5–10Hz 占比','角速度主频','角速度频谱重心','角速度谱熵','角速度 0–2Hz 占比','角速度 2–5Hz 占比','角速度 5–10Hz 占比','重力方向变化','加速度周期强度','加速度周期频率','角速度周期强度','角速度周期频率'];
export const FEATURE_UNITS=FEATURE_NAMES.map((n,i)=>n.includes('_hz__')?'Hz':i===26?'°':n.includes('entropy')||n.includes('_band_')||n.includes('acf_strength')?'—':i===13?'m/s³':n.startsWith('g')?'rad/s':'m/s²');
export const BEHAVIORS={0:'未知 / 未佩戴',2:'静息',6:'睡眠',7:'活动'};
export const bytes=x=>x instanceof Uint8Array?x:x instanceof DataView?new Uint8Array(x.buffer,x.byteOffset,x.byteLength):new Uint8Array(x);
export const hex=x=>Array.from(bytes(x),b=>b.toString(16).padStart(2,'0')).join(' ');
export function crc16(input){let crc=0xffff;for(const b of bytes(input)){crc^=b<<8;for(let i=0;i<8;i++)crc=crc&0x8000?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc;}
const CRC32_TABLE=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(input){let crc=0xffffffff;for(const b of bytes(input))crc=CRC32_TABLE[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export const hex32=x=>'0x'+(x>>>0).toString(16).padStart(8,'0').toUpperCase();
export class ProtocolError extends Error{constructor(code,message){super(message);this.code=code;}}
const error=(c,m)=>{throw new ProtocolError(c,m);};
export function parseRecord(input){
 const p=bytes(input);if(p.length!==32)error('length','产品记录必须为32字节');const v=new DataView(p.buffer,p.byteOffset,p.byteLength);
 if(p[28]!==1||p[29]!==0xa5)error('record','记录格式标记错误');if(crc16(p.subarray(0,30))!==v.getUint16(30,true))error('recordCrc','产品记录CRC不匹配');
 const id=String.fromCharCode(...p.subarray(25,28));if(!/^\d{3}$/.test(id))error('identity','设备ID不是三位数字');
 const flags=p[12];return {recordId:v.getUint32(0,true),uptimeMs:v.getUint32(4,true),utcSeconds:v.getUint32(8,true),stateFlags:flags,behavior:p[13],behaviorLabel:BEHAVIORS[p[13]]??`代码 ${p[13]}`,heartRate:(flags&4)&&p[14]!==255?p[14]:null,respiratoryRate:(flags&8)&&p[15]!==255?p[15]:null,heartConfidence:(p[16]&15)/15,respiratoryConfidence:(p[16]>>>4)/15,rssi:flags&64?v.getInt8(17):null,temperatureC:flags&32?v.getInt16(18,true)/256:null,activityG:flags&128?v.getUint32(20,true)/65536:null,deviceId:id,nonrest:!!(p[24]&2),settling:!!(p[24]&1),timeValid:!!(flags&16),behaviorValid:!!(flags&2),absoluteStatic:!!(flags&1)};
}
export function featureUsable(i,flags){if(i>=27)return !!(flags&FLAGS.PERIOD_VALID);if(!(flags&FLAGS.CORE_VALID))return false;if(i>=14&&i<=19)return !!(flags&FLAGS.ACC_SPECTRUM);if(i>=20&&i<=25)return !!(flags&FLAGS.GYRO_SPECTRUM);return true;}
export function parseFrame(input){
 const p=bytes(input);if(p.length<8||p[0]!==0xa5)error('header','缺少A5帧头');if(p.length!==p[3]+8)error('length','帧长度不匹配');const v=new DataView(p.buffer,p.byteOffset,p.byteLength);
 if(crc16(p.subarray(0,-2))!==v.getUint16(p.length-2,true))error('outerCrc','外层CRC不匹配');if(p[1]!==7)error('version',`收到协议v${p[1]}，本页要求FW17/v7`);
 const kind=p[2],base={kind,sequence:v.getUint16(4,true),rawHex:hex(p),receivedAt:Date.now()};
 if(kind===0x33){const d=p.subarray(6,-2);return {...base,diagnostic:d.slice(),health:d.length>=6&&d[0]===1&&d[1]===0?new DataView(d.buffer,d.byteOffset,d.byteLength).getUint16(2,true):null};}
 if(kind!==0x31&&kind!==0x32&&kind!==0x42)return {...base,unknown:true};
 if(p[3]!== (kind===0x42?160:32))error('length','结果帧payload长度错误');const record=parseRecord(p.subarray(6,38));
 if(kind!==0x42)return {...base,record};
 const schema=p[38],samples=p[39],flags=v.getUint16(40,true);if(schema!==2)error('schema',`收到schema ${schema}，需要schema 2`);if(samples>200)error('samples','4秒历史点数超出200');
 if((flags&FLAGS.CORE_VALID)&&samples<100)error('flags','1秒核心尚未完成预热');if((flags&FLAGS.PERIOD_VALID)&&samples!==200)error('flags','4秒特征不足200点');
 if((flags&FLAGS.VALID)&&((flags&0x300)!==0x300||flags&FLAGS.WARMUP))error('flags','完整有效标记与窗口状态冲突');
 const values=Array.from({length:31},(_,i)=>v.getFloat32(42+i*4,true));if(!values.every(Number.isFinite))error('nonfinite','特征包含NaN或Infinity');
 return {...base,record,schema,samples,flags,values,usable:values.map((_,i)=>featureUsable(i,flags)),coreValid:!!(flags&256),periodValid:!!(flags&512),valid:!!(flags&1)};
}
export function parseStatus(input){
 const p=bytes(input);if(p.length<32)error('status','设备status不足32字节');const v=new DataView(p.buffer,p.byteOffset,p.byteLength);
 return {protocol:p[0],state:p[1],batteryAdc:v.getUint16(2,true),storedRecords:v.getUint32(4,true),sampleHz:v.getUint16(8,true),mtu:v.getUint16(10,true),realtimeFrameBytes:v.getUint16(12,true),historyFrameBytes:v.getUint16(14,true),realtimeHz:p[16],capabilities:p[17],deviceId:String(v.getUint16(18,true)).padStart(3,'0'),format:p[23],txDropped:v.getUint32(24,true),notifyBusy:!!p[28],streaming:!!p[29],batteryEncoding:p[30]};
}
export class FrameStream{
 constructor(onFrame,onError=()=>{}){this.onFrame=onFrame;this.onError=onError;this.buffer=new Uint8Array(0);}
 reset(){this.buffer=new Uint8Array(0);}
 push(input){
  const chunk=bytes(input);if(chunk.length>65536){this.reset();this.onError(new ProtocolError('overflow','通知过大'));return;}
  const merged=new Uint8Array(this.buffer.length+chunk.length);merged.set(this.buffer);merged.set(chunk,this.buffer.length);this.buffer=merged;
  while(this.buffer.length){
   const start=this.buffer.indexOf(0xa5);if(start<0){this.reset();break;}if(start>0)this.buffer=this.buffer.slice(start);if(this.buffer.length<4)break;
   const n=this.buffer[3];if(n>244){this.buffer=this.buffer.slice(1);this.onError(new ProtocolError('length','非法payload长度'));continue;}const size=n+8;if(this.buffer.length<size)break;
   const p=this.buffer.slice(0,size);if(crc16(p.subarray(0,-2))!==(p[size-2]|p[size-1]<<8)){this.buffer=this.buffer.slice(1);this.onError(new ProtocolError('outerCrc','接收流CRC错误，重新同步'));continue;}
   this.buffer=this.buffer.slice(size);try{this.onFrame(parseFrame(p));}catch(e){this.onError(e);}
  }
 }
}
export class TelemetryStats{
 constructor(){this.frames=0;this.live=0;this.history=0;this.duplicates=0;this.sequenceGaps=0;this.sequenceResets=0;this.errors={};this.lastSequence=null;this.lastRecord=null;this.lastFreshAt=null;this.intervals=[];}
 error(e){this.errors[e.code??'other']=(this.errors[e.code??'other']??0)+1;}
 accept(f){
  this.frames++;
  if(this.lastSequence!==null){const delta=(f.sequence-this.lastSequence+65536)%65536;if(delta>1&&delta<32768)this.sequenceGaps+=delta-1;else if(delta>=32768)this.sequenceResets++;}this.lastSequence=f.sequence;
  if(f.kind===0x32){this.history++;return false;}if(f.kind!==0x42&&f.kind!==0x31)return false;this.live++;
  const key=`${f.record.recordId}:${f.record.uptimeMs}`;if(key===this.lastRecord){this.duplicates++;return false;}
  this.lastRecord=key;if(this.lastFreshAt!==null){this.intervals.push(f.receivedAt-this.lastFreshAt);if(this.intervals.length>60)this.intervals.shift();}this.lastFreshAt=f.receivedAt;return true;
 }
}
export function makeFrame(kind,payload,sequence=0){const p=bytes(payload);if(p.length>244)throw Error('payload too large');const out=new Uint8Array(p.length+8),v=new DataView(out.buffer);out.set([0xa5,7,kind,p.length]);v.setUint16(4,sequence,true);out.set(p,6);v.setUint16(out.length-2,crc16(out.subarray(0,-2)),true);return out;}
export function csvText(rows){const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n');}
