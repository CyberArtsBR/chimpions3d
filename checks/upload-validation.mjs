import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readLocalGLB,validateGLB} from '../src/upload.js';

function glb(json){
  const raw=Buffer.from(JSON.stringify(json));
  const jsonChunk=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(jsonChunk);
  const out=Buffer.alloc(20+jsonChunk.length);
  out.write('glTF',0,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(jsonChunk.length,12);out.writeUInt32LE(0x4e4f534a,16);jsonChunk.copy(out,20);
  return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
const valid={asset:{version:'2.0'},nodes:[{name:'Hips'}],skins:[{joints:[0]}]};
assert.doesNotThrow(()=>validateGLB(glb(valid)));
assert.throws(()=>validateGLB(new ArrayBuffer(8)),/complete GLB/i);
assert.throws(()=>validateGLB(glb({asset:{version:'2.0'},nodes:[{}]})),/no skinning/i);
assert.throws(()=>validateGLB(glb({...valid,buffers:[{uri:'https://example.com/body.bin'}]})),/self-contained GLB/i);
assert.throws(()=>validateGLB(glb({...valid,nodes:Array.from({length:2001},()=>({}))})),/too many scene nodes/i);
assert.throws(()=>validateGLB(glb({...valid,extensionsRequired:['KHR_draco_mesh_compression']})),/without Draco/i);

const buffer=glb(valid);
const file={name:'chimp.glb',size:buffer.byteLength,arrayBuffer:async()=>buffer};
assert.equal((await readLocalGLB(file)).byteLength,buffer.byteLength);
await assert.rejects(()=>readLocalGLB({name:'chimp.glb',size:32*1024*1024+1,arrayBuffer:async()=>buffer}),/32 MB/i);
await assert.rejects(()=>readLocalGLB({name:'chimp.gltf',size:10,arrayBuffer:async()=>buffer}),/\.glb file/i);

fs.writeFileSync('checks/upload-validation-report.json',JSON.stringify({status:'PASS',covers:['valid GLB','invalid GLB','non-skinned GLB','external resource rejection','scene-node complexity limit','unsupported compression','32 MB limit']},null,2));
console.log('PASS local GLB validation boundaries');
