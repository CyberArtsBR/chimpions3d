import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,startSelectedRun,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1440,height:900}});
const budgets={high:{drawCalls:250,triangles:1000000,geometries:300,textures:120},restartGrowth:{geometries:4,textures:2}};
const report={status:'PASS',suite:'performance-browser',budgets,samples:{}};
try{
  await gotoJump(page,{test:true});
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
  await startSelectedRun(page,{fastForward:true});
  const sample=async()=>page.evaluate(()=>{window.chimpJumpTest.render();const s=window.chimpJump();return {drawCalls:s.drawCalls,triangles:s.triangles,geometries:s.geometries,textures:s.textures,platformCount:s.platformCount,visibleBranches:s.visibleBranches,visibleHazards:s.visibleHazards,time:s.time};});
  report.samples.initial=await sample();
  for(const [key,max] of Object.entries(budgets.high))assert(report.samples.initial[key]<=max,`${key} ${report.samples.initial[key]} exceeds HIGH budget ${max}`);

  await page.evaluate(()=>window.chimpJumpTest.resumeRendering());
  const frameTimes=await page.evaluate(()=>new Promise(resolve=>{
    const samples=[];let previous=performance.now();
    function frame(now){
      samples.push(now-previous);previous=now;
      if(samples.length>=120)resolve(samples);else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  const sorted=[...frameTimes].sort((a,b)=>a-b);
  const percentile=p=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
  report.frameTime={samples:frameTimes.length,p50Ms:Number(percentile(.50).toFixed(2)),p95Ms:Number(percentile(.95).toFixed(2)),p99Ms:Number(percentile(.99).toFixed(2)),maxMs:Number(Math.max(...frameTimes).toFixed(2))};
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());

  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.nextY=10000;g.hazards=[];g.nextJetAt=Infinity;g.nextEventAt=Infinity;
    g.platforms=[{id:9900,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  });
  await page.evaluate(()=>window.chimpJumpTest.step(18000));
  report.samples.fiveMinutes=await sample();
  await page.evaluate(()=>window.chimpJumpTest.step(18000));
  report.samples.tenMinutes=await sample();
  assert(report.samples.tenMinutes.geometries<=report.samples.initial.geometries+8,'10-minute simulation geometry count runaway');
  assert(report.samples.tenMinutes.textures<=report.samples.initial.textures+3,'10-minute simulation texture count runaway');

  const beforeRestarts=await sample();
  for(let i=0;i<25;i++){
    await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
    await page.waitForFunction(()=>window.chimpJump?.().mode==='over'&&document.getElementById('results-dialog')?.open);
    await page.evaluate(()=>document.getElementById('try-again').click());
    await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));
    if(await page.evaluate(()=>window.chimpJump().mode==='starting'))await page.evaluate(()=>window.chimpJumpTest.finishCountdown());
    await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  }
  const afterRestarts=await sample();
  report.samples.beforeRestarts=beforeRestarts;report.samples.after25Restarts=afterRestarts;
  assert(afterRestarts.geometries<=beforeRestarts.geometries+budgets.restartGrowth.geometries,'Geometry count grows monotonically across 25 restarts');
  assert(afterRestarts.textures<=beforeRestarts.textures+budgets.restartGrowth.textures,'Texture count grows monotonically across 25 restarts');

  writeReport('checks/performance-report.json',report);
  console.log('PERFORMANCE_REPORT:'+JSON.stringify(report));
}finally{await browser.close();}
