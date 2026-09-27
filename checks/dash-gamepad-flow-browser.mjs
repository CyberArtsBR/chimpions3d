import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport} from './dash-test-utils.mjs';

const {browser,page,pageErrors}=await openBrowserPage({viewport:{width:1440,height:900},gamepad:true});
const report={scope:'dash-gamepad-flow',checks:{}};
const setButton=async(index,pressed,poll=false)=>{
  await page.evaluate(({index,pressed,poll})=>{window.__dashTestPad.buttons[index].pressed=pressed;if(poll)window.chimpionsDashTest.pollGamepad();},{index,pressed,poll});
  await page.waitForTimeout(70);
};

try{
  await waitForDash(page);

  await setButton(9,true,true);
  assert.equal(await page.evaluate(()=>window.chimpionsDash().state),'menu','Gamepad Start must not bypass the menu/picker state');
  await page.getByRole('dialog',{name:'Choose your Chimpion'}).waitFor({state:'visible'});
  await setButton(9,false,true);
  report.checks.startOpensPicker=true;

  await setButton(1,true,false);await setButton(1,false,false);
  await page.getByRole('dialog',{name:'Choose your Chimpion'}).waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.chimpionsDash().state),'menu','Gamepad cancel must return to menu');
  report.checks.cancel=true;

  await setButton(9,true,true);await setButton(9,false,true);
  const dialog=page.getByRole('dialog',{name:'Choose your Chimpion'});
  await dialog.waitFor({state:'visible'});
  const first=dialog.locator('.picker-option').first();
  await first.waitFor({state:'visible'});await first.focus();
  await setButton(0,true,false);await setButton(0,false,false);
  await dialog.locator('.picker-play:not(:disabled)').waitFor({state:'visible',timeout:45000});
  assert.equal(await page.evaluate(()=>window.chimpionsDash().state),'menu','Character selection must not implicitly start gameplay');
  report.checks.selectionRequiresPlay=true;

  await dialog.locator('.picker-play').focus();
  await setButton(0,true,false);await setButton(0,false,false);
  await page.waitForFunction(()=>window.chimpionsDash().state==='running',{timeout:45000});
  report.checks.playStartsRun=true;

  await setButton(9,true,true);assert.equal(await page.evaluate(()=>window.chimpionsDash().state),'paused');
  await setButton(9,false,true);await setButton(9,true,true);assert.equal(await page.evaluate(()=>window.chimpionsDash().state),'running');
  await setButton(9,false,true);report.checks.pauseResume=true;

  await page.evaluate(()=>window.chimpionsDashTest.finishRun());
  await page.waitForFunction(()=>window.chimpionsDash().state==='over');
  await page.waitForFunction(()=>document.activeElement?.id==='dash-retry');
  await setButton(0,true,true);await setButton(0,false,true);
  await page.waitForFunction(()=>window.chimpionsDash().state==='running');
  report.checks.retry=true;

  assert.deepEqual(pageErrors,[]);
  writeReport('dash-gamepad-flow-report.json',report);
  console.log('PASS Dash gamepad flow: Start -> picker -> select -> explicit Play -> pause/resume -> retry');
}finally{await browser.close();}
