import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cards=JSON.parse(fs.readFileSync('public/characters.json','utf8'));
const overrides=JSON.parse(fs.readFileSync('public/avatar-overrides.json','utf8'));
const names=new Map(cards.map(c=>[normalize(c.name),c]));
// Explicit reviewed spelling corrections; never fuzzy-match at runtime.
const aliases={theboson:'thebosun',theacromatic:'theachromatic',thealmagamation:'theamalgamation',theattendantr:'theattendant',thebuddly:'thebubbly',thedeepweller:'thedeepdweller',thedrownsy:'thedrowsy',thefautly:'thefaulty',themaincaracter:'themaincharacter',theranched:'therancher',thesulton:'thesultan',theunkowable:'theunknowable',theyoutfull:'theyouthful'};
const entries=[{id:'chimpion',name:'Silver Chimp',url:'model/chimpion.glb'}],seen=new Map(),report={duplicates:[],extra:[],missing:[],unavailable:[]};
const files=[];
function scan(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())scan(full);else if(/\.glb$/i.test(file.name)&&full.replaceAll('\\','/')!=='public/model/chimpion.glb')files.push(full);}}
scan('public/model');
// Prefer the canonical spelling when an identical alias is also present.
files.sort((a,b)=>Number(!names.has(normalize(path.basename(a,'.glb'))))-Number(!names.has(normalize(path.basename(b,'.glb'))))||a.localeCompare(b));
for(const full of files){
 const filename=path.basename(full),key=normalize(filename.replace(/\.glb$/i,'')),card=names.get(aliases[key]||key);
 const bytes=fs.readFileSync(full),digest=createHash('sha256').update(bytes).digest('hex');
 const id=card?String(card.id):'extra-'+key;
 if(seen.has(id)){if(seen.get(id)===digest){report.duplicates.push(filename);continue;}throw new Error('Different GLBs map to '+card.name);}
 seen.set(id,digest);
 const entry=card?{...card,id}:{id,name:filename.replace(/\.glb$/i,''),tribe:'Extra avatar'};
 if(!card)report.extra.push(entry.name);
 const reason=overrides[entry.name]?.unavailable;
 if(reason){entry.unavailable=reason;report.unavailable.push({name:entry.name,reason});}
 else entry.url=path.relative('public',full).split(path.sep).map(encodeURIComponent).join('/');
 entries.push(entry);
}
report.missing=cards.filter(c=>!seen.has(String(c.id))).map(c=>c.name);
report.files=files.length;report.playable=entries.filter(e=>e.url).length;report.matchedCards=cards.length-report.missing.length;
fs.writeFileSync('public/avatars.json',JSON.stringify(entries,null,2)+'\n');
fs.writeFileSync('public/avatar-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Avatar catalog: '+report.playable+' playable (including default), '+report.missing.length+' missing cards, '+report.unavailable.length+' rigs need correction.');
