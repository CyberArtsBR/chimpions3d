import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync('src/game.js','utf8');
assert(source.includes("import.meta.env.VITE_CHIMP_QA_HOOKS==='1'"),'Mutable QA hook must require explicit VITE_CHIMP_QA_HOOKS=1');
assert(!/if\s*\(new URLSearchParams\(location\.search\)\.has\('test'\)\)\s*\{\s*window\.chimpJumpTest/.test(source),'?test=1 alone must never expose mutable QA APIs');

function walk(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
}
const built=walk('dist').filter(p=>/\.(js|html)$/i.test(p));
assert(built.length,'Run npm run build before production-hook-safety');
const exposures=built.filter(p=>fs.readFileSync(p,'utf8').includes('chimpJumpTest'));
assert.deepEqual(exposures,[],'Production bundle must tree-shake mutable chimpJumpTest API');
fs.writeFileSync('checks/production-hook-safety-report.json',JSON.stringify({status:'PASS',scannedFiles:built.length,exposures},null,2));
console.log('PASS production bundle contains no mutable chimpJumpTest API');
