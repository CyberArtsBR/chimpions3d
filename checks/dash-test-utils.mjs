import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

export const localBase=process.env.CHIMP_TEST_URL||'http://127.0.0.1:4173';
export const productionBase=process.env.CHIMP_PRODUCTION_URL||'https://chimp-jump.onrender.com';
export const chromiumArgs=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];

export async function openBrowserPage({viewport={width:1440,height:900},mobile=false,gamepad=false}={}){
  const browser=await chromium.launch({args:chromiumArgs});
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  if(gamepad){
    await context.addInitScript(()=>{
      const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
      window.__dashTestPad=pad;
    });
  }
  const page=await context.newPage();
  const pageErrors=[],consoleErrors=[],requestFailures=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',request=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'failed'}));
  return{browser,context,page,pageErrors,consoleErrors,requestFailures};
}

export async function waitForDash(page,{test=true,url=localBase}={}){
  const suffix=test?'/?dash=1&test=1':'/?dash=1';
  await page.goto(url+suffix,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.chimpionsDash?.().ready,{timeout:90000});
  await page.waitForFunction(()=>document.querySelector('.dash-start-hotspot'),{timeout:30000});
  return page.evaluate(()=>window.chimpionsDash());
}

export async function assertNoOverflow(page,label='layout'){
  const value=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
  assert(value.sw<=value.w+1,`${label}: horizontal overflow ${value.sw} > ${value.w}`);
  return value;
}

export function writeReport(name,report){
  fs.writeFileSync(`checks/${name}`,JSON.stringify(report,null,2));
}

export async function shot(page,name){
  const canSuppress=await page.evaluate(()=>!!window.chimpionsDashTest?.setLongFrameGuardSuppressed).catch(()=>false);
  if(canSuppress)await page.evaluate(()=>window.chimpionsDashTest.setLongFrameGuardSuppressed(true));
  try{await page.screenshot({path:`checks/${name}`,timeout:90000});}
  finally{if(canSuppress)await page.evaluate(()=>window.chimpionsDashTest.setLongFrameGuardSuppressed(false));}
}

export function externalDashFailure(entry){
  return /raw\.githubusercontent\.com\/CyberArtsBR\/chimpions-dash/.test(entry.url||'');
}
