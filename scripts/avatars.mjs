import fs from 'node:fs';
import path from 'node:path';
// Match exact names, ignoring case, accents, spaces and punctuation.
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cards=JSON.parse(fs.readFileSync('public/characters.json','utf8'));
const names=new Map();
for(const card of cards){const key=normalize(card.name);if(names.has(key))throw new Error('Ambiguous character: '+card.name);names.set(key,card);}
const entries=[{id:'chimpion',name:'Silver Chimp',url:'model/chimpion.glb'}],seen=new Set();
function scan(dir){if(!fs.existsSync(dir))return;for(const file of fs.readdirSync(dir,{withFileTypes:true})){
 const full=path.join(dir,file.name);if(file.isDirectory()){scan(full);continue;}
 if(!/\.glb$/i.test(file.name)||full.replaceAll('\\','/')==='public/model/chimpion.glb')continue;
 const card=names.get(normalize(file.name.slice(0,-4)));if(!card){console.warn('Unmatched avatar:',file.name);continue;}
 if(seen.has(card.id))throw new Error('Duplicate GLB for '+card.name);seen.add(card.id);
 entries.push({...card,id:String(card.id),url:path.relative('public',full).split(path.sep).map(encodeURIComponent).join('/')});
}}
scan('public/model');
fs.writeFileSync('public/avatars.json',JSON.stringify(entries,null,2)+'\n');
console.log('Avatar catalog: '+(entries.length-1)+' named GLBs + default chimp.');
