import './menuExtras.css';

const SOCIAL_LINKS=[
  ['◎','Official Chimpions Website','https://www.chimpions.co/'],
  ['𝕏','Chimpions X','https://x.com/TheChimpions'],
  ['◉','Join Discord','https://discord.com/invite/thechimpions']
];

function makeLabButton(card){
  if(card.querySelector('#chimpions-lab-button'))return;
  const lab=document.createElement('button');lab.id='chimpions-lab-button';lab.type='button';lab.textContent='Chimpions Lab';lab.setAttribute('aria-label','Open Chimpions Lab and Chimpion Dash');
  lab.onclick=()=>{try{const selected=window.chimpJump?.().selectedId;if(selected)localStorage.setItem('chimpions-lab-avatar',String(selected));}catch{}location.href='?lab=1';};card.append(lab);
}
function makeSocialDock(){
  if(document.getElementById('community-links'))return;
  const links=document.createElement('nav');links.id='community-links';links.setAttribute('aria-label','Official Chimpions links');
  for(const [icon,label,url] of SOCIAL_LINKS){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',label);const mark=document.createElement('span');mark.className='community-icon';mark.textContent=icon;const text=document.createElement('span');text.textContent=label;a.append(mark,text);links.append(a);}document.body.append(links);
}
function mount(){const card=document.querySelector('#overlay .card');if(card)makeLabButton(card);makeSocialDock();}
export function setupMenuExtras(){
  mount();
  // The menu is created/recreated by the game runtime. Observe it instead of assuming
  // the card already exists at module-import time; this is why the first social dock vanished.
  const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});
}
