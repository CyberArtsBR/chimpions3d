import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport} from './dash-test-utils.mjs';

const {browser,page,pageErrors}=await openBrowserPage({viewport:{width:1440,height:900}});
const report={scope:'dash-physics',tests:{},capabilities:{}};
const reset=(s='physics',t=0)=>page.evaluate(([a,b])=>window.chimpionsDashTest.reset(a,b),[s,t]);
const clear=()=>page.evaluate(()=>window.chimpionsDashTest.clearWorld());
const step=n=>page.evaluate(n=>window.chimpionsDashTest.step(n),n);
const input=(k,s,o)=>page.evaluate(([a,b,c])=>window.chimpionsDashTest.setInput(a,b,c),[k,s,o]);
const snap=()=>page.evaluate(()=>window.chimpionsDashTest.snapshot());

async function apex(heldSteps){
  await reset('apex-'+heldSteps);await clear();await input('jump','qa',true);
  let peak=0;
  for(let i=0;i<240;i++){
    if(i===heldSteps)await input('jump','qa',false);
    const s=await step(1);peak=Math.max(peak,s.run.y);
    if(i>8&&s.run.grounded)break;
  }
  await input('jump','qa',false);return peak;
}

try{
  await waitForDash(page);
  const catalog=await page.evaluate(()=>window.chimpionsDashTest.catalog());
  report.constants=catalog.constants;

  const tap=await apex(2),hold=await apex(30);
  assert(tap>=catalog.constants.LOW_HEIGHT-3,`tap apex ${tap} below contract`);
  assert(hold>tap+25,`held apex ${hold} must exceed tap ${tap}`);
  report.tests.jumpApex={tap,hold};

  await reset('multi');await clear();
  await input('jump','keyboard',true);await input('jump','gamepad',true);await input('jump','keyboard',false);
  let s=await snap();assert.deepEqual(s.inputs.jump,['gamepad']);assert.equal(s.run.jumpHeld,true);
  await input('jump','gamepad',false);s=await snap();assert.equal(s.inputs.jump.length,0);assert.equal(s.run.jumpHeld,false);
  await input('slide','mouse',true);await input('slide','touch',true);await input('slide','mouse',false);
  s=await snap();assert.deepEqual(s.inputs.slide,['touch']);assert.equal(s.run.slideHeld,true);
  await input('slide','touch',false);report.tests.multiInput='pass';

  await reset('coyote');await clear();
  await page.evaluate(()=>window.chimpionsDashTest.setRun({y:2,vy:-20,grounded:false,coyote:.05}));
  await input('jump','qa',true);s=await step(1);assert(s.run.vy>0,'coyote jump must launch');await input('jump','qa',false);
  report.tests.coyote='pass';

  await reset('buffer');await clear();
  await page.evaluate(()=>window.chimpionsDashTest.setRun({y:5,vy:-160,grounded:false,coyote:0}));
  await input('jump','qa',true);s=await step(20);assert(s.run.y>0&&s.run.vy>0,'buffered landing jump must launch');await input('jump','qa',false);
  report.tests.bufferedLanding='pass';

  await reset('slide-min');await clear();
  await input('slide','qa',true);await step(1);await input('slide','qa',false);s=await step(8);
  assert(s.run.slideTime>0||s.run.slideMin>0,'minimum slide duration must persist');
  s=await step(40);assert.equal(s.run.slideHeld,false);assert.equal(s.run.slideBlocked,false);assert.equal(s.run.slideMin,0);
  report.tests.slideMinimum='pass';

  await reset('blocked');await clear();await page.evaluate(()=>window.chimpionsDashTest.spawnObstacle('branch',80));
  await input('slide','qa',true);await step(1);await input('slide','qa',false);s=await step(30);
  assert.equal(s.state,'running');assert(s.run.slideBlocked||s.standBlocked,'overhead must block standing');
  s=await step(35);assert.equal(s.run.slideBlocked,false,'runner must stand after clearance');
  report.tests.blockedStand='pass';

  await reset('slide-jump');await clear();await input('slide','qa',true);await step(2);await input('jump','qb',true);s=await step(1);
  assert(s.run.y>0||s.run.vy>0);assert.equal(s.run.slideHeld,false);await input('jump','qb',false);await input('slide','qa',false);
  report.tests.slideToJump='pass';

  await reset('landing-slide');await clear();await page.evaluate(()=>window.chimpionsDashTest.setRun({y:8,vy:-180,grounded:false,coyote:0}));
  await input('slide','qa',true);s=await step(20);assert(s.run.grounded&&s.run.slideHeld,'held slide must activate on landing');await input('slide','qa',false);
  report.tests.landingToSlide='pass';

  const swept={};
  for(const id of ['log','stump','log-pile','branch']){
    await reset('swept-'+id,900);await clear();await page.evaluate(id=>window.chimpionsDashTest.spawnObstacle(id,420),id);s=await step(1);
    assert.equal(s.state,'over',`high-speed ${id} tunneled`);swept[id]={speed:s.run.speed,hit:s.obstacles.find(o=>o.id===id)?.hit||false};
  }
  report.tests.sweptHazards=swept;

  await reset('banana',900);await clear();await page.evaluate(()=>window.chimpionsDashTest.spawnBanana(420,20,false));s=await step(1);
  assert.equal(s.run.bananaCount,1);assert.equal(s.state,'running');report.tests.sweptBanana={speed:s.run.speed,count:s.run.bananaCount};

  await reset('score');await clear();await page.evaluate(()=>{window.chimpionsDashTest.spawnBanana(4,20,false);window.chimpionsDashTest.spawnBanana(8,20,true);});
  s=await step(6);assert(s.run.distance>0&&s.run.score>0);assert(s.run.bananaCount>=1);assert(s.run.flow>0);
  report.tests.scoring={distance:s.run.distance,score:s.run.score,bananas:s.run.bananaCount,golden:s.run.goldenBananas,flow:s.run.flow,bonus:s.run.bonus};
  report.capabilities.perfectActions='not exposed/implemented on current main';
  report.capabilities.nearMisses='not exposed/implemented on current main';

  assert.deepEqual(pageErrors,[]);
  writeReport('dash-physics-report.json',report);
  console.log(`PASS dash physics tap=${tap.toFixed(1)} held=${hold.toFixed(1)}`);
}finally{await browser.close();}
