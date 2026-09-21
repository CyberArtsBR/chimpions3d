import {chromium} from '@playwright/test';

const base='https://chimp-jump.onrender.com';
const pageUrl=base+'/?test=1';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const network=[];
page.on('request',r=>{if(/api\/runs|leaderboard/i.test(r.url()))network.push({type:'request',method:r.method(),url:r.url(),at:Date.now()});});
page.on('response',r=>{if(/api\/runs|leaderboard/i.test(r.url()))network.push({type:'response',status:r.status(),url:r.url(),at:Date.now()});});
page.on('requestfailed',r=>{if(/api\/runs|leaderboard/i.test(r.url()))network.push({type:'failed',url:r.url(),error:r.failure()?.errorText,at:Date.now()});});
page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));

const sleep=ms=>page.waitForTimeout(ms);
async function state(label){
  const s=await page.evaluate(()=>({
    mode:window.chimpJump?.().mode,
    ready:window.chimpJump?.().ready,
    selectedId:window.chimpJump?.().selectedId,
    runSeed:window.chimpJump?.().runSeed,
    dialog:!!document.querySelector('#collection-dialog[open]'),
    confirmDisabled:document.querySelector('#confirm-chimpion')?.disabled,
    confirmText:document.querySelector('#confirm-chimpion')?.textContent,
    avatarStatus:document.querySelector('#avatar-status')?.textContent,
    playText:document.querySelector('#play')?.textContent,
    toast:document.querySelector('#toast')?.textContent
  }));
  console.log('STATE',label,JSON.stringify(s));
  return s;
}

try{
  await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.chimpJump?.().ready&&document.querySelector('#jump-guide-button'),{timeout:120000});
  await state('ready');
  await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#collection-dialog')?.open,{timeout:10000});
  await state('picker-open');
  await page.locator('#confirm-chimpion').click();
  await state('after-confirm');
  for(let i=1;i<=12;i++){
    await sleep(3000);
    const s=await state('t+'+(i*3)+'s');
    if(s.mode==='playing')break;
  }
  console.log('NETWORK',JSON.stringify(network));
  await page.screenshot({path:'checks/production-diagnostic.png'});
}finally{await browser.close();}
