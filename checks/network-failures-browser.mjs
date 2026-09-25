import assert from 'node:assert/strict';
import {launchBrowser,BASE,attachPageDiagnostics,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const includeSlow=process.env.CHIMP_INCLUDE_SLOW_NETWORK==='1';
const scenarios=[
  {name:'500',handler:route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"qa-500"}'})},
  {name:'404',handler:route=>route.fulfill({status:404,contentType:'application/json',body:'{"error":"qa-404"}'})},
  {name:'abort',handler:route=>route.abort('connectionfailed')},
];
if(includeSlow)scenarios.push({
  name:'late-response',
  handler:async route=>{await new Promise(r=>setTimeout(r,4000));await route.fulfill({status:200,contentType:'application/json',body:'{"id":"late","seed":7}'});}
});

const report={status:'PASS',suite:'network-failures',includeSlow,scenarios:[]};
try{
  for(const scenario of scenarios){
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const diag=attachPageDiagnostics(page);
    let runRequests=0;
    await page.route('**/__qa_leaderboard__/api/runs',route=>{runRequests++;return scenario.handler(route);});
    await gotoJump(page,{test:true});
    await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
    await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
    const started=Date.now();
    await page.locator('#confirm-chimpion').click();
    await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:1500});
    if(scenario.name==='late-response'){
      // This is the release invariant: the visible countdown must not wait for a slow leaderboard ticket.
      await page.waitForFunction(()=>window.chimpJump?.().countdown===3&&!document.getElementById('countdown').hidden,{timeout:1200});
    }else{
      await page.waitForFunction(()=>window.chimpJump?.().countdown===3&&!document.getElementById('countdown').hidden,{timeout:2500});
    }
    const latencyMs=Date.now()-started;
    assert(runRequests>0,`${scenario.name}: QA build did not contact configured leaderboard endpoint`);
    report.scenarios.push({name:scenario.name,runRequests,latencyMs,pageErrors:diag.errors});
    assert.deepEqual(diag.errors,[],scenario.name+': page errors');
    await page.close();
  }

  const offline=await browser.newPage({viewport:{width:1280,height:800}});
  await offline.context().setOffline(true);
  // Load once online first so application assets are present, then exercise a disconnected run start.
  await offline.context().setOffline(false);await gotoJump(offline,{test:true});await offline.context().setOffline(true);
  await offline.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await offline.locator('#collection-dialog[open]').waitFor({state:'visible'});
  await offline.locator('#confirm-chimpion').click();
  await offline.waitForFunction(()=>window.chimpJump?.().countdown===3,{timeout:2500});
  report.scenarios.push({name:'offline',countdownStarted:true});
  await offline.context().setOffline(false);await offline.close();

  writeReport('checks/network-failures-report.json',report);
  console.log('PASS network failures: '+report.scenarios.map(s=>s.name).join(', '));
}finally{await browser.close();}
