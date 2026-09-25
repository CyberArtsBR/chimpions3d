import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],criticalExternal=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
  const url=request.url();
  if(url.includes('raw.githubusercontent.com')&&!url.endsWith('/chimpions-army.mp3'))criticalExternal.push(url);
});

async function diag(){return page.evaluate(()=>window.chimpionsDashPerformance.diagnostics());}

try{
  await page.goto('http://127.0.0.1:4173/?dash=1&test=1&quality=AUTO',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.chimpionsDash?.().ready&&window.chimpionsDashPerformance?.diagnostics,{timeout:45000});
  await page.waitForTimeout(250);

  assert.deepEqual(criticalExternal,[],'Dash critical visuals must not request GitHub Raw');
  const scenery=await page.evaluate(()=>({
    far:getComputedStyle(document.querySelector('#dash-far')).backgroundImage,
    ground:getComputedStyle(document.querySelector('#dash-ground')).backgroundImage,
    hazards:[...document.querySelectorAll('.hazard')].map(el=>({src:el.currentSrc||el.src,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))
  }));
  assert(scenery.far.includes('/dash/assets/jungle-v2.1f8e991e.webp'),'Jungle must be same-origin/content-addressed');
  assert(scenery.ground.includes('/dash/assets/ground-green.5163bede.png'),'Ground must be same-origin/content-addressed');
  assert(scenery.hazards.length>0,'Menu world should seed visible hazards');
  assert(scenery.hazards.every(h=>h.src.includes('/dash/assets/sprites/')&&h.width>0&&h.height>0),'Hazards must use prepared local sprites');

  const idleBefore=await diag();
  await page.waitForTimeout(1200);
  const idleAfter=await diag();
  assert(idleAfter.renderedFrames-idleBefore.renderedFrames<=30,'Menu should not render at full rAF cadence');

  await page.evaluate(()=>window.chimpionsDashPerformance.setQuality('LOW'));
  let low=await diag();
  assert.equal(low.qualityTier,'LOW');
  assert(low.dpr<=1.01,'LOW must cap DPR');
  assert.equal(low.shadowMap,512);

  await page.evaluate(()=>window.chimpionsDashPerformance.setQuality('ULTRA'));
  const ultra=await diag();
  assert.equal(ultra.qualityTier,'ULTRA');
  assert(ultra.dpr<=2.01,'ULTRA must keep an explicit DPR ceiling');
  assert.equal(ultra.shadowMap,2048);

  // Feed deterministic synthetic frame timings through the test-only sampler to
  // prove AUTO hysteresis can reduce quality without waiting on headless scheduler noise.
  await page.evaluate(()=>{
    window.chimpionsDashPerformance.setQuality('AUTO');
    const t=performance.now()+6000;
    for(let i=0;i<120;i++)window.chimpionsDashTest.samplePerformance(42,t+i*100);
  });
  const adapted=await diag();
  assert.equal(adapted.requestedQuality,'AUTO');
  assert(adapted.autoStep>=1,'AUTO must react to sustained over-budget p95/average frame time');
  await page.evaluate(()=>window.chimpionsDashPerformance.setQuality('AUTO'));

  // Establish a stable post-menu baseline, then run dozens of start/die/retry cycles.
  await page.evaluate(()=>window.chimpionsDashTest.quit());
  await page.waitForTimeout(150);
  const baseline=await diag();
  await page.evaluate(()=>{
    for(let i=0;i<24;i++){
      window.chimpionsDashTest.startRun();
      window.chimpionsDashTest.finishRun();
    }
    window.chimpionsDashTest.quit();
  });
  await page.waitForTimeout(700);
  const afterRuns=await diag();
  assert.equal(afterRuns.domGameplayNodes,0,'Quit must release active Dash DOM gameplay nodes');
  assert(afterRuns.poolSizes.hazards<=32&&afterRuns.poolSizes.bananas<=32,'DOM pools must remain bounded');
  assert(afterRuns.renderer.geometries<=baseline.renderer.geometries+1,'Run retries must not leak renderer geometries');
  assert(afterRuns.renderer.textures<=baseline.renderer.textures+1,'Run retries must not leak renderer textures');

  // Repeated character/menu/play/return changes must dispose the previous GLB.
  const original=await page.evaluate(()=>window.chimpionsDash().selectedId);
  const ids=await page.locator('#lab-avatar option').evaluateAll(options=>options.map(o=>o.value));
  assert(ids.length>=3,'Expected multiple approved Dash avatars');
  for(let i=0;i<6;i++){
    const id=ids[(ids.indexOf(original)+1+i)%ids.length];
    await page.selectOption('#lab-avatar',id);
    await page.waitForFunction(id=>window.chimpionsDash().selectedId===id,id,{timeout:45000});
    await page.evaluate(()=>{window.chimpionsDashTest.startRun();window.chimpionsDashTest.quit();});
  }
  await page.selectOption('#lab-avatar',original);
  await page.waitForFunction(id=>window.chimpionsDash().selectedId===id,original,{timeout:45000});
  await page.waitForTimeout(400);
  const afterCharacters=await diag();
  assert.equal(afterCharacters.domGameplayNodes,0,'Character return cycle must leave menu gameplay DOM clear');
  assert(afterCharacters.renderer.geometries<=baseline.renderer.geometries+2,'Character swaps must dispose old geometries');
  assert(afterCharacters.renderer.textures<=baseline.renderer.textures+2,'Character swaps must dispose old textures');

  assert.deepEqual(errors,[],'Dash performance audit must not raise page errors');

  // Failure injection: every sprite request fails, but lethal hazards remain visible fallbacks.
  const fallback=await browser.newPage({viewport:{width:960,height:600}});
  await fallback.route('**/dash/assets/sprites/**',route=>route.abort());
  await fallback.goto('http://127.0.0.1:4173/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await fallback.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:45000});
  await fallback.waitForTimeout(250);
  const fallbackHazards=await fallback.locator('.hazard').evaluateAll(nodes=>nodes.map(el=>{
    const r=el.getBoundingClientRect();
    return {fallback:el.classList.contains('sprite-fallback'),width:r.width,height:r.height,display:getComputedStyle(el).display};
  }));
  assert(fallbackHazards.length>0,'Failure injection must still seed hazards');
  assert(fallbackHazards.every(h=>h.fallback&&h.width>0&&h.height>0&&h.display!=='none'),'Failed hazard sprites must remain visible lethal-hazard fallbacks');
  await fallback.close();

  console.log('DASH_PERF_BASELINE:'+JSON.stringify(baseline));
  console.log('DASH_PERF_AFTER_RUN_CYCLES:'+JSON.stringify(afterRuns));
  console.log('DASH_PERF_AFTER_CHARACTER_CYCLES:'+JSON.stringify(afterCharacters));
  console.log('PASS Dash performance: local critical assets, no runtime-critical Raw requests, idle throttling, quality/DPR controls, AUTO adaptation, bounded retry/character resources, visible failure fallbacks');
}finally{
  await browser.close();
}
