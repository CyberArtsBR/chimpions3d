import assert from 'node:assert/strict';
import fs from 'node:fs';

function parseGLB(path){
  const b=fs.readFileSync(path);
  assert(b.length>=20,`${path}: incomplete GLB`);
  assert.equal(b.toString('ascii',0,4),'glTF',`${path}: invalid GLB magic`);
  assert.equal(b.readUInt32LE(4),2,`${path}: expected glTF 2.0`);
  assert.equal(b.readUInt32LE(8),b.length,`${path}: header length mismatch`);
  const jsonLength=b.readUInt32LE(12);
  assert(20+jsonLength<=b.length,`${path}: incomplete JSON chunk`);
  assert.equal(b.readUInt32LE(16),0x4e4f534a,`${path}: first chunk must be JSON`);
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
    skins:(json.skins||[]).length,
    joints:(json.skins||[]).reduce((n,s)=>n+(s.joints?.length||0),0),
    jointNames:jointIndexes.map(i=>json.nodes?.[i]?.name||`node#${i}`),
    skinnedNodes:(json.nodes||[]).filter(n=>n.mesh!==undefined&&n.skin!==undefined).length,
    triangles:triangles(json),nodes:(json.nodes||[]).length,meshes:(json.meshes||[]).length,
    materials:(json.materials||[]).length,textures:(json.textures||[]).length,
    images:(json.images||[]).map(i=>({mimeType:i.mimeType||null,uri:i.uri||null,bufferView:i.bufferView??null})),
  };
}

const avatars=JSON.parse(fs.readFileSync('public/avatars.json','utf8'));
assert.equal(avatars.length,6,'Expected default chimp plus five supplied Chimpions');
const expected=['The Bosun','The Executioner','The Knight Commander','The One Who Rocks Hard','The Street Fighter'];
assert.deepEqual(avatars.slice(1).map(a=>a.name),expected,'Playable avatar catalog changed unexpectedly');

const avatarReport=[];
for(const avatar of avatars.slice(1)){
  const path='public/'+decodeURIComponent(avatar.url);
  assert(fs.existsSync(path),`${avatar.name}: missing ${path}`);
  const {bytes,json}=parseGLB(path);
  const info=assetInfo(avatar.name,bytes,json);
  assert(info.skins>0,`${avatar.name}: no skin`);
  assert(info.joints>0,`${avatar.name}: skin has no joints`);
  assert(info.skinnedNodes>0,`${avatar.name}: no skinned mesh node`);
  avatarReport.push(info);
}
console.log('AVATAR_ASSET_REPORT:'+JSON.stringify(avatarReport));

const branchPath='public/environment/platforms/branch-moss.glb';
assert(fs.existsSync(branchPath),'Missing branch-moss.glb');
const branch=parseGLB(branchPath);
const branchReport=assetInfo('branch-moss.glb',branch.bytes,branch.json);
assert(branchReport.meshes>0,'branch-moss.glb has no mesh');
console.log('BRANCH_ASSET_REPORT:'+JSON.stringify(branchReport));

fs.writeFileSync('checks/assets-report.json',JSON.stringify({avatars:avatarReport,branch:branchReport},null,2));
console.log('PASS assets: five supplied Chimpions and branch-moss.glb are structurally valid GLB 2.0 assets');
