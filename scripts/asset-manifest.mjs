import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC='public';
const toPosix=p=>p.split(path.sep).join('/');
const rel=file=>toPosix(path.relative(PUBLIC,file));
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));else out.push(full);
  }
  return out;
}

function pngDimensions(buffer){
  if(buffer.length>=24&&buffer.toString('ascii',1,4)==='PNG')return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  return null;
}

function jpegDimensions(buffer){
  if(buffer.length<4||buffer[0]!==0xff||buffer[1]!==0xd8)return null;
  let offset=2;
  while(offset+9<buffer.length){
    if(buffer[offset]!==0xff){offset++;continue;}
    const marker=buffer[offset+1];
    if(marker===0xd8||marker===0xd9){offset+=2;continue;}
    const length=buffer.readUInt16BE(offset+2);
    if(length<2||offset+2+length>buffer.length)break;
    if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
      return {width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5)};
    }
    offset+=2+length;
  }
  return null;
}

function webpDimensions(buffer){
  if(buffer.length<30||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WEBP')return null;
  const type=buffer.toString('ascii',12,16);
  if(type==='VP8X'){
    return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};
  }
  if(type==='VP8 '&&buffer.length>=30&&buffer[23]===0x9d&&buffer[24]===0x01&&buffer[25]===0x2a){
    return {width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff};
  }
  if(type==='VP8L'&&buffer.length>=25&&buffer[20]===0x2f){
    const bits=buffer.readUInt32LE(21);
    return {width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1};
  }
  return null;
}

function imageDimensions(file){
  const buffer=fs.readFileSync(file);
  return pngDimensions(buffer)||jpegDimensions(buffer)||webpDimensions(buffer);
}

function parseGLB(file){
  const buffer=fs.readFileSync(file);
  if(buffer.length<20||buffer.toString('ascii',0,4)!=='glTF'||buffer.readUInt32LE(4)!==2)return null;
  const jsonLength=buffer.readUInt32LE(12);
  if(buffer.readUInt32LE(16)!==0x4e4f534a||20+jsonLength>buffer.length)return null;
  const json=JSON.parse(buffer.subarray(20,20+jsonLength).toString().trim());
  let triangles=0,vertices=0;
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){
    const position=primitive.attributes?.POSITION;
    if(position!==undefined)vertices+=json.accessors?.[position]?.count||0;
    if((primitive.mode??4)===4){
      const accessor=primitive.indices??position;
      triangles+=Math.floor((json.accessors?.[accessor]?.count||0)/3);
    }
  }
  return {
    meshes:(json.meshes||[]).length,
    materials:(json.materials||[]).length,
    textures:(json.textures||[]).length,
    images:(json.images||[]).length,
    triangles,
    vertices,
    extensionsUsed:json.extensionsUsed||[],
    extensionsRequired:json.extensionsRequired||[]
  };
}

function entry(file){
  const extension=path.extname(file).toLowerCase();
  const item={path:rel(file),bytes:fs.statSync(file).size,sha256:sha256(file)};
  if(/\.(png|jpe?g|webp)$/i.test(extension))item.dimensions=imageDimensions(file);
  if(extension==='.glb')item.glb=parseGLB(file);
  return item;
}

const files=walk(PUBLIC);
const byRel=new Map(files.map(file=>[rel(file),file]));
const controlledNames=[
  'ui/start-screen.webp',
  'audio/music-full.mp3',
  'environment.json',
  'environment/tree-wide-v2-16x9.webp',
  'environment/tree-wide-v2-9x16.webp',
  'environment/platforms/branch-moss.glb',
  'avatars.json',
  'characters.json',
  ...files.filter(file=>toPosix(file).includes('/model/characters/')&&/\.glb$/i.test(file)).map(rel)
];
const controlled=[...new Set(controlledNames)].filter(name=>byRel.has(name)).map(name=>entry(byRel.get(name)));

const characters=controlled.filter(item=>item.path.startsWith('model/characters/'));
const defaultCharacter=[...characters].sort((a,b)=>b.bytes-a.bytes)[0]||null; // worst-case playable initial selection
const optionalCharacters=characters.filter(item=>item!==defaultCharacter);
const sum=items=>items.reduce((total,item)=>total+(item?.bytes||0),0);

const categories={
  initialShell:controlled.filter(item=>['ui/start-screen.webp','avatars.json','characters.json','environment.json'].includes(item.path)),
  menuArt:controlled.filter(item=>item.path==='ui/start-screen.webp'),
  defaultCharacter:defaultCharacter?[defaultCharacter]:[],
  environment:controlled.filter(item=>item.path.startsWith('environment/')),
  music:controlled.filter(item=>item.path==='audio/music-full.mp3'),
  optionalCharacters
};

const manifest={
  version:1,
  contentHash:crypto.createHash('sha256').update(controlled.map(item=>item.sha256).join('')).digest('hex'),
  categories:Object.fromEntries(Object.entries(categories).map(([name,items])=>[name,{bytes:sum(items),files:items.map(item=>item.path)}])),
  largestSingleAsset:[...controlled].sort((a,b)=>b.bytes-a.bytes)[0]||null,
  assets:controlled
};

fs.writeFileSync(path.join(PUBLIC,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Controlled asset manifest: '+controlled.length+' files · '+(sum(controlled)/1048576).toFixed(2)+' MiB · '+manifest.contentHash.slice(0,16));
