import assert from 'node:assert/strict';
import {launchBrowser,attachPageDiagnostics,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1440,height:900}});
const diag=attachPageDiagnostics(page);
const report={status:'PASS',suite:'accessibility-browser',checks:{}};
try{
  await gotoJump(page,{test:true});
  const visibleButtons=page.locator('button:visible');
  const count=await visibleButtons.count();
  for(let i=0;i<count;i++){
    const button=visibleButtons.nth(i);
    const name=(await button.getAttribute('aria-label'))?.trim()||(await button.innerText()).trim();
    assert(name,`Visible button #${i} has no accessible label`);
  }
  report.checks.visibleButtonsLabeled=count;

  await page.keyboard.press('Tab');
  const active=await page.evaluate(()=>{
    const style=getComputedStyle(document.activeElement);
    return {tag:document.activeElement?.tagName,id:document.activeElement?.id,outlineStyle:style.outlineStyle,outlineWidth:style.outlineWidth,boxShadow:style.boxShadow};
  });
  assert(active.tag&&active.tag!=='BODY','Keyboard focus must enter interactive UI');
  assert(active.outlineStyle!=='none'||active.boxShadow!=='none','Keyboard focus must have a visible focus indicator');
  report.checks.keyboardFocus=active;

  for(const selector of ['#results-dialog','#record-book']){
    const dialog=page.locator(selector);
    assert((await dialog.getAttribute('aria-label'))||(await dialog.getAttribute('aria-labelledby')),selector+' must be labeled');
  }
  report.checks.resultsDialogsLabeled=true;

  await page.getByRole('button',{name:'Field Guide',exact:true}).click();
  const guide=page.locator('#jump-guide-dialog[open]');
  assert(await guide.isVisible(),'Field Guide dialog must be visible');
  assert((await guide.getAttribute('aria-label'))||(await guide.getAttribute('aria-labelledby')),'Field Guide dialog must be labeled');
  const reduced=page.getByLabel('Reduced Motion');
  const highVisibility=page.getByLabel('High Visibility');
  await reduced.check();
  assert.equal(await page.evaluate(()=>document.body.dataset.reducedMotion),'true');
  await highVisibility.check();
  assert.equal(await page.evaluate(()=>document.body.dataset.highVisibility),'true');
  report.checks.reducedMotion=true;report.checks.highVisibility=true;
  await reduced.uncheck();await highVisibility.uncheck();
  await page.getByRole('button',{name:'Close Field Guide',exact:true}).click();

  const choose=page.getByRole('button',{name:'Choose chimp',exact:true});
  await choose.click();
  const picker=page.locator('#collection-dialog[open]');
  assert((await picker.getAttribute('aria-label'))||(await picker.getAttribute('aria-labelledby')),'Character picker dialog must be labeled');
  await page.getByRole('searchbox',{name:'Search characters'}).waitFor({state:'visible'});
  assert(await page.evaluate(()=>document.getElementById('collection-dialog')?.contains(document.activeElement)),'Modal focus must enter picker');
  await page.keyboard.press('Escape');
  await picker.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'choose','Closing picker must restore focus to Choose chimp');
  report.checks.modalFocus=true;

  const primaryTargets=await page.locator('button:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.id,width:r.width,height:r.height};}));
  const undersized=primaryTargets.filter(x=>x.width<32||x.height<32);
  assert.deepEqual(undersized,[],'Visible button touch/focus targets must be at least 32x32');
  report.checks.minTargetPx=32;

  assert.deepEqual(diag.errors,[],'Accessibility flow must not raise page errors');
  assert.deepEqual(diag.consoleErrors,[],'Accessibility flow must not emit console errors');
  assert.deepEqual(diag.sameOriginFailures,[],'Accessibility flow must not have same-origin HTTP failures');
  writeReport('checks/accessibility-report.json',report);
  console.log('PASS accessibility: labels, focus, modal return, reduced motion, high visibility and target sizing');
}catch(error){
  report.status='FAIL';report.error=error.message;writeReport('checks/accessibility-report.json',report);throw error;
}finally{await browser.close();}
