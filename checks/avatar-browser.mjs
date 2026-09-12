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
  ['26','The Bosun'],
  ['69','The Executioner'],
  ['118','The Knight Commander'],
  ['142','The One Who Rocks Hard'],
  ['193','The Street Fighter'],
];
const report={avatars:[],errors,network};
const preparing='Preparing pose and checking skeleton…';

function saveReport(){
  fs.writeFileSync('checks/avatar-browser-report.json',JSON.stringify(report,null,2));
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
  console.log('PASS avatars: all five supplied Chimpions load through the real browser character pipeline');
}finally{
  saveReport();
  await browser.close();
}

