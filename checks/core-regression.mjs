import fs from 'node:fs';
const started=Date.now();
await import('./physics.mjs');
fs.writeFileSync('checks/core-regression-report.json',JSON.stringify({
  status:'PASS',
  suite:'core-physics-gameplay',
  covers:['GAMEPLAY','PLATFORMS','HAZARDS','EVENTS','JETPACK','DEATH','DETERMINISM'],
  durationMs:Date.now()-started
},null,2));
