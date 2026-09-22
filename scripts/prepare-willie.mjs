import fs from 'node:fs';
import path from 'node:path';
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const source='assets/steamboat-willie/rig.br';
const output='public/model/steamboat_willie.glb';
const expectedSha='d14feca93846f64f4c71ee271e00789ddf22ada0fdd4d4d8e88ef608237ed3ca';
const required=[
  'Hips','Spine','Chest','Neck','Head',
  'LeftShoulder','LeftUpperArm','LeftForearm','LeftHand',
  'RightShoulder','RightUpperArm','RightForearm','RightHand',
  'LeftThigh','LeftShin','LeftFoot','RightThigh','RightShin','RightFoot'
];

if(!fs.existsSync(source))throw new Error('Missing compressed Steamboat Willie rig source');
const bytes=brotliDecompressSync(fs.readFileSync(source));
const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==expectedSha)throw new Error('Steamboat Willie rig checksum mismatch: '+digest);
if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
  throw new Error('Steamboat Willie rig is not a complete GLB 2.0 file');
const jsonLength=bytes.readUInt32LE(12);
if(20+jsonLength>bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)
  throw new Error('Steamboat Willie rig has an invalid GLB JSON chunk');
const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString().trim());
const joints=[...new Set((json.skins||[]).flatMap(s=>s.joints||[]))];
const names=joints.map(i=>json.nodes?.[i]?.name).filter(Boolean);
const missing=required.filter(name=>!names.includes(name));
const skinned=(json.nodes||[]).filter(n=>n.mesh!==undefined&&n.skin!==undefined);
if((json.skins||[]).length!==1||joints.length!==19||skinned.length<1||missing.length)
  throw new Error('Steamboat Willie rig validation failed; missing bones: '+missing.join(', '));
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,bytes);
console.log('Steamboat Willie rig ready: '+bytes.length+' bytes · 19 bones · sha256 '+digest);
