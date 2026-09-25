import assert from 'node:assert/strict';
import {launchBrowser,attachPageDiagnostics,gotoJump,assertNoHorizontalOverflow,writeReport} from './qa-browser-utils.mjs';

const requested=process.env.CHIMP_BROWSER||'firefox';
const {name,browser}=await launchBrowser(requested);
const page=await browser.newPage({viewport:{width:1280,height:800}});
const diag=attachPageDiagnostics(page);
const report={status:'PASS',browser:name};
try{
  await gotoJump(page,{test:true,requireAuthored:false});
  report.readiness=await page.evaluate(()=>{const s=window.chimpJump();return {ready:s.ready,quality:s.quality,treeVisible:s.treeVisible,platformReady:s.platformReady,backgroundReady:s.backgroundReady,mode:s.mode};});
  await assertNoHorizontalOverflow(page,name+' menu');
  assert(await page.getByRole('button',{name:'LET’S JUMP',exact:true}).isVisible());
  await page.getByRole('button',{name:'Field guide',exact:true}).click();
  assert(await page.locator('#jump-guide-dialog[open]').isVisible());
  await page.getByRole('button',{name:'Close field guide',exact:true}).click();
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  assert(await page.locator('#collection-dialog[open]').isVisible());
  assert.equal(await page.locator('#collection-dialog .avatar-option').count(),10);
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',null,{timeout:10000});
  const hasQaHook=await page.evaluate(()=>typeof window.chimpJumpTest==='object');
  assert(hasQaHook,name+': dedicated QA build must expose deterministic countdown hook');
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing',null,{timeout:7000});
  assert(await page.getByRole('button',{name:'Pause game'}).isVisible(),name+': gameplay pause action hidden');
  await page.getByRole('button',{name:'Pause game'}).click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='paused',null,{timeout:3000});
  report.gameplaySmoke=true;
  assert.deepEqual(diag.errors,[],name+': page errors');
  assert.deepEqual(diag.consoleErrors,[],name+': console errors');
  assert.deepEqual(diag.sameOriginFailures,[],name+': same-origin failures');
  report.errors=diag.errors;report.consoleErrors=diag.consoleErrors;report.sameOriginFailures=diag.sameOriginFailures;
  writeReport(`checks/cross-browser-${name}-report.json`,report);
  console.log('PASS '+name+' core smoke');
}catch(error){
  report.error=error.message;
  report.diagnostics=await page.evaluate(()=>({state:window.chimpJump?.()||null,mode:document.body?.dataset?.mode||null,bodyText:(document.body?.innerText||'').slice(0,1500)})).catch(()=>null);
  report.errors=diag.errors;report.consoleErrors=diag.consoleErrors;report.sameOriginFailures=diag.sameOriginFailures;
  const firefoxWebglBlocked=name==='firefox'&&
    diag.errors.some(message=>/WebGL context/i.test(message))&&
    diag.consoleErrors.some(message=>/AllowWebgl2:false|WebGL context could not be created/i.test(message));
  if(firefoxWebglBlocked){
    report.status='BLOCKED';
    report.blockedReason='Headless Firefox runner refused WebGL/WebGL2 context creation before application boot.';
    writeReport(`checks/cross-browser-${name}-report.json`,report);
    console.log('BLOCKED '+name+' core smoke: CI runner cannot create WebGL; application assertions were not executed.');
  }else{
    report.status='FAIL';
    writeReport(`checks/cross-browser-${name}-report.json`,report);
    throw error;
  }
}finally{await browser.close();}
