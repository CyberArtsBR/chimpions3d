import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1280,height:800}});
const seen=[];
try{
  await gotoJump(page,{test:true});
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
  await page.locator('#confirm-chimpion').click();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting');
  const before=await page.evaluate(()=>window.chimpJump().time);
  assert.equal(before,0,'Physics time must be zero at countdown start');

  const deadline=Date.now()+6000;
  while(Date.now()<deadline){
    const state=await page.evaluate(()=>({mode:window.chimpJump().mode,text:document.getElementById('countdown').textContent,hidden:document.getElementById('countdown').hidden,time:window.chimpJump().time}));
    if(!state.hidden&&state.text&&!seen.includes(state.text))seen.push(state.text);
    if(state.mode==='playing')break;
    await page.waitForTimeout(40);
  }
  assert.equal(await page.evaluate(()=>window.chimpJump().mode),'playing','Countdown must transition into gameplay');
  assert.equal(before,0);
  assert.deepEqual(seen.slice(0,4),['3','2','1','GO'],'Countdown must visibly present 3, 2, 1, GO exactly once in order');
  writeReport('checks/countdown-report.json',{status:'PASS',seen});
  console.log('PASS countdown: '+seen.join(' -> '));
}finally{await browser.close();}
