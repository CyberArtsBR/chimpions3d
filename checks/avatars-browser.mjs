import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const names=['The Bosun','The Street Fighter','The Knight Commander','The Executioner','The One Who Rocks Hard'];
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:760}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')console.log('BROWSER_ERROR:',m.text());});
await page.route('https://cdn.helius-rpc.com/**',route=>route.abort());
try{
 await page.goto('http://127.0.0.1:4173/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready);
 for(const name of names){
  await page.getByRole('button',{name:'Choose chimp',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Search characters'});
  await search.fill(name);
  const option=page.getByRole('button',{name,exact:true});
  assert(await option.isEnabled(),`${name} must have a selectable GLB`);
  await option.click();
  await page.waitForFunction(expected=>{
   const status=document.querySelector('#avatar-status')?.textContent||'';
   return window.chimpJump?.().ready&&window.chimpJump().visible&&status.includes(expected);
  },name,{timeout:15000});
  await page.screenshot({path:'checks/avatar-'+name.replaceAll(' ','-')+'.png'});
  assert(await page.locator('#avatar-list').isHidden(),`${name} picker should close after selection`);
 }
 assert.deepEqual(errors,[],'Uploaded avatars must load without page errors');
 console.log('PASS avatars: '+names.join(', '));
}finally{
 await browser.close();
}
