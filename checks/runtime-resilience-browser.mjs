import assert from 'node:assert/strict';
import {launchBrowser,attachPageDiagnostics,gotoJump,startSelectedRun,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1280,height:800}});
const diag=attachPageDiagnostics(page);
await page.addInitScript(()=>{
  const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
  window.__qaPad=pad;
});
const report={status:'PASS',suite:'runtime-resilience',checks:{}};
try{
  const padEdge=async({button=null,axisX=null,axisY=null}={})=>{
    await page.evaluate(({button,axisX,axisY})=>{
      if(button!==null)window.__qaPad.buttons[button].pressed=true;
      if(axisX!==null)window.__qaPad.axes[0]=axisX;
      if(axisY!==null)window.__qaPad.axes[1]=axisY;
    },{button,axisX,axisY});
    await page.waitForTimeout(60);
    await page.evaluate(({button,axisX,axisY})=>{
      if(button!==null)window.__qaPad.buttons[button].pressed=false;
      if(axisX!==null)window.__qaPad.axes[0]=0;
      if(axisY!==null)window.__qaPad.axes[1]=0;
    },{button,axisX,axisY});
    await page.waitForTimeout(60);
  };

  await gotoJump(page,{test:true});
  await page.waitForFunction(()=>document.activeElement?.id==='play');
  report.checks.controllerStartFocused=true;
  await padEdge({button:0});
  await page.locator('#collection-dialog[open]').waitFor({state:'visible'});
  const avatarButtons=page.locator('#collection-dialog .avatar-option:not(:disabled)');
  assert(await avatarButtons.count()>2,'Controller picker test needs at least three selectable avatars');
  await avatarButtons.nth(2).focus();
  await padEdge({axisX:-1});
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('avatar-option')?[...document.querySelectorAll('#collection-dialog .avatar-option:not(:disabled)')].indexOf(document.activeElement):-1),1,'One left controller edge must move exactly one avatar');
  report.checks.controllerPickerSingleStep=true;
  await page.locator('#collection-dialog #confirm-chimpion').focus();
  await padEdge({button:0});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:10000});
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing',{timeout:10000});

  await padEdge({button:9});
  await page.waitForFunction(()=>window.chimpJump().mode==='paused',{timeout:5000});
  await page.waitForFunction(()=>document.activeElement?.id==='jump-resume',{timeout:3000});
  await padEdge({axisY:1});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'jump-restart','Pause menu controller Down must move exactly one option');
  await page.locator('#jump-resume').focus();
  await padEdge({button:9});
  await page.waitForFunction(()=>window.chimpJump().mode==='playing',{timeout:5000});
  report.checks.controllerPauseMenu=true;
  await page.waitForTimeout(1300);

  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>window.chimpJump().mode==='paused');
  report.checks.blurPause=true;
  await page.getByRole('button',{name:'Resume'}).click();
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  await page.waitForTimeout(1300);

  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
  });
  await page.waitForFunction(()=>window.chimpJump().mode==='paused');
  report.checks.visibilityPause=true;
  await page.getByRole('button',{name:'Resume'}).click();
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');

  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.locator('#results-dialog[open]').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement?.id==='try-again',{timeout:3000});
  await padEdge({axisY:1});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'replay-trail','Game-over controller Down must move exactly one result action');
  await padEdge({axisY:-1});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'try-again','Game-over controller Up must return one result action');
  await padEdge({button:0});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='starting',{timeout:10000});
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump?.().mode==='playing',{timeout:10000});
  report.checks.controllerGameOverMenu=true;

  await page.evaluate(()=>{window.__qaPad.connected=false;window.__qaPad.axes[0]=0;});
  await page.keyboard.down('ArrowRight');
  await page.evaluate(()=>window.chimpJumpTest.stepInput(20));
  await page.keyboard.up('ArrowRight');
  assert(await page.evaluate(()=>window.chimpJump().vx>0),'Keyboard input must remain usable after gamepad disconnect');
  report.checks.gamepadDisconnectFallback=true;

  const context=await page.evaluate(()=>{
    const canvas=document.querySelector('#world canvas[data-engine],#world canvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const ext=gl?.getExtension('WEBGL_lose_context');
    if(!ext)return {supported:false};
    window.__qaWebglLost=false;window.__qaWebglRestored=false;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();window.__qaWebglLost=true;},{once:true});
    canvas.addEventListener('webglcontextrestored',()=>{window.__qaWebglRestored=true;},{once:true});
    ext.loseContext();
    setTimeout(()=>ext.restoreContext(),120);
    return {supported:true};
  });
  if(context.supported){
    await page.waitForFunction(()=>window.__qaWebglLost===true,{timeout:2000});
    await page.waitForFunction(()=>window.__qaWebglRestored===true,{timeout:4000});
    assert(await page.evaluate(()=>window.chimpJump?.().ready),'App diagnostics must remain available after WebGL context restoration');
    report.checks.webglContextLoss='restored';
  }else report.checks.webglContextLoss='unsupported-in-ci';

  assert.deepEqual(diag.errors,[],'Runtime resilience scenarios must not raise page errors');
  writeReport('checks/runtime-resilience-report.json',report);
  console.log('PASS runtime resilience: blur, visibility, gamepad disconnect and WebGL loss/restoration');
}finally{await browser.close();}
