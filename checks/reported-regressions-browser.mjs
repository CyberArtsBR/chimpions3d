import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const base=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={status:'PASS',scope:'reported-jump-regressions',checkpoints:{}};
const errors=[];

page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

await page.addInitScript(()=>{
  const pad={connected:true,id:'QA Gamepad',index:0,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
  window.__reportedRegressionPad=pad;
});

async function pulseA(){
  await page.evaluate(()=>{const p=window.__reportedRegressionPad;p.buttons[0]={pressed:true,value:1};});
  await page.waitForTimeout(80);
  await page.evaluate(()=>{const p=window.__reportedRegressionPad;p.buttons[0]={pressed:false,value:0};});
  await page.waitForTimeout(80);
}
async function pulseDown(){
  await page.evaluate(()=>{window.__reportedRegressionPad.axes[1]=1;});
  await page.waitForTimeout(90);
  await page.evaluate(()=>{window.__reportedRegressionPad.axes[1]=0;});
  await page.waitForTimeout(90);
}
async function snapshot(name){
  const state=await page.evaluate(()=>window.chimpJump());
  report.checkpoints[name]=state;
  return state;
}

try{
  await page.goto(base+'/?test=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.chimpJump?.().ready&&document.body?.dataset?.mode==='menu',{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('play')&&!document.getElementById('play').disabled,{timeout:10000});

  // The illustrated title screen is production-critical. A missing image used to
  // leave only the dark green menu fallback while the transparent hotspots stayed live.
  await page.waitForFunction(()=>{
    const image=document.getElementById('jump-menu-art-recovery');
    return !!image?.complete&&image.naturalWidth>0&&image.naturalHeight>0;
  },{timeout:15000});
  const startArt=await page.evaluate(()=>{
    const image=document.getElementById('jump-menu-art-recovery');
    const fastFall=document.getElementById('jump-fast-fall-hint');
    return {
      width:image.naturalWidth,height:image.naturalHeight,src:image.currentSrc||image.src,
      visible:getComputedStyle(image).display!=='none'&&getComputedStyle(image).visibility!=='hidden',
      fastFallVisible:!!fastFall&&getComputedStyle(fastFall).display!=='none'&&!fastFall.hidden
    };
  });
  assert(startArt.visible,'Jump start artwork must be visible in menu mode');
  assert.equal(startArt.fastFallVisible,false,'Fast Fall hint must never leak onto the title screen');
  report.startArt=startArt;

  // Controller-only title-screen activation: no mouse click.
  await page.waitForFunction(()=>document.activeElement?.id==='play',{timeout:5000});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'play','Connected controller must focus the transparent Start Game hotspot');
  await pulseA();
  await page.locator('#collection-dialog[open]').waitFor({state:'visible',timeout:5000});
  await page.waitForFunction(()=>document.querySelectorAll('#collection-dialog .avatar-option:not(:disabled)').length>0);
  assert.equal(await page.locator('#confirm-chimpion').count(),0,'Chimpion picker must not require a second confirmation button');

  // D-pad moves from the search field to a Chimpion; A starts immediately.
  await page.getByRole('searchbox',{name:'Search characters'}).focus();
  await pulseDown();
  assert.equal(await page.evaluate(()=>document.activeElement?.classList?.contains('avatar-option')),true,'D-pad Down must reach a Chimpion card');
  const chosen=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||'');
  await pulseA();
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:15000});
  assert.equal(await page.locator('#collection-dialog[open]').count(),0,'Selecting a Chimpion with A must close the picker and start the run');
  report.chosenChimpion=chosen;

  // Expedition artwork is now the active gameplay backdrop. The legacy scenery
  // backgroundReady flag intentionally stays false while that backdrop is selected.
  await page.waitForFunction(()=>{
    const active=document.querySelector('.expedition-backdrop.active');
    const image=active?.querySelector('img');
    return !!active&&!active.hidden&&!!image?.complete&&image.naturalWidth>0;
  },{timeout:30000});
  report.expeditionBackdrop=await page.evaluate(()=>{
    const active=document.querySelector('.expedition-backdrop.active');
    const image=active?.querySelector('img');
    return {active:!!active,hidden:!!active?.hidden,width:image?.naturalWidth||0,height:image?.naturalHeight||0};
  });

  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
  await page.evaluate(()=>window.chimpJumpTest.render());

  await page.evaluate(()=>window.chimpJumpTest.setQuality('balanced'));
  await page.evaluate(()=>window.chimpJumpTest.render());
  const balanced=await snapshot('balanced');
  assert.equal(balanced.quality,'balanced');
  assert(balanced.rendererDpr<=1.11,'Balanced DPR must stay within its 1.1 cap');
  assert.equal(balanced.ambientOcclusionEnabled,false,'Balanced must keep AO disabled');
  assert.equal(balanced.bloomEnabled,false,'Balanced must keep bloom disabled');

  await page.evaluate(()=>window.chimpJumpTest.setQuality('high'));
  await page.evaluate(()=>window.chimpJumpTest.render());
  const high=await snapshot('high');
  assert.equal(high.quality,'high');
  assert(Math.abs(high.rendererDpr-1.6)<.01,'HIGH must render at true 1.6 DPR');
  assert.equal(high.ambientOcclusionEnabled,true,'HIGH must retain max-quality ambient occlusion');
  assert.equal(high.sharpenEnabled,true,'HIGH must retain sharpening');
  assert.equal(high.colorGradingEnabled,true,'HIGH must retain color grading');
  assert.equal(high.bloomEnabled,true,'HIGH must retain controlled bloom');

  // Pace is altitude-directed: +0.06 every 200m through 1000m, then +0.035 per 200m.
  const checkpoints=[[0,.96],[200,1.02],[400,1.08],[600,1.14],[800,1.20],[1000,1.26],[1200,1.295]];
  const pace=[];
  for(const [height,expected] of checkpoints){
    const value=await page.evaluate(h=>{window.chimpJumpTest.game().height=h;return window.chimpJump().pace;},height);
    pace.push({height,value,expected});
    assert(Math.abs(value-expected)<.0001,'Pace mismatch at '+height+'m: '+value+' vs '+expected);
  }
  const latePace=await page.evaluate(()=>{window.chimpJumpTest.game().height=10000;return window.chimpJump().pace;});
  assert(latePace>2.8,'Pace must remain uncapped in late game');
  report.pace=pace;
  report.latePace=latePace;

  await page.evaluate(()=>window.chimpJumpTest.setQuality('ultra'));
  await page.evaluate(()=>window.chimpJumpTest.render());
  const ultra=await snapshot('ultra');
  assert.equal(ultra.quality,'ultra');
  assert(Math.abs(ultra.rendererDpr-1.6)<.01,'ULTRA must actually render at 1.6 DPR');
  assert.equal(ultra.ambientOcclusionEnabled,true,'ULTRA must retain ambient occlusion');
  assert.equal(ultra.bloomEnabled,true,'ULTRA must retain controlled bloom');
  assert.equal(ultra.atmosphereEnabled,true,'ULTRA must retain subtle atmosphere');
  assert.equal(ultra.lightShaftsEnabled,true,'ULTRA must retain subtle light shafts');
  assert.equal(ultra.sharpenEnabled,true,'ULTRA must retain sharpening');
  assert.equal(ultra.colorGradingEnabled,true,'ULTRA must retain color grading');

  assert.deepEqual(errors,[],'Targeted regression browser run must not emit runtime errors');
  fs.writeFileSync('checks/reported-regressions-report.json',JSON.stringify(report,null,2));
  await page.screenshot({path:'checks/reported-regressions-ultra.png',fullPage:false,animations:'disabled'});
  console.log('PASS reported regressions: title artwork, controller Start, one-press Chimpion launch, Expedition backdrop, current quality profiles and uncapped altitude pace');
}finally{
  await browser.close();
}
