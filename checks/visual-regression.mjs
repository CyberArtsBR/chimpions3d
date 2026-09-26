import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const shots=[];
async function shot(name){await page.evaluate(()=>window.chimpJumpTest?.render());await page.screenshot({path:'checks/visual-'+name+'.png',animations:'disabled',timeout:90000});shots.push(name);}
try{
  await gotoJump(page,{test:true});
  await page.evaluate(async()=>{await window.chimpJumpTest.selectAvatar('12');window.chimpJumpTest.suspendRendering();window.chimpJumpTest.render();});
  await shot('menu');
  await page.getByRole('button',{name:'Field Guide',exact:true}).click();await shot('field-guide');await page.getByRole('button',{name:'Close Field Guide',exact:true}).click();
  await page.getByRole('button',{name:'Options',exact:true}).click();
  await page.getByLabel('Reduced Motion').check();await shot('options-reduced-motion');
  await page.getByLabel('Reduced Motion').uncheck();await page.getByRole('button',{name:'Close Options',exact:true}).click();
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();await shot('character-picker');
  await page.locator('#confirm-chimpion').click();await page.waitForFunction(()=>window.chimpJump().mode==='starting');await page.evaluate(()=>window.chimpJumpTest.render());await shot('countdown');
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.x=0;g.vx=0;g.y=0;g.vy=12.6;g.camera=5;g.height=0;g.hazards=[];g.nextJetAt=Infinity;g.nextEventAt=Infinity;
    g.platforms=[
      {id:7900,x:-2.4,baseX:-2.4,y:0,width:2.2,type:'solid',coin:false,broken:false},
      {id:7901,x:0,baseX:0,y:3.8,width:1.8,type:'moving',coin:true,broken:false,moveRange:1,moveSpeed:.7,phase:.2},
      {id:7902,x:2.5,baseX:2.5,y:7.6,width:1.7,type:'spring',coin:true,broken:false}
    ];
    window.chimpJumpTest.render();
  });
  await shot('gameplay');

  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    const types=['solid','moving','cracked','spring','leaf','vanish','swing'];
    g.platforms=types.map((type,i)=>({id:8000+i,x:-4.2+i*1.4,baseX:-4.2+i*1.4,y:g.y-1+(i%2)*1.2,width:1.2,type,coin:i%2===0,broken:false,moveRange:1,moveSpeed:.7,phase:i*.3,fragile:type==='cracked'}));
    g.hazards=[{id:8999,type:'thorn-pod',x:3.8,baseX:3.8,y:g.y+2.2,radius:.42,range:0,speed:0,phase:0}];
  });
  await shot('mechanics-solid-moving-cracked-spring-leaf-vanish-swing-thorn');

  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    g.jetpack={x:g.x+1.4,y:g.y+2.4};
    g.jetRemaining=6;
  });
  await shot('jetpack');
  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.jetpack=null;g.jetRemaining=0;});

  const biomes=[['jungle-morning',0],['emerald-mist',30],['golden-canopy',60],['moonlit-grove',90]];
  for(const [name,time] of biomes){await page.evaluate(t=>{const g=window.chimpJumpTest.game();g.time=t;},time);await shot('biome-'+name);}

  await page.getByRole('button',{name:'Pause game'}).click();await shot('pause');await page.getByRole('button',{name:'Resume'}).click();
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.waitForFunction(()=>window.chimpJump().mode==='over');await shot('result');
  await page.evaluate(()=>document.body.dataset.reducedMotion='true');await shot('result-reduced-motion');
  await page.evaluate(()=>document.body.dataset.reducedMotion='false');

  const manifest={status:'PASS',suite:'visual-regression-capture',mode:'baseline-candidate',browser:'chromium',viewport:{width:1440,height:900,dpr:1},animations:'disabled',shots,note:'Capture set includes reduced-motion Options/results states; pixel-diff gating remains disabled until approved baselines are committed.'};
  assert(shots.length>=14);
  writeReport('checks/visual-regression-manifest.json',manifest);
  console.log('PASS visual capture manifest: '+shots.length+' deterministic states');
}finally{await browser.close();}
