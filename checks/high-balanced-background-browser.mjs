import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});

try{
  await page.goto(base+'/?test=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.chimpJump?.().ready&&document.body?.dataset?.mode==='menu',null,{timeout:30000});
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());

  const domBackground=()=>page.evaluate(()=>['sun','rays','hill','mist'].map(cls=>{
    const el=document.querySelector('#world>.'+cls);
    const style=getComputedStyle(el);
    return {cls,display:style.display,opacity:style.opacity,visibility:style.visibility};
  }));

  await page.evaluate(()=>window.chimpJumpTest.setQuality('balanced'));
  await page.evaluate(()=>window.chimpJumpTest.render());
  const balanced=await page.evaluate(()=>window.chimpJump());
  const balancedDom=await domBackground();

  await page.evaluate(()=>window.chimpJumpTest.setQuality('high'));
  await page.evaluate(()=>window.chimpJumpTest.render());
  const high=await page.evaluate(()=>window.chimpJump());
  const highDom=await domBackground();

  assert.equal(balanced.backgroundMode,'layered-forest');
  assert.equal(high.backgroundMode,'layered-forest','HIGH must retain the Balanced background family');
  assert.equal(high.forestVisibleLayers,balanced.forestVisibleLayers,'HIGH must retain the same layered-forest composition');
  assert.deepEqual(highDom,balancedDom,'HIGH must retain the same DOM background composition as Balanced');
  assert.equal(high.treeAuthoredVisible,false,'HIGH must not swap to the authored Ultra tree');
  assert.equal(high.treeFallbackVisible,true,'HIGH layered forest must be visible');
  assert(high.forestTextureScale>=1.5,'HIGH forest textures must use the max-density set');

  assert(Math.abs(high.rendererDpr-1.6)<.01,'HIGH must render at 1.6 DPR');
  assert.equal(high.renderTargetType,'half-float','HIGH must use half-float post target');
  assert.equal(high.shadowEnabled,true,'HIGH shadows must remain enabled');
  assert(high.shadowMapSize>=2048,'HIGH must use 2048 shadow maps');
  assert(high.anisotropyRequested>=4,'HIGH must request strong anisotropy');
  assert.equal(high.ambientOcclusionEnabled,true,'HIGH must enable AO');
  assert.equal(high.colorGradingEnabled,true,'HIGH must enable color grading');
  assert.equal(high.sharpenEnabled,true,'HIGH must enable sharpening');
  assert.equal(high.bloomEnabled,false,'HIGH must not reintroduce glow/bloom');
  assert.equal(high.lightShaftsEnabled,false,'HIGH must not reintroduce light shafts');

  console.log(JSON.stringify({
    status:'PASS',
    balanced:{forestVisibleLayers:balanced.forestVisibleLayers,dom:balancedDom},
    high:{
      forestVisibleLayers:high.forestVisibleLayers,
      forestTextureScale:high.forestTextureScale,
      rendererDpr:high.rendererDpr,
      shadowMapSize:high.shadowMapSize,
      anisotropyRequested:high.anisotropyRequested,
      ambientOcclusionEnabled:high.ambientOcclusionEnabled,
      colorGradingEnabled:high.colorGradingEnabled,
      sharpenEnabled:high.sharpenEnabled,
      dom:highDom
    }
  },null,2));
}finally{
  await browser.close();
}
