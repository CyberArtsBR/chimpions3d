import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,startSelectedRun,writeReport} from './qa-browser-utils.mjs';

const seconds=Math.max(60,Number(process.env.CHIMP_REAL_SOAK_SECONDS||300));
const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={status:'PASS',suite:'long-session-rendered',seconds,samples:[],autoPauses:0};
try{
  await gotoJump(page,{test:true});
  await startSelectedRun(page,{fastForward:true});
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.nextY=10000;
    g.hazards=[];g.nextJetAt=Infinity;g.nextEventAt=Infinity;
    g.platforms=[{id:9950,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  });
  const sample=async elapsed=>{
    const state=await page.evaluate(()=>window.chimpJump());
    report.samples.push({
      elapsed,
      mode:state.mode,
      gameTime:Number(state.time.toFixed(2)),
      drawCalls:state.drawCalls,
      triangles:state.triangles,
      geometries:state.geometries,
      textures:state.textures,
      programs:state.programs,
      pooledBranches:state.pooledBranches,
      jsHeapBytes:performance.memory?.usedJSHeapSize||null,
      assetActiveRequests:state.assetTelemetry?.active||0,
      platformCount:state.platformCount,
      visibleBranches:state.visibleBranches
    });
  };
  await sample(0);
  for(let elapsed=10;elapsed<=seconds;elapsed+=10){
    await page.waitForTimeout(10000);
    const mode=await page.evaluate(()=>window.chimpJump().mode);
    if(mode==='paused'){
      report.autoPauses++;
      await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
      await page.waitForFunction(()=>window.chimpJump().mode==='playing');
    }
    if(elapsed%60===0||elapsed===seconds)await sample(elapsed);
  }
  const first=report.samples[0],last=report.samples.at(-1);
  assert(last.geometries<=first.geometries+8,'Rendered soak geometry count runaway');
  assert(last.textures<=first.textures+3,'Rendered soak texture count runaway');
  assert(last.programs<=first.programs+6,'Rendered soak shader/program count runaway');
  assert(last.pooledBranches<=56,'Rendered soak branch pool exceeded bounded capacity');
  assert(last.assetActiveRequests===0,'Rendered soak ended with asset requests still active');
  report.heapGrowthBytes=first.jsHeapBytes&&last.jsHeapBytes?last.jsHeapBytes-first.jsHeapBytes:null;
  assert(report.autoPauses<=3,'Rendered soak encountered excessive safety auto-pauses: '+report.autoPauses);
  writeReport('checks/long-session-rendered-report.json',report);
  console.log('PASS real-rendered soak: '+seconds+' seconds, '+report.autoPauses+' safety auto-pauses');
}catch(error){
  report.status='FAIL';report.error=error.message;
  writeReport('checks/long-session-rendered-report.json',report);
  throw error;
}finally{await browser.close();}
