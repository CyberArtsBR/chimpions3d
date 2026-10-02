import './menuScreensV2.css';
import './menuScreensFinal.css';
import jumpStartArt from './assets/chimp-jump-start.png';

const params=new URLSearchParams(location.search);
const BASE=import.meta.env.BASE_URL;

// Portals standalone build: Chimp Jump is the only entry point.
// Never route through the cartridge launcher or sibling games.
document.documentElement.style.setProperty('--jump-screen-art',`url("${jumpStartArt}")`);
document.documentElement.style.setProperty('--jump-legacy-start-art',`url("${BASE}ui/start-screen.webp")`);
document.body.classList.add('jump-start-screen');

function forceStandaloneStartArtwork(){
  const backdrop=document.getElementById('menu-backdrop');
  if(!backdrop)return;
  backdrop.style.setProperty(
    'background',
    `#132e32 url("${jumpStartArt}") center/cover no-repeat`,
    'important'
  );
  backdrop.style.setProperty('filter','none','important');
  backdrop.style.setProperty('overflow','hidden','important');

  // Keep the approved start artwork as a real image layer too. This makes the
  // standalone build resilient when embedded hosts rewrite CSS/base URLs.
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
  image.src=jumpStartArt;

  if(!document.getElementById('jump-standalone-start-recovery-style')){
    const style=document.createElement('style');
    style.id='jump-standalone-start-recovery-style';
    style.textContent=`
      .jump-start-screen[data-mode="menu"] #jump-menu-art-recovery{display:block!important}
      #hud .stat{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;padding:6px 8px!important;text-shadow:0 2px 8px #000c}
      #hud #pause,#hud #mute,#hud #quality{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;text-shadow:0 2px 8px #000c}
      #jump-mastery-feedback,#jump-fast-fall-hint{display:none!important}
    `;
    document.head.append(style);
  }
}
document.body.dataset.uiReady='loading';
document.body.dataset.menuReady='loading';
import('./polish.css');
if(params.has('dev'))document.body.dataset.devTools='true';

Promise.all([
  import('./runtimeEnhancements.js')
]).then(async()=>{
  const [{setupBiomePolish},{setupMenuExtras}]=await Promise.all([
    import('./biome-polish.js'),
    import('./menuExtras.js')
  ]);

  await import('./portalFastFall.js');
  await import('./game.js');
  forceStandaloneStartArtwork();
  setupBiomePolish();
  setupMenuExtras();

  const {setupJumpMenu}=await import('./menuScreensV2.js');
  setupJumpMenu();

  const {setupJumpExperience}=await import('./jumpExperience.js');
  setupJumpExperience();
});
