import {scoreFor} from './score.js';

const initialState=()=>({
 flowPoints:0,flowMultiplier:1,flowProgress:0,bestFlow:1,skillBonus:0,
 perfectLandings:0,goodLandings:0,edgeLandings:0,riskLandings:0,dangerLandings:0,
 nearMisses:0,encountersCompleted:0
});

export function setupJumpMasteryPresentation(){
 if(document.getElementById('jump-flow-hud'))return;
 let state=initialState(),lastMode=document.body.dataset.mode||'';
 const hud=document.createElement('aside');hud.id='jump-flow-hud';hud.hidden=true;hud.setAttribute('aria-live','polite');hud.setAttribute('aria-atomic','true');
 hud.innerHTML='<small>FLOW</small><strong id="jump-flow-value">×1</strong><span class="flow-track" aria-hidden="true"><i></i></span>';
 const style=document.createElement('style');style.textContent=`
 #hud{width:min(96vw,720px)!important;display:grid!important;grid-template-columns:minmax(64px,1fr) minmax(64px,1fr) minmax(164px,auto);align-items:start!important;gap:clamp(6px,1.8vw,16px)!important}
 #hud>.stat{min-width:0;white-space:nowrap;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;padding:5px 6px!important;text-shadow:0 2px 8px #000c}
 #hud>.height-stat{justify-self:start;text-align:left}
 #hud>.stat:not(.height-stat){justify-self:center;text-align:center}
 #hud .right{display:grid!important;grid-template-columns:minmax(58px,auto) repeat(3,36px);align-items:start;justify-content:end;justify-self:end;gap:4px!important;min-width:0}
 #hud .right .coins{min-width:58px;text-align:right;padding:5px 4px!important}
 #hud #pause,#hud #mute,#hud #quality{width:36px!important;height:36px!important;min-width:36px!important;padding:0!important;display:grid;place-items:center;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;text-shadow:0 2px 8px #000c;line-height:1}
 #hud #quality{font-size:9px!important;font-weight:900!important;letter-spacing:.02em}
 #jump-flow-hud{position:fixed;left:max(14px,env(safe-area-inset-left));top:82px;z-index:31;min-width:94px;padding:4px 8px;border:0;background:transparent;backdrop-filter:none;box-shadow:none;color:#fff;text-shadow:0 2px 8px #000c;pointer-events:none}
 #jump-flow-hud small{display:block;font:700 9px/1.1 system-ui;letter-spacing:.18em;color:#d8edf0}#jump-flow-hud strong{display:block;font:900 22px/1 system-ui;margin-top:3px}
 #jump-flow-hud .flow-track{display:block;width:72px;height:3px;margin-top:7px;border-radius:99px;background:transparent;overflow:hidden}#jump-flow-hud .flow-track i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7cecff,#ffe477);transition:width .12s linear}
 @media(max-width:480px){
  #hud{top:max(8px,env(safe-area-inset-top))!important;width:calc(100vw - 12px)!important;grid-template-columns:minmax(48px,.8fr) minmax(48px,.8fr) minmax(128px,1.35fr);gap:3px!important}
  #hud>.stat{padding:3px!important}
  #hud .stat small{font-size:8px!important;letter-spacing:1.1px!important}
  #hud .stat strong{font-size:clamp(19px,6vw,23px)!important}
  #hud .stat em{font-size:10px!important}
  #hud .right{grid-template-columns:minmax(44px,auto) repeat(3,28px);gap:2px!important}
  #hud .right .coins{min-width:44px;padding:3px 2px!important}
  #hud .coins strong{font-size:18px!important}
  #hud #pause,#hud #mute,#hud #quality{width:28px!important;height:28px!important;min-width:28px!important;font-size:13px!important}
  #hud #quality{font-size:8px!important}
  #jump-flow-hud{top:62px;left:8px;padding:2px 4px;min-width:72px}
 }
 body[data-mode="menu"] #jump-flow-hud,body[data-mode="paused"] #jump-flow-hud,body[data-mode="over"] #jump-flow-hud{display:none}
 `;
 document.head.append(style);document.body.append(hud);
 const value=hud.querySelector('#jump-flow-value'),bar=hud.querySelector('.flow-track i');
 function reset(){state=initialState();hud.hidden=true;value.textContent='×1';bar.style.width='0%';}
 function render(){
  const multiplier=Number(state.flowMultiplier)||1;hud.hidden=multiplier<=1;value.textContent='×'+String(multiplier).replace('.0','');bar.style.width=Math.round((Number(state.flowProgress)||0)*100)+'%';
 }
 function apply(detail={}){
  for(const key of Object.keys(state))if(Number.isFinite(Number(detail[key])))state[key]=Number(detail[key]);
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
  lastMode=mode;
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['data-mode']});
 reset();
}
