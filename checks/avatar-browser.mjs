import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:720}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')console.log('BROWSER_ERROR:'+m.text());});

const avatars=[
  ['26','The Bosun'],
  ['69','The Executioner'],
  ['118','The Knight Commander'],
  ['142','The One Who Rocks Hard'],
  ['193','The Street Fighter'],
];

try{
  await page.goto('http://127.0.0.1:4173/?test=1');
  await page.waitForFunction(()=>window.chimpJump?.().ready);
  const results=[];
  for(const [id,name] of avatars){
    await page.getByRole('button',{name:'Choose chimp',exact:true}).click();
    const search=page.getByRole('searchbox',{name:'Search characters'});
    await search.fill(name);
    const option=page.getByRole('button',{name,exact:true});
    assert.equal(await option.isDisabled(),false,`${name} must be playable`);
    await option.click();
    await page.waitForFunction(expected=>{
      const text=document.getElementById('avatar-status')?.textContent||'';
      return window.chimpJump?.().ready && text.startsWith(expected+' · ');
    },name,{timeout:30000});
    const state=await page.evaluate(()=>window.chimpJump());
    assert(state.visible,`${name} must be visible after loading`);
    const status=await page.locator('#avatar-status').textContent();
    results.push({id,name,status});
    await page.locator('#world canvas').screenshot({path:`checks/avatar-${id}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('AVATAR_BROWSER_REPORT:'+JSON.stringify(results));
  console.log('PASS avatars: all five supplied Chimpions load through the real browser character pipeline');
}finally{
  await browser.close();
}
