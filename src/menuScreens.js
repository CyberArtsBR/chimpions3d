import './menuScreens.css';

const launcher=()=>{location.href='/'};
function backButton(parent){
 const button=document.createElement('button');button.className='games-back';button.textContent='Back to Games Selection';button.onclick=launcher;parent.append(button);return button;
}
export function setupJumpMenu(){
 const card=document.querySelector('#overlay .card');if(!card)return;
 backButton(card);
 document.body.classList.add('jump-start-screen');
}
export function setupDashMenu(){
 const menu=document.querySelector('#dash-menu');if(!menu)return;
 document.body.classList.add('dash-start-screen');
 const trigger=document.querySelector('#dash-start');trigger.classList.add('original-dash-start');
 const start=document.createElement('button');start.className='screen-hotspot dash-start-hotspot';start.textContent='Start Game';start.setAttribute('aria-label','Start Game');
 const back=backButton(menu);back.classList.add('screen-hotspot','dash-back-hotspot');menu.append(start);
 const dialog=document.createElement('dialog');dialog.id='dash-character-picker';
 dialog.innerHTML='<header><h2>Choose your Chimpion</h2><button class="picker-close" aria-label="Close">×</button></header><input class="picker-search" type="search" placeholder="Search chimp name" aria-label="Search characters"><div class="picker-grid"></div><footer><button class="picker-prev">Previous</button><button class="picker-random">Random Chimpion</button><span class="picker-page"></span><button class="picker-next">Next</button><button class="picker-play">Play with selected Chimpion</button></footer>';
 document.body.append(dialog);
 let entries=[],filtered=[],selected=null,page=0;const perPage=12;
 const grid=dialog.querySelector('.picker-grid'),search=dialog.querySelector('.picker-search');
 function render(){
  filtered=entries.filter(e=>e.name.toLowerCase().includes(search.value.toLowerCase()));const pages=Math.max(1,Math.ceil(filtered.length/perPage));page=Math.min(page,pages-1);grid.replaceChildren();
  for(const entry of filtered.slice(page*perPage,page*perPage+perPage)){
   const button=document.createElement('button');button.className='picker-option';button.setAttribute('aria-pressed',String(selected?.id===entry.id));
   if(entry.image){const image=new Image();image.src=entry.image;image.loading='lazy';image.alt='';button.append(image);}
   const label=document.createElement('strong');label.textContent=entry.name;button.append(label);
   button.onclick=()=>{selected=entry;render();};grid.append(button);
  }
  dialog.querySelector('.picker-page').textContent=page+1+' / '+pages;dialog.querySelector('.picker-prev').disabled=page===0;dialog.querySelector('.picker-next').disabled=page>=pages-1;
 }
 Promise.all([fetch('/avatars.json').then(r=>r.json()),fetch('/characters.json').then(r=>r.json()).catch(()=>[])])
 .then(([avatars,cards])=>{const images=new Map(cards.map(c=>[c.id,c.image]));entries=avatars.filter(e=>e.url).map(e=>({...e,image:e.image||images.get(e.id)}));selected=entries[Math.floor(Math.random()*entries.length)];render();});
 start.onclick=()=>dialog.showModal();dialog.querySelector('.picker-close').onclick=()=>dialog.close();search.oninput=()=>{page=0;render();};
 dialog.querySelector('.picker-prev').onclick=()=>{page--;render();};dialog.querySelector('.picker-next').onclick=()=>{page++;render();};
 dialog.querySelector('.picker-random').onclick=()=>{selected=entries[Math.floor(Math.random()*entries.length)];page=Math.floor(filtered.findIndex(e=>e.id===selected.id)/perPage);if(page<0)page=0;render();};
 dialog.querySelector('.picker-play').onclick=()=>{
  if(!selected)return;const select=document.querySelector('#lab-avatar');select.value=selected.id;select.dispatchEvent(new Event('change'));
  dialog.close();const begin=()=>trigger.disabled?setTimeout(begin,80):trigger.click();begin();
 };
}
export function setupArenaGate(){
 document.body.className='arena-gate-screen';document.title='Chimpions Card Arena';
 document.body.innerHTML='<main class="arena-gate"><button class="arena-hotspot enter-arena" id="enter-arena" aria-label="Enter the Arena">Enter the Arena</button><button class="arena-hotspot arena-back" id="arena-back" aria-label="Back to the game selection">Back to the game selection</button></main>';
 document.querySelector('#enter-arena').onclick=()=>{location.href='https://chimpions-attribute-arena.onrender.com/'};
 document.querySelector('#arena-back').onclick=launcher;
}
