import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport} from './dash-test-utils.mjs';

const {browser,page,pageErrors}=await openBrowserPage({viewport:{width:1440,height:900}});
const START_TIMES=[0,30,60,120,180,300,600],SEEDS_PER_TIME=384;
const report={scope:'dash-pattern-fuzz',seedsPerTime:SEEDS_PER_TIME,startTimes:START_TIMES,totalSeeds:0,patterns:0,failures:[],warnings:[],byTime:{}};

function futureSpeed(base,time,currentStage,currentSpeed,x,scroll=0,playerX=150){
  const arrival=time+Math.max(0,x-scroll-playerX)/currentSpeed;
  const stage=Math.max(currentStage,Math.floor((arrival+2)/30)+1);
  return base*Math.pow(1.2,Math.max(0,stage-1));
}
const transitionFloor=(prev,next)=>prev.action!=='slide'?1.02:next.action==='slide'?.55:.72;

try{
  await page.route('https://raw.githubusercontent.com/CyberArtsBR/chimpions-dash/**',r=>r.abort('failed'));
  await waitForDash(page);
  const catalog=await page.evaluate(()=>window.chimpionsDashTest.catalog());
  const base=catalog.constants.BASE_SPEED,types=new Set(catalog.types.map(t=>t.id));

  for(const time of START_TIMES){
    const bucket={seeds:0,patterns:0,minInitialReaction:Infinity,minTransition:Infinity,minRecovery:Infinity,failures:0};
    for(let i=0;i<SEEDS_PER_TIME;i++){
      const seed=`dash-fuzz-${time}-${i}`;
      const snap=await page.evaluate(([s,t])=>window.chimpionsDashTest.reset(s,t),[seed,time]);
      report.totalSeeds++;bucket.seeds++;
      const obs=snap.obstacles.slice().sort((a,b)=>a.x-b.x),groups=[];
      for(const o of obs){
        let g=groups.at(-1);
        if(!g||g.id!==o.patternId){g={id:o.patternId||'unknown',items:[]};groups.push(g);}
        g.items.push(o);
      }
      bucket.patterns+=groups.length;report.patterns+=groups.length;

      if(obs.length){
        const first=obs[0],reaction=Math.max(0,first.x-catalog.constants.PLAYER_X)/snap.run.speed;
        bucket.minInitialReaction=Math.min(bucket.minInitialReaction,reaction);
        if(time<=300&&reaction<.32){
          const f={seed,pattern:first.patternId,stage:snap.run.stage,speed:snap.run.speed,obstacle:first.id,reactionTime:reaction,kind:'initial-reaction'};
          report.failures.push(f);bucket.failures++;
        }else if(time>300&&reaction<.12)report.warnings.push({seed,stage:snap.run.stage,speed:snap.run.speed,reactionTime:reaction,kind:'extended-survival-legibility'});
      }

      for(const g of groups)for(let j=1;j<g.items.length;j++){
        const prev=g.items[j-1],next=g.items[j],gap=next.x-(prev.x+prev.w);
        assert(gap>0,`seed ${seed} pattern ${g.id}: overlap ${prev.id}->${next.id}`);
        const speed=futureSpeed(base,snap.run.time,snap.run.stage,snap.run.speed,next.x,snap.run.scroll,catalog.constants.PLAYER_X);
        const seconds=gap/speed,required=transitionFloor(prev,next);bucket.minTransition=Math.min(bucket.minTransition,seconds);
        if(seconds+1e-6<required){
          const f={seed,pattern:g.id,stage:snap.run.stage,speed,obstacle:next.id,reactionTime:seconds,required,kind:'transition'};
          report.failures.push(f);bucket.failures++;
        }
      }

      for(let g=1;g<groups.length;g++){
        const prev=groups[g-1].items.at(-1),next=groups[g].items[0];if(!prev||!next)continue;
        const gap=next.x-(prev.x+prev.w),speed=futureSpeed(base,snap.run.time,snap.run.stage,snap.run.speed,next.x,snap.run.scroll,catalog.constants.PLAYER_X);
        const seconds=gap/speed;bucket.minRecovery=Math.min(bucket.minRecovery,seconds);
        if(seconds<.82){
          const f={seed,pattern:groups[g].id,stage:snap.run.stage,speed,obstacle:next.id,reactionTime:seconds,required:.82,kind:'recovery'};
          report.failures.push(f);bucket.failures++;
        }
      }
      for(const o of obs)assert(types.has(o.id),`seed ${seed}: unknown obstacle ${o.id}`);
    }
    report.byTime[time]=bucket;
  }

  assert(report.totalSeeds>=2000,'fuzz suite must cover thousands of deterministic seeds');
  writeReport('dash-patterns-report.json',report);
  if(report.failures.length){
    const f=report.failures[0];
    throw new assert.AssertionError({message:`Dash pattern invariant failed seed=${f.seed} pattern=${f.pattern} stage=${f.stage} speed=${f.speed.toFixed(2)} obstacle=${f.obstacle} reaction=${f.reactionTime.toFixed(3)}s kind=${f.kind}`});
  }
  assert.deepEqual(pageErrors,[]);
  console.log(`PASS dash pattern fuzz: ${report.totalSeeds} seeds, ${report.patterns} windows`);
}finally{await browser.close();}
