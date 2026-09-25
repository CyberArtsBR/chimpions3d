import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const tier=process.argv[2];
const suites={
  fast:[
    'qa-self-audit.mjs',
    'core-regression.mjs',
    'determinism-regression.mjs',
    'assets.mjs',
    'asset-budget.mjs',
    'upload-validation.mjs',
    'jump-audit.mjs',
    'production-hook-safety.mjs'
  ],
  standard:[
    'game-browser.mjs',
    'collection-browser.mjs',
    'countdown-browser.mjs',
    'responsive-browser.mjs',
    'accessibility-browser.mjs',
    'network-failures-browser.mjs',
    'runtime-resilience-browser.mjs',
    'performance-browser.mjs',
    'visual-regression.mjs'
  ]
};
if(!suites[tier])throw new Error('Unknown QA tier: '+tier);
const results=[];
for(const file of suites[tier]){
  console.log('\n=== '+tier.toUpperCase()+' :: '+file+' ===');
  const started=Date.now();
  const child=spawnSync(process.execPath,['checks/'+file],{stdio:'inherit',env:process.env});
  results.push({file,status:child.status===0?'PASS':'FAIL',exitCode:child.status,durationMs:Date.now()-started,signal:child.signal||null});
}
if(tier==='standard')spawnSync(process.execPath,['checks/acceptance-matrix.mjs'],{stdio:'inherit',env:process.env});
const failures=results.filter(r=>r.status==='FAIL');
const report={status:failures.length?'FAIL':'PASS',tier,results,failures:failures.map(f=>f.file)};
fs.writeFileSync('checks/qa-'+tier+'-status-report.json',JSON.stringify(report,null,2));
console.log('\nQA_'+tier.toUpperCase()+'_STATUS:'+JSON.stringify(report));
if(failures.length)process.exitCode=1;
