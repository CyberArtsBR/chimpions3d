import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,assertNoOverflow,writeReport,shot} from './dash-test-utils.mjs';

const {browser,page,pageErrors}=await openBrowserPage({viewport:{width:390,height:844},mobile:true});
const report={scope:'dash-mobile',viewports:{},touch:{},pause:{}};
async function recoverScreenshotPause(label){
  if(await page.evaluate(()=>window.chimpionsDash().state)==='paused'){
    report.pause.largeFrameProtection=(report.pause.largeFrameProtection||[]).concat(label);
    await page.evaluate(()=>window.chimpionsDashTest.resume());
    await page.waitForFunction(()=>window.chimpionsDash().state==='running');
  }
}
try{
  await waitForDash(page);report.viewports.portrait=await assertNoOverflow(page,'phone portrait');await shot(page,'dash-menu-mobile-portrait.png');
  await page.getByRole('button',{name:'Start Game'}).tap();await page.locator('.picker-play').tap();await page.waitForFunction(()=>window.chimpionsDash().state==='running');await page.evaluate(()=>window.chimpionsDashTest.clearWorld());
  assert(await page.locator('#touch-jump').isVisible());assert(await page.locator('#touch-slide').isVisible());await shot(page,'dash-gameplay-mobile-portrait.png');await recoverScreenshotPause('portrait gameplay screenshot');

  const jump=page.locator('#touch-jump');await jump.dispatchEvent('pointerdown',{pointerId:11,pointerType:'touch',button:0});await page.waitForTimeout(30);assert((await page.evaluate(()=>window.chimpionsDash().vy))>0);await jump.dispatchEvent('pointercancel',{pointerId:11,pointerType:'touch'});await page.waitForTimeout(20);assert.equal((await page.evaluate(()=>window.chimpionsDashTest.snapshot())).inputs.jump.length,0);
  await page.evaluate(()=>window.chimpionsDashTest.reset('touch-lost',0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());await jump.dispatchEvent('pointerdown',{pointerId:12,pointerType:'touch',button:0});await jump.dispatchEvent('lostpointercapture',{pointerId:12,pointerType:'touch'});await page.waitForTimeout(20);assert.equal((await page.evaluate(()=>window.chimpionsDashTest.snapshot())).inputs.jump.length,0);report.touch.jumpCancel='pass';

  const slide=page.locator('#touch-slide');await page.evaluate(()=>window.chimpionsDashTest.reset('touch-slide',0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());await slide.dispatchEvent('pointerdown',{pointerId:13,pointerType:'touch',button:0});await page.waitForTimeout(20);assert(await page.evaluate(()=>window.chimpionsDash().sliding));await slide.dispatchEvent('pointerup',{pointerId:13,pointerType:'touch'});report.touch.slide='pass';

  await page.evaluate(()=>window.chimpionsDashTest.reset('touch-multi',0));await page.evaluate(()=>window.chimpionsDashTest.clearWorld());await jump.dispatchEvent('pointerdown',{pointerId:14,pointerType:'touch',button:0});await page.keyboard.down('Space');await jump.dispatchEvent('pointerup',{pointerId:14,pointerType:'touch'});let s=await page.evaluate(()=>window.chimpionsDashTest.snapshot());assert(s.inputs.jump.includes('Space'),'keyboard ownership must survive touch release');await page.keyboard.up('Space');

  await page.setViewportSize({width:844,height:390});report.viewports.landscape=await assertNoOverflow(page,'phone landscape');await shot(page,'dash-gameplay-mobile-landscape.png');
  await page.setViewportSize({width:1024,height:768});report.viewports.tablet=await assertNoOverflow(page,'tablet landscape');
  for(const id of ['touch-jump','touch-slide']){const b=await page.locator('#'+id).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=1025&&b.y+b.height<=769,id+' must remain in safe viewport');}
  assert.deepEqual(pageErrors,[]);writeReport('dash-mobile-browser-report.json',report);console.log('PASS dash mobile E2E: portrait/landscape/tablet, touch release/cancel/lost capture, multi-input');
}finally{await browser.close();}
