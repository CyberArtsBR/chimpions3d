import './menuExtras.css';

export function setupMenuExtras(){
  const card=document.querySelector('#overlay .card');
  if(!card||document.getElementById('chimpions-lab-button'))return;

  const lab=document.createElement('button');
  lab.id='chimpions-lab-button';
  lab.type='button';
  lab.textContent='Chimpions Lab';
  lab.setAttribute('aria-label','Open Chimpions Lab and Chimpion Dash');
  lab.onclick=()=>{
    try{
      const selected=window.chimpJump?.().selectedId;
      if(selected)localStorage.setItem('chimpions-lab-avatar',String(selected));
    }catch{}
    location.href='?lab=1';
  };
  card.append(lab);

  const links=document.createElement('nav');
  links.id='community-links';
  links.setAttribute('aria-label','Official Chimpions links');
  const entries=[
    ['◎','Official Chimpions Website','https://www.chimpions.co/'],
    ['𝕏','X / TheChimpions','https://x.com/TheChimpions'],
    ['☯','Join Discord','https://discord.com/invite/thechimpions']
  ];
  for(const [icon,label,url] of entries){
    const a=document.createElement('a');
    a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    const mark=document.createElement('span');mark.className='community-icon';mark.textContent=icon;
    const text=document.createElement('span');text.textContent=label;
    a.append(mark,text);links.append(a);
  }
  card.append(links);
}
