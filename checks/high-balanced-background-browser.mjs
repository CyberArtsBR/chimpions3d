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
  assert(high.forestVisibleLayers>=3,'Balanced/High background must retain the richer three-layer canopy');
  assert.deepEqual(highDom,balancedDom,'HIGH must retain the same DOM background composition as Balanced');
  assert.equal(high.treeAuthoredVisible,false,'HIGH must not swap to the authored Ultra tree');
  assert.equal(high.treeFallbackVisible,true,'HIGH layered forest must be visible');
  assert(balanced.forestTextureScale>=1.18,'BALANCED must use enhanced-density forest textures');
  assert(high.forestTextureScale>=1.6,'HIGH forest textures must use the max-density set');
  assert(balanced.qualitySettings.rainDensity>=96,'BALANCED must keep atmospheric rain density');
  assert(high.qualitySettings.rainDensity>=180,'HIGH must keep dense atmospheric rain');

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

  await page.evaluate(()=>{window.chimpJumpTest.startRun();window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();});
  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.camera=250;g.previousCamera=250;g.height=250;g.y=250;g.time=34;g.paceClock=34;});
  for(let i=0;i<24;i++)await page.evaluate(()=>window.chimpJumpTest.renderStep(.05));
  const rainy=await page.evaluate(()=>window.chimpJump());
  assert.equal(rainy.rainLevel,1,'250m must land in rain level 1');
  assert.equal(rainy.rainActive,true,'Rain must become visible in a configured wet altitude band');
  assert(rainy.rainIntensity>.25,'Wet band rain intensity must visibly build');
  assert(rainy.rainDropCount>=180,'HIGH rain must use the dense drop budget');

  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.camera=500;g.previousCamera=500;g.height=500;g.y=500;g.time=64;g.paceClock=64;});
  for(let i=0;i<36;i++)await page.evaluate(()=>window.chimpJumpTest.renderStep(.05));
  const dry=await page.evaluate(()=>window.chimpJump());
  assert.equal(dry.rainLevel,2,'500m must land in dry level 2');
  assert.equal(dry.rainActive,false,'Rain must fade outside configured rain levels');

  console.log(JSON.stringify({
    status:'PASS',
    balanced:{forestVisibleLayers:balanced.forestVisibleLayers,forestTextureScale:balanced.forestTextureScale,rainDensity:balanced.qualitySettings.rainDensity,dom:balancedDom},
    high:{
      forestVisibleLayers:high.forestVisibleLayers,
      forestTextureScale:high.forestTextureScale,
      rendererDpr:high.rendererDpr,
      shadowMapSize:high.shadowMapSize,
      anisotropyRequested:high.anisotropyRequested,
      ambientOcclusionEnabled:high.ambientOcclusionEnabled,
      colorGradingEnabled:high.colorGradingEnabled,
      sharpenEnabled:high.sharpenEnabled,
      rainDensity:high.qualitySettings.rainDensity,
      dom:highDom
    },
    weather:{rainy:{level:rainy.rainLevel,intensity:rainy.rainIntensity,count:rainy.rainDropCount},dry:{level:dry.rainLevel,active:dry.rainActive,intensity:dry.rainIntensity}}
  },null,2));
}finally{
  await browser.close();
}
