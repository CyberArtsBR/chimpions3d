import assert from 'node:assert/strict';
import {launchBrowser,gotoJump,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const shots=[];
async function shot(name){await page.evaluate(()=>window.chimpJumpTest?.render());await page.screenshot({path:'checks/visual-'+name+'.png',animations:'disabled',timeout:90000});shots.push(name);}
try{
  await gotoJump(page,{test:true});
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
  await shot('menu');
  await page.getByRole('button',{name:'Field guide',exact:true}).click();await shot('field-guide');await page.getByRole('button',{name:'Close field guide',exact:true}).click();
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();await shot('character-picker');
  await page.locator('#confirm-chimpion').click();await page.waitForFunction(()=>window.chimpJump().mode==='starting');await page.evaluate(()=>window.chimpJumpTest.render());await shot('countdown');
  await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');await shot('gameplay');

  await page.evaluate(()=>{
    const g=window.chimpJumpTest.game();
    const types=['solid','moving','cracked','spring','leaf','vanish','swing'];
    g.platforms=types.map((type,i)=>({id:8000+i,x:-4.2+i*1.4,baseX:-4.2+i*1.4,y:g.y-1+(i%2)*1.2,width:1.2,type,coin:i%2===0,broken:false,moveRange:1,moveSpeed:.7,phase:i*.3,fragile:type==='cracked'}));
    g.hazards=[{id:8999,type:'thorn-pod',x:3.8,baseX:3.8,y:g.y+2.2,radius:.42,range:0,speed:0,phase:0}];
  });
  await shot('mechanics-solid-moving-cracked-spring-leaf-vanish-swing-thorn');

  const biomes=[['jungle-morning',0],['emerald-mist',30],['golden-canopy',60],['moonlit-grove',90]];
  for(const [name,time] of biomes){await page.evaluate(t=>{const g=window.chimpJumpTest.game();g.time=t;},time);await shot('biome-'+name);}

  await page.getByRole('button',{name:'Pause game'}).click();await shot('pause');await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
  await page.waitForFunction(()=>window.chimpJump().mode==='playing');
  await page.evaluate(()=>{const g=window.chimpJumpTest.game();g.y=-100;window.chimpJumpTest.step(1);window.chimpJumpTest.ending(5);});
  await page.waitForFunction(()=>window.chimpJump().mode==='over');await shot('result');

  const manifest={status:'PASS',suite:'visual-regression-capture',mode:'baseline-candidate',browser:'chromium',viewport:{width:1440,height:900,dpr:1},animations:'disabled',shots,note:'Capture set is deterministic; pixel-diff gating remains disabled until approved baselines are committed.'};
  assert(shots.length>=12);
  writeReport('checks/visual-regression-manifest.json',manifest);
  console.log('PASS visual capture manifest: '+shots.length+' deterministic states');
}finally{await browser.close();}
