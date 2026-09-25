import './jumpExperience.css';
import {JUMP_GOALS,evaluateJumpGoals} from './jumpGoals.js';

const PREFS_KEY='chimp-jump-comfort-v1',GOALS_KEY='chimp-jump-goals-v1';
const MENU_ART_URL='/ui/start-screen.webp';
const loadJSON=(key,fallback)=>{try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return {...fallback}}};
const loadGoals=()=>{try{const value=JSON.parse(localStorage.getItem(GOALS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const formatDuration=value=>{const seconds=Math.max(0,Math.round(Number(value)||0)),minutes=Math.floor(seconds/60);return minutes?`${minutes}m ${String(seconds%60).padStart(2,'0')}s`:`${seconds}s`;};

function makeButton(id,label){
  const button=document.createElement('button');
  button.id=id;button.type='button';button.textContent=label;
  return button;
}

function openDialog(dialog,focusSelector){
  if(dialog.open)return;
  dialog.showModal();
  requestAnimationFrame(()=>dialog.querySelector(focusSelector)?.focus());
}

function focusGrid(dialog,direction){
  const buttons=[...dialog.querySelectorAll('.avatar-option:not(:disabled),.avatar-upload-option:not(:disabled)')].filter(button=>button.offsetParent!==null);
  if(!buttons.length)return false;
  const active=document.activeElement,index=buttons.indexOf(active),columns=innerWidth>=900?4:innerWidth>=600?4:3;
  let next=index<0?0:index;
  if(direction==='left')next=Math.max(0,next-1);
  if(direction==='right')next=Math.min(buttons.length-1,next+1);
  if(direction==='up')next=Math.max(0,next-columns);
  if(direction==='down')next=Math.min(buttons.length-1,next+columns);
  buttons[next].focus();
  return true;
}

export function setupJumpExperience(){
  if(document.getElementById('jump-guide-button'))return;
  const defaults={reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,highVisibility:false};
  let prefs=loadJSON(PREFS_KEY,defaults),unlocked=loadGoals();
  let rememberedBest=0;
  try{rememberedBest=Number(localStorage.getItem('chimp-jump-best'))||0;}catch{}

  document.body.dataset.uiReady='loading';
  document.body.dataset.menuReady='loading';

  const toolDock=document.createElement('nav');toolDock.id='jump-menu-tools';toolDock.setAttribute('aria-label','Game help and options');
  const guideButton=makeButton('jump-guide-button','Field Guide');guideButton.setAttribute('aria-haspopup','dialog');
  const optionsButton=makeButton('jump-options-button','Options');optionsButton.setAttribute('aria-haspopup','dialog');
  toolDock.append(guideButton,optionsButton);

  const hint=document.createElement('div');hint.id='jump-control-hint';hint.textContent=matchMedia('(pointer: coarse)').matches?'Hold ◀ ▶ to steer · auto-jump':'← → / A D · mouse · gamepad · auto-jump';

  const status=document.createElement('div');status.id='jump-runtime-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.hidden=true;
  const goalToast=document.createElement('div');goalToast.id='jump-goal-toast';goalToast.setAttribute('role','status');goalToast.setAttribute('aria-live','polite');goalToast.setAttribute('aria-atomic','true');goalToast.hidden=true;

  const loader=document.createElement('div');loader.id='jump-menu-loader';loader.setAttribute('role','status');loader.setAttribute('aria-live','polite');loader.innerHTML='<span class="menu-loader-mark" aria-hidden="true"></span><strong>Preparing canopy…</strong>';

  const dialog=document.createElement('dialog');dialog.id='jump-guide-dialog';dialog.setAttribute('aria-labelledby','jump-guide-title');
  dialog.innerHTML=`<header><div><small>CHIMP JUMP</small><h2 id="jump-guide-title">Field Guide</h2></div><button class="guide-close" aria-label="Close Field Guide">×</button></header>
    <p class="guide-intro">Everything you need to climb quickly, grouped for fast reference.</p>
    <div class="guide-grid">
      <section><h3>Movement</h3><p>Auto-jump keeps the run moving. Steer in the air with ← → or A/D, mouse position, touch controls, or a normalized gamepad input.</p></section>
      <section><h3>Platforms</h3><div class="guide-branches"><span>↔ <b>Moving</b></span><span>╱ <b>Fragile</b></span><span>↑ <b>Spring</b></span><span>🍃 <b>Leaf</b></span><span>⌁ <b>Swing</b></span><span>◌ <b>Vanish</b></span></div><p>Solid branches form the safest route. Small or unusual branches can offer better banana opportunities.</p></section>
      <section><h3>Hazards</h3><p>Thorn pods knock the Chimpion off line. Keep landing space in reserve when one sits near your route.</p></section>
      <section><h3>Power-ups</h3><p>Jetpacks create a timed climb boost. The HUD shows the remaining boost time without blocking the landing area.</p></section>
      <section><h3>Events</h3><p>Banana Bloom adds fruit rewards. Spring Fever boosts spring branches. A compact event badge appears only while an event is active.</p></section>
      <section><h3>Scoring</h3><p>Altitude drives your run score and collected bananas add a bonus. Online placement is submitted after the run when the service is available.</p></section>
      <section><h3>Goals</h3><ul id="jump-goals"></ul></section>
      <section><h3>Controls</h3><p><b>Steer:</b> ← → / A D · mouse · touch · gamepad<br><b>Pause:</b> P or Escape<br><b>Menus:</b> Tab / Shift+Tab · Enter / Space · Escape</p></section>
    </div>`;

  const settings=document.createElement('dialog');settings.id='jump-settings-dialog';settings.setAttribute('aria-labelledby','jump-settings-title');
  settings.innerHTML=`<header><div><small>ACCESSIBILITY</small><h2 id="jump-settings-title">Options</h2></div><button class="settings-close" aria-label="Close Options">×</button></header>
    <p class="settings-intro">Presentation preferences apply immediately and are remembered on this device.</p>
    <div class="settings-list">
      <label for="jump-reduced-motion"><span><b>Reduced Motion</b><small>Minimizes zoom, pulses, parallax and large UI movement while keeping essential feedback.</small></span><input id="jump-reduced-motion" type="checkbox"></label>
      <label for="jump-high-visibility"><span><b>High Visibility</b><small>Strengthens HUD, focus and critical interface contrast without turning the entire game neon.</small></span><input id="jump-high-visibility" type="checkbox"></label>
    </div>`;

  const pauseActions=document.createElement('nav');pauseActions.id='jump-pause-actions';pauseActions.setAttribute('aria-label','Pause menu actions');
  pauseActions.innerHTML=`<button id="jump-resume" class="primary">Resume</button><button id="jump-restart">Restart Run</button><button id="jump-pause-guide">Field Guide</button><button id="jump-home">Quit / Home</button><small>Esc / P resumes · your current run stays paused while menus are open.</small>`;

  document.body.append(toolDock,hint,status,goalToast,loader,dialog,settings);
  document.querySelector('#overlay .card')?.append(pauseActions);

  const reduced=settings.querySelector('#jump-reduced-motion'),visibility=settings.querySelector('#jump-high-visibility'),list=dialog.querySelector('#jump-goals');
  const gameplayToast=document.getElementById('toast');
  gameplayToast?.setAttribute('aria-live','polite');gameplayToast?.setAttribute('aria-atomic','true');

  function applyPrefs(){
    prefs.reducedMotion=!!prefs.reducedMotion;prefs.highVisibility=!!prefs.highVisibility;
    document.body.dataset.reducedMotion=String(prefs.reducedMotion);
    document.body.dataset.highVisibility=String(prefs.highVisibility);
    reduced.checked=prefs.reducedMotion;visibility.checked=prefs.highVisibility;save(PREFS_KEY,prefs);
    window.dispatchEvent(new CustomEvent('chimp-comfort-change',{detail:{...prefs}}));
  }

  function renderGoals(){
    list.replaceChildren();
    for(const goal of JUMP_GOALS){
      const li=document.createElement('li'),done=unlocked.includes(goal.id);
      li.className=done?'complete':'';
      li.innerHTML=`<span aria-hidden="true">${done?'✓':'○'}</span><div><b>${goal.title}</b><small>${goal.description}</small></div>`;
      list.append(li);
    }
  }

  function syncStatus(){
    const source=document.getElementById('avatar-status'),play=document.getElementById('play'),text=source?.textContent?.trim()||'';
    const failed=/unavailable|rejected|failed|not a complete|skeleton|rig/i.test(text);
    const loading=!!play?.disabled&&!failed;
    status.textContent=failed?`Unable to load Chimpion · ${text||'Try another character.'}`:loading?'Loading Chimpion…':'';
    status.dataset.state=failed?'error':loading?'loading':'ready';
    status.hidden=!(failed||loading);
  }

  function openGuide(opener=guideButton){
    renderGoals();dialog.dataset.opener=opener.id||'';openDialog(dialog,'.guide-close');
  }

  function openSettings(opener=optionsButton){
    settings.dataset.opener=opener.id||'';openDialog(settings,'.settings-close');
  }

  function restoreFocus(source){
    const id=source.dataset.opener;
    if(id)document.getElementById(id)?.focus();
    delete source.dataset.opener;
  }

  async function setReadiness(){
    let artworkReady=false;
    const art=new Image();art.src=MENU_ART_URL;
    try{
      if(art.decode)await art.decode();
      else await new Promise((resolve,reject)=>{art.onload=resolve;art.onerror=reject;});
      artworkReady=true;
    }catch{}
    try{await document.fonts?.ready;}catch{}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const controlsReady=!!document.getElementById('play')&&!!document.querySelector('#overlay .card')&&!!document.getElementById('avatar-status');
    document.body.dataset.uiReady=controlsReady?'true':'degraded';
    document.body.dataset.menuReady=artworkReady&&controlsReady?'true':'degraded';
    loader.hidden=true;
    window.dispatchEvent(new CustomEvent('chimp-ui-ready',{detail:{artworkReady,controlsReady}}));
  }

  function syncReadyLoader(){
    const menu=document.body.dataset.mode==='menu';
    loader.hidden=!menu||document.body.dataset.menuReady==='true'||document.body.dataset.menuReady==='degraded';
  }

  function focusPause(direction){
    const candidates=[...pauseActions.querySelectorAll('button:not(:disabled)')].filter(button=>button.offsetParent!==null);
    if(!candidates.length)return false;
    let index=candidates.indexOf(document.activeElement);
    if(index<0)index=0;
    index=(index+(direction==='up'||direction==='left'?-1:1)+candidates.length)%candidates.length;
    candidates[index].focus();
    return true;
  }

  function handleNormalizedAction(action){
    const normalized=String(action||'').toLowerCase(),collection=document.getElementById('collection-dialog');
    if(['cancel','back'].includes(normalized)){
      if(dialog.open){dialog.close();return true;}
      if(settings.open){settings.close();return true;}
      if(collection?.open){collection.close();return true;}
      if(document.body.dataset.mode==='paused'){document.getElementById('play')?.click();return true;}
      return false;
    }
    if(['confirm','accept'].includes(normalized)){const active=document.activeElement;if(active?.matches?.('button,a[href]')){active.click();return true;}return false;}
    if(['left','right','up','down'].includes(normalized)){
      if(collection?.open)return focusGrid(collection,normalized);
      if(document.body.dataset.mode==='paused')return focusPause(normalized);
    }
    return false;
  }

  let toastTimer=0;
  window.addEventListener('chimp-run-finished',event=>{
    const stats=event.detail||{};
    if(!Number.isFinite(Number(stats.duration)))stats.duration=Number(window.chimpJump?.().time)||0;
    stats.durationLabel=formatDuration(stats.duration);
    stats.newBest=Number(stats.meters)>rememberedBest;
    rememberedBest=Math.max(rememberedBest,Number(stats.meters)||0);
    const result=evaluateJumpGoals(stats,unlocked);unlocked=result.unlocked;save(GOALS_KEY,unlocked);renderGoals();
    if(result.newlyUnlocked.length){
      const names=result.newlyUnlocked.map(id=>JUMP_GOALS.find(goal=>goal.id===id)?.title).filter(Boolean);
      goalToast.textContent='Goal complete · '+names.join(' + ');goalToast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>goalToast.hidden=true,3200);
    }
  });

  const avatarStatus=document.getElementById('avatar-status'),play=document.getElementById('play');
  if(avatarStatus)new MutationObserver(syncStatus).observe(avatarStatus,{childList:true,subtree:true,characterData:true});
  if(play)new MutationObserver(syncStatus).observe(play,{attributes:true,childList:true,subtree:true});

  const countdown=document.getElementById('countdown');
  if(countdown)new MutationObserver(()=>{
    if(document.body.dataset.reducedMotion==='true')return;
    countdown.classList.remove('countdown-pulse');void countdown.offsetWidth;countdown.classList.add('countdown-pulse');
  }).observe(countdown,{childList:true,characterData:true,subtree:true});

  const modeObserver=new MutationObserver(()=>syncReadyLoader());
  modeObserver.observe(document.body,{attributes:true,attributeFilter:['data-mode','data-menu-ready']});

  guideButton.onclick=()=>openGuide(guideButton);
  optionsButton.onclick=()=>openSettings(optionsButton);
  dialog.querySelector('.guide-close').onclick=()=>dialog.close();
  settings.querySelector('.settings-close').onclick=()=>settings.close();
  dialog.addEventListener('close',()=>restoreFocus(dialog));
  settings.addEventListener('close',()=>restoreFocus(settings));
  reduced.onchange=()=>{prefs.reducedMotion=reduced.checked;applyPrefs();};
  visibility.onchange=()=>{prefs.highVisibility=visibility.checked;applyPrefs();};

  pauseActions.querySelector('#jump-resume').onclick=()=>document.getElementById('play')?.click();
  pauseActions.querySelector('#jump-restart').onclick=()=>{
    document.getElementById('give-up')?.click();
    requestAnimationFrame(()=>document.getElementById('play')?.click());
  };
  pauseActions.querySelector('#jump-pause-guide').onclick=event=>openGuide(event.currentTarget);
  pauseActions.querySelector('#jump-home').onclick=()=>{location.href='/';};

  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(dialog.open||settings.open)){
      event.preventDefault();event.stopImmediatePropagation();
      (dialog.open?dialog:settings).close();return;
    }
    const collection=document.getElementById('collection-dialog');
    if(!collection?.open||event.target?.matches?.('input,textarea,select'))return;
    const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(keys[event.key]){event.preventDefault();event.stopImmediatePropagation();focusGrid(collection,keys[event.key]);}
  },true);

  window.chimpJumpUX=Object.freeze({handleAction:handleNormalizedAction,get preferences(){return {...prefs}}});

  applyPrefs();renderGoals();syncStatus();syncReadyLoader();void setReadiness();
}
