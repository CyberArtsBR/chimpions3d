import './jumpExperience.css';
import {JUMP_GOALS,evaluateJumpGoals} from './jumpGoals.js';

const PREFS_KEY='chimp-jump-comfort-v1',GOALS_KEY='chimp-jump-goals-v1';
const loadJSON=(key,fallback)=>{try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return {...fallback}}};
const loadGoals=()=>{try{const value=JSON.parse(localStorage.getItem(GOALS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};

export function setupJumpExperience(){
  if(document.getElementById('jump-guide-button'))return;
  const defaults={reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,highVisibility:false};
  let prefs=loadJSON(PREFS_KEY,defaults),unlocked=loadGoals();

  const button=document.createElement('button');button.id='jump-guide-button';button.type='button';button.textContent='Field guide';
  button.setAttribute('aria-haspopup','dialog');
  const hint=document.createElement('div');hint.id='jump-control-hint';hint.textContent=matchMedia('(pointer: coarse)').matches?'Hold ◀ ▶ to steer · auto-jump':'← → / A D · mouse · gamepad · auto-jump';
  const status=document.createElement('div');status.id='jump-runtime-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
  const goalToast=document.createElement('div');goalToast.id='jump-goal-toast';goalToast.setAttribute('role','status');goalToast.hidden=true;

  const dialog=document.createElement('dialog');dialog.id='jump-guide-dialog';dialog.setAttribute('aria-labelledby','jump-guide-title');
  dialog.innerHTML=`<header><div><small>CHIMP JUMP</small><h2 id="jump-guide-title">Field guide</h2></div><button class="guide-close" aria-label="Close field guide">×</button></header>
    <section><h3>Controls</h3><p>Steer while the chimp auto-jumps with Arrow keys or A/D, mouse, or gamepad. P or Escape pauses.</p></section>
    <section><h3>Read the branches</h3><div class="guide-branches"><span>↔ <b>Moving</b></span><span>╱ <b>Fragile</b></span><span>↑ <b>Spring</b></span><span>🍃 <b>Leaf</b></span><span>⌁ <b>Swing</b></span><span>◌ <b>Vanish</b></span></div><p>Leaves drift and swings sway. Vanishing branches disappear after you land. Small, optional branches pay more bananas; solid branches form the main route.</p></section>
    <section><h3>Canopy surprises</h3><p>Avoid thorn pods. Banana Bloom adds rewards, and Spring Fever boosts springs. Watch the event badge for the active effect.</p></section>
    <section><h3>Comfort</h3><label><input id="jump-reduced-motion" type="checkbox"> Reduced motion</label><label><input id="jump-high-visibility" type="checkbox"> High-visibility HUD</label></section>
    <section><h3>Expedition goals</h3><ul id="jump-goals"></ul></section>`;
  document.body.append(button,hint,status,goalToast,dialog);

  const reduced=dialog.querySelector('#jump-reduced-motion'),visibility=dialog.querySelector('#jump-high-visibility'),list=dialog.querySelector('#jump-goals');
  function applyPrefs(){
    prefs.reducedMotion=!!prefs.reducedMotion;prefs.highVisibility=!!prefs.highVisibility;
    document.body.dataset.reducedMotion=String(prefs.reducedMotion);
    document.body.dataset.highVisibility=String(prefs.highVisibility);
    reduced.checked=prefs.reducedMotion;visibility.checked=prefs.highVisibility;save(PREFS_KEY,prefs);
    window.dispatchEvent(new CustomEvent('chimp-comfort-change',{detail:{...prefs}}));
  }
  function renderGoals(){
    list.replaceChildren();
    for(const goal of JUMP_GOALS){const li=document.createElement('li');const done=unlocked.includes(goal.id);li.className=done?'complete':'';li.innerHTML=`<span aria-hidden="true">${done?'✓':'○'}</span><div><b>${goal.title}</b><small>${goal.description}</small></div>`;list.append(li);}
  }
  function syncStatus(){
    const source=document.getElementById('avatar-status'),play=document.getElementById('play'),text=source?.textContent?.trim()||'';
    const important=!!play?.disabled||/unavailable|rejected|failed|previous avatar|not a complete|skeleton|rig/i.test(text);
    status.textContent=important?(text||play?.textContent||'Loading…'):'';status.hidden=!important;
  }
  let toastTimer=0;
  window.addEventListener('chimp-run-finished',event=>{
    const result=evaluateJumpGoals(event.detail,unlocked);unlocked=result.unlocked;save(GOALS_KEY,unlocked);renderGoals();
    if(result.newlyUnlocked.length){const names=result.newlyUnlocked.map(id=>JUMP_GOALS.find(goal=>goal.id===id)?.title).filter(Boolean);goalToast.textContent='Goal complete · '+names.join(' + ');goalToast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>goalToast.hidden=true,3200);}
  });
  new MutationObserver(syncStatus).observe(document.getElementById('avatar-status'),{childList:true,subtree:true,characterData:true});
  new MutationObserver(syncStatus).observe(document.getElementById('play'),{attributes:true,childList:true,subtree:true});
  button.onclick=()=>{renderGoals();dialog.showModal();dialog.querySelector('.guide-close').focus();};
  dialog.querySelector('.guide-close').onclick=()=>dialog.close();
  reduced.onchange=()=>{prefs.reducedMotion=reduced.checked;applyPrefs();};
  visibility.onchange=()=>{prefs.highVisibility=visibility.checked;applyPrefs();};
  applyPrefs();renderGoals();syncStatus();
}
