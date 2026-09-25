import assert from 'node:assert/strict';
import {launchBrowser,VIEWPORTS,attachPageDiagnostics,gotoJump,assertNoHorizontalOverflow,startSelectedRun,writeReport} from './qa-browser-utils.mjs';

const {browser}=await launchBrowser('chromium');
const report={status:'PASS',suite:'responsive-browser',viewports:[]};
try{
  for(const viewport of VIEWPORTS){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    const diag=attachPageDiagnostics(page);
    await gotoJump(page,{test:true});
    const item={...viewport};
    item.menu=await assertNoHorizontalOverflow(page,viewport.name+' menu');
    assert(await page.getByRole('button',{name:'LET’S JUMP',exact:true}).isVisible(),viewport.name+': play action hidden');
    assert(await page.getByRole('button',{name:'Field guide',exact:true}).isVisible(),viewport.name+': Field Guide hidden');
    await page.screenshot({path:`checks/responsive-${viewport.name}-menu.png`,animations:'disabled'});

    await page.getByRole('button',{name:'Field guide',exact:true}).click();
    const guide=page.locator('#jump-guide-dialog[open]');
    await guide.waitFor({state:'visible'});
    const guideBox=await guide.boundingBox();
    assert(guideBox&&guideBox.x>=-1&&guideBox.y>=-1&&guideBox.x+guideBox.width<=viewport.width+1&&guideBox.y+guideBox.height<=viewport.height+1,viewport.name+': Field Guide exceeds viewport');
    await page.getByRole('button',{name:'Close field guide',exact:true}).click();

    await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
    const picker=page.locator('#collection-dialog[open]');
    await picker.waitFor({state:'visible'});
    const pickerBox=await picker.boundingBox();
    assert(pickerBox&&pickerBox.x>=-1&&pickerBox.y>=-1&&pickerBox.x+pickerBox.width<=viewport.width+1&&pickerBox.y+pickerBox.height<=viewport.height+1,viewport.name+': picker exceeds viewport');
    assert(await page.locator('#confirm-chimpion').isVisible(),viewport.name+': picker play action hidden');
    await page.screenshot({path:`checks/responsive-${viewport.name}-picker.png`,animations:'disabled'});

    await page.locator('#confirm-chimpion').click();
    await page.waitForFunction(()=>window.chimpJump?.().mode==='starting');
    await page.evaluate(()=>{window.chimpJumpTest.finishCountdown();window.chimpJumpTest.settleIntro();window.chimpJumpTest.render();});
    await page.waitForFunction(()=>window.chimpJump?.().mode==='playing');
    item.playing=await assertNoHorizontalOverflow(page,viewport.name+' playing');
    assert(await page.getByRole('button',{name:'Pause game'}).isVisible(),viewport.name+': pause action hidden');
    if(viewport.width<=768){
      const touch=page.locator('#touch');
      assert(await touch.isVisible(),viewport.name+': touch controls must be visible in gameplay');
      const boxes=await touch.locator('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
      for(const b of boxes)assert(b.left>=0&&b.top>=0&&b.right<=viewport.width+1&&b.bottom<=viewport.height+1&&b.width>=40&&b.height>=40,viewport.name+': touch target clipped or too small');
      if(viewport.name==='mobile-390x844'){
        const right=page.locator('#right'),box=await right.boundingBox();
        assert(box,viewport.name+': right touch control has no hit box');
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down();
        await page.evaluate(()=>window.chimpJumpTest.stepInput(16));
        await page.mouse.up();
        assert(await page.evaluate(()=>window.chimpJump().vx>0),viewport.name+': touch-control pointer hold must steer right');
        item.touchInput=true;
      }
    }
    await page.getByRole('button',{name:'Pause game'}).click();
    await page.waitForFunction(()=>window.chimpJump?.().mode==='paused');
    const pauseCard=page.locator('#overlay .card');
    const pauseBox=await pauseCard.boundingBox();
    assert(pauseBox&&pauseBox.y>=-1&&pauseBox.y+pauseBox.height<=viewport.height+1,viewport.name+': pause UI exceeds viewport');
    item.errors=diag.errors;item.consoleErrors=diag.consoleErrors;item.sameOriginFailures=diag.sameOriginFailures;
    assert.deepEqual(diag.errors,[],viewport.name+': page errors');
    assert.deepEqual(diag.consoleErrors,[],viewport.name+': console errors');
    assert.deepEqual(diag.sameOriginFailures,[],viewport.name+': same-origin failures');
    report.viewports.push(item);
    await page.close();
  }
  writeReport('checks/responsive-report.json',report);
  console.log('PASS responsive browser matrix: '+report.viewports.length+' viewports');
}catch(error){
  report.status='FAIL';report.error=error.message;writeReport('checks/responsive-report.json',report);throw error;
}finally{await browser.close();}
