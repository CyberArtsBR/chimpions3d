import {chromium} from '@playwright/test';

const url=process.env.CHIMP_TEST_URL;
if(!url)throw new Error('CHIMP_TEST_URL is required');

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1709,height:864}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));

try{
  await page.goto(url+'/?dash=1&test=1',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:90000});

  const result=await page.evaluate(()=>{
    const api=window.chimpionsDashTest;
    api.setLongFrameGuardSuppressed(true);
    api.startRun({tutorial:true,seed:0xD45A2026});

    const passFixture=id=>{
      const snap=api.snapshot();
      const obstacle=snap.obstacles.find(o=>o.patternId===id&&!o.hit&&!o.passed);
      if(!obstacle)throw new Error('missing tutorial obstacle '+id);
      // Put the fixed player just beyond the obstacle, then advance one
      // authoritative 120 Hz step. This exercises obstacle-pass, tutorial
      // advancement and immediate spawning of the next lesson synchronously.
      api.setRun({scroll:obstacle.x+obstacle.w-150+30,y:0,vy:0,grounded:true});
      api.step(1);
    };

    passFixture('tutorial-tap-jump');
    const afterTap=window.chimpionsDash();
    if(afterTap.tutorial?.index!==1)throw new Error('tap-jump did not advance');

    passFixture('tutorial-hold-jump');

    const finalState=window.chimpionsDash();
    const finalSnap=api.snapshot();
    const slide=finalSnap.obstacles.find(o=>o.patternId==='tutorial-slide'&&!o.hit&&!o.passed);
    if(finalState.state!=='running'||finalSnap.run.dead)throw new Error('run stopped after hold-jump');
    if(finalState.tutorial?.index!==2)throw new Error('hold-jump did not advance to slide');
    if(!slide)throw new Error('slide tutorial obstacle was not spawned');
    if(slide.family!=='overhead')throw new Error('slide tutorial spawned wrong family: '+slide.family);
    if(finalState.lastRuntimeError)throw new Error('runtime error: '+finalState.lastRuntimeError);

    return{
      state:finalState.state,
      tutorialIndex:finalState.tutorial.index,
      nextPattern:slide.patternId,
      nextObstacle:slide.id,
      nextFamily:slide.family,
      lastRuntimeError:finalState.lastRuntimeError
    };
  });

  if(pageErrors.length)throw new Error('page errors: '+pageErrors.join('\n'));
  console.log('PASS_TUTORIAL_STAGE1_SLIDE_SPAWN',JSON.stringify(result));
}finally{
  await browser.close();
}
