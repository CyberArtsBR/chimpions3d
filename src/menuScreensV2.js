import './menuScreensV2.css';
import './menuScreensFinal.css';

const launcher=()=>{location.href='/'};
function backButton(parent,className=''){
  let button=parent.querySelector(':scope > .games-back');
  if(button)return button;
  button=document.createElement('button');button.type='button';button.className=('games-back '+className).trim();button.textContent='Back to the game selection';button.onclick=launcher;parent.append(button);return button;
}

export function setupJumpMenu(){
  const card=document.querySelector('#overlay .card');if(!card)return;
  backButton(card,'jump-back');
  document.body.classList.add('jump-start-screen');
}

export function setupDashMenu(){
  const menu=document.querySelector('#dash-menu');if(!menu)return;
  document.body.classList.add('dash-start-screen');
  const trigger=document.querySelector('#dash-start');
  trigger?.classList.add('original-dash-start');

  const start=document.createElement('button');start.type='button';start.className='screen-primary dash-start-hotspot';start.textContent='Start Game';start.setAttribute('aria-label','Start Game');
  const back=backButton(menu,'dash-back');
  menu.append(start);

  const dialog=document.createElement('dialog');dialog.id='dash-character-picker';
  dialog.innerHTML=`
    <header><h2>Choose your Chimpion</h2><button class="picker-close" aria-label="Close character selection">×</button></header>
    <div class="picker-selection-actions">
      <button class="picker-random">Random Chimpion</button>
      <div class="picker-current"><img alt="" hidden><p role="status">Choose a Chimpion</p></div>
      <button class="picker-play">Play with selected Chimpion</button>
    </div>
    <input class="picker-search" type="search" placeholder="Search chimp name" aria-label="Search characters">
    <div class="picker-grid"></div>
    <footer><button class="picker-prev">Previous</button><span class="picker-page"></span><button class="picker-next">Next</button></footer>`;
  document.body.append(dialog);

  let entries=[],filtered=[],selected=null,page=0;const perPage=12;
  const grid=dialog.querySelector('.picker-grid'),search=dialog.querySelector('.picker-search'),preview=dialog.querySelector('.picker-current img'),status=dialog.querySelector('.picker-current p');
  function showSelected(){
    if(!selected){preview.hidden=true;status.textContent='Choose a Chimpion';dialog.querySelector('.picker-play').textContent='Play with selected Chimpion';return;}
    status.textContent=selected.name;dialog.querySelector('.picker-play').textContent='Play with '+selected.name;
    if(selected.image){preview.src=selected.image;preview.alt=selected.name;preview.hidden=false;}else preview.hidden=true;
  }
  function render(){
    filtered=entries.filter(e=>e.name.toLowerCase().includes(search.value.toLowerCase()));
    const pages=Math.max(1,Math.ceil(filtered.length/perPage));page=Math.max(0,Math.min(page,pages-1));grid.replaceChildren();
    for(const entry of filtered.slice(page*perPage,page*perPage+perPage)){
      const button=document.createElement('button');button.type='button';button.className='picker-option';button.setAttribute('aria-pressed',String(selected?.id===entry.id));
      if(entry.image){const image=new Image();image.src=entry.image;image.loading='lazy';image.alt='';button.append(image);}
      const label=document.createElement('strong');label.textContent=entry.name;button.append(label);button.onclick=()=>{selected=entry;showSelected();render();};grid.append(button);
    }
    dialog.querySelector('.picker-page').textContent=(page+1)+' / '+pages;dialog.querySelector('.picker-prev').disabled=page===0;dialog.querySelector('.picker-next').disabled=page>=pages-1;showSelected();
  }

  Promise.all([fetch('/avatars.json').then(r=>r.json()),fetch('/characters.json').then(r=>r.json()).catch(()=>[])])
    .then(([avatars,cards])=>{
      const images=new Map(cards.map(c=>[c.id,c.image]));
      entries=avatars.filter(e=>e.url).map(e=>({...e,image:e.image||images.get(e.id)}));
      let saved='';try{saved=localStorage.getItem('chimpions-lab-avatar')||'';}catch{}
      selected=entries.find(e=>String(e.id)===String(saved))||entries[Math.floor(Math.random()*entries.length)]||null;render();
    });

  start.onclick=()=>dialog.showModal();
  dialog.querySelector('.picker-close').onclick=()=>dialog.close();
  search.oninput=()=>{page=0;render();};
  dialog.querySelector('.picker-prev').onclick=()=>{page--;render();};
  dialog.querySelector('.picker-next').onclick=()=>{page++;render();};
  dialog.querySelector('.picker-random').onclick=()=>{
    if(!entries.length)return;selected=entries[Math.floor(Math.random()*entries.length)];search.value='';filtered=entries;page=Math.max(0,Math.floor(entries.findIndex(e=>e.id===selected.id)/perPage));render();
  };
  dialog.querySelector('.picker-play').onclick=()=>{
    if(!selected||!trigger)return;
    const select=document.querySelector('#lab-avatar');if(!select)return;
    select.value=selected.id;select.dispatchEvent(new Event('change'));dialog.close();
    const begin=()=>trigger.disabled?setTimeout(begin,80):trigger.click();begin();
  };
  back.onclick=launcher;
}

export function setupArenaGate(){
  document.body.className='arena-gate-screen';document.title='Chimpions Card Arena';
  document.body.innerHTML=`<main class="arena-gate"><div class="arena-art"><div class="arena-actions"><button id="enter-arena" aria-label="Enter the Arena">Enter the Arena</button><button id="arena-back" aria-label="Back to the game selection">Back to the game selection</button></div></div></main>`;
  document.querySelector('#enter-arena').onclick=()=>{location.href='https://chimpions-attribute-arena.onrender.com/'};
  document.querySelector('#arena-back').onclick=launcher;
}
