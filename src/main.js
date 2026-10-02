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
      #hud{width:min(96vw,720px)!important;display:grid!important;grid-template-columns:minmax(64px,1fr) minmax(64px,1fr) minmax(164px,auto);align-items:start!important;gap:clamp(6px,1.8vw,16px)!important}
      #hud>.stat{min-width:0;white-space:nowrap;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;padding:5px 6px!important;text-shadow:0 2px 8px #000c}
      #hud>.height-stat{justify-self:start;text-align:left}
      #hud>.stat:not(.height-stat){justify-self:center;text-align:center}
      #hud .right{display:grid!important;grid-template-columns:minmax(58px,auto) repeat(3,36px);align-items:start;justify-content:end;justify-self:end;gap:4px!important;min-width:0}
      #hud .right .coins{min-width:58px;text-align:right;padding:5px 4px!important}
      #hud #pause,#hud #mute,#hud #quality{width:36px!important;height:36px!important;min-width:36px!important;padding:0!important;display:grid;place-items:center;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;text-shadow:0 2px 8px #000c;line-height:1}
      #hud #quality{font-size:9px!important;font-weight:900!important;letter-spacing:.02em}
      #jump-mastery-feedback,#jump-fast-fall-hint{display:none!important}
      @media(max-width:480px){
        #hud{top:max(8px,env(safe-area-inset-top))!important;width:calc(100vw - 12px)!important;grid-template-columns:minmax(48px,.8fr) minmax(48px,.8fr) minmax(128px,1.35fr);gap:3px!important}
        #hud>.stat{padding:3px!important}
        #hud .stat small{font-size:8px!important;letter-spacing:1.1px!important}
        #hud .stat strong{font-size:clamp(19px,6vw,23px)!important}
        #hud .stat em{font-size:10px!important}
        #hud .right{grid-template-columns:minmax(44px,auto) repeat(3,28px);gap:2px!important}
        #hud .right .coins{min-width:44px;padding:3px 2px!important}
        #hud .coins strong{font-size:18px!important}
        #hud #pause,#hud #mute,#hud #quality{width:28px!important;height:28px!important;min-width:28px!important;font-size:13px!important}
        #hud #quality{font-size:8px!important}
      }
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
