// Headless DOM contract checks; this is not a substitute for browser layout QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UUID} from '../protocol.mjs';
const nodes=new Map();
class Element{
 constructor(id=''){this.id=id;this.textContent='';this.disabled=false;this.checked=false;this.className='';this.value=id==='signal'?'0':'';this.listeners={};this.style={};this.children=[];this.clientWidth=600;this.height=210;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 removeEventListener(name,fn){this.listeners[name]=(this.listeners[name]??[]).filter(f=>f!==fn);}
 emit(name,event={}){for(const fn of this.listeners[name]??[])fn({target:this,...event});}
 append(node){this.children.push(node);}
 replaceChildren(...c){this.children=c;}
 set innerHTML(s){for(const [,id] of s.matchAll(/id="([^"]+)"/g))nodes.set(id,new Element(id));}
 getContext(){return new Proxy({},{get:()=>()=>{}});}
 click(){this.emit('click');}
}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Element(id));
for(const [id,cmd] of [['start',1],['stop',2],['history',4]])nodes.get(id).dataset={command:String(cmd)};
const original={document:globalThis.document,window:globalThis.window,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,fetch:globalThis.fetch,localStorage:globalThis.localStorage};
globalThis.document={getElementById:id=>{assert(nodes.has(id),`missing HTML element ${id}`);return nodes.get(id);},createElement:()=>new Element()};globalThis.window={isSecureContext:true,devicePixelRatio:1,addEventListener:()=>{}};
const stored=new Map();globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};globalThis.setInterval=()=>123;globalThis.clearInterval=()=>{};
const status=new Uint8Array(32),sv=new DataView(status.buffer);status[0]=7;status[23]=5;sv.setUint16(10,247,true);sv.setUint16(12,168,true);sv.setUint16(18,2,true);sv.setUint16(8,50,true);
const result=new Uint8Array(16);result[0]=1;new DataView(result.buffer).setUint32(4,17,true);
class Characteristic extends Element{constructor(data){super();this.data=data;this.writes=[];}async readValue(){return new DataView(this.data.buffer);}async startNotifications(){return this;}async writeValueWithResponse(p){this.writes.push(p.slice());}}
const dataChar=new Characteristic(),otaRx=new Characteristic(),otaNotify=new Characteristic(result),command=new Characteristic(),statusChar=new Characteristic(status);
const dev=new Element();dev.id='test-device-002';dev.name='Petvewi002';dev.gatt={connected:false,async connect(){this.connected=true;return this;},disconnect(){this.connected=false;dev.emit('gattserverdisconnected');},async getPrimaryService(id){const map=id===UUID.service?new Map([[UUID.status,statusChar],[UUID.data,dataChar],[UUID.command,command]]):new Map([[UUID.otaRx,otaRx],[UUID.otaNotify,otaNotify]]);return {getCharacteristic:async id=>{assert(map.has(id));return map.get(id);}};}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{bluetooth:{requestDevice:async()=>dev}}});
globalThis.fetch=async url=>{assert.equal(url,'sample.hex');return {text:async()=>fs.readFileSync(new URL('../sample.hex',import.meta.url),'utf8')};};
await import('../app.mjs');
const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
test('initial DOM contract, demo parsing, true connection read-only metadata, disconnect',async()=>{
 assert.equal(nodes.get('featureRows').children.length,31);assert.equal(nodes.get('otaStart').disabled,true);
 nodes.get('demo').click();await flush();assert.equal(nodes.get('featureState').textContent,'完整就绪');assert.equal(nodes.get('connection').textContent,'示例数据 / 未连接');assert.notEqual(nodes.get('value-30').textContent,'—');assert.equal(otaRx.writes.length,0);
 nodes.get('connect').click();await flush();assert.equal(nodes.get('connection').textContent,'蓝牙已连接');assert.equal(nodes.get('runningVersion').textContent,'运行固件：FW17');assert.equal(nodes.get('demo').disabled,true);assert.equal(nodes.get('start').disabled,false);assert.equal(otaRx.writes.length,0,'connect must NOT start OTA or pause acquisition');
 const packet=Uint8Array.from(fs.readFileSync(new URL('../sample.hex',import.meta.url),'utf8').trim().split(/\s+/),v=>parseInt(v,16));dataChar.emit('characteristicvaluechanged',{target:{value:new DataView(packet.buffer)}});assert.equal(nodes.get('featureState').textContent,'完整就绪');
 nodes.get('start').click();await flush();assert.deepEqual([...command.writes[0]],[1]);
 nodes.get('disconnect').click();await flush();assert.equal(nodes.get('connection').textContent,'已断开');assert.equal(nodes.get('featureState').textContent,'数据已过期');assert.equal(nodes.get('value-30').textContent,'—');assert.equal(nodes.get('otaStart').disabled,true);
});
test.after(()=>{for(const k of ['document','window','setInterval','clearInterval','fetch','localStorage']){if(original[k]===undefined)delete globalThis[k];else globalThis[k]=original[k];}if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else delete globalThis.navigator;});
