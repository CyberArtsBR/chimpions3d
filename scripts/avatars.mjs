import fs from 'node:fs';
import path from 'node:path';
import {BUILT_IN_CHIMPION_NAMES,filterBuiltInRoster} from '../src/roster.js';

const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const allCards=JSON.parse(fs.readFileSync('public/characters.json','utf8'));
const cards=filterBuiltInRoster(allCards);
const overrides=JSON.parse(fs.readFileSync('public/avatar-overrides.json','utf8'));
if(cards.length!==BUILT_IN_CHIMPION_NAMES.length)throw new Error('characters.json must contain all 10 approved built-in Chimpions.');
const names=new Map(cards.map(c=>[normalize(c.name),c]));
const characterDir='public/model/characters';
const diskGlbs=fs.readdirSync(characterDir,{withFileTypes:true}).filter(entry=>entry.isFile()&&/\.glb$/i.test(entry.name)).map(entry=>entry.name);
const expected=new Set(BUILT_IN_CHIMPION_NAMES.map(name=>name+'.glb'));
const unexpected=diskGlbs.filter(name=>!expected.has(name));
const missing=[...expected].filter(name=>!diskGlbs.includes(name));
if(unexpected.length)throw new Error('Unexpected character GLBs: '+unexpected.join(', '));
if(missing.length)throw new Error('Missing approved character GLBs: '+missing.join(', '));

const entries=[],report={duplicates:[],extra:[],missing:[],unavailable:[]};
for(const name of BUILT_IN_CHIMPION_NAMES){
 const filename=name+'.glb',full=path.join(characterDir,filename),card=names.get(normalize(name));
 if(!card)throw new Error('Missing approved metadata for '+name);
 const entry={...card,id:String(card.id)};
 const reason=overrides[entry.name]?.unavailable;
 if(reason){entry.unavailable=reason;report.unavailable.push({name:entry.name,reason});}
 else entry.url=path.relative('public',full).split(path.sep).map(encodeURIComponent).join('/');
 entries.push(entry);
}
report.files=diskGlbs.length;
report.playable=entries.filter(e=>e.url).length;
report.matchedCards=cards.length;
fs.writeFileSync('public/avatars.json',JSON.stringify(entries,null,2)+'\n');
fs.writeFileSync('public/avatar-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Avatar catalog: '+report.playable+' approved playable Chimpions; no guest or extra roster models included.');
