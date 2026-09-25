import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1280,height:800}});
const report={status:'PASS',suite:'countdown-browser',seen:[]};
try{
  await gotoJump(page,{test:true});
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting'&&window.chimpJump().countdown===3,{timeout:5000});
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());

  assert.equal(await page.evaluate(()=>window.chimpJump().time),0,'Physics time must be zero at countdown start');
  report.seen.push(await page.locator('#countdown').textContent());
  for(let i=0;i<3;i++){
    await page.evaluate(()=>window.chimpJumpTest.advanceCountdown(.75));
    report.seen.push(await page.locator('#countdown').textContent());
    assert.equal(await page.evaluate(()=>window.chimpJump().time),0,'Physics must remain frozen throughout countdown');
  }
  const expected=['3','2','1','GO'];
  if(JSON.stringify(report.seen)!==JSON.stringify(expected))report.status='FAIL';
  writeReport('checks/countdown-report.json',report);
  assert.deepEqual(report.seen,expected,'Countdown must visibly present 3, 2, 1, GO exactly once in order');
  await page.evaluate(()=>window.chimpJumpTest.advanceCountdown(.75));
  assert.equal(await page.evaluate(()=>window.chimpJump().mode),'playing','GO must transition into gameplay');
  console.log('PASS countdown: '+report.seen.join(' -> '));
}catch(error){
  report.status='FAIL';report.error=error.message;
  writeReport('checks/countdown-report.json',report);
  throw error;
}finally{await browser.close();}
