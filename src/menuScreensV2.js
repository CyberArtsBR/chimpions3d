import './menuScreensV2.css';
import './menuScreensFinal.css';
import {filterBuiltInRoster,fallbackBuiltIn} from './roster.js';

const launcher=()=>{location.href='/'};
function backButton(parent,className=''){
  let button=parent.querySelector(':scope > .games-back');
  if(button)return button;
  button=document.createElement('button');
  button.type='button';
  button.className=('games-back '+className).trim();
  button.textContent='BACK';
  button.setAttribute('aria-label','Back to game selection');
  button.onclick=launcher;
  parent.append(button);
  return button;
}

export function setupJumpMenu(){
  const card=document.querySelector('#overlay .card');if(!card)return;
  const button=backButton(card,'jump-back');button.textContent='Back to the game selection';
  document.body.classList.add('jump-start-screen');
}

function dashApi(){return window.chimpionsDashPresentationApi||null}
function pickerColumns(grid){
  const template=getComputedStyle(grid).gridTemplateColumns;
  return Math.max(1,template.split(' ').filter(Boolean).length);
}
function movePickerFocus(grid,key){
  const options=[...grid.querySelectorAll('.picker-option:not([hidden])')];
  if(!options.length)return;
  const current=Math.max(0,options.indexOf(document.activeElement)),cols=pickerColumns(grid);
  let next=current;
  if(key==='ArrowRight')next=Math.min(options.length-1,current+1);
  if(key==='ArrowLeft')next=Math.max(0,current-1);
  if(key==='ArrowDown')next=Math.min(options.length-1,current+cols);
  if(key==='ArrowUp')next=Math.max(0,current-cols);
  if(key==='Home')next=0;
  if(key==='End')next=options.length-1;
  if(next!==current||['Home','End'].includes(key)){options[next]?.focus();return true}
  return false;
}

export function setupDashMenu(){
  const menu=document.querySelector('#dash-menu');if(!menu)return;
  document.body.classList.add('dash-start-screen');

  // The approved artwork already contains the visible Start and Back buttons.
  // Reuse the real runtime Start button as a transparent hotspot, but make its
  // first action open the Chimpion picker. The picker then calls startRun only
  // after an avatar is explicitly ready.
  const start=document.querySelector('#dash-start');
  if(start){
    start.classList.remove('primary','original-dash-start');
    start.classList.add('screen-primary');
    start.textContent='START GAME';
    start.setAttribute('aria-label','Start Game');
    start.setAttribute('aria-haspopup','dialog');
    menu.append(start);
  }
  const back=backButton(menu,'dash-back');
  back.textContent='Back to the game selection';

  // Remove stale presentation controls from any cached/hot-reloaded DOM.
  menu.querySelector('.dash-entry-actions')?.remove();
  document.querySelector('#dash-character-picker')?.remove();

  const dialog=document.createElement('dialog');
  dialog.id='dash-character-picker';
  dialog.setAttribute('aria-labelledby','dash-picker-title');
  dialog.innerHTML=`
    <div class="picker-shell">
      <header>
        <div><span class="picker-kicker">RUNNER SELECT</span><h2 id="dash-picker-title">Choose your Chimpion</h2></div>
        <button class="picker-close" type="button" aria-label="Close character selection">×</button>
      </header>
      <div class="picker-toolbar">
        <label class="picker-search-wrap">SEARCH
          <input class="picker-search" type="search" aria-label="Search characters" placeholder="Search Chimpions" autocomplete="off" spellcheck="false">
        </label>
        <button class="picker-random" type="button" aria-label="Random Chimpion">RANDOM</button>
        <button class="picker-upload" type="button">UPLOAD GLB</button>
      </div>
      <div class="picker-current" aria-live="polite">
        <div class="picker-preview-frame"><img alt="" hidden></div>
        <div><small>SELECTED</small><strong>Choose a Chimpion</strong><p role="status">Roster loading…</p></div>
      </div>
      <div class="picker-grid" role="group" aria-label="Approved Chimpions"></div>
      <footer>
        <div class="picker-pages"><button class="picker-prev" type="button">‹ PREV</button><span class="picker-page" aria-live="polite"></span><button class="picker-next" type="button">NEXT ›</button></div>
        <button class="picker-play" type="button" disabled>PLAY</button>
      </footer>
    </div>`;
  document.body.append(dialog);

  let entries=[],filtered=[],selected=null,page=0,busy=false;
  const perPage=12;
  const grid=dialog.querySelector('.picker-grid');
  const search=dialog.querySelector('.picker-search');
  const preview=dialog.querySelector('.picker-current img');
  const selectedName=dialog.querySelector('.picker-current strong');
  const status=dialog.querySelector('.picker-current p');
  const play=dialog.querySelector('.picker-play');
  const random=dialog.querySelector('.picker-random');
  const upload=dialog.querySelector('.picker-upload');

  function setBusy(on,message=''){
    busy=!!on;dialog.toggleAttribute('aria-busy',busy);
    play.disabled=busy||!selected;random.disabled=busy;upload.disabled=busy;
    if(message)status.textContent=message;
  }
  function showSelected(){
    if(!selected){
      preview.hidden=true;selectedName.textContent='Choose a Chimpion';play.textContent='PLAY';play.disabled=true;return;
    }
    selectedName.textContent=selected.name;
    play.textContent='PLAY AS '+selected.name.toUpperCase();
    play.disabled=busy;
    if(selected.image){preview.src=selected.image;preview.alt=selected.name+' preview';preview.hidden=false}
    else preview.hidden=true;
  }
  function render(){
    const q=search.value.trim().toLowerCase();
    filtered=entries.filter(e=>e.name.toLowerCase().includes(q));
    const pages=Math.max(1,Math.ceil(filtered.length/perPage));
    page=Math.max(0,Math.min(page,pages-1));grid.replaceChildren();
    const visible=filtered.slice(page*perPage,page*perPage+perPage);
    for(const entry of visible){
      const button=document.createElement('button');
      button.type='button';button.className='picker-option';
      button.dataset.id=entry.id;button.setAttribute('aria-pressed',String(selected?.id===entry.id));
      button.setAttribute('aria-label',entry.name+(selected?.id===entry.id?' selected':''));
      if(entry.image){const image=new Image();image.src=entry.image;image.loading='lazy';image.alt='';button.append(image)}
      const label=document.createElement('strong');label.textContent=entry.name;button.append(label);
      button.onclick=()=>{selected=entry;status.textContent=entry.name+' selected';showSelected();render()};
      grid.append(button);
    }
    if(!visible.length){const empty=document.createElement('p');empty.className='picker-empty';empty.textContent='No Chimpions match your search.';grid.append(empty)}
    dialog.querySelector('.picker-page').textContent=filtered.length?`${page+1} / ${pages}`:'0 / 0';
    dialog.querySelector('.picker-prev').disabled=page===0;
    dialog.querySelector('.picker-next').disabled=page>=pages-1;
    showSelected();
  }

  async function loadRoster(){
    setBusy(true,'Loading approved roster…');
    try{
      const [avatars,cards]=await Promise.all([
        fetch('/avatars.json').then(r=>{if(!r.ok)throw new Error('avatars '+r.status);return r.json()}),
        fetch('/characters.json').then(r=>r.ok?r.json():[]).catch(()=>[])
      ]);
      const approvedCards=filterBuiltInRoster(cards),images=new Map(approvedCards.map(c=>[String(c.id),c.image]));
      entries=filterBuiltInRoster(avatars.filter(e=>e.url)).map(e=>({...e,image:e.image||images.get(String(e.id))}));
      if(entries.length!==10)throw new Error('Expected exactly 10 approved built-in Chimpions');
      let saved='';try{saved=localStorage.getItem('chimpions-lab-avatar')||''}catch{}
      selected=entries.find(e=>String(e.id)===String(saved))||fallbackBuiltIn(entries);
      status.textContent='Choose a Chimpion, then press Play.';
      setBusy(false);render();
    }catch(error){
      entries=[];selected=null;setBusy(false);
      status.textContent='Character roster unavailable: '+error.message;
      dialog.classList.add('picker-error');render();
    }
  }

  start.onclick=()=>{
    dashApi()?.audioGesture?.();dashApi()?.playUi?.('click');
    if(!dialog.open)dialog.showModal();
    requestAnimationFrame(()=>search.focus());
  };
  back.onclick=()=>{dashApi()?.playUi?.('back');launcher()};
  dialog.querySelector('.picker-close').onclick=()=>{dashApi()?.playUi?.('back');if(busy)dashApi()?.cancelAvatarLoad?.();dialog.close()};
  dialog.addEventListener('cancel',()=>{if(busy)dashApi()?.cancelAvatarLoad?.()});
  dialog.addEventListener('close',()=>start.focus());
  search.oninput=()=>{page=0;render()};
  grid.addEventListener('keydown',event=>{
    if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key)&&movePickerFocus(grid,event.key))event.preventDefault();
  });
  dialog.querySelector('.picker-prev').onclick=()=>{page--;render();grid.querySelector('.picker-option')?.focus()};
  dialog.querySelector('.picker-next').onclick=()=>{page++;render();grid.querySelector('.picker-option')?.focus()};
  random.onclick=()=>{
    if(!entries.length||busy)return;dashApi()?.playUi?.('click');
    selected=entries[Math.floor(Math.random()*entries.length)];
    search.value='';page=Math.max(0,Math.floor(entries.findIndex(e=>e.id===selected.id)/perPage));
    status.textContent='Random pick: '+selected.name;render();
  };
  upload.onclick=()=>{dashApi()?.audioGesture?.();dashApi()?.playUi?.('click');document.querySelector('#dash-upload')?.click()};

  window.addEventListener('chimpions-dash-avatar-loading',event=>{
    if(!dialog.open)return;
    setBusy(true,'Loading '+(event.detail?.name||'Chimpion')+'…');
  });
  window.addEventListener('chimpions-dash-avatar-loaded',event=>{
    if(!dialog.open)return;
    if(event.detail?.local){
      selected={id:'local-custom',name:event.detail.name||'Local Chimpion',localReady:true};
      status.textContent=selected.name+' · local GLB ready';
    }else if(event.detail?.id){
      selected=entries.find(e=>String(e.id)===String(event.detail.id))||selected;
      status.textContent=(event.detail.name||'Chimpion')+' ready';
    }
    setBusy(false);showSelected();render();
  });
  window.addEventListener('chimpions-dash-avatar-error',event=>{
    if(!dialog.open)return;
    setBusy(false,'Could not load Chimpion: '+(event.detail?.message||'Unknown error'));
  });

  play.onclick=async()=>{
    if(!selected||busy)return;
    const api=dashApi();
    if(!api){status.textContent='Dash runtime is not ready.';return}
    api.audioGesture?.();api.playUi?.('confirm');setBusy(true,'Preparing '+selected.name+'…');
    try{
      if(!selected.localReady)await api.selectAvatar(selected.id,{timeoutMs:15000});
      const started=api.startRun();
      if(started===false)throw new Error('Dash runtime did not enter the run');
      dialog.close();
    }catch(error){
      setBusy(false,'Could not start: '+error.message);
    }
  };

  let lastPadState={},lastPadSignature='',lastAxis=0,lastPadMove=0;
  function pickerGamepadFrame(now){
    if(dialog.open){
      const pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected);
      if(pad){
        const signature=[0,1,9,12,13,14,15].map(i=>pad.buttons?.[i]?.pressed?'1':'0').join('');
        const axis=pad.axes?.[1]||0;
        const focusables=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
        if((signature!==lastPadSignature||Math.abs(axis-lastAxis)>.35))dashApi()?.setInputDevice?.('gamepad');
        const pressed=i=>!!pad.buttons?.[i]?.pressed&&!lastPadState[i];
        if(pressed(1)){dialog.close()}
        if(pressed(0)){document.activeElement?.click?.()}
        const canMove=now-lastPadMove>150;
        const prev=focusables.indexOf(document.activeElement);
        if(canMove&&(pad.buttons?.[13]?.pressed||axis>.65)){focusables[Math.min(focusables.length-1,Math.max(0,prev)+1)]?.focus();lastPadMove=now}
        if(canMove&&(pad.buttons?.[12]?.pressed||axis<-.65)){focusables[Math.max(0,prev-1)]?.focus();lastPadMove=now}
        lastPadState=Object.fromEntries([0,1,9,12,13,14,15].map(i=>[i,!!pad.buttons?.[i]?.pressed]));lastPadSignature=signature;lastAxis=axis;
      }
    }
    requestAnimationFrame(pickerGamepadFrame);
  }
  requestAnimationFrame(pickerGamepadFrame);
  loadRoster();
}

export function setupArenaGate(){
  document.body.className='arena-gate-screen';document.title='Chimpions Card Arena';
  document.body.innerHTML=`<main class="arena-gate"><div class="arena-art"><div class="arena-actions"><button id="enter-arena" aria-label="Enter the Arena">Enter the Arena</button><button id="arena-back" aria-label="Back to the game selection">Back to the game selection</button></div></div></main>`;
  document.querySelector('#enter-arena').onclick=()=>{location.href='https://chimpions-attribute-arena.onrender.com/'};
  document.querySelector('#arena-back').onclick=launcher;
}
