import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:760}});
const errors=[];
const network=[];
page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE_ERROR:'+error.message);});
page.on('console',message=>{if(['error','warning'].includes(message.type()))console.log('BROWSER_'+message.type().toUpperCase()+':'+message.text());});
page.on('requestfailed',request=>{
  if(request.url().includes('/model/characters/'))network.push({kind:'failed',url:request.url(),error:request.failure()?.errorText||'unknown'});
});
page.on('response',response=>{
  if(response.url().includes('/model/characters/'))network.push({kind:'response',url:response.url(),status:response.status(),contentType:response.headers()['content-type']||''});
});

const avatars=[
  ['12','The Archon'],['95','The Heretic'],['38','The Commodore'],['158','The Pioneer'],
  ['166','The Punk'],['193','The Street Fighter'],['26','The Bosun'],['3','The Adolescent'],
  ['9','The Angsty'],['11','The Apologetic'],
];
const requiredStates=[
  ['IDLE','IDLE'],['TAKEOFF','TAKEOFF'],['ASCEND','ASCEND'],['APEX','APEX'],
  ['DESCEND','DESCEND'],['LAND','LAND'],['HARD LAND','LAND'],['SPRING','SPRING'],
  ['HAZARD','HAZARD'],['JETPACK','JETPACK'],['DYING','DYING'],
];
const requiredEvents=['foot-contact','takeoff','apex','spring-contact','jet-start','jet-end','death'];
const report={avatars:[],errors,network,reload:null};

function save(){
  fs.writeFileSync('checks/avatar-browser-report.json',JSON.stringify(report,null,2));
}

function assertAnimation(name,animation){
  assert(animation,name+': missing animation harness');
  assert.equal(animation.ok,true,name+': '+(animation.failures||[]).join('; '));
  assert(animation.bounceCycles>=120,name+': expected 120+ bounce soak');
  assert(animation.landContactSeconds>=.06&&animation.landContactSeconds<=.09,name+': landing contact window outside 60-90ms');
  assert(animation.maxQuaternionNormError<=1e-4,name+': quaternion norm drift '+animation.maxQuaternionNormError);
  assert(animation.maxVisualScaleDeviation<=.20,name+': unsafe visual scale '+animation.maxVisualScaleDeviation);
  assert(animation.maxReducedRootScaleDeviation<=.075,name+': reduced-motion scale deviation '+animation.maxReducedRootScaleDeviation);
  assert(animation.maxBoneScaleDelta<=1e-7,name+': bone scale drift '+animation.maxBoneScaleDelta);
  assert(animation.maxResetAngularError<=1e-6,name+': main rig reset drift '+animation.maxResetAngularError);
  assert(animation.maxSecondaryResetError<=1e-6,name+': accessory reset drift '+animation.maxSecondaryResetError);
  assert(animation.maxSecondaryAngularOffset<=.24,name+': accessory angular explosion '+animation.maxSecondaryAngularOffset);
  assert(animation.maxHeadStep<=.50,name+': head snap '+animation.maxHeadStep);
  assert(animation.minLandingRootOffset>=-.01,name+': landing root penetrated foot plane '+animation.minLandingRootOffset);
  for(const [label,expected] of requiredStates){
    const state=animation.states.find(item=>item.label===label);
    assert(state,name+': missing '+label+' scenario');
    assert(state.observed.includes(expected),name+': '+label+' observed '+state.observed.join(','));
  }
  for(const event of requiredEvents)assert(animation.eventTypes.includes(event),name+': missing event '+event);
}

try{
  await page.goto('http://127.0.0.1:4173/?test=1');
  await page.waitForFunction(()=>window.chimpJump?.().ready&&window.chimpJumpTest?.selectAvatar,{timeout:45000});
  await page.evaluate(()=>window.chimpJumpTest.suspendRendering());

  for(const [id,name] of avatars){
    const item={id,name};
    report.avatars.push(item);
    try{
      item.loaded=await page.evaluate(id=>window.chimpJumpTest.selectAvatar(id),id);
      assert.equal(item.loaded,true,name+': real loader rejected approved avatar');
      item.state=await page.evaluate(()=>window.chimpJump());
      assert.equal(item.state.selectedId,id,name+': selected id mismatch');
      assert(item.state.ready,name+': game not ready');
      assert(item.state.visible,name+': model hidden after safe rig preparation');
      item.diagnostics=await page.evaluate(()=>window.__chimpCharacterAnimationTest?.diagnostics());
      assert(item.diagnostics,name+': animation diagnostics unavailable');
      assert.equal(item.diagnostics.skeleton.ok,true,name+': skeleton became invalid');
      item.animation=await page.evaluate(()=>window.__chimpCharacterAnimationTest.exercise());
      assertAnimation(name,item.animation);
      await page.evaluate(()=>window.chimpJumpTest.render());
      await page.locator('#world canvas[data-engine]').screenshot({path:'checks/avatar-'+id+'.png'});
      item.ok=true;
      console.log('AVATAR_OK:'+JSON.stringify({id,name,secondary:item.animation.secondaryBoneCount,bounceCycles:item.animation.bounceCycles}));
    }catch(error){
      item.ok=false;
      item.error=error?.stack||error?.message||String(error);
      await page.locator('#world canvas[data-engine]').screenshot({path:'checks/avatar-failure-'+id+'.png'}).catch(()=>{});
      save();
      throw error;
    }
  }

  const [reloadId,reloadName]=avatars[0];
  const reloadLoaded=await page.evaluate(id=>window.chimpJumpTest.selectAvatar(id),reloadId);
  const reloadState=await page.evaluate(()=>window.chimpJump());
  const reloadAnimation=await page.evaluate(()=>window.__chimpCharacterAnimationTest.exercise());
  assert.equal(reloadLoaded,true,'reload: first avatar failed to load again after full roster');
  assert.equal(reloadState.selectedId,reloadId,'reload: wrong selected id');
  assertAnimation(reloadName+' reload',reloadAnimation);
  report.reload={id:reloadId,name:reloadName,ok:true,bounceCycles:reloadAnimation.bounceCycles};

  assert.deepEqual(errors,[]);
  console.log('PASS avatars: 10 approved rigs + reload passed animation, drift, reduced-motion and event-contract validation');
}finally{
  save();
  await browser.close();
}
