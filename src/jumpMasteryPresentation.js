import {scoreFor} from './score.js';

const initialState=()=>({
 flowPoints:0,flowMultiplier:1,flowProgress:0,bestFlow:1,skillBonus:0,
 perfectLandings:0,goodLandings:0,edgeLandings:0,riskLandings:0,dangerLandings:0,
 nearMisses:0,encountersCompleted:0
});

export function setupJumpMasteryPresentation(){
 if(document.getElementById('jump-flow-hud'))return;
 let state=initialState(),feedbackTimer=0,fastFallSeen=false,lastMode=document.body.dataset.mode||'';
 const hud=document.createElement('aside');hud.id='jump-flow-hud';hud.hidden=true;hud.setAttribute('aria-live','polite');hud.setAttribute('aria-atomic','true');
 hud.innerHTML='<small>FLOW</small><strong id="jump-flow-value">×1</strong><span class="flow-track" aria-hidden="true"><i></i></span>';
 const feedback=document.createElement('div');feedback.id='jump-mastery-feedback';feedback.hidden=true;feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const fastFallHint=document.createElement('div');fastFallHint.id='jump-fast-fall-hint';fastFallHint.textContent='↓ / S · Fast Fall';fastFallHint.hidden=true;
 const style=document.createElement('style');style.textContent=`
 #jump-flow-hud{position:fixed;left:max(14px,env(safe-area-inset-left));top:94px;z-index:31;min-width:94px;padding:8px 11px;border:1px solid #ffffff2e;border-radius:12px;background:#07151bd9;backdrop-filter:blur(8px);box-shadow:0 7px 24px #0005;color:#fff;pointer-events:none}
 #jump-flow-hud small{display:block;font:700 9px/1.1 system-ui;letter-spacing:.18em;color:#b7d8dc}#jump-flow-hud strong{display:block;font:900 22px/1 system-ui;margin-top:3px}
 #jump-flow-hud .flow-track{display:block;width:72px;height:3px;margin-top:7px;border-radius:99px;background:#ffffff1e;overflow:hidden}#jump-flow-hud .flow-track i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7cecff,#ffe477);transition:width .12s linear}
 #jump-mastery-feedback{position:fixed;left:50%;top:30%;z-index:35;transform:translate(-50%,-50%);padding:8px 14px;border-radius:999px;background:#07151be8;border:1px solid #ffffff30;color:#fff;font:900 16px/1 system-ui;letter-spacing:.08em;text-shadow:0 2px 8px #000;pointer-events:none}
 #jump-mastery-feedback[data-quality="PERFECT"]{font-size:20px;border-color:#ffe477aa;box-shadow:0 0 24px #ffe47730}#jump-mastery-feedback[data-quality="EDGE"]{border-color:#ff9a79aa}
 #jump-fast-fall-hint{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));z-index:29;transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:#07151bb8;border:1px solid #ffffff24;color:#d8edf0;font:700 11px/1 system-ui;letter-spacing:.05em;pointer-events:none}
 body[data-reduced-motion="true"] #jump-mastery-feedback{transition:none!important}body[data-mode="menu"] #jump-flow-hud,body[data-mode="paused"] #jump-flow-hud,body[data-mode="over"] #jump-flow-hud{display:none}
 `;
 document.head.append(style);document.body.append(hud,feedback,fastFallHint);
 const value=hud.querySelector('#jump-flow-value'),bar=hud.querySelector('.flow-track i');
 function reset(){state=initialState();hud.hidden=true;value.textContent='×1';bar.style.width='0%';feedback.hidden=true;fastFallHint.hidden=fastFallSeen||matchMedia('(pointer: coarse)').matches;}
 function showFeedback(text,quality=''){
  if(!text)return;feedback.textContent=text;feedback.dataset.quality=quality;feedback.hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>feedback.hidden=true,700);
 }
 function render(){
  const multiplier=Number(state.flowMultiplier)||1;hud.hidden=multiplier<=1;value.textContent='×'+String(multiplier).replace('.0','');bar.style.width=Math.round((Number(state.flowProgress)||0)*100)+'%';
 }
 function apply(detail={}){
  for(const key of Object.keys(state))if(Number.isFinite(Number(detail[key])))state[key]=Number(detail[key]);
  const kind=detail.type;
  if(kind==='fast-fall'){fastFallSeen=true;fastFallHint.hidden=true;showFeedback('FAST FALL');}
  if(kind==='landing'||kind==='bounce'){
   const quality=detail.landingQuality||'';const tier=detail.routeTier||'SAFE';
   if(quality==='PERFECT')showFeedback((detail.fastFallPerfect?'FAST FALL · ':'')+'PERFECT'+(tier==='DANGER'?' · DANGER':tier==='RISK'?' · RISK':''),'PERFECT');
   else if(quality==='EDGE')showFeedback('EDGE LANDING','EDGE');
   else if(tier==='DANGER')showFeedback('DANGER ROUTE');
   else if(tier==='RISK')showFeedback('RISK ROUTE');
  }else if(kind==='near-miss')showFeedback('CLOSE!');
  render();
 }
 window.addEventListener('chimp-mastery',event=>apply(event.detail));
 window.addEventListener('chimp-run-finished',event=>{
  const run=event.detail;if(!run||typeof run!=='object')return;
  Object.assign(run,state);
  run.score=scoreFor(run.meters,run.bananas,state.skillBonus);
  run.bestFlow=state.bestFlow;
 });
 const observer=new MutationObserver(()=>{
  const mode=document.body.dataset.mode||'';
  if(mode!==lastMode&&(mode==='starting'||mode==='menu'))reset();
  if(mode==='playing'&&!fastFallSeen&&!matchMedia('(pointer: coarse)').matches)fastFallHint.hidden=false;
  if(mode!=='playing')fastFallHint.hidden=true;
  lastMode=mode;
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['data-mode']});
 reset();
}
