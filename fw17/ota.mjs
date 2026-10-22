import {bytes,crc32,hex32} from './protocol.mjs';
export const LAYOUT={id:0x02000001,start:0x68000,end:0xce000,capacity:0x66000,sector:4096,aAbi:1,aCrc:0xe9a4172a};
export function validateFirmware(input,deviceName=null){
 const p=bytes(input);if(p.length<36||p.length>LAYOUT.capacity)throw Error('请选择OTA_APP应用镜像（≤408KiB），不能选择FULL_BURN、A区或源码ZIP');
 const v=new DataView(p.buffer,p.byteOffset,p.byteLength),sp=v.getUint32(0,true),reset=v.getUint32(4,true);
 if(sp<0x20001818||sp>0x20018000||!(reset&1)||(reset&~1)<0x10002000||(reset&~1)>=0x10068000)throw Error('应用向量表错误：禁止上传完整烧录镜像或A区镜像');
 const contracts=[];for(let i=0;i+36<=p.length;i+=4)if(v.getUint32(i,true)===0x4f544131&&v.getUint32(i+4,true)===1)contracts.push(i);
 if(contracts.length!==1)throw Error('未找到唯一有效OTA契约');const at=contracts[0],c=Array.from({length:9},(_,i)=>v.getUint32(at+i*4,true));
 if(c[2]!==LAYOUT.id)throw Error(`镜像分区不兼容：${hex32(c[2])}`);if(c[3]!==LAYOUT.aAbi||c[4]!==LAYOUT.aCrc)throw Error('镜像所需A区ABI/CRC与FW16/17基线不一致');
 if(c[5]!==p.length)throw Error('OTA契约长度不等于文件长度');if(c[6]<17||c[7]!==1)throw Error('仅支持FW17及以上的当前新布局应用镜像');if(crc32(p.subarray(at,at+32))!==c[8])throw Error('OTA契约CRC错误');
 const text=new TextDecoder('latin1').decode(p),names=[...new Set(text.match(/Petvewi\d{3}(?=\x00)/g)??[])];
 if(names.length!==1)throw Error('镜像中未找到唯一Petvewi设备身份');if(deviceName&&names[0]!==deviceName)throw Error(`镜像属于${names[0]}，当前设备为${deviceName}`);
 return {version:c[6],length:p.length,crc:crc32(p),layout:c[2],aCrc:c[4],contractOffset:at,deviceName:names[0],sectors:Math.ceil(p.length/4096)};
}
export function otaCommand(op,payload=new Uint8Array()){payload=bytes(payload);const p=new Uint8Array(payload.length+3);p[0]=op;new DataView(p.buffer).setUint16(1,payload.length,true);p.set(payload,3);return p;}
export function words(...values){const p=new Uint8Array(values.length*4),v=new DataView(p.buffer);values.forEach((x,i)=>v.setUint32(i*4,x,true));return p;}
export function parseOtaResponse(input){const p=bytes(input);if(p.length<4)throw Error('OTA应答不足4字节');const v=new DataView(p.buffer,p.byteOffset,p.byteLength),n=v.getUint16(2,true);if(n!==p.length-4)throw Error('OTA应答长度错误');return {result:p[0],op:p[1],payload:p.slice(4)};}
export function parseOtaResult(input){const p=bytes(input);if(p.length!==16||p[0]!==1||p[1]>3)throw Error('OTA安装结果格式不支持');const v=new DataView(p.buffer,p.byteOffset,p.byteLength);return {state:p[1],attempt:p[2],runningVersion:v.getUint32(4,true),targetVersion:v.getUint32(8,true),targetCrc:v.getUint32(12,true)};}
export function verifyResult(r,target){
 if(!target)return {state:'reported',message:`设备记录：${['无安装记录','待安装/恢复','成功','失败'][r.state]}；当前FW${r.runningVersion}`};
 if(r.state===3)return {state:'failed',message:'设备报告安装失败，请保留日志'};
 if(r.state===1)return {state:'pending',message:'设备报告安装待完成或恢复中'};
 if(r.state!==2||r.runningVersion!==target.version||r.targetVersion!==target.version||r.targetCrc!==target.crc)return {state:'unconfirmed',message:'尚未找到与本次目标版本和CRC一致的成功结果'};
 if(target.preexistingSameSuccess)return {state:'image-verified',message:'设备报告目标镜像运行且CRC一致；同版本同CRC重装无法仅凭持久结果区分上次成功记录'};
 return {state:'verified',message:'设备安装结果SUCCESS，运行版本、目标版本与镜像CRC均匹配'};
}
export class OtaClient{
 constructor(write,{timeoutMs=8000}={}){this.write=write;this.timeoutMs=timeoutMs;this.pending=null;this.closed=false;}
 receive(input){let r;try{r=parseOtaResponse(input);}catch{return;}const q=this.pending;if(!q||r.op!==q.op)return;clearTimeout(q.timer);this.pending=null;if(r.result!==0)q.reject(Object.assign(Error(`设备拒绝OTA命令0x${r.op.toString(16)}（结果${r.result}）`),{code:'rejected'}));else q.resolve(r.payload);}
 close(reason='蓝牙已断开'){this.closed=true;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(reason));this.pending=null;}}
 async request(op,payload){
  if(this.closed)throw Error('OTA连接已关闭');if(this.pending)throw Error('已有OTA命令未完成');
  return new Promise((resolve,reject)=>{
   const q={op,resolve,reject,timer:setTimeout(()=>{if(this.pending===q){this.pending=null;reject(Error(`OTA命令0x${op.toString(16)}应答超时；未自动重发，请重新开始`));}},this.timeoutMs)};this.pending=q;
   Promise.resolve().then(()=>this.write(otaCommand(op,payload))).catch(e=>{if(this.pending===q){clearTimeout(q.timer);this.pending=null;reject(e);}});
  });
 }
}
export async function uploadFirmware(client,input,{deviceName,mtu=23,runningVersion=0,onProgress=()=>{},onCommit=()=>{},preexistingResult=null}={}){
 const p=bytes(input),info=validateFirmware(p,deviceName);if(runningVersion<16)throw Error('FW15及旧布局须先有线完整烧录，不能使用本页OTA迁移');if(info.version<runningVersion)throw Error('本页不执行降级更新');
 if(!Number.isInteger(mtu)||mtu<23||mtu>517)throw Error('ATT MTU无效');const chunk=Math.min(mtu-3,244)-9;
 // GET_BASE starts the device OTA session and pauses acquisition; do it only after user starts.
 const baseReply=await client.request(1);if(baseReply.length!==4||new DataView(baseReply.buffer,baseReply.byteOffset,4).getUint32(0,true)!==LAYOUT.start)throw Error('设备暂存地址不是0x68000，已停止；设备超时后恢复采样');
 for(let i=0;i<info.sectors;i++){
  const address=LAYOUT.start+i*4096,r=await client.request(3,words(address));if(r.length!==4||new DataView(r.buffer,r.byteOffset,4).getUint32(0,true)!==address)throw Error('擦除应答地址错误');
  onProgress({phase:'erase',done:i+1,total:info.sectors,percent:20*(i+1)/info.sectors});
 }
 for(let offset=0;offset<p.length;offset+=chunk){
  const n=Math.min(chunk,p.length-offset),payload=new Uint8Array(6+n),v=new DataView(payload.buffer);v.setUint32(0,LAYOUT.start+offset,true);v.setUint16(4,n,true);payload.set(p.subarray(offset,offset+n),6);
  const r=await client.request(5,payload);if(r.length!==6)throw Error('写入应答长度错误');const rv=new DataView(r.buffer,r.byteOffset,6);if(rv.getUint32(0,true)!==LAYOUT.start+offset||rv.getUint16(4,true)!==n)throw Error('写入应答地址/长度不匹配');
  onProgress({phase:'write',done:offset+n,total:p.length,percent:20+75*(offset+n)/p.length});
 }
 const target={...info,preexistingSameSuccess:!!(preexistingResult&&preexistingResult.state===2&&preexistingResult.runningVersion===info.version&&preexistingResult.targetVersion===info.version&&preexistingResult.targetCrc===info.crc)};
 onCommit(target);onProgress({phase:'commit',percent:95,done:p.length,total:p.length});
 try{await client.request(9,words(info.length,info.crc));}catch(e){
  // Firmware may reboot before the ACK reaches the browser. Neither timeout nor disconnect proves success.
  if(e.code==='rejected'||!client.closed&&!/超时/.test(e.message))throw e;
  return {...target,pending:true,acknowledged:false};
 }
 return {...target,pending:true,acknowledged:true};
}
