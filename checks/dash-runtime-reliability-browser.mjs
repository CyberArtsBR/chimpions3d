import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport,localBase} from './dash-test-utils.mjs';

const {browser,context,page,pageErrors}=await openBrowserPage({viewport:{width:1366,height:768}});
const report={scope:'dash-runtime-reliability',checks:{}};

try{
  await waitForDash(page);
  await page.evaluate(()=>window.chimpionsDashTest.startRun({seed:9001,tutorial:false}));
  await page.waitForFunction(()=>window.chimpionsDash().state==='running');

  const contextMenuPrevented=await page.evaluate(()=>{
    const stage=document.querySelector('#dash-stage'),event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});
    return !stage.dispatchEvent(event);
  });
  assert(contextMenuPrevented,'Dash stage must suppress the browser context menu for right-click slide');
  report.checks.contextMenuSuppressed=true;

  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
  });
  await page.waitForFunction(()=>window.chimpionsDash().state==='paused');
  const paused=await page.evaluate(()=>window.chimpionsDashTest.snapshot());
  assert.equal(paused.inputs.jump.length,0);assert.equal(paused.inputs.slide.length,0);
  await page.evaluate(()=>window.chimpionsDashTest.resume());
  await page.waitForFunction(()=>window.chimpionsDash().state==='running');
  report.checks.hiddenTabPause='clears input and resumes';

  const contextLoss=await page.evaluate(()=>{
    const canvas=document.querySelector('#lab-3d canvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const ext=gl?.getExtension('WEBGL_lose_context');
    if(!ext)return{supported:false};
    window.__dashContextLost=false;window.__dashContextRestored=false;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();window.__dashContextLost=true;},{once:true});
    canvas.addEventListener('webglcontextrestored',()=>{window.__dashContextRestored=true;},{once:true});
    ext.loseContext();setTimeout(()=>ext.restoreContext(),120);
    return{supported:true};
  });
  if(contextLoss.supported){
    await page.waitForFunction(()=>window.__dashContextLost===true,{timeout:3000});
    await page.waitForFunction(()=>window.__dashContextRestored===true,{timeout:5000});
    await page.waitForTimeout(150);
    const restored=await page.evaluate(()=>{window.chimpionsDashTest.step(2);return window.chimpionsDashGraphics.stats();});
    assert(restored.drawCalls>0&&restored.triangles>0,'Dash must resume meaningful rendering after supported WebGL context restoration');
    report.checks.webglContextLoss={supported:true,restored:true,drawCalls:restored.drawCalls,triangles:restored.triangles};
  }else report.checks.webglContextLoss={supported:false};

  const audioPage=await context.newPage();
  const audioErrors=[];audioPage.on('pageerror',e=>audioErrors.push(e.message));
  await audioPage.addInitScript(()=>{
    try{Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});}catch{}
    try{Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});}catch{}
    if(window.HTMLMediaElement)window.HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('autoplay blocked','NotAllowedError'));};
  });
  await audioPage.goto(localBase+'/?dash=1&test=1&sound=1',{waitUntil:'domcontentloaded',timeout:90000});
  await audioPage.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:90000});
  await audioPage.evaluate(()=>{window.chimpionsDashPresentationApi.audioGesture();window.chimpionsDashTest.startRun({seed:44,tutorial:false});window.chimpionsDashTest.clearWorld();window.chimpionsDashTest.setInput('jump','qa',true);window.chimpionsDashTest.step(1);});
  const audioState=await audioPage.evaluate(()=>window.chimpionsDash());
  assert.equal(audioState.state,'running','Unavailable/blocked audio must never block gameplay');
  assert(audioState.vy>0,'Gameplay input must remain live when audio initialization fails');
  report.checks.audioFailure={playable:true,audio:audioState.audio};
  assert.deepEqual(audioErrors,[]);
  await audioPage.close();

  assert.deepEqual(pageErrors,[]);
  writeReport('dash-runtime-reliability-report.json',report);
  console.log('PASS Dash runtime reliability: context menu, hidden-tab pause, context restoration, audio failure');
}finally{await browser.close();}
