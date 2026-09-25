import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport} from './dash-test-utils.mjs';

const {browser,context,page,pageErrors}=await openBrowserPage({viewport:{width:1440,height:900}});
const report={scope:'dash-resources',samples:[],assetFailures:{}};
try{
  await waitForDash(page);
  await page.evaluate(()=>window.chimpionsDashTest.reset('soak',0));
  const baseline=await page.evaluate(()=>window.chimpionsDashTest.snapshot());
  for(let i=0;i<40;i++){
    await page.evaluate(()=>window.chimpionsDashTest.finishRun());
    await page.evaluate(()=>window.chimpionsDashTest.startRun({tutorial:false}));
    await page.evaluate(()=>window.chimpionsDashTest.finishRun());
    await page.evaluate(()=>window.chimpionsDashTest.quit());
    await page.evaluate(()=>window.chimpionsDashTest.startRun({tutorial:false}));
    if(i%5===0)report.samples.push(await page.evaluate(()=>window.chimpionsDashTest.snapshot()));
  }
  const final=await page.evaluate(()=>window.chimpionsDashTest.snapshot());
  assert(final.resources.domNodes<=baseline.resources.domNodes+90,`DOM leak ${baseline.resources.domNodes}->${final.resources.domNodes}`);
  assert(final.resources.sceneObjects<=baseline.resources.sceneObjects+16,`scene leak ${baseline.resources.sceneObjects}->${final.resources.sceneObjects}`);
  assert(final.renderer.geometries<=baseline.renderer.geometries+12,`geometry leak ${baseline.renderer.geometries}->${final.renderer.geometries}`);
  assert(final.renderer.textures<=baseline.renderer.textures+12,`texture leak ${baseline.renderer.textures}->${final.renderer.textures}`);
  assert(final.pools.hazards<=32&&final.pools.bananas<=32,'pools must remain capped');
  report.soak={baseline:baseline.resources,final:final.resources,pool:final.pools,renderer:final.renderer,graphics:final.graphics};

  const failurePage=await context.newPage(),failureErrors=[];
  failurePage.on('pageerror',error=>failureErrors.push(error.message));
  // Block localized decorative raster assets and music. The GPU gameplay world must
  // remain readable and lethal hazards must still have geometry.
  await failurePage.route('**/dash/assets/**',r=>r.abort('failed'));
  await failurePage.route('**/chimpions-army.mp3',r=>r.abort('failed'));
  await failurePage.goto((process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173')+'/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await failurePage.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:90000});
  assert(await failurePage.getByRole('button',{name:'Start Game'}).isVisible(),'asset/audio failure must not block start');

  await failurePage.evaluate(()=>window.chimpionsDashTest.reset('asset-log',0));
  await failurePage.evaluate(()=>window.chimpionsDashTest.clearWorld());
  await failurePage.evaluate(()=>window.chimpionsDashTest.spawnObstacle('log',120));
  await failurePage.evaluate(()=>window.chimpionsDashTest.step(1));
  const hazard=await failurePage.evaluate(()=>{
    const state=window.chimpionsDashTest.snapshot();
    return {simulationHazards:state.resources.hazards,gpuHazards:state.graphics?.hazards??0,drawCalls:state.graphics?.drawCalls??0};
  });
  assert(hazard.simulationHazards>=1,'hazard must remain present in simulation when raster assets fail');
  assert(hazard.gpuHazards>=1,'GPU world must render hazard geometry when raster assets fail');
  assert(hazard.drawCalls>0,'GPU fallback world must remain renderable');
  report.assetFailures.hazard=hazard;
  report.assetFailures.backgroundAudio='Dash remained bootable with localized raster/music requests blocked; GPU gameplay geometry stayed visible';

  const before=await failurePage.evaluate(()=>window.chimpionsDash().selectedId);
  await failurePage.route('**/*.glb',r=>r.abort('failed'));
  const options=await failurePage.locator('#lab-avatar option').evaluateAll(os=>os.map(o=>o.value));
  const target=options.find(x=>x!==before);
  if(target){
    await failurePage.evaluate(value=>{const select=document.querySelector('#lab-avatar');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},target);
    await failurePage.waitForFunction(()=>document.querySelector('#lab-message').textContent.includes('Could not load'),{timeout:90000});
    assert.equal(await failurePage.evaluate(()=>window.chimpionsDash().selectedId),before);
  }
  report.assetFailures.glb='previous avatar preserved';

  assert.deepEqual(failureErrors,[]);
  await failurePage.close();
  assert.deepEqual(pageErrors,[]);
  writeReport('dash-resources-report.json',report);
  console.log('PASS dash soak/resources: 40 lifecycle cycles, bounded resources, GPU hazard fallback, avatar failure safety');
}finally{await browser.close();}
