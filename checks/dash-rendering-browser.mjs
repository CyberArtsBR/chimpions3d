import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')console.log('[dash browser console]',message.text());});

try{
  await page.goto(base+'/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.chimpionsDash?.().ready,null,{timeout:30000});
  await page.waitForTimeout(350);

  const snapshot=await page.evaluate(()=>({
    dash:window.chimpionsDash(),
    lab:window.chimpionsLab(),
    graphics:window.chimpionsDashGraphics?.stats?.(),
    gpuClass:document.documentElement.classList.contains('dash-gpu-world'),
    legacyObjects:document.querySelector('#dash-objects')?.childElementCount,
    canvasCount:document.querySelectorAll('#lab-3d canvas').length
  }));
  assert(snapshot.gpuClass,'Dash must activate the GPU-world presentation class');
  assert.equal(snapshot.canvasCount,1,'Dash must keep one authoritative Three.js canvas');
  assert.equal(snapshot.legacyObjects,0,'GPU Dash must not duplicate gameplay objects as DOM sprites');
  assert(snapshot.graphics,'Dash graphics diagnostics must be exposed');
  assert(snapshot.graphics.environmentInstances>20,'GPU environment must populate instanced depth bands');
  assert(snapshot.graphics.hazards>0,'Seeded Dash course must have pooled GPU hazard visuals');
  assert(snapshot.graphics.bananaInstances>0,'Seeded Dash course must render instanced banana collectibles');
  assert(snapshot.graphics.drawCalls>0,'Three.js renderer must submit draw calls');
  assert(snapshot.graphics.triangles>0,'Three.js renderer must submit geometry');

  const low=await page.evaluate(()=>{
    window.chimpionsDashGraphics.setQuality('LOW');
    return window.chimpionsDashGraphics.stats();
  });
  await page.waitForTimeout(100);
  assert.equal(low.quality,'LOW');
  assert(low.pixelRatio<=1.01,'LOW quality must cap device pixel ratio at 1');

  const high=await page.evaluate(()=>{
    window.chimpionsDashGraphics.setQuality('HIGH');
    return window.chimpionsDashGraphics.stats();
  });
  assert.equal(high.quality,'HIGH');
  assert(high.pixelRatio<=1.61,'HIGH quality must respect its pixel-ratio cap');

  await page.screenshot({path:'checks/dash-rendering-desktop.png',timeout:90000});
  assert.deepEqual(errors,[],'Dash GPU route must not raise browser page errors');
  console.log(JSON.stringify({scope:'dash-rendering-browser',snapshot,low,high},null,2));
}finally{
  await browser.close();
}
