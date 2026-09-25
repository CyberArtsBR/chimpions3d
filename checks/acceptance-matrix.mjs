import fs from 'node:fs';

const reportFor={
  STARTUP:'checks/game-browser-report.json',
  INPUT:'checks/game-browser-report.json',
  GAMEPLAY:'checks/core-regression-report.json',
  PLATFORMS:'checks/core-regression-report.json',
  HAZARDS:'checks/core-regression-report.json',
  EVENTS:'checks/core-regression-report.json',
  JETPACK:'checks/core-regression-report.json',
  PAUSE:'checks/game-browser-report.json',
  DEATH:'checks/game-browser-report.json',
  RESULT:'checks/game-browser-report.json',
  REPLAY:'checks/game-browser-report.json',
  AVATARS:'checks/collection-report.json',
  RESPONSIVE:'checks/responsive-report.json',
  ACCESSIBILITY:'checks/accessibility-report.json',
  PERFORMANCE:'checks/performance-report.json',
  MEMORY:'checks/performance-report.json',
  NETWORK:'checks/network-failures-report.json',
  PRODUCTION:'checks/production-browser-report.json'
};
const matrix={generatedAt:new Date().toISOString(),categories:{}};
for(const [category,file] of Object.entries(reportFor)){
  let status='NOT TESTED',detail='report not generated in this tier';
  if(fs.existsSync(file)){
    try{const data=JSON.parse(fs.readFileSync(file,'utf8'));status=data.status==='FAIL'?'FAIL':'PASS';detail=file;}
    catch{status='FAIL';detail=file+' is unreadable';}
  }
  matrix.categories[category]={status,detail};
}
fs.writeFileSync('checks/acceptance-matrix.json',JSON.stringify(matrix,null,2));
const rows=['| Category | Status | Evidence |','|---|---|---|',...Object.entries(matrix.categories).map(([k,v])=>`| ${k} | ${v.status} | ${v.detail} |`)];
fs.writeFileSync('checks/acceptance-matrix.md',rows.join('\n')+'\n');
console.log(rows.join('\n'));
