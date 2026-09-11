import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:720}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
try{
 await page.goto('http://127.0.0.1:4173/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready);
 assert((await page.evaluate(()=>window.chimpJump())).visible);
 await page.screenshot({path:'checks/game-menu.png'});
 await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
 await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(()=>window.chimpJump().yaw< -1.5);
 await page.keyboard.up('ArrowLeft');
 const left=await page.evaluate(()=>window.chimpJump());assert(left.x<0);
 await page.keyboard.down('ArrowRight');
 await page.waitForFunction(()=>window.chimpJump().yaw>1.5);
 await page.keyboard.up('ArrowRight');
 await page.screenshot({path:'checks/game-playing.png'});
 await page.getByRole('button',{name:'Pause game'}).click();
 const time=await page.evaluate(()=>window.chimpJump().time);
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.chimpJump().time),time);
 await page.getByRole('button',{name:'KEEP CLIMBING'}).click();
 // Keep a stationary, safe bounce fixture to inspect active-time theme changes.
 await page.evaluate(()=>{
  const g=window.chimpJumpTest.game();g.x=0;g.vx=0;g.y=0;g.vy=14;g.camera=6;g.height=0;g.nextY=100;
  g.platforms=[{id:9000,x:0,baseX:0,y:0,width:10,type:'solid',coin:false,broken:false}];
  window.chimpJumpTest.step(1801);
 });
 assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Emerald Mist');
 await page.screenshot({path:'checks/game-theme.png'});
 await page.evaluate(()=>{window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);});
 assert.equal(await page.evaluate(()=>window.chimpJump().mode),'over');
 await page.getByRole('button',{name:'JUMP AGAIN'}).click();
 assert.equal(await page.evaluate(()=>window.chimpJump().theme),'Jungle Morning');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Move right',exact:true}).click();
 await page.screenshot({path:'checks/game-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS game: actual GLB, turns, movement, pause, 30-second theme, retry, mobile layout');
}finally{
 await page.screenshot({path:'checks/game-final.png'});
 for(const name of ['game-menu','game-playing','game-theme'])if(fs.existsSync('checks/'+name+'.png'))console.log(name.toUpperCase()+'_IMAGE_BASE64:'+fs.readFileSync('checks/'+name+'.png').toString('base64'));
 await browser.close();
}
