// Production hardening for the illustrated Jump entry screen.
// Keep the approved artwork as a real DOM image so relative CSS URL resolution
// cannot leave the menu on its solid-color fallback in embedded/static builds.
export function setupJumpStartScreenRecovery(){
  const backdrop=document.getElementById('menu-backdrop');
  if(!backdrop)return;

  const candidates=[
    new URL('screens/chimp-jump-start.png',document.baseURI).href,
    new URL('/screens/chimp-jump-start.png',location.origin).href
  ];
  let image=document.getElementById('jump-menu-art-recovery');
  if(!image){
    image=document.createElement('img');
    image.id='jump-menu-art-recovery';
    image.alt='';
    image.setAttribute('aria-hidden','true');
    image.decoding='async';
    Object.assign(image.style,{
      position:'absolute',inset:'0',width:'100%',height:'100%',
      objectFit:'cover',objectPosition:'center',pointerEvents:'none',zIndex:'0'
    });
    backdrop.prepend(image);
  }

  let index=0;
  const loadNext=()=>{
    if(index>=candidates.length)return;
    const url=candidates[index++];
    document.documentElement.style.setProperty('--jump-screen-art',`url("${url}")`);
    image.src=url;
  };
  image.onerror=()=>loadNext();
  loadNext();

  if(!document.getElementById('jump-start-recovery-style')){
    const style=document.createElement('style');
    style.id='jump-start-recovery-style';
    style.textContent=`
      .jump-start-screen[data-mode="menu"] #menu-backdrop{overflow:hidden!important}
      .jump-start-screen[data-mode="menu"] #jump-menu-art-recovery{display:block!important}
      body:not([data-mode="playing"]) #jump-fast-fall-hint{display:none!important}
    `;
    document.head.append(style);
  }
}
