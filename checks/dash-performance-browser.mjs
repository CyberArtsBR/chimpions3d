import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],criticalExternal=[],localDashAssets=[],localMusic=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
  const url=request.url();
  if(url.includes('raw.githubusercontent.com'))criticalExternal.push(url);
  if(url.includes('/dash/assets/'))localDashAssets.push(url);
  if(url.includes('/audio/music-full.mp3'))localMusic.push(url);
});

async function diag(){return page.evaluate(()=>window.chimpionsDashPerformance.diagnostics());}

try{
  await page.goto('http://127.0.0.1:4173/?dash=1&test=1&quality=AUTO',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.chimpionsDash?.().ready&&window.chimpionsDashPerformance?.diagnostics&&window.chimpionsDashGraphics?.stats,{timeout:45000});
  await page.waitForTimeout(350);

  assert.deepEqual(criticalExternal,[],'Dash must not request GitHub Raw at runtime');
  assert.equal(localDashAssets.length,0,'GPU Dash boot must not eagerly download legacy DOM fallback sprites/scenery');
  assert.equal(localMusic.length,0,'Dash music must remain lazy before a run starts');

  const graphics=await page.evaluate(()=>window.chimpionsDashGraphics.stats());
  assert(graphics.hazards>0,'GPU world must render seeded lethal hazards');
  assert(graphics.environmentInstances>20,'GPU world must render environment depth');

  const idleBefore=await diag();
  await page.waitForTimeout(1200);
  const idleAfter=await diag();
  assert(idleAfter.renderedFrames-idleBefore.renderedFrames<=30,'Menu should not render at full rAF cadence');

  const tierSamples={};
  for(const tier of ['LOW','BALANCED','HIGH','ULTRA']){
    await page.evaluate(tier=>window.chimpionsDashPerformance.setQuality(tier),tier);
    await page.waitForTimeout(80);
    tierSamples[tier]=await diag();
    assert.equal(tierSamples[tier].qualityTier,tier);
  }
  assert(tierSamples.LOW.dpr<=1.01,'LOW must cap DPR');
  assert(tierSamples.ULTRA.dpr<=2.01,'ULTRA must keep an explicit DPR ceiling');

  await page.evaluate(()=>{
    window.chimpionsDashPerformance.setQuality('AUTO');
    const t=performance.now()+6000;
    for(let i=0;i<120;i++)window.chimpionsDashTest.samplePerformance(42,t+i*100);
  });
  const adapted=await diag();
  assert.equal(adapted.requestedQuality,'AUTO');
  assert(adapted.autoStep>=1,'AUTO must react to sustained over-budget p95/average frame time');

  await page.evaluate(()=>window.chimpionsDashTest.startRun({seed:424242,tutorial:false}));
  await page.waitForTimeout(350);

  const contextSupport=await page.evaluate(()=>{
    const canvas=document.querySelector('#lab-3d canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const ext=gl?.getExtension('WEBGL_lose_context');
    if(!ext)return {supported:false};
    const before=window.chimpionsDashTest.snapshot().run.time;
    window.__dashContextProbe={before,lost:false,lostTime:null,restored:false};
    canvas.addEventListener('webglcontextlost',()=>{window.__dashContextProbe.lost=true;window.__dashContextProbe.lostTime=window.chimpionsDashTest.snapshot().run.time;},{once:true});
    canvas.addEventListener('webglcontextrestored',()=>{window.__dashContextProbe.restored=true;},{once:true});
    ext.loseContext();setTimeout(()=>ext.restoreContext(),180);
    return {supported:true,before};
  });
  if(contextSupport.supported){
    await page.waitForFunction(()=>window.__dashContextProbe?.lost===true,{timeout:3000});
    await page.waitForTimeout(120);
    const frozen=await page.evaluate(()=>({time:window.chimpionsDashTest.snapshot().run.time,lostTime:window.__dashContextProbe.lostTime,recovery:!document.getElementById('dash-render-recovery').hidden}));
    assert(Math.abs(frozen.time-frozen.lostTime)<.02,'Dash simulation must freeze while WebGL context is lost');
    assert(frozen.recovery,'Context loss must expose a readable recovery state');
    await page.waitForFunction(()=>window.__dashContextProbe?.restored===true,{timeout:5000});
    await page.waitForFunction(()=>document.getElementById('dash-render-recovery').hidden===true,{timeout:5000});
    const restored=await page.evaluate(()=>window.chimpionsDashGraphics.stats());
    assert.equal(restored.contextLost,false,'Dash graphics must leave context-lost state after restoration');
  }

  await page.waitForTimeout(1050);
  const playingSample=await diag();
  await page.evaluate(()=>window.chimpionsDashTest.quit());
  await page.waitForTimeout(150);

  const baseline=await diag();
  await page.evaluate(()=>{
    for(let i=0;i<24;i++){
      window.chimpionsDashTest.startRun({seed:1000+i,tutorial:false});
      window.chimpionsDashTest.finishRun();
    }
    window.chimpionsDashTest.quit();
  });
  await page.waitForTimeout(700);
  const afterRuns=await diag();
  assert.equal(afterRuns.domGameplayNodes,0,'GPU Dash must not accumulate legacy DOM gameplay nodes');
  assert(afterRuns.poolSizes.hazards<=32&&afterRuns.poolSizes.bananas<=32,'Legacy fallback pools must remain bounded');
  assert(afterRuns.renderer.geometries<=baseline.renderer.geometries+2,'Run retries must not leak renderer geometries');
  assert(afterRuns.renderer.textures<=baseline.renderer.textures+2,'Run retries must not leak renderer textures');

  const original=await page.evaluate(()=>window.chimpionsDash().selectedId);
  const ids=await page.locator('#lab-avatar option').evaluateAll(options=>options.map(o=>o.value));
  assert(ids.length>=3,'Expected multiple approved Dash avatars');
  for(let i=0;i<6;i++){
    const id=ids[(ids.indexOf(original)+1+i)%ids.length];
    await page.evaluate(id=>window.chimpionsDashPresentationApi.selectAvatar(id,{timeoutMs:15000}),id);
    await page.waitForFunction(id=>window.chimpionsDash().selectedId===id,id,{timeout:45000});
    await page.evaluate(()=>{window.chimpionsDashTest.startRun({seed:777,tutorial:false});window.chimpionsDashTest.quit();});
  }
  await page.evaluate(id=>window.chimpionsDashPresentationApi.selectAvatar(id,{timeoutMs:15000}),original);
  await page.waitForFunction(id=>window.chimpionsDash().selectedId===id,original,{timeout:45000});
  await page.waitForTimeout(400);
  const afterCharacters=await diag();
  assert.equal(afterCharacters.domGameplayNodes,0,'Character return cycle must leave gameplay DOM clear');
  assert(afterCharacters.renderer.geometries<=baseline.renderer.geometries+3,'Character swaps must dispose old geometries');
  assert(afterCharacters.renderer.textures<=baseline.renderer.textures+3,'Character swaps must dispose old textures');

  assert.deepEqual(errors,[],'Dash performance audit must not raise page errors');

  const fallback=await browser.newPage({viewport:{width:960,height:600}});
  await fallback.route('**/dash/assets/sprites/**',route=>route.abort());
  await fallback.goto('http://127.0.0.1:4173/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await fallback.waitForFunction(()=>window.chimpionsDash?.().ready&&window.chimpionsDashGraphics?.stats,{timeout:45000});
  await fallback.waitForTimeout(250);
  const fallbackGraphics=await fallback.evaluate(()=>window.chimpionsDashGraphics.stats());
  assert(fallbackGraphics.hazards>0,'Prepared-sprite failure must not make lethal GPU hazards invisible');
  await fallback.close();

  console.log('DASH_PERF_TIERS:'+JSON.stringify(tierSamples));
  console.log('DASH_PERF_PLAYING_SAMPLE:'+JSON.stringify(playingSample));
  console.log('DASH_PERF_BASELINE:'+JSON.stringify(baseline));
  console.log('DASH_PERF_AFTER_RUN_CYCLES:'+JSON.stringify(afterRuns));
  console.log('DASH_PERF_AFTER_CHARACTER_CYCLES:'+JSON.stringify(afterCharacters));
  console.log('PASS Dash performance: no eager fallback downloads, GPU-safe fallbacks, context recovery, idle throttling, unified quality/DPR controls, AUTO adaptation, bounded retry/character resources');
}finally{
  await browser.close();
}
