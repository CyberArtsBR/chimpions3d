import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {BUILT_IN_CHIMPION_NAMES,filterBuiltInRoster} from '../src/roster.js';

function parseGLB(filePath){
  const b=fs.readFileSync(filePath);
  assert(b.length>=20,`${filePath}: incomplete GLB`);
  assert.equal(b.toString('ascii',0,4),'glTF',`${filePath}: invalid GLB magic`);
  assert.equal(b.readUInt32LE(4),2,`${filePath}: expected glTF 2.0`);
  assert.equal(b.readUInt32LE(8),b.length,`${filePath}: header length mismatch`);
  const jsonLength=b.readUInt32LE(12);
  assert(20+jsonLength<=b.length,`${filePath}: incomplete JSON chunk`);
  assert.equal(b.readUInt32LE(16),0x4e4f534a,`${filePath}: first chunk must be JSON`);
  const json=JSON.parse(b.subarray(20,20+jsonLength).toString().trim());
  const nextChunk=20+jsonLength;
  const binOffset=nextChunk+8<=b.length&&b.readUInt32LE(nextChunk+4)===0x004e4942?nextChunk+8:null;
  return {bytes:b.length,json,buffer:b,binOffset};
}

function triangles(json){
  let total=0;
  for(const mesh of json.meshes||[])for(const p of mesh.primitives||[]){
    if((p.mode??4)!==4)continue;
    const accessor=p.indices??p.attributes?.POSITION;
    const count=json.accessors?.[accessor]?.count||0;
    total+=Math.floor(count/3);
  }
  return total;
}

function vertices(json){
  const positions=new Set();
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){
    const accessor=primitive.attributes?.POSITION;
    if(accessor!==undefined)positions.add(accessor);
  }
  let total=0;
  for(const accessor of positions)total+=json.accessors?.[accessor]?.count||0;
  return total;
}

function embeddedImageBuffer(json,image,buffer,binOffset){
  if(image.bufferView!==undefined&&buffer&&binOffset!==null){
    const view=json.bufferViews?.[image.bufferView];
    if(view){
      const start=binOffset+(view.byteOffset||0),end=start+(view.byteLength||0);
      if(start>=0&&end<=buffer.length)return buffer.subarray(start,end);
    }
  }
  if(typeof image.uri==='string'&&image.uri.startsWith('data:')){
    const comma=image.uri.indexOf(',');
    if(comma>=0){
      const body=image.uri.slice(comma+1);
      return image.uri.slice(0,comma).includes(';base64')?Buffer.from(body,'base64'):Buffer.from(decodeURIComponent(body));
    }
  }
  return null;
}

function imageDimensions(buffer){
  if(!buffer?.length)return null;
  if(buffer.length>=24&&buffer.toString('ascii',1,4)==='PNG')return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(buffer.length>=30&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'){
    const type=buffer.toString('ascii',12,16);
    if(type==='VP8X')return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};
    if(type==='VP8 '&&buffer[23]===0x9d&&buffer[24]===0x01&&buffer[25]===0x2a)return {width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff};
    if(type==='VP8L'&&buffer[20]===0x2f){const bits=buffer.readUInt32LE(21);return {width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1};}
  }
  if(buffer.length>=4&&buffer[0]===0xff&&buffer[1]===0xd8){
    let offset=2;
    while(offset+9<buffer.length){
      if(buffer[offset]!==0xff){offset++;continue;}
      const marker=buffer[offset+1],length=buffer.readUInt16BE(offset+2);
      if(length<2||offset+2+length>buffer.length)break;
      if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
        return {width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5)};
      }
      offset+=2+length;
    }
  }
  return null;
}

function assetInfo(name,bytes,json,buffer=null,binOffset=null){
  const jointIndexes=[...new Set((json.skins||[]).flatMap(s=>s.joints||[]))];
  const images=(json.images||[]).map((image,index)=>{
    const encoded=embeddedImageBuffer(json,image,buffer,binOffset);
    return {
      index,mimeType:image.mimeType||null,uri:image.uri||null,bufferView:image.bufferView??null,
      encodedBytes:encoded?.byteLength||null,
      dimensions:imageDimensions(encoded)
    };
  });
  const largestTexture=images.reduce((largest,image)=>(image.encodedBytes||0)>(largest?.encodedBytes||0)?image:largest,null);
  return {
    name,bytes,
    extensionsUsed:json.extensionsUsed||[],
    extensionsRequired:json.extensionsRequired||[],
    skins:(json.skins||[]).length,
    joints:(json.skins||[]).reduce((n,s)=>n+(s.joints?.length||0),0),
    jointNames:jointIndexes.map(i=>json.nodes?.[i]?.name||`node#${i}`),
    skinnedNodes:(json.nodes||[]).filter(n=>n.mesh!==undefined&&n.skin!==undefined).length,
    triangles:triangles(json),vertices:vertices(json),
    nodes:(json.nodes||[]).length,meshes:(json.meshes||[]).length,
    materials:(json.materials||[]).length,textures:(json.textures||[]).length,
    animations:(json.animations||[]).length,
    images,largestTexture
  };
}

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else out.push(full.replaceAll('\\','/'));
  }
  return out;
}

function sha256(filePath){
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function collectTextReferences(){
  const roots=['src','server','public','index.html','package.json'];
  const allowed=/\.(?:js|mjs|cjs|ts|tsx|jsx|css|html|json|md)$/i;
  let text='';
  for(const root of roots){
    if(!fs.existsSync(root))continue;
    const files=fs.statSync(root).isDirectory()?walk(root):[root];
    for(const file of files){
      if(!allowed.test(file)||file.endsWith('assets-report.json'))continue;
      try{text+='\n'+fs.readFileSync(file,'utf8');}catch{}
    }
  }
  return text;
}

const dashCriticalAssets=[
  'public/dash/assets/jungle-v2.1f8e991e.webp',
  'public/dash/assets/ground-green.5163bede.png',
  'public/dash/assets/sprites/log.bdc546a2.png',
  'public/dash/assets/sprites/mushroom.ed146566.png',
  'public/dash/assets/sprites/thorns.9c23d2a8.png',
  'public/dash/assets/sprites/stump.79b7a74b.png',
  'public/dash/assets/sprites/spike.9209c4ec.png',
  'public/dash/assets/sprites/puddle.63b40637.png',
  'public/dash/assets/sprites/spike-patch.30ffeb5a.png',
  'public/dash/assets/sprites/branch.9e282e4d.png',
  'public/dash/assets/sprites/vine.4fa7e992.png',
  'public/dash/assets/sprites/canopy.953eaa4e.png',
  'public/dash/assets/sprites/banana.7595c6cd.png',
  'public/dash/assets/sprites/golden.f3ec3655.png'
];
for(const file of dashCriticalAssets)assert(fs.existsSync(file),'Missing localized Dash critical asset: '+file);
const dashLabSource=fs.readFileSync('src/chimpionsLab.js','utf8');
const dashCssSource=fs.readFileSync('src/chimpionsLab.css','utf8');
assert(!dashLabSource.includes('getImageData('),'Dash must not alpha-scan sprites at runtime');
assert(!dashLabSource.includes('trimmedSprite('),'Dash runtime sprite trimming must stay removed');
assert(!dashLabSource.includes('raw.githubusercontent.com'),'Dash critical runtime code must not use GitHub Raw assets');
assert(!dashCssSource.includes('raw.githubusercontent.com'),'Dash CSS scenery must be same-origin');
const dashCriticalBytes=dashCriticalAssets.reduce((n,file)=>n+fs.statSync(file).size,0);
console.log('DASH_LOCAL_ASSET_REPORT:'+JSON.stringify({files:dashCriticalAssets.length,bytes:dashCriticalBytes}));

const avatars=filterBuiltInRoster(JSON.parse(fs.readFileSync('public/avatars.json','utf8')));
assert.equal(avatars.length,10,'Expected exactly 10 approved built-in Chimpions');
assert.deepEqual(avatars.map(a=>a.name),BUILT_IN_CHIMPION_NAMES,'Roster order/names must match the canonical allowlist');
assert.equal(new Set(avatars.map(a=>a.id)).size,avatars.length,'Unique IDs');
assert(avatars.every(a=>a.url?.startsWith('model/characters/')),'Every built-in must resolve inside public/model/characters');
const characterFiles=fs.readdirSync('public/model/characters').filter(name=>/\.glb$/i.test(name)).sort();
assert.deepEqual(characterFiles,[...BUILT_IN_CHIMPION_NAMES].map(name=>name+'.glb').sort(),'Character directory must contain only the 10 approved GLBs');
assert(fs.existsSync('public/model/chimpion.glb'),'Required non-roster public/model/chimpion.glb must be preserved');

const avatarReport=[];
for(const avatar of avatars.filter(a=>a.url)){
  const filePath='public/'+decodeURIComponent(avatar.url);
  assert(fs.existsSync(filePath),`${avatar.name}: missing ${filePath}`);
  const {bytes,json,buffer,binOffset}=parseGLB(filePath);
  const info=assetInfo(avatar.name,bytes,json,buffer,binOffset);
  assert(info.skins>0,`${avatar.name}: no skin`);
  assert(info.joints>0,`${avatar.name}: skin has no joints`);
  assert(info.skinnedNodes>0,`${avatar.name}: no skinned mesh node`);
  avatarReport.push(info);
}
console.log('AVATAR_ASSET_COUNT:'+avatarReport.length);

const branchPath='public/environment/platforms/branch-moss.glb';
assert(fs.existsSync(branchPath),'Missing branch-moss.glb');
const branch=parseGLB(branchPath);
const branchReport=assetInfo('branch-moss.glb',branch.bytes,branch.json,branch.buffer,branch.binOffset);
assert(branchReport.meshes>0,'branch-moss.glb has no mesh');
console.log('BRANCH_ASSET_REPORT:'+JSON.stringify(branchReport));

const publicFiles=walk('public').map(file=>({
  path:file,
  bytes:fs.statSync(file).size,
  ext:path.extname(file).toLowerCase()||'(none)'
}));
const totalBytes=publicFiles.reduce((n,f)=>n+f.bytes,0);
const byExtension={};
for(const file of publicFiles){
  byExtension[file.ext]??={count:0,bytes:0};
  byExtension[file.ext].count++;
  byExtension[file.ext].bytes+=file.bytes;
}

const rootGlbs=publicFiles.filter(f=>f.ext==='.glb'&&path.dirname(f.path)==='public');
const audioFiles=publicFiles.filter(f=>/\.(?:mp3|wav|ogg|m4a)$/i.test(f.path));
const imageFiles=publicFiles.filter(f=>/\.(?:png|jpe?g|webp|gif|avif)$/i.test(f.path));
const environmentFiles=publicFiles.filter(f=>f.path.startsWith('public/environment/'));
const largestFiles=[...publicFiles].sort((a,b)=>b.bytes-a.bytes).slice(0,25);

// Hash only likely duplicate candidates (audio/images/configs), not hundreds of large avatar GLBs.
const duplicateCandidates=publicFiles.filter(f=>/\.(?:mp3|wav|ogg|m4a|png|jpe?g|webp|gif|avif|json)$/i.test(f.path));
const hashes=new Map();
for(const file of duplicateCandidates){
  const key=sha256(file.path);
  if(!hashes.has(key))hashes.set(key,[]);
  hashes.get(key).push(file);
}
const duplicateGroups=[...hashes.entries()]
  .filter(([,files])=>files.length>1)
  .map(([hash,files])=>({hash,bytes:files[0].bytes,files:files.map(f=>f.path)}));

const references=collectTextReferences();
const runtimeCandidates=[...audioFiles,...imageFiles,...environmentFiles.filter(f=>f.ext!=='.glb')];
const possiblyUnreferenced=runtimeCandidates.filter(file=>{
  const rel=file.path.replace(/^public\//,'');
  const base=path.basename(file.path);
  return !references.includes(rel)&&!references.includes(base);
});

const audioUsage=audioFiles.map(file=>({
  ...file,
  referenced:references.includes(file.path.replace(/^public\//,''))||references.includes(path.basename(file.path))
}));

const audit={
  summary:{
    publicFiles:publicFiles.length,
    totalBytes,
    totalMiB:Number((totalBytes/1024/1024).toFixed(2)),
    avatarCount:avatarReport.length,
    rootGlbCount:rootGlbs.length,
    audioCount:audioFiles.length,
    imageCount:imageFiles.length,
    duplicateGroupCount:duplicateGroups.length,
    possiblyUnreferencedCount:possiblyUnreferenced.length,
    dashCriticalAssetCount:dashCriticalAssets.length,
    dashCriticalAssetBytes:dashCriticalBytes
  },
  byExtension,
  branch:branchReport,
  avatars:avatarReport,
  rootGlbs,
  audioUsage,
  duplicateGroups,
  possiblyUnreferenced,
  largestFiles
};

fs.writeFileSync('checks/assets-report.json',JSON.stringify(audit,null,2));
console.log('ASSET_AUDIT_SUMMARY:'+JSON.stringify(audit.summary));
if(rootGlbs.length)console.log('ROOT_GLB_REVIEW:'+JSON.stringify(rootGlbs));
if(duplicateGroups.length)console.log('DUPLICATE_ASSET_GROUPS:'+JSON.stringify(duplicateGroups));
if(possiblyUnreferenced.length)console.log('POSSIBLY_UNREFERENCED:'+JSON.stringify(possiblyUnreferenced));
console.log('PASS assets: exactly 10 approved Chimpion GLBs are valid; non-roster chimpion.glb and branch-moss.glb are preserved');
