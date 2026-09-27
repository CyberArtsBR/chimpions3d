import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport} from './dash-test-utils.mjs';

const {browser,page,pageErrors}=await openBrowserPage({viewport:{width:1440,height:900}});
const report={scope:'dash-runtime-determinism',runs:{}};

async function runReplay(quality){
  await page.evaluate(tier=>window.chimpionsDashPerformance.setQuality(tier),quality);
  return page.evaluate(()=>{
    const api=window.chimpionsDashTest;
    api.reset('release-determinism-424242',0);
    const actions=new Map([
      [18,[['jump',true]]],[28,[['jump',false]]],
      [122,[['slide',true]]],[154,[['slide',false]]],
      [236,[['jump',true]]],[258,[['jump',false]]],
      [390,[['slide',true]]],[420,[['slide',false]]],
      [510,[['jump',true]]],[532,[['jump',false]]]
    ]);
    const checkpoints=[];
    for(let step=0;step<1800;step++){
      for(const [kind,down] of actions.get(step)||[])api.setInput(kind,'determinism',down);
      const s=api.step(1);
      if(step%60===0||s.state!=='running'){
        checkpoints.push({
          step,state:s.state,time:s.run.time,stage:s.run.stage,speed:s.run.speed,distance:s.run.distance,
          y:s.run.y,vy:s.run.vy,grounded:s.run.grounded,sliding:s.run.slideHeld||s.run.slideTime>0||s.run.slideMin>0,
          score:s.run.score,flow:s.run.flow,combo:s.run.combo,bananas:s.run.bananaCount,golden:s.run.goldenBananas,
          obstacles:s.obstacles.slice(0,18).map(o=>[o.patternId,o.id,Number(o.x.toFixed(4)),o.passed,o.hit]),
          collectibles:s.bananas.slice(0,24).map(b=>[Number(b.x.toFixed(4)),Number(b.y.toFixed(4)),b.golden,b.collected])
        });
      }
      if(s.state!=='running')break;
    }
    api.setInput('jump','determinism',false);api.setInput('slide','determinism',false);
    const s=api.snapshot(),d=window.chimpionsDash();
    return{
      rulesVersion:d.rulesVersion,seed:s.run.seed,seedState:s.run.seedState,state:s.state,
      final:{time:s.run.time,stage:s.run.stage,speed:s.run.speed,distance:s.run.distance,score:s.run.score,flow:s.run.flow,maxFlow:s.run.maxFlow,combo:s.run.combo,longestCombo:s.run.longestCombo,bananas:s.run.bananaCount,goldenBananas:s.run.goldenBananas,dead:s.run.dead},
      checkpoints
    };
  });
}

try{
  await waitForDash(page);
  const lowA=await runReplay('LOW');
  const lowB=await runReplay('LOW');
  const ultra=await runReplay('ULTRA');
  assert.deepEqual(lowA,lowB,'same gameplay version + seed + input timeline must reproduce exactly');
  assert.deepEqual(ultra,lowA,'graphics quality must not alter authoritative Dash simulation');
  assert(lowA.rulesVersion,'determinism report must include gameplay/rules version');
  assert(lowA.checkpoints.length>=2,'determinism replay must produce observable checkpoints');
  report.runs={LOW:firstSummary(lowA),ULTRA:firstSummary(ultra)};
  report.contract={sameSeedInputTimeline:true,qualityInvariant:true,fields:['obstacle sequence','collectible sequence','timings','score','distance','Flow','combo','result']};
  assert.deepEqual(pageErrors,[]);
  writeReport('dash-runtime-determinism-report.json',report);
  console.log('PASS Dash authoritative runtime determinism including score/Flow/combo/content/result');
}finally{await browser.close();}

function firstSummary(run){
  return{rulesVersion:run.rulesVersion,seed:run.seed,state:run.state,checkpoints:run.checkpoints.length,final:run.final};
}
