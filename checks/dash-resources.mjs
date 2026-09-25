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
    await page.evaluate(()=>window.chimpionsDashTest.startRun());
    await page.evaluate(()=>window.chimpionsDashTest.finishRun());
    await page.evaluate(()=>window.chimpionsDashTest.quit());
    await page.evaluate(()=>window.chimpionsDashTest.startRun());
    if(i%5===0)report.samples.push(await page.evaluate(()=>window.chimpionsDashTest.snapshot()));
  }
  const final=await page.evaluate(()=>window.chimpionsDashTest.snapshot());
  assert(final.resources.domNodes<=baseline.resources.domNodes+90,`DOM leak ${baseline.resources.domNodes}->${final.resources.domNodes}`);
  assert(final.resources.sceneObjects<=baseline.resources.sceneObjects+8,`scene leak ${baseline.resources.sceneObjects}->${final.resources.sceneObjects}`);
  assert(final.renderer.geometries<=baseline.renderer.geometries+8,`geometry leak ${baseline.renderer.geometries}->${final.renderer.geometries}`);
  assert(final.renderer.textures<=baseline.renderer.textures+8,`texture leak ${baseline.renderer.textures}->${final.renderer.textures}`);
  assert(final.pools.hazards<=32&&final.pools.bananas<=32,'pools must remain capped');
  report.soak={baseline:baseline.resources,final:final.resources,pool:final.pools,renderer:final.renderer};

  const failurePage=await context.newPage(),failureErrors=[];
  failurePage.on('pageerror',error=>failureErrors.push(error.message));
  await failurePage.route('**/sprites-clean/log.png',r=>r.abort('failed'));
  await failurePage.route('**/jungle-v2.webp',r=>r.abort('failed'));
  await failurePage.route('**/ground-green.png',r=>r.abort('failed'));
  await failurePage.route('**/chimpions-army.mp3',r=>r.abort('failed'));
  await failurePage.goto((process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173')+'/?dash=1&test=1',{waitUntil:'domcontentloaded'});
  await failurePage.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:90000});
  await failurePage.waitForFunction(()=>document.querySelector('.dash-start-hotspot'),{timeout:30000});
  assert(await failurePage.getByRole('button',{name:'Start Game'}).isVisible(),'background/audio failure must not block start');
  await failurePage.evaluate(()=>window.chimpionsDashTest.reset('asset-log',0));
  await failurePage.evaluate(()=>window.chimpionsDashTest.clearWorld());
  await failurePage.evaluate(()=>window.chimpionsDashTest.spawnObstacle('log',120));
  await failurePage.waitForFunction(()=>document.querySelector('.hazard.log')?.classList.contains('sprite-fallback'));
  const fallback=await failurePage.locator('.hazard.log').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{background:s.backgroundImage,width:r.width,height:r.height};});
  assert(fallback.width>0&&fallback.height>0&&fallback.background!=='none','missing hazard art needs visible fallback');
  report.assetFailures.hazard=fallback;
  report.assetFailures.backgroundAudio='Dash remained bootable with authored background/ground/music requests blocked';

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
  console.log('PASS dash soak/resources: 40 lifecycle cycles, bounded DOM/scene/renderer pools, asset fallback');
}finally{await browser.close();}
