import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {BUILT_IN_CHIMPION_NAMES,filterBuiltInRoster} from '../src/roster.js';
import {ASSET_BUDGETS,ASSET_TARGETS,UNSUPPORTED_BUILTIN_REQUIRED_EXTENSIONS} from '../scripts/assets/asset-budgets.mjs';

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
  return {bytes:b.length,json};
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

function assetInfo(name,bytes,json){
  const jointIndexes=[...new Set((json.skins||[]).flatMap(s=>s.joints||[]))];
  return {
    name,bytes,
    extensionsUsed:json.extensionsUsed||[],
    extensionsRequired:json.extensionsRequired||[],
    animations:(json.animations||[]).length,
    skins:(json.skins||[]).length,
    joints:(json.skins||[]).reduce((n,s)=>n+(s.joints?.length||0),0),
    jointNames:jointIndexes.map(i=>json.nodes?.[i]?.name||`node#${i}`),
    skinnedNodes:(json.nodes||[]).filter(n=>n.mesh!==undefined&&n.skin!==undefined).length,
    triangles:triangles(json),nodes:(json.nodes||[]).length,meshes:(json.meshes||[]).length,
    materials:(json.materials||[]).length,textures:(json.textures||[]).length,
    images:(json.images||[]).map(i=>({mimeType:i.mimeType||null,uri:i.uri||null,bufferView:i.bufferView??null})),
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

function readUInt24LE(buffer,offset){
  return buffer[offset]|(buffer[offset+1]<<8)|(buffer[offset+2]<<16);
}

function imageDimensions(filePath,ext){
  const b=fs.readFileSync(filePath);
  if(ext==='.png'&&b.length>=24&&b.subarray(1,4).toString()==='PNG')
    return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  if(ext==='.webp'&&b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
    let offset=12;
    while(offset+8<=b.length){
      const type=b.toString('ascii',offset,offset+4),size=b.readUInt32LE(offset+4),data=offset+8;
      if(type==='VP8X'&&data+10<=b.length)return {width:1+readUInt24LE(b,data+4),height:1+readUInt24LE(b,data+7)};
      if(type==='VP8 '&&data+10<=b.length&&b[data+3]===0x9d&&b[data+4]===0x01&&b[data+5]===0x2a)
        return {width:b.readUInt16LE(data+6)&0x3fff,height:b.readUInt16LE(data+8)&0x3fff};
      if(type==='VP8L'&&data+5<=b.length&&b[data]===0x2f){
        const b1=b[data+1],b2=b[data+2],b3=b[data+3],b4=b[data+4];
        return {width:1+(b1|((b2&0x3f)<<8)),height:1+((b2>>6)|(b3<<2)|((b4&0x0f)<<10))};
      }
      offset=data+size+(size&1);
    }
  }
  return null;
}

function gpuTextureBytes(dimensions){
  return dimensions?Math.ceil(dimensions.width*dimensions.height*4*4/3):null;
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
  const {bytes,json}=parseGLB(filePath);
  const info=assetInfo(avatar.name,bytes,json);
  assert(info.skins>0,`${avatar.name}: no skin`);
  assert(info.joints>0,`${avatar.name}: skin has no joints`);
  assert(info.skinnedNodes>0,`${avatar.name}: no skinned mesh node`);
  avatarReport.push(info);
}
console.log('AVATAR_ASSET_COUNT:'+avatarReport.length);

const branchPath='public/environment/platforms/branch-moss.glb';
assert(fs.existsSync(branchPath),'Missing branch-moss.glb');
const branch=parseGLB(branchPath);
const branchReport=assetInfo('branch-moss.glb',branch.bytes,branch.json);
assert(branchReport.meshes>0,'branch-moss.glb has no mesh');
console.log('BRANCH_ASSET_REPORT:'+JSON.stringify(branchReport));

const publicFiles=walk('public').map(file=>{
  const ext=path.extname(file).toLowerCase()||'(none)';
  const dimensions=/\.(?:png|jpe?g|webp|avif)$/i.test(file)?imageDimensions(file,ext):null;
  return {
    path:file,
    bytes:fs.statSync(file).size,
    ext,
    dimensions,
    estimatedGpuTextureBytes:gpuTextureBytes(dimensions)
  };
});
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

// Hash the entire public payload so exact duplicates cannot hide in GLBs or other binaries.
const duplicateCandidates=publicFiles;
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
const isReferenced=file=>{
  const rel=file.path.replace(/^public\//,''),base=path.basename(file.path);
  return [rel,'/'+rel,encodeURI(rel),encodeURI('/'+rel),base,encodeURIComponent(base)].some(value=>references.includes(value));
};
const loadingTier=file=>{
  if(file.path.startsWith('public/launcher/')&&!/\.(?:mp3|wav|ogg|m4a)$/i.test(file.path))return 'TIER_0_CRITICAL_SHELL';
  if(['public/avatars.json','public/characters.json','public/environment.json'].includes(file.path))return 'TIER_1_GAME_START';
  if(file.path.startsWith('public/environment/')||file.path==='public/ui/start-screen.webp'||file.path==='public/screens/chimp-jump-start.png')return 'TIER_1_GAME_START';
  if(file.path.startsWith('public/model/characters/')||/\.(?:mp3|wav|ogg|m4a)$/i.test(file.path))return 'TIER_2_LAZY';
  return isReferenced(file)?'TIER_2_LAZY':'TIER_3_DEFERRED_OR_UNUSED';
};
for(const file of publicFiles){file.referenced=isReferenced(file);file.loadingTier=loadingTier(file);}
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

const unsupportedCompression=[
  ...avatarReport.flatMap(asset=>asset.extensionsRequired.filter(ext=>UNSUPPORTED_BUILTIN_REQUIRED_EXTENSIONS.includes(ext)).map(extension=>({asset:asset.name,extension}))),
  ...branchReport.extensionsRequired.filter(ext=>UNSUPPORTED_BUILTIN_REQUIRED_EXTENSIONS.includes(ext)).map(extension=>({asset:branchReport.name,extension}))
];
const launcherImages=imageFiles.filter(file=>file.path.startsWith('public/launcher/'));
const maxImageDimension=Math.max(0,...imageFiles.filter(file=>file.dimensions).flatMap(file=>[file.dimensions.width,file.dimensions.height]));
const targetGaps=[];
if(totalBytes>ASSET_TARGETS.totalPublicBytes)targetGaps.push({target:'totalPublicBytes',actual:totalBytes,targetBytes:ASSET_TARGETS.totalPublicBytes});
for(const asset of avatarReport)if(asset.bytes>ASSET_TARGETS.characterBytes)targetGaps.push({target:'characterBytes',asset:asset.name,actual:asset.bytes,targetBytes:ASSET_TARGETS.characterBytes});
for(const image of launcherImages)if(image.bytes>ASSET_TARGETS.launcherImageBytes)targetGaps.push({target:'launcherImageBytes',asset:image.path,actual:image.bytes,targetBytes:ASSET_TARGETS.launcherImageBytes});

assert(totalBytes<=ASSET_BUDGETS.totalPublicBytes,'Public asset payload '+totalBytes+' exceeds hard budget '+ASSET_BUDGETS.totalPublicBytes);
assert.equal(duplicateGroups.length,0,'Exact duplicate assets remain: '+JSON.stringify(duplicateGroups));
assert.equal(unsupportedCompression.length,0,'Built-in assets require unsupported compression: '+JSON.stringify(unsupportedCompression));
assert(maxImageDimension<=ASSET_BUDGETS.maxImageDimension,'Image dimension '+maxImageDimension+'px exceeds hard budget '+ASSET_BUDGETS.maxImageDimension+'px');
for(const asset of avatarReport)assert(asset.bytes<=ASSET_BUDGETS.maxCharacterBytes,asset.name+' exceeds hard GLB budget');
for(const image of launcherImages)assert(image.bytes<=ASSET_BUDGETS.maxLauncherImageBytes,image.path+' exceeds hard launcher image budget');

const smallestCharacter=[...avatarReport].sort((x,y)=>x.bytes-y.bytes)[0]||null;
const archonAnalysis=avatarReport.find(asset=>asset.name==='The Archon')||null;
const gpuTextureOffenders=imageFiles.filter(file=>file.estimatedGpuTextureBytes).sort((x,y)=>y.estimatedGpuTextureBytes-x.estimatedGpuTextureBytes).slice(0,20);

const audit={
  budgets:{hard:ASSET_BUDGETS,targets:ASSET_TARGETS,targetGaps},
  startupRecommendation:smallestCharacter?{name:smallestCharacter.name,bytes:smallestCharacter.bytes,rationale:'Use a lightweight approved Chimpion for deterministic first presentation, then lazy-load alternatives.'}:null,
  archonAnalysis,
  unsupportedCompression,
  gpuTextureOffenders,
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
    estimatedExternalTextureGpuBytes:imageFiles.reduce((n,file)=>n+(file.estimatedGpuTextureBytes||0),0)
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
if(targetGaps.length)console.log('ASSET_TARGET_GAPS:'+JSON.stringify(targetGaps));
console.log('PASS assets: roster, GLB integrity, duplicate-free payload, loader compatibility and hard production budgets validated');
