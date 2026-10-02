const BASE=import.meta.env.BASE_URL;
const DASH_PRIMARY=BASE+'screens/chimp-dash-start-853ee5d1.png';
const DASH_FALLBACK=BASE+'screens/chimp-dash-start.png';
const ARENA_PRIMARY=BASE+'screens/card-arena-start-0920443d.png';
const ARENA_FALLBACK=BASE+'screens/card-arena-start.png';

function ensureStyle(){
 if(document.getElementById('start-art-recovery-style'))return;
 const style=document.createElement('style');
 style.id='start-art-recovery-style';
 style.textContent=`
  #dash-start-art-recovery{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:80;pointer-events:none;background:#06110a}
  body.dash-start-art-recovered #dash-stage::before{display:none!important}
  #arena-start-art-recovery{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;object-position:center;z-index:0;pointer-events:none;background:#06110a}
  .arena-gate-screen .arena-art{background-color:#06110a!important}
  .arena-gate-screen .arena-actions{z-index:1}
 `;
 document.head.append(style);
}

function makeRecoveryImage(id,primary,fallback){
 let image=document.getElementById(id);
 if(image)return image;
 image=document.createElement('img');
 image.id=id;
 image.alt='';
 image.setAttribute('aria-hidden','true');
 image.decoding='async';
 image.loading='eager';
 image.fetchPriority='high';
 let fallbackTried=false;
 image.onerror=()=>{
  if(fallbackTried)return;
  fallbackTried=true;
  image.src=fallback;
 };
 image.src=primary;
 return image;
}

export function setupDashStartArtRecovery(){
 ensureStyle();
 const image=makeRecoveryImage('dash-start-art-recovery',DASH_PRIMARY,DASH_FALLBACK);
 if(!image.isConnected)document.body.append(image);
 document.body.classList.add('dash-start-art-recovered');
 const sync=()=>{
  const state=document.body.dataset.labState||'';
  image.hidden=!!state&&state!=='menu';
 };
 sync();
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{attributes:true,attributeFilter:['data-lab-state']});
 return image;
}

export function setupArenaStartArtRecovery(){
 ensureStyle();
 const host=document.querySelector('.arena-art');
 if(!host)return null;
 const image=makeRecoveryImage('arena-start-art-recovery',ARENA_PRIMARY,ARENA_FALLBACK);
 if(!image.isConnected)host.prepend(image);
 return image;
}
