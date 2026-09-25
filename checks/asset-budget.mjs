import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));else out.push(full.replaceAll('\\','/'));
  }
  return out;
}
const files=walk('public').map(p=>({path:p,bytes:fs.statSync(p).size,ext:path.extname(p).toLowerCase()}));
const characters=files.filter(f=>f.path.startsWith('public/model/characters/')&&f.ext==='.glb');
const glbs=files.filter(f=>f.ext==='.glb').sort((a,b)=>b.bytes-a.bytes);
const images=files.filter(f=>/\.(png|jpe?g|webp|avif|gif)$/i.test(f.path)).sort((a,b)=>b.bytes-a.bytes);
const totalBytes=files.reduce((n,f)=>n+f.bytes,0),characterBytes=characters.reduce((n,f)=>n+f.bytes,0);
const report={
  status:'PASS',
  totalPublicBytes:totalBytes,totalPublicMiB:Number((totalBytes/1048576).toFixed(2)),
  characterBytes,characterMiB:Number((characterBytes/1048576).toFixed(2)),
  characterCount:characters.length,
  largestGlb:glbs[0]||null,largestImage:images[0]||null,
  top20:[...files].sort((a,b)=>b.bytes-a.bytes).slice(0,20)
};
const maxMiB=Number(process.env.CHIMP_ASSET_BUDGET_MIB||0);
if(maxMiB)assert(totalBytes<=maxMiB*1048576,`Public payload ${report.totalPublicMiB} MiB exceeds ${maxMiB} MiB budget`);
fs.writeFileSync('checks/asset-budget-report.json',JSON.stringify(report,null,2));
console.log('ASSET_BUDGET:'+JSON.stringify(report));
