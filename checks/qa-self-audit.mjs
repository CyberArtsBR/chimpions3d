import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const files=fs.readdirSync('checks').filter(name=>name.endsWith('.mjs')).sort();
const failures=[];
for(const name of files){
  const result=spawnSync(process.execPath,['--check','checks/'+name],{encoding:'utf8'});
  if(result.status!==0)failures.push({name,stderr:result.stderr});
}
fs.writeFileSync('checks/qa-self-audit-report.json',JSON.stringify({status:failures.length?'FAIL':'PASS',files:files.length,failures},null,2));
assert.deepEqual(failures,[],'QA JavaScript syntax failures: '+failures.map(f=>f.name).join(', '));
console.log('PASS QA self-audit: '+files.length+' .mjs files parse successfully');
