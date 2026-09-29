const params=new URLSearchParams(location.search);
const BASE=import.meta.env.BASE_URL;

// Portals standalone build: Chimp Jump is the only entry point.
// Never route through the cartridge launcher or sibling games.
document.documentElement.style.setProperty('--jump-screen-art',`url("${BASE}screens/chimp-jump-start.png")`);
document.documentElement.style.setProperty('--jump-legacy-start-art',`url("${BASE}ui/start-screen.webp")`);

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

  await import('./game.js');
  setupBiomePolish();
  setupMenuExtras();

  const {setupJumpMenu}=await import('./menuScreensV2.js');
  setupJumpMenu();

  const {setupJumpExperience}=await import('./jumpExperience.js');
  setupJumpExperience();
});
