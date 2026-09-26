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
  await gotoJump(page,{test:true});
  await startSelectedRun(page,{fastForward:true});

  await page.evaluate(()=>{window.__qaPad.buttons[9].pressed=true;window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump().mode==='paused',{timeout:5000});
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(()=>window.chimpJump().mode),'paused','Held controller Start must trigger only one pause edge');
  await page.evaluate(()=>{window.__qaPad.buttons[9].pressed=false;window.chimpJumpTest.render();});
  await page.waitForTimeout(120);
  await page.evaluate(()=>{window.__qaPad.buttons[9].pressed=true;window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump().mode==='playing',{timeout:5000});
  await page.evaluate(()=>{window.__qaPad.buttons[9].pressed=false;});
  report.checks.controllerPauseEdge=true;
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
