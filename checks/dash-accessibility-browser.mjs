import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport} from './dash-test-utils.mjs';

const {browser,page,pageErrors}=await openBrowserPage({viewport:{width:430,height:932},mobile:true});
await page.addInitScript(()=>{
  window.__dashVibrations=[];
  try{Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.__dashVibrations.push(pattern);return true;}});}catch{}
});
const report={scope:'dash-accessibility-runtime',checks:{}};

const change=async(id,checked)=>page.locator('#'+id).setChecked(checked);
const stats=()=>page.evaluate(()=>window.chimpionsDashGraphics.stats());

try{
  await waitForDash(page);
  await page.evaluate(()=>{window.chimpionsDashTest.reset('a11y-gpu',0);window.chimpionsDashTest.clearWorld();window.chimpionsDashTest.spawnObstacle('log',260);window.chimpionsDashTest.step(1);});
  await page.evaluate(()=>window.chimpionsDashPresentationApi.openSettings());
  await page.locator('#dash-settings[open]').waitFor({state:'visible'});

  const baseline=await stats();
  await change('setting-high-visibility',true);
  const high=await stats();
  assert.equal(high.accessibility.highVisibility,true);
  assert(high.hazards>=1,'High Visibility fixture must contain a GPU hazard');
  assert(high.highlightedHazards>=1,'High Visibility must create an observable GPU hazard highlight');
  assert(high.highlightedHazards>baseline.highlightedHazards,'High Visibility must alter GPU presentation, not only CSS/localStorage');
  report.checks.highVisibility={before:baseline.highlightedHazards,after:high.highlightedHazards};

  await change('setting-reduced-motion',false);
  await page.evaluate(()=>{window.chimpionsDashTest.reset('motion-full',0);window.chimpionsDashTest.emitGraphics('stage');window.chimpionsDashTest.step(1);});
  const fullMotion=await stats();
  await change('setting-reduced-motion',true);
  await page.evaluate(()=>{window.chimpionsDashTest.reset('motion-reduced',0);window.chimpionsDashTest.emitGraphics('stage');window.chimpionsDashTest.step(1);});
  const reduced=await stats();
  assert.equal(reduced.accessibility.reducedMotion,true);
  assert.equal(reduced.vfx.reducedMotion,true);
  assert(reduced.vfx.activeParticles<fullMotion.vfx.activeParticles,`Reduced Motion VFX ${reduced.vfx.activeParticles} must be lower than ${fullMotion.vfx.activeParticles}`);
  assert.equal(reduced.vfx.streaksVisible,false,'Reduced Motion must suppress speed streaks');
  report.checks.reducedMotion={fullParticles:fullMotion.vfx.activeParticles,reducedParticles:reduced.vfx.activeParticles};

  await change('setting-reduced-motion',false);
  await change('setting-screen-shake',true);
  await page.evaluate(()=>{window.chimpionsDashTest.reset('shake-on',0);window.chimpionsDashTest.emitGraphics('death');});
  const shakeOn=await stats();
  assert(shakeOn.shakeAmount>0,'Screen Shake ON must accept a presentation shake impulse');
  await change('setting-screen-shake',false);
  await page.evaluate(()=>{window.chimpionsDashTest.reset('shake-off',0);window.chimpionsDashTest.emitGraphics('death');});
  const shakeOff=await stats();
  assert.equal(shakeOff.shakeAmount,0,'Screen Shake OFF must suppress shake impulses');
  report.checks.screenShake={on:shakeOn.shakeAmount,off:shakeOff.shakeAmount};

  await page.evaluate(()=>window.chimpionsDashPresentationApi.setInputDevice('touch'));
  const touchBefore=await page.locator('#touch-jump').boundingBox();
  await change('setting-large-touch',true);
  const touchAfter=await page.locator('#touch-jump').boundingBox();
  assert(touchBefore&&touchAfter&&touchAfter.width>touchBefore.width&&touchAfter.height>touchBefore.height,'Large Touch must increase actual touch target geometry');
  report.checks.largeTouch={before:{width:touchBefore.width,height:touchBefore.height},after:{width:touchAfter.width,height:touchAfter.height}};

  await page.locator('#setting-master').evaluate(el=>{el.value='37';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#setting-music').evaluate(el=>{el.value='41';el.dispatchEvent(new Event('input',{bubbles:true}));});
  let dash=await page.evaluate(()=>window.chimpionsDash());
  assert(Math.abs(dash.audio.volumes.master-.37)<.001&&Math.abs(dash.audio.volumes.music-.41)<.001,'Audio bus sliders must update the live mix');
  await change('setting-mute',true);
  dash=await page.evaluate(()=>window.chimpionsDash());
  assert.equal(dash.audio.muted,true,'Mute must update live audio state');
  report.checks.audio={master:dash.audio.volumes.master,music:dash.audio.volumes.music,muted:dash.audio.muted};

  await change('setting-haptics',false);
  await page.evaluate(()=>{window.__dashVibrations.length=0;window.chimpionsDashTest.reset('haptic-off',0);window.chimpionsDashTest.finishRun();});
  assert.equal(await page.evaluate(()=>window.__dashVibrations.length),0,'Haptics OFF must suppress vibration');
  await change('setting-haptics',true);
  await page.evaluate(()=>{window.chimpionsDashTest.reset('haptic-on',0);window.chimpionsDashTest.finishRun();});
  assert((await page.evaluate(()=>window.__dashVibrations.length))>=1,'Haptics ON must invoke supported vibration');
  report.checks.haptics='observable';

  assert.deepEqual(pageErrors,[]);
  writeReport('dash-accessibility-runtime-report.json',report);
  console.log('PASS Dash accessibility settings alter live GPU/VFX/input/audio/haptics behavior');
}finally{await browser.close();}
