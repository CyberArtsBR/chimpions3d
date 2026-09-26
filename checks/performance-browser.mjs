import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,startSelectedRun,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1440,height:900}});

const budgets={
  functionalCI:{
    balanced:{drawCalls:180,triangles:650000,geometries:220,textures:90,programs:36},
    high:{drawCalls:220,triangles:900000,geometries:260,textures:110,programs:48},
    ultra:{drawCalls:260,triangles:1100000,geometries:320,textures:140,programs:72},
    frameTime:{p50Ms:50,p95Ms:250,p99Ms:1200,longFramesOver250Ms:8},
    restartGrowth:{geometries:4,textures:2,programs:4},
    transitionGrowth:{geometries:8,textures:8,programs:10}
  },
  realHardwareTargets:{
    note:'Targets for representative desktop GPU hardware; reported for release validation and intentionally not enforced in CI software rendering.',
    frameTime:{p50Ms:16.7,p95Ms:25,p99Ms:40,longFramesOver50Ms:0},
    high:{drawCalls:180,triangles:750000},
    ultra:{drawCalls:230,triangles:1000000}
  }
};

const report={status:'PASS',suite:'performance-browser',budgets,samples:{},coverage:{
  contextLossRecovery:'checks/runtime-resilience-browser.mjs',
  realRenderedSoak:'checks/long-session-rendered.mjs'
}};

const percentile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
const resourceKeys=['drawCalls','triangles','geometries','textures','programs'];
const sample=async()=>page.evaluate(()=>{
  window.chimpJumpTest.render();
  const s=window.chimpJump();
  return {
    drawCalls:s.drawCalls,
    triangles:s.triangles,
    geometries:s.geometries,
    textures:s.textures,
    programs:s.programs,
    pooledBranches:s.pooledBranches,
    platformCount:s.platformCount,
    visibleBranches:s.visibleBranches,
    visibleHazards:s.visibleHazards,
    quality:s.quality,
    time:s.time,
    pipelineBuilds:s.pipelineBuilds,
    pipelinePrewarms:s.pipelinePrewarms,
    assetTelemetry:s.assetTelemetry
  };
});

function enforceRendererBudget(label,state){
  const budget=budgets.functionalCI[label];
  for(const key of ['drawCalls','triangles','geometries','textures','programs']){
    assert(state[key]<=budget[key],`${label} ${key} ${state[key]} exceeds functional CI budget ${budget[key]}`);
  }
}

function assertResourceGrowth(before,after,limits,label){
  for(const key of ['geometries','textures','programs']){
    assert(after[key]<=before[key]+limits[key],`${label}: ${key} grew from ${before[key]} to ${after[key]} (limit +${limits[key]})`);
  }
}

try{
  await gotoJump(page,{test:true});
  const resourceGraph=()=>page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>({
    url:new URL(entry.name).pathname,
    initiatorType:entry.initiatorType,
    transferSize:entry.transferSize||0,
    encodedBodySize:entry.encodedBodySize||0,
    decodedBodySize:entry.decodedBodySize||0,
    durationMs:Number(entry.duration.toFixed(1))
  })).filter(entry=>entry.url.startsWith('/')));
  report.loading={initialMenu:await resourceGraph()};
  const initialUrls=new Set(report.loading.initialMenu.map(entry=>entry.url));
  assert(![...initialUrls].some(url=>url.includes('/environment/platforms/branch-moss.glb')),'Branch GLB must be lazy and absent from menu boot');
  assert(![...initialUrls].some(url=>url.includes('/environment/tree-wide-v2-')),'Authored tree plates must be lazy and absent from menu boot');

  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
  await startSelectedRun(page,{fastForward:true});
  report.loading.afterRunStart=await resourceGraph();
  report.loading.deferred=report.loading.afterRunStart.filter(entry=>!initialUrls.has(entry.url));
  assert(report.loading.deferred.some(entry=>entry.url.includes('/environment/platforms/branch-moss.glb')),'Branch GLB should load after run commitment');
  assert(report.loading.deferred.some(entry=>entry.url.includes('/environment/tree-wide-v2-')),'Authored tree plate should load after run commitment');

  // Renderer ceilings are checked independently per visual quality. Gameplay state is untouched.
  for(const quality of ['balanced','high','ultra']){
    await page.evaluate(name=>window.chimpJumpTest.setQuality(name),quality);
    await page.evaluate(()=>window.chimpJumpTest.render());
    const state=await sample();
    report.samples[`quality_${quality}`]=state;
    enforceRendererBudget(quality,state);
  }

  // Frame percentiles: warm the renderer first, then collect a bounded rendered window.
  await page.evaluate(()=>window.chimpJumpTest.setQuality('high'));
  await page.evaluate(()=>window.chimpJumpTest.resumeRendering());
  await page.evaluate(()=>new Promise(resolve=>{
    let frames=0;
    function warm(){if(++frames>=20)resolve();else requestAnimationFrame(warm);}
    requestAnimationFrame(warm);
  }));
  const frameTimes=await page.evaluate(()=>new Promise(resolve=>{
    const samples=[];let previous=performance.now();
    function frame(now){
      const delta=now-previous;previous=now;
      samples.push(delta);
      if(samples.length>=180)resolve(samples);else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  const sorted=[...frameTimes].sort((a,b)=>a-b);
  report.frameTime={
    samples:frameTimes.length,
    p50Ms:Number(percentile(sorted,.50).toFixed(2)),
    p95Ms:Number(percentile(sorted,.95).toFixed(2)),
    p99Ms:Number(percentile(sorted,.99).toFixed(2)),
    maxMs:Number(Math.max(...frameTimes).toFixed(2)),
    longFramesOver50Ms:frameTimes.filter(value=>value>50).length,
    longFramesOver100Ms:frameTimes.filter(value=>value>100).length,
    longFramesOver250Ms:frameTimes.filter(value=>value>250).length
  };
  const frameBudget=budgets.functionalCI.frameTime;
  assert(report.frameTime.p50Ms<=frameBudget.p50Ms,`CI p50 ${report.frameTime.p50Ms}ms exceeds ${frameBudget.p50Ms}ms`);
  assert(report.frameTime.p95Ms<=frameBudget.p95Ms,`CI p95 ${report.frameTime.p95Ms}ms exceeds ${frameBudget.p95Ms}ms`);
  assert(report.frameTime.p99Ms<=frameBudget.p99Ms,`CI p99 ${report.frameTime.p99Ms}ms exceeds ${frameBudget.p99Ms}ms`);
  assert(report.frameTime.longFramesOver250Ms<=frameBudget.longFramesOver250Ms,`CI long-frame count ${report.frameTime.longFramesOver250Ms} exceeds ${frameBudget.longFramesOver250Ms}`);

  const postFrameMode=await page.evaluate(()=>window.chimpJump().mode);
  report.frameTime.safetyPauseObserved=postFrameMode==='paused';
  if(postFrameMode==='paused'){
    await page.evaluate(()=>window.chimpJumpTest.startRun());
    await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  }
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());

  // 10-minute deterministic simulation with world churn.
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.nextY=10000;g.hazards=[];g.nextJetAt=Infinity;g.nextEventAt=Infinity;
    g.platforms=[{id:9900,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  });
  report.samples.initialSimulation=await sample();
  await page.evaluate(()=>window.chimpJumpTest.step(18000));
  report.samples.fiveMinutes=await sample();
  await page.evaluate(()=>window.chimpJumpTest.step(18000));
  report.samples.tenMinutes=await sample();
  assert(report.samples.tenMinutes.geometries<=report.samples.initialSimulation.geometries+8,'10-minute simulation geometry count runaway');
  assert(report.samples.tenMinutes.textures<=report.samples.initialSimulation.textures+3,'10-minute simulation texture count runaway');

  // Theme transitions and burst VFX must stay bounded.
  const beforeVisualEvents=await sample();
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    for(const t of [29.9,59.9,89.9,119.9]){g.time=t;window.chimpJumpTest.step(10);window.chimpJumpTest.burst('hazard');window.chimpJumpTest.burst('coin');}
  });
  report.samples.afterThemeAndVfx=await sample();
  assertResourceGrowth(beforeVisualEvents,report.samples.afterThemeAndVfx,budgets.functionalCI.transitionGrowth,'theme/event VFX');

  // Repeated Ultra -> High -> Balanced transitions must dispose post-process targets/programs.
  const beforeQualityTransitions=await sample();
  for(let i=0;i<6;i++){
    for(const quality of ['ultra','high','balanced']){
      await page.evaluate(name=>window.chimpJumpTest.setQuality(name),quality);
      await page.evaluate(()=>window.chimpJumpTest.render());
    }
  }
  report.samples.afterQualityTransitions=await sample();
  assertResourceGrowth(beforeQualityTransitions,report.samples.afterQualityTransitions,budgets.functionalCI.transitionGrowth,'quality transitions');

  // Rapid selection verifies stale/cancelled requests; sequential swaps verify disposal.
  const avatarIds=await page.evaluate(()=>window.chimpJumpTest.avatarIds());
  const swapIds=avatarIds.filter(id=>['95','166','193','3'].includes(String(id))).slice(0,4);
  if(swapIds.length>=2){
    report.rapidAvatarSwapResults=await page.evaluate(async ids=>Promise.all([
      window.chimpJumpTest.selectAvatar(ids[0]),
      window.chimpJumpTest.selectAvatar(ids[1])
    ]),swapIds);
    const beforeAvatarSwaps=await sample();
    for(let i=0;i<8;i++)await page.evaluate(id=>window.chimpJumpTest.selectAvatar(id),swapIds[i%swapIds.length]);
    report.samples.afterAvatarSwaps=await sample();
    assertResourceGrowth(beforeAvatarSwaps,report.samples.afterAvatarSwaps,budgets.functionalCI.transitionGrowth,'avatar swaps');
  }

  // Opening/closing the character menu repeatedly must not retain GPU resources.
  const beforeMenus=await sample();
  for(let i=0;i<8;i++){
    await page.locator('#choose').click();
    await page.waitForFunction(()=>document.getElementById('collection-dialog')?.open===true);
    await page.locator('#close-collection').click();
    await page.waitForFunction(()=>document.getElementById('collection-dialog')?.open===false);
  }
  report.samples.afterMenus=await sample();
  assertResourceGrowth(beforeMenus,report.samples.afterMenus,budgets.functionalCI.transitionGrowth,'menu cycles');

  await page.evaluate(()=>window.chimpJumpTest.startRun());
  await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));
  if(await page.evaluate(()=>window.chimpJump().mode==='starting'))await page.evaluate(()=>window.chimpJumpTest.finishCountdown());
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');

  // 25 complete restarts remain the primary resource lifetime regression.
  const beforeRestarts=await sample();
  for(let i=0;i<25;i++){
    await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
    await page.waitForFunction(()=>window.chimpJump?.().mode==='over');
    await page.evaluate(()=>document.getElementById('try-again').click());
    await page.waitForFunction(()=>['starting','playing'].includes(window.chimpJump().mode));
    if(await page.evaluate(()=>window.chimpJump().mode==='starting'))await page.evaluate(()=>window.chimpJumpTest.finishCountdown());
    await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  }
  report.samples.beforeRestarts=beforeRestarts;
  report.samples.after25Restarts=await sample();
  assertResourceGrowth(beforeRestarts,report.samples.after25Restarts,budgets.functionalCI.restartGrowth,'25 restarts');

  report.resourceKeys=resourceKeys;
  writeReport('checks/performance-report.json',report);
  console.log('PERFORMANCE_REPORT:'+JSON.stringify(report));
}catch(error){
  report.status='FAIL';report.error=error.message;writeReport('checks/performance-report.json',report);throw error;
}finally{await browser.close();}
