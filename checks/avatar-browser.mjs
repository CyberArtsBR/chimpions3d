import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:720}});
const errors=[];
const network=[];
page.on('pageerror',e=>{errors.push(e.message); console.log('PAGE_ERROR:'+e.message);});
page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(`BROWSER_${m.type().toUpperCase()}:`+m.text());});
page.on('requestfailed',req=>{
  if(req.url().includes('/model/characters/')){
    const item={kind:'failed',url:req.url(),error:req.failure()?.errorText||'unknown'};
    network.push(item);
    console.log('GLB_REQUEST_FAILED:'+JSON.stringify(item));
  }
});
page.on('response',res=>{
  if(res.url().includes('/model/characters/')){
    const item={kind:'response',url:res.url(),status:res.status(),contentType:res.headers()['content-type']||''};
    network.push(item);
    console.log('GLB_RESPONSE:'+JSON.stringify(item));
  }
});

const avatars=[
  ['12','The Archon'],
  ['95','The Heretic'],
  ['38','The Commodore'],
  ['158','The Pioneer'],
  ['166','The Punk'],
  ['193','The Street Fighter'],
  ['26','The Bosun'],
  ['3','The Adolescent'],
  ['9','The Angsty'],
  ['11','The Apologetic'],
];
const requiredAnimationScenarios=[
  ['IDLE','IDLE'],
  ['TAKEOFF','TAKEOFF'],
  ['ASCEND','ASCEND'],
  ['APEX','APEX'],
  ['DESCEND','DESCEND'],
  ['LAND','LAND'],
  ['HARD LAND','LAND'],
  ['SPRING','SPRING'],
  ['HAZARD','HAZARD'],
  ['JETPACK','JETPACK'],
  ['DYING','DYING'],
];

const report={avatars:[],errors,network};
const preparing='Preparing pose and checking skeleton…';

function saveReport(){
  fs.writeFileSync('checks/avatar-browser-report.json',JSON.stringify(report,null,2));
}

function assertAnimationReport(name,animation){
  assert(animation,`${name}: missing character animation test harness`);
  assert.equal(animation.ok,true,`${name}: animation exercise failed: ${animation.failures?.join('; ')}`);
  assert(animation.maxQuaternionNormError<=1e-4,`${name}: quaternion drift ${animation.maxQuaternionNormError}`);
  assert(animation.maxVisualScaleDeviation<=.20,`${name}: unsafe visual scale deviation ${animation.maxVisualScaleDeviation}`);
  assert(animation.maxBoneScaleDelta<=1e-7,`${name}: bone scale changed by ${animation.maxBoneScaleDelta}`);
  assert(animation.maxResetAngularError<=1e-6,`${name}: accumulated pose drift ${animation.maxResetAngularError}`);

  for(const [label,expected] of requiredAnimationScenarios){
    const state=animation.states.find(item=>item.label===label);
    assert(state,`${name}: missing ${label} animation scenario`);
    assert(state.observed.includes(expected),`${name}: ${label} did not enter ${expected}; observed ${state.observed.join(',')}`);
  }
}

try{
  await page.goto('http://127.0.0.1:4173/?test=1');
  await page.waitForFunction(()=>window.chimpJump?.().ready);
  for(const [id,name] of avatars){
    console.log(`START_AVATAR:${id}:${name}`);
    const item={id,name};
    report.avatars.push(item);
    try{
      const choose=page.getByRole('button',{name:'Choose chimp',exact:true});
      item.chooseCount=await choose.count();
      assert.equal(item.chooseCount,1,'Expected exactly one Choose chimp button');
      await choose.click();

      const search=page.getByRole('searchbox',{name:'Search characters'});
      await search.waitFor({state:'visible'});
      item.searchCount=await search.count();
      assert.equal(item.searchCount,1,'Expected exactly one character search box');
      await search.fill(name);

      const option=page.getByRole('button',{name,exact:true});
      item.optionCount=await option.count();
      assert.equal(item.optionCount,1,`${name}: expected exactly one chooser option`);
      item.disabled=await option.isDisabled();
      assert.equal(item.disabled,false,`${name} must be playable`);
      await option.click();

      await page.waitForFunction(expected=>{
        const text=document.getElementById('avatar-status')?.textContent||'';
        return text && text!==expected;
      },preparing,{timeout:30000});

      item.status=await page.locator('#avatar-status').textContent();
      assert(item.status.startsWith(name+' · '),`${name} rejected: ${item.status}`);
      item.state=await page.evaluate(()=>window.chimpJump());
      assert(item.state.ready,`${name} must leave the game ready`);
      assert(item.state.visible,`${name} must be visible after loading`);

      await page.evaluate(()=>window.chimpJumpTest?.suspendRendering());
      item.animation=await page.evaluate(()=>{
        const harness=window.__chimpCharacterAnimationTest;
        if(!harness) return null;
        return harness.exercise();
      });
      assertAnimationReport(name,item.animation);
      await page.evaluate(()=>window.chimpJumpTest?.resumeRendering());
      await page.waitForTimeout(60);

      await page.locator('#world canvas[data-engine]').screenshot({path:`checks/avatar-${id}.png`});
      item.ok=true;
      console.log('AVATAR_OK:'+JSON.stringify(item));
    }catch(err){
      item.ok=false;
      item.error=err?.stack||err?.message||String(err);
      item.status=await page.locator('#avatar-status').textContent().catch(()=>null);
      item.state=await page.evaluate(()=>window.chimpJump?.()).catch(()=>null);
      item.bodyText=(await page.locator('body').innerText().catch(()=>'' )).slice(0,4000);
      await page.locator('#world canvas[data-engine]').screenshot({path:`checks/avatar-failure-${id}.png`}).catch(()=>{});
      console.log('AVATAR_FAILURE:'+JSON.stringify(item));
      saveReport();
      throw err;
    }
  }
  assert.deepEqual(errors,[]);
  console.log('AVATAR_BROWSER_REPORT:'+JSON.stringify(report));
  console.log('PASS avatars: all ten approved Chimpions load and pass the procedural animation state matrix');
}finally{
  saveReport();
  await browser.close();
}
