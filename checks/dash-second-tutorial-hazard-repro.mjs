import {chromium} from '@playwright/test';

const url=process.env.CHIMP_TEST_URL||'https://chimp-dash-collision-end-state-qa.onrender.com';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1920,height:1080}});
const page=await context.newPage();
const pageErrors=[],consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});

async function state(){return page.evaluate(()=>window.chimpionsDash())}
async function snap(){return page.evaluate(()=>window.chimpionsDashTest.snapshot())}

try{
  await page.goto(url+'/?dash=1&test=1',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:90000});
  await page.evaluate(()=>window.chimpionsDashTest.setLongFrameGuardSuppressed(true));

  const catalog=await page.evaluate(()=>window.chimpionsDashTest.catalog().types);
  for(const type of catalog){
    await page.evaluate(id=>{
      window.chimpionsDashTest.reset('hazard-'+id,0);
      window.chimpionsDashTest.clearWorld();
      window.chimpionsDashTest.spawnObstacle(id,230);
    },type.id);
    const action=type.action;
    try{
      if(action==='slide'){
        await page.evaluate(()=>window.chimpionsDashTest.setInput('slide','repro',true));
        await page.evaluate(()=>window.chimpionsDashTest.step(180));
        await page.evaluate(()=>window.chimpionsDashTest.setInput('slide','repro',false));
      }else{
        await page.evaluate(()=>window.chimpionsDashTest.setInput('jump','repro',true));
        await page.evaluate(a=>window.chimpionsDashTest.step(a==='high-jump'?55:22),action);
        await page.evaluate(()=>window.chimpionsDashTest.setInput('jump','repro',false));
        await page.evaluate(()=>window.chimpionsDashTest.step(180));
      }
      const after=await snap();
      console.log('HAZARD_OK',type.id,after.state,after.run?.scroll,after.run?.dead);
    }catch(error){
      console.error('HAZARD_THROW',type.id,String(error?.stack||error),JSON.stringify({public:await state(),snap:await snap(),pageErrors,consoleErrors},null,2));
      process.exitCode=10;break;
    }
  }

  if(!process.exitCode){
    await page.evaluate(()=>window.chimpionsDashPresentationApi.startRun({tutorial:true,seed:0xD45A2026}));
    await page.waitForFunction(()=>window.chimpionsDash().state==='running'&&window.chimpionsDash().tutorial?.enabled,{timeout:10000});

    let acted0=false,acted1=false,reachedTutorial2=false;
    const started=Date.now();
    while(Date.now()-started<26000){
      const s=await page.evaluate(()=>({public:window.chimpionsDash(),snap:window.chimpionsDashTest.snapshot()}));
      if(s.public.state==='paused'){
        console.error('REPRO_PAUSED',JSON.stringify({
          lastRuntimeError:s.public.lastRuntimeError,tutorial:s.public.tutorial,run:s.snap.run,
          obstacles:s.snap.obstacles,pageErrors,consoleErrors
        },null,2));
        process.exitCode=2;break;
      }
      if(s.public.state==='over'){
        console.error('REPRO_GAME_OVER',JSON.stringify({tutorial:s.public.tutorial,run:s.snap.run,obstacles:s.snap.obstacles,lastRuntimeError:s.public.lastRuntimeError,pageErrors,consoleErrors},null,2));
        process.exitCode=3;break;
      }
      const playerX=150+s.snap.run.scroll;
      const nearest=s.snap.obstacles.filter(o=>!o.passed&&!o.hit&&o.x+o.w>=playerX).sort((a,b)=>a.x-b.x)[0];
      const distance=nearest?nearest.x-playerX:Infinity;
      const ti=s.public.tutorial?.index??-1;
      if(ti===0&&!acted0&&distance<125){
        acted0=true;await page.keyboard.down('Space');await page.waitForTimeout(65);await page.keyboard.up('Space');
      }else if(ti===1&&!acted1&&distance<175){
        acted1=true;await page.keyboard.down('Space');await page.waitForTimeout(430);await page.keyboard.up('Space');
      }
      if(ti>=2){
        reachedTutorial2=true;
        console.log('PASS_REACHED_TUTORIAL_2',JSON.stringify({tutorial:s.public.tutorial,lastRuntimeError:s.public.lastRuntimeError,runtimeFaults:s.public.runtimeFaults,pageErrors,consoleErrors}));
        break;
      }
      await page.waitForTimeout(12);
    }
    const final=await state();
    if(!reachedTutorial2||final.state!=='running'){
      console.error('REPRO_DID_NOT_CLEAR_SECOND_HAZARD',JSON.stringify({public:final,snap:await snap(),acted0,acted1,pageErrors,consoleErrors},null,2));
      process.exitCode=4;
    }else{
      console.log('PASS_NO_PAUSE_LOOP',JSON.stringify({state:final.state,tutorial:final.tutorial,lastRuntimeError:final.lastRuntimeError,runtimeErrorCount:final.runtimeErrorCount,runtimeFaults:final.runtimeFaults}));
    }
  }
}finally{
  await browser.close();
}
