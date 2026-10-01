import assert from 'node:assert/strict';
import {launchBrowser,attachPageDiagnostics,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const includeSlow=process.env.CHIMP_INCLUDE_SLOW_NETWORK!=='0';
const scenarios=[
  {name:'success',handler:route=>route.fulfill({status:200,contentType:'application/json',body:'{"id":"qa-run","seed":1234}'})},
  {name:'500',handler:route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"qa-500"}'})},
  {name:'404',handler:route=>route.fulfill({status:404,contentType:'application/json',body:'{"error":"qa-404"}'})},
  {name:'abort',handler:route=>route.abort('connectionfailed')},
  {name:'timeout',handler:route=>route.abort('timedout')},
];
if(includeSlow)scenarios.push({
  name:'slow-late-response',
  handler:async route=>{await new Promise(r=>setTimeout(r,4000));await route.fulfill({status:200,contentType:'application/json',body:'{"id":"late","seed":7}'})}
});

const report={status:'PASS',suite:'network-failures',includeSlow,scenarios:[],failures:[]};
try{
  for(const scenario of scenarios){
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const diag=attachPageDiagnostics(page);
    let runRequests=0;
    const item={name:scenario.name,status:'PASS'};
    try{
      await page.route('**/__qa_leaderboard__/api/runs',route=>{runRequests++;return scenario.handler(route);});
      await gotoJump(page,{test:true});
      await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
      await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
      assert.equal(await page.locator('#confirm-chimpion').count(),0,scenario.name+': redundant confirmation button must stay removed');
      const option=page.locator('#collection-dialog .avatar-option:not(:disabled)').first();
      await option.waitFor({state:'visible'});
      const started=Date.now();
      await option.click();
      await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:1500});
      const budget=scenario.name==='slow-late-response'?1200:2500;
      await page.waitForFunction(()=>window.chimpJump?.().countdown===3&&!document.getElementById('countdown').hidden,null,{timeout:budget});
      item.latencyMs=Date.now()-started;
      assert(runRequests>0,scenario.name+': QA build did not contact configured leaderboard endpoint');
      if(scenario.name==='success'){
        await page.waitForFunction(()=>window.chimpJump().runSeed===1234,{timeout:1000});
        item.authoritativeSeedAdopted=true;
      }
      if(scenario.name==='slow-late-response'){
        const seedBefore=await page.evaluate(()=>window.chimpJump().runSeed);
        await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.suspendRendering();});
        await page.waitForFunction(()=>window.chimpJump?.().mode==='playing');
        await page.waitForTimeout(4300);
        const late=await page.evaluate(()=>({mode:window.chimpJump().mode,seed:window.chimpJump().runSeed}));
        assert.equal(late.mode,'playing','Late run-ticket response must not interrupt active gameplay');
        assert.equal(late.seed,seedBefore,'Late run-ticket response must not reset an active route seed');
        item.lateResponsePreservedActiveRun=true;
      }
      assert.deepEqual(diag.errors,[],scenario.name+': page errors');
    }catch(error){
      item.status='FAIL';item.error=error.message;report.failures.push(scenario.name);
    }finally{
      item.runRequests=runRequests;item.pageErrors=diag.errors;report.scenarios.push(item);await page.close();
    }
  }

  const offline=await browser.newPage({viewport:{width:1280,height:800}});
  const item={name:'offline',status:'PASS'};
  try{
    await gotoJump(offline,{test:true});
    await offline.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
    await offline.locator('#collection-dialog[open]').waitFor({state:'visible'});
    assert.equal(await offline.locator('#confirm-chimpion').count(),0,'offline: redundant confirmation button must stay removed');
    const option=offline.locator('#collection-dialog .avatar-option:not(:disabled)').first();
    await option.waitFor({state:'visible'});
    // Load the picker while online; then disconnect immediately before run commitment.
    // This isolates the startup/network fallback contract from unrelated lazy picker assets.
    await offline.context().setOffline(true);
    await option.click();
    await offline.waitForFunction(()=>window.chimpJump?.().countdown===3,null,{timeout:2500});
    item.countdownStarted=true;
  }catch(error){
    item.status='FAIL';item.error=error.message;report.failures.push('offline');
  }finally{
    await offline.context().setOffline(false);await offline.close();report.scenarios.push(item);
  }

  report.status=report.failures.length?'FAIL':'PASS';
  writeReport('checks/network-failures-report.json',report);
  assert.deepEqual(report.failures,[],'Network startup failures: '+report.failures.join(', '));
  console.log('PASS network failures: '+report.scenarios.map(s=>s.name).join(', '));
}finally{await browser.close();}
