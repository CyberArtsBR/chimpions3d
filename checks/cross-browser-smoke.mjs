import assert from 'node:assert/strict';
import {launchBrowser,attachPageDiagnostics,gotoJump,assertNoHorizontalOverflow,writeReport} from './qa-browser-utils.mjs';

const requested=process.env.CHIMP_BROWSER||'firefox';
const {name,browser}=await launchBrowser(requested);
const page=await browser.newPage({viewport:{width:1280,height:800}});
const diag=attachPageDiagnostics(page);
const report={status:'PASS',browser:name};
try{
  await gotoJump(page,{test:false,requireAuthored:false});
  report.readiness=await page.evaluate(()=>{const s=window.chimpJump();return {ready:s.ready,quality:s.quality,treeVisible:s.treeVisible,platformReady:s.platformReady,backgroundReady:s.backgroundReady,mode:s.mode};});
  await assertNoHorizontalOverflow(page,name+' menu');
  assert(await page.getByRole('button',{name:'LET’S JUMP',exact:true}).isVisible());
  await page.getByRole('button',{name:'Field guide',exact:true}).click();
  assert(await page.locator('#jump-guide-dialog[open]').isVisible());
  await page.getByRole('button',{name:'Close field guide',exact:true}).click();
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  assert(await page.locator('#collection-dialog[open]').isVisible());
  assert.equal(await page.locator('#collection-dialog .avatar-option').count(),10);
  assert.deepEqual(diag.errors,[],name+': page errors');
  assert.deepEqual(diag.consoleErrors,[],name+': console errors');
  assert.deepEqual(diag.sameOriginFailures,[],name+': same-origin failures');
  report.errors=diag.errors;report.consoleErrors=diag.consoleErrors;report.sameOriginFailures=diag.sameOriginFailures;
  writeReport(`checks/cross-browser-${name}-report.json`,report);
  console.log('PASS '+name+' core smoke');
}catch(error){
  report.status='FAIL';report.error=error.message;
  report.diagnostics=await page.evaluate(()=>({state:window.chimpJump?.()||null,mode:document.body?.dataset?.mode||null,bodyText:(document.body?.innerText||'').slice(0,1500)})).catch(()=>null);
  report.errors=diag.errors;report.consoleErrors=diag.consoleErrors;report.sameOriginFailures=diag.sameOriginFailures;
  writeReport(`checks/cross-browser-${name}-report.json`,report);
  throw error;
}finally{await browser.close();}
