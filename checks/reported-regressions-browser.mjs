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

  await page.waitForFunction(()=>window.chimpJump?.().backgroundReady,{timeout:30000});
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
  await page.evaluate(()=>window.chimpJumpTest.render());

  const high=await snapshot('high');
  assert.equal(high.quality,'high');
  assert.equal(high.backgroundMode,'layered-forest','HIGH must use the Balanced layered-forest background style');
  assert.equal(high.treeAuthoredVisible,false,'HIGH must not show the authored tree plate');
  assert.equal(high.treeFallbackVisible,true,'HIGH must render the layered forest');
  assert(high.forestTextureScale>=1.5,'HIGH layered forest must use the high-density texture set');
  assert(Math.abs(high.rendererDpr-1.6)<.01,'HIGH must render at true 1.6 DPR');
  assert.equal(high.ambientOcclusionEnabled,true,'HIGH must retain max-quality ambient occlusion');
  assert.equal(high.sharpenEnabled,true,'HIGH must retain sharpening');
  assert.equal(high.colorGradingEnabled,true,'HIGH must retain color grading');
  const highDom=await page.evaluate(()=>['sun','rays','hill','mist'].map(cls=>({cls,display:getComputedStyle(document.querySelector('#world>.'+cls)).display})));
  assert(highDom.every(item=>item.display!=='none'),'HIGH must preserve the Balanced presentation-layer background composition');
  report.highDom=highDom;

  // The historical arcade ramp was roughly .92x -> 3.0x by five minutes.
  const checkpoints=[[0,.92],[60,1.336],[120,1.752],[180,2.168],[240,2.584],[300,3]];
  const pace=[];
  for(const [time,expected] of checkpoints){
    const value=await page.evaluate(t=>{window.chimpJumpTest.game().time=t;return window.chimpJump().pace;},time);
    pace.push({time,value,expected});
    assert(Math.abs(value-expected)<.0001,'Pace mismatch at '+time+'s: '+value+' vs '+expected);
  }
  report.pace=pace;

  await page.evaluate(()=>window.chimpJumpTest.setQuality('ultra'));
  await page.evaluate(()=>window.chimpJumpTest.render());
  const ultra=await snapshot('ultra');
  assert.equal(ultra.quality,'ultra');
  assert.equal(ultra.treeAuthoredVisible,true,'ULTRA must retain the authored scrolling tree');
  assert.equal(ultra.treeFallbackVisible,false,'ULTRA must not overlay fallback forest');
  assert.equal(ultra.treeMistVisible,false,'ULTRA must not overlay mist on the 4K tree');
  assert.equal(ultra.bloomEnabled,false,'ULTRA glow/bloom must be disabled');
  assert.equal(ultra.atmosphereEnabled,false,'ULTRA atmosphere glow must be disabled');
  assert.equal(ultra.lightShaftsEnabled,false,'ULTRA top-left light shafts must be disabled');
  assert(Math.abs(ultra.rendererDpr-1.6)<.01,'ULTRA must actually render at 1.6 DPR');
  assert(ultra.treeAnisotropy>=4,'ULTRA tree must retain high texture anisotropy');
  const ultraDom=await page.evaluate(()=>['sun','rays','hill','mist'].map(cls=>({cls,display:getComputedStyle(document.querySelector('#world>.'+cls)).display})));
  assert(ultraDom.every(item=>item.display==='none'),'ULTRA must hide legacy DOM background layers');
  report.ultraDom=ultraDom;

  assert.deepEqual(errors,[],'Targeted regression browser run must not emit runtime errors');
  fs.writeFileSync('checks/reported-regressions-report.json',JSON.stringify(report,null,2));
  await page.screenshot({path:'checks/reported-regressions-ultra.png',fullPage:false,animations:'disabled'});
  console.log('PASS reported regressions: strong pace ramp, controller Start, one-press Chimpion launch, max-quality HIGH layered forest, crisp no-glow ULTRA');
}finally{
  await browser.close();
}
