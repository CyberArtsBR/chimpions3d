import fs from 'node:fs';
import path from 'node:path';

function readGLB(file){
  const b=fs.readFileSync(file);
  if(b.toString('ascii',0,4)!=='glTF') throw new Error(`${file}: not a GLB`);
  const version=b.readUInt32LE(4);
  const length=b.readUInt32LE(8);
  const jsonLength=b.readUInt32LE(12);
  const jsonType=b.toString('ascii',16,20);
  if(version!==2||jsonType!=='JSON') throw new Error(`${file}: unsupported GLB`);
  const json=JSON.parse(b.subarray(20,20+jsonLength).toString('utf8').trim());
  return {json,length};
}

function inspect(file){
  const {json,length}=readGLB(file);
  const nodes=json.nodes||[];
  const parents=new Map();
  nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
  const skinJointIds=new Set((json.skins||[]).flatMap(s=>s.joints||[]));
  const joints=[...skinJointIds].map(i=>({
    i,
    name:nodes[i]?.name||`node_${i}`,
    parent:parents.has(i)?(nodes[parents.get(i)]?.name||`node_${parents.get(i)}`):null,
  }));
  let triangles=0;
  for(const mesh of json.meshes||[]) for(const p of mesh.primitives||[]){
    if((p.mode??4)!==4) continue;
    const accessor=p.indices!=null?json.accessors?.[p.indices]:json.accessors?.[p.attributes?.POSITION];
    triangles+=(accessor?.count||0)/3;
  }
  const positionBounds=[];
  (json.meshes||[]).forEach((mesh,mi)=>(mesh.primitives||[]).forEach((p,pi)=>{
    const a=json.accessors?.[p.attributes?.POSITION];
    if(a?.min&&a?.max) positionBounds.push({mesh:mesh.name||mi,primitive:pi,min:a.min,max:a.max});
  }));
  return {
    file:path.basename(file),
    bytes:length,
    meshes:(json.meshes||[]).length,
    materials:(json.materials||[]).length,
    images:(json.images||[]).length,
    skins:(json.skins||[]).length,
    triangles:Math.round(triangles),
    joints,
    positionBounds,
  };
}

const files=[];
const characters='public/model/characters';
if(fs.existsSync(characters)) for(const name of fs.readdirSync(characters)) if(/\.glb$/i.test(name)) files.push(path.join(characters,name));
const platform='public/environment/platforms/branch-moss.glb';
if(fs.existsSync(platform)) files.push(platform);
for(const file of files){
  console.log(`ASSET_INSPECTION ${file}`);
  console.log(JSON.stringify(inspect(file),null,2));
}
