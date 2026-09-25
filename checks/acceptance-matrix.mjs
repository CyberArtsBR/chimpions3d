import fs from 'node:fs';

const evidence={
  STARTUP:['checks/countdown-report.json','checks/game-browser-report.json'],
  INPUT:['checks/game-browser-report.json','checks/runtime-resilience-report.json'],
  GAMEPLAY:['checks/core-regression-report.json'],
  PLATFORMS:['checks/core-regression-report.json'],
  HAZARDS:['checks/core-regression-report.json'],
  EVENTS:['checks/core-regression-report.json'],
  JETPACK:['checks/core-regression-report.json'],
  PAUSE:['checks/game-browser-report.json','checks/runtime-resilience-report.json'],
  DEATH:['checks/game-browser-report.json'],
  RESULT:['checks/game-browser-report.json'],
  REPLAY:['checks/game-browser-report.json'],
  AVATARS:['checks/collection-report.json','checks/upload-validation-report.json'],
  RESPONSIVE:['checks/responsive-report.json'],
  ACCESSIBILITY:['checks/accessibility-report.json'],
  PERFORMANCE:['checks/performance-report.json'],
  MEMORY:['checks/performance-report.json'],
  NETWORK:['checks/network-failures-report.json'],
  PRODUCTION:['checks/production-browser-report.json']
};

function inspect(file){
  if(!fs.existsSync(file))return null;
  try{
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    return {file,status:data.status==='FAIL'?'FAIL':'PASS'};
  }catch{return {file,status:'FAIL'};}
}
const matrix={generatedAt:new Date().toISOString(),categories:{}};
for(const [category,files] of Object.entries(evidence)){
  const found=files.map(inspect).filter(Boolean);
  let status='NOT TESTED',detail='no executed evidence';
  if(found.length){
    status=found.some(x=>x.status==='FAIL')?'FAIL':'PASS';
    detail=found.map(x=>x.file).join(', ');
  }
  matrix.categories[category]={status,detail};
}
fs.writeFileSync('checks/acceptance-matrix.json',JSON.stringify(matrix,null,2));
const rows=['| Category | Status | Evidence |','|---|---|---|',...Object.entries(matrix.categories).map(([k,v])=>`| ${k} | ${v.status} | ${v.detail} |`)];
fs.writeFileSync('checks/acceptance-matrix.md',rows.join('\n')+'\n');
console.log(rows.join('\n'));
