import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.CHIMP_TEST_URL||'http://127.0.0.1:4174')+'/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready&&window.chimpJumpTest);
 await page.evaluate(()=>{chimpJumpTest.suspendRendering();chimpJumpTest.startRun();chimpJumpTest.finishCountdown();chimpJumpTest.settleIntro();chimpJumpTest.step(0);});
 await page.waitForFunction(()=>chimpJump().backgroundReady);
 const start=await page.evaluate(()=>{chimpJumpTest.step(0);return chimpJump();});assert.equal(start.treeClimbOffset,0);
 await page.evaluate(()=>chimpJumpTest.render());await page.screenshot({path:'checks/tree-scroll/gameplay-desktop.png'});
 const climb=await page.evaluate(()=>{const g=chimpJumpTest.game();g.camera+=100;g.y+=100;chimpJumpTest.step(0);return chimpJump();});assert(climb.treeClimbOffset>0);assert.equal(climb.treeMeshY,climb.treeCameraY);
 await page.evaluate(()=>chimpJumpTest.render());await page.screenshot({path:'checks/tree-scroll/gameplay-climb.png'});
 // Return to the menu through the existing UI, then start a fresh run.
 await page.evaluate(()=>{document.getElementById('pause').click();document.getElementById('give-up').click();});
 await page.evaluate(()=>{chimpJumpTest.startRun();chimpJumpTest.finishCountdown();chimpJumpTest.settleIntro();chimpJumpTest.step(0);});
 const retry=await page.evaluate(()=>chimpJump());assert.equal(retry.treeClimbOffset,0);assert.equal(retry.treeScrollNormalized,0);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{chimpJumpTest.step(0);chimpJumpTest.render();});await page.screenshot({path:'checks/tree-scroll/gameplay-mobile.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync('checks/tree-scroll/gameplay-report.json',JSON.stringify({status:'PASS',start,climb,retry,errors},null,2));
 console.log('PASS actual Jump boot, start, climb, camera lock, menu/new-run reset, mobile render');
}finally{await browser.close();}
