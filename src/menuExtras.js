import './menuExtras.css';

const SOCIAL_LINKS=[
  ['◎','Official Site','https://www.chimpions.co/'],
  ['𝕏','Chimpions X','https://x.com/TheChimpions'],
  ['◉','Join Discord','https://discord.com/invite/thechimpions']
];

function makeLabButton(card){
  if(card.querySelector('#chimpions-lab-button'))return;
  const lab=document.createElement('button');
  lab.id='chimpions-lab-button';
  lab.type='button';
  lab.textContent='Chimpions Dash';
  lab.setAttribute('aria-label','Open Chimpions Dash');
  lab.onclick=()=>{
    try{
      const selected=window.chimpJump?.().selectedId;
      if(selected)localStorage.setItem('chimpions-lab-avatar',String(selected));
    }catch{}
    location.href='?dash=1';
  };
  card.append(lab);
}

function makeSocialButtons(card){
  if(card.querySelector('#menu-social-buttons'))return;
  // Remove the previous viewport dock if an older hot-reloaded build left it behind.
  document.getElementById('community-links')?.remove();
  const nav=document.createElement('nav');
  nav.id='menu-social-buttons';
  nav.setAttribute('aria-label','Official Chimpions links');
  for(const [icon,label,url] of SOCIAL_LINKS){
    const a=document.createElement('a');
    a.href=url;
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.setAttribute('aria-label',label);
    const mark=document.createElement('span');
    mark.className='community-icon';
    mark.textContent=icon;
    const text=document.createElement('span');
    text.textContent=label;
    a.append(mark,text);
    nav.append(a);
  }
  card.append(nav);
}

function mount(){
  const card=document.querySelector('#overlay .card');
  if(!card)return;
  card.querySelector('#chimpions-lab-button')?.remove();
  makeSocialButtons(card);
}

export function setupMenuExtras(){
  mount();
  // The runtime reuses the title card but changes its content/mode. Keep the custom
  // controls mounted without depending on one exact initialization frame.
  const observer=new MutationObserver(mount);
  observer.observe(document.body,{childList:true,subtree:true});
}
