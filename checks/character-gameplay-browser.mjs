import assert from 'node:assert/strict';
import {attachPageDiagnostics,gotoJump,launchBrowser,startSelectedRun,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1280,height:800}});
const diagnostics=attachPageDiagnostics(page);
const report={states:{},events:{},restart:null};

async function animationState(){
  return page.evaluate(()=>window.chimpJump().animationState);
}
async function eventTypes(){
  return page.evaluate(()=>window.__characterEvents.map(event=>event.type));
}
async function clearEvents(){
  await page.evaluate(()=>{window.__characterEvents.length=0;});
}

try{
  await gotoJump(page,{test:true});
  await page.evaluate(()=>{
    window.__characterEvents=[];
    window.addEventListener('chimp-character-animation',event=>window.__characterEvents.push({...event.detail}));
  });
  await startSelectedRun(page);
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());

  await clearEvents();
  report.states.land=await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    const p=g.platforms[0];
    Object.assign(p,{type:'moving',broken:false,fragile:false,x:g.x,baseX:g.x,y:g.y-.04,width:3,moveRange:0,moveSpeed:1,phase:0});
    g.platforms=[p];g.hazards=[];g.jetRemaining=0;g.dead=false;g.vy=-8;g.bounceAge=1;g.y=p.y+.04;g.x=p.x;
    window.chimpJumpTest.step(1,0);
    window.chimpJumpTest.renderStep(1/60);
    return window.chimpJump().animationState;
  });
  assert.equal(report.states.land,'LAND','real bounce must enter visual-only LAND contact');
  report.events.land=await eventTypes();
  assert(report.events.land.includes('foot-contact'),'real bounce must emit foot-contact');

  await page.evaluate(()=>window.chimpJumpTest.renderStep(.10));
  report.states.postLand=await animationState();
  assert(['TAKEOFF','ASCEND'].includes(report.states.postLand),'landing pose must hand control back to launch immediately after contact window');

  await clearEvents();
  report.states.spring=await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    const p=g.platforms[0];
    Object.assign(p,{type:'spring',broken:false,fragile:false,x:g.x,baseX:g.x,y:g.y-.04,width:3,moveRange:0,moveSpeed:1,phase:0});
    g.platforms=[p];g.hazards=[];g.jetRemaining=0;g.dead=false;g.vy=-8;g.bounceAge=1;g.y=p.y+.04;g.x=p.x;
    window.chimpJumpTest.step(1,0);
    window.chimpJumpTest.renderStep(1/60);
    return window.chimpJump().animationState;
  });
  assert.equal(report.states.spring,'SPRING','real spring bounce must enter SPRING');
  report.events.spring=await eventTypes();
  assert(report.events.spring.includes('spring-contact'),'real spring bounce must emit spring-contact');

  await clearEvents();
  report.states.jetpack=await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.hazards=[];g.dead=false;g.jetRemaining=1;
    window.chimpJumpTest.renderStep(1/60);
    return window.chimpJump().animationState;
  });
  assert.equal(report.states.jetpack,'JETPACK','active real jet timer must enter JETPACK');
  report.events.jetStart=await eventTypes();
  assert(report.events.jetStart.includes('jet-start'),'jet activation must emit jet-start');

  await clearEvents();
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();g.jetRemaining=0;
    window.chimpJumpTest.renderStep(1/60);
  });
  report.events.jetEnd=await eventTypes();
  assert(report.events.jetEnd.includes('jet-end'),'jet exit must emit jet-end');

  await clearEvents();
  report.states.hazard=await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.dead=false;g.jetRemaining=0;g.hazardCooldown=0;g.vy=0;
    g.hazards=[{id:999,type:'thorn',baseX:g.x,x:g.x,y:g.y+.45,radius:.5,range:0,speed:1,phase:0}];
    window.chimpJumpTest.step(1,0);
    window.chimpJumpTest.renderStep(1/60);
    return window.chimpJump().animationState;
  });
  assert.equal(report.states.hazard,'HAZARD','real hazard collision must enter HAZARD');

  await clearEvents();
  report.states.death=await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.hazards=[];g.jetRemaining=0;g.dead=false;g.y=g.camera-20;g.vy=-6;
    window.chimpJumpTest.step(1,0);
    window.chimpJumpTest.renderStep(1/60);
    return window.chimpJump().animationState;
  });
  assert.equal(report.states.death,'DYING','real death event must enter DYING instead of freezing a stale/T pose');
  report.events.death=await eventTypes();
  assert(report.events.death.includes('death'),'death transition must emit death event');

  await page.evaluate(()=>window.chimpJumpTest.ending(.75));
  await page.getByRole('button',{name:'Try Again',exact:true}).click();
  await page.waitForFunction(()=>window.chimpJump().mode==='starting');
  report.restart=await page.evaluate(()=>({mode:window.chimpJump().mode,state:window.chimpJump().animationState}));
  assert.equal(report.restart.state,'IDLE','fresh retry must reset rig pose before countdown');
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.renderStep(1/60);});
  assert.notEqual(await animationState(),'DYING','restart must leave death pose cleanly');

  await page.locator('#world canvas[data-engine]').screenshot({path:'checks/character-gameplay-browser.png'});
  assert.deepEqual(diagnostics.errors,[]);
  assert.deepEqual(diagnostics.consoleErrors,[]);
  report.status='PASS';
  console.log('PASS character gameplay integration: land, spring, jetpack, hazard, death and restart');
}finally{
  writeReport('checks/character-gameplay-browser-report.json',report);
  await browser.close();
}
