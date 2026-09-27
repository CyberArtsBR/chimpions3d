import assert from 'node:assert/strict';
import {openBrowserPage,waitForDash,writeReport,shot} from './dash-test-utils.mjs';

const {browser,page,pageErrors,consoleErrors}=await openBrowserPage({viewport:{width:1440,height:900}});
const report={scope:'dash-black-screen',tiers:{},evidence:'canvas pixel luminance + renderer diagnostics + visible gameplay fixtures'};

async function sampleCanvas(){
  return page.evaluate(()=>{
    window.chimpionsDashTest.step(2);
    const canvas=document.querySelector('#lab-3d canvas');
    if(!canvas)throw new Error('Dash WebGL canvas missing');
    const probe=document.createElement('canvas');probe.width=64;probe.height=40;
    const ctx=probe.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(canvas,0,0,probe.width,probe.height);
    const data=ctx.getImageData(0,0,probe.width,probe.height).data;
    let sum=0,sumSq=0,nonBlack=0,opaque=0,min=255,max=0;
    const bins=new Set();
    for(let i=0;i<data.length;i+=4){
      const luma=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
      sum+=luma;sumSq+=luma*luma;if(luma>4)nonBlack++;if(data[i+3]>16)opaque++;
      min=Math.min(min,luma);max=Math.max(max,luma);bins.add(Math.min(15,Math.floor(luma/16)));
    }
    const pixels=data.length/4,mean=sum/pixels,variance=Math.max(0,sumSq/pixels-mean*mean);
    return{
      pixels,mean:Number(mean.toFixed(2)),variance:Number(variance.toFixed(2)),
      nonBlackRatio:Number((nonBlack/pixels).toFixed(4)),opaqueRatio:Number((opaque/pixels).toFixed(4)),
      range:Number((max-min).toFixed(2)),lumaBins:bins.size,
      graphics:window.chimpionsDashGraphics.stats(),dash:window.chimpionsDash()
    };
  });
}

try{
  await waitForDash(page);
  for(const requested of ['AUTO','LOW','BALANCED','HIGH','ULTRA']){
    await page.evaluate(tier=>window.chimpionsDashPerformance.setQuality(tier),requested);
    await page.evaluate(seed=>{window.chimpionsDashTest.reset('black-screen-'+seed,60);window.chimpionsDashTest.clearWorld();window.chimpionsDashTest.spawnObstacle('log',250);window.chimpionsDashTest.spawnBanana(330,44,false);},requested);
    await page.waitForTimeout(80);
    const sample=await sampleCanvas();
    assert(sample.dash.ready,requested+': selected character must remain ready');
    assert(sample.graphics.drawCalls>0,requested+': renderer submitted no draw calls');
    assert(sample.graphics.triangles>0,requested+': renderer submitted no triangles');
    assert(sample.graphics.hazards>=1,requested+': lethal fixture is absent from GPU world');
    assert(sample.nonBlackRatio>.12,requested+': canvas is catastrophically dark/blank');
    assert(sample.opaqueRatio>.8,requested+': canvas lacks meaningful rendered coverage');
    assert(sample.range>18,requested+': canvas has insufficient luminance range');
    assert(sample.lumaBins>=4,requested+': canvas histogram is suspiciously uniform');
    if(requested!=='AUTO')assert.equal(sample.graphics.quality,requested,requested+': GPU quality tier mismatch');
    report.tiers[requested]=sample;
    if(requested==='LOW'||requested==='ULTRA')await shot(page,`dash-black-screen-${requested.toLowerCase()}.png`);
  }
  assert.deepEqual(pageErrors,[],'Dash black-screen sentinel saw page errors');
  report.consoleErrors=consoleErrors;
  writeReport('dash-black-screen-report.json',report);
  console.log('PASS Dash black-screen sentinel across AUTO/LOW/BALANCED/HIGH/ULTRA');
}finally{await browser.close();}
