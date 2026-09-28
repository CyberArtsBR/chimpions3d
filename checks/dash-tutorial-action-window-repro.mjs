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

    const first=api.snapshot().obstacles.find(o=>o.patternId==='tutorial-tap-jump');
    if(!first)throw new Error('first tutorial obstacle missing');

    // Intentionally fail the first lesson. Tutorial collisions must never end the run.
    api.setRun({scroll:first.x-180,y:0,vy:0,grounded:true});
    api.step(30);
    const retryState=window.chimpionsDash();
    const retrySnap=api.snapshot();
    if(retryState.state!=='running'||retrySnap.run.dead)throw new Error('tutorial collision ended the run');
    if(retryState.tutorial?.index!==0)throw new Error('tutorial collision advanced the lesson');
    if(!retrySnap.obstacles.some(o=>o.patternId==='tutorial-tap-jump'&&!o.hit))throw new Error('tutorial retry obstacle was not respawned');

    // Advance the retry fixture past the first lesson without depending on
    // realtime browser cadence; the HOLD JUMP lesson is the behavior under test.
    const retry=retrySnap.obstacles.find(o=>o.patternId==='tutorial-tap-jump'&&!o.hit);
    api.setRun({scroll:retry.x+retry.w-150+30,y:120,vy:0,grounded:false});
    api.step(1);
    const secondState=window.chimpionsDash();
    const secondSnap=api.snapshot();
    if(secondState.tutorial?.index!==1)throw new Error('did not advance to hold-jump lesson');

    const wide=secondSnap.obstacles.find(o=>o.patternId==='tutorial-hold-jump'&&!o.hit);
    if(!wide)throw new Error('hold-jump obstacle missing');

    // "NOW" must be shown inside a practical reaction window.
    api.setRun({scroll:wide.x-150-135,y:0,vy:0,grounded:true});
    api.step(1);
    const cue=document.getElementById('dash-tip')?.textContent||'';
    if(!/HOLD JUMP NOW/.test(cue))throw new Error('hold-jump NOW cue missing: '+cue);

    // Simulate the actual action after a short human reaction delay.
    api.step(24);
    api.setInput('jump','repro',true);
    api.step(95);
    api.setInput('jump','repro',false);
    api.step(30);

    const finalState=window.chimpionsDash();
    const finalSnap=api.snapshot();
    if(finalState.state!=='running'||finalSnap.run.dead)throw new Error('hold-jump lesson ended the run');
    if((finalState.tutorial?.index??0)<2)throw new Error('hold-jump lesson did not advance');
    if(finalState.lastRuntimeError)throw new Error('runtime error: '+finalState.lastRuntimeError);

    return{
      retryState:retryState.state,
      tutorialIndex:finalState.tutorial?.index,
      cue,
      runtimeErrorCount:finalState.runtimeErrorCount,
      lastRuntimeError:finalState.lastRuntimeError
    };
  });

  if(pageErrors.length)throw new Error('page errors: '+pageErrors.join('\n'));
  console.log('PASS_TUTORIAL_ACTION_WINDOW',JSON.stringify(result));
}finally{
  await browser.close();
}
