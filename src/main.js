const params=new URLSearchParams(location.search);

// Chimpions Dash has one canonical production route: ?dash=1.
// Retire the old Lab/2D entry point instead of maintaining two Dash entry
// paths that can drift apart. Any legacy ?lab link is permanently redirected
// to the current Dash game while preserving unrelated query flags.
if(params.has('lab')){
  params.delete('lab');
  params.set('dash','1');
  location.replace(location.pathname+'?'+params.toString()+location.hash);
}else if(!['dash','rig','play','dev','arena','test'].some(key=>params.has(key))){
  import('./launcherV2.js');
}else if(params.has('arena')){
  import('./menuScreensV2.js').then(({setupArenaGate})=>setupArenaGate());
}else if(params.has('dash')){
  import('./polish.css');
  // Load the Dash presentation CSS before the runtime builds its DOM, and mark
  // the page as the artwork start screen immediately. This prevents the legacy
  // internal 2.5D setup panel from flashing for a frame before the real menu.
  document.body.classList.add('dash-start-screen');
  import('./menuScreensV2.js').then(async({setupDashMenu})=>{
    await import('./chimpionsLab.js');
    setupDashMenu();
  });
}else if(params.has('rig')){
  import('./polish.css');
  document.body.innerHTML=`<main id="panel"><div>State: <output id="state">IDLE</output></div><div>Speed: <output id="speed">0</output></div><div>Grounded: <output id="grounded">true</output></div><nav><button data-state="IDLE">Idle</button><button data-state="WALK">Walk</button><button data-state="RUN">Run</button><button data-state="JUMP">Jump</button></nav><label><input id="skeleton" type="checkbox"> Show Skeleton</label><div><a href="/" style="color:#80e4dc">Back to Chimp Jump</a></div></main><p id="message" role="status">Loading character…</p>`;
  import('./rig-lab.js');
}else{
  // Jump readiness starts before async module loading so diagnostics can never
  // advertise an interactive game before its presentation controls are mounted.
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
    const {setupJumpStartScreenRecovery}=await import('./jumpStartScreenRecovery.js');setupJumpStartScreenRecovery();
    const {setupJumpMasteryPresentation}=await import('./jumpMasteryPresentation.js');setupJumpMasteryPresentation();
    setupBiomePolish();
    setupMenuExtras();
    const {setupJumpMenu}=await import('./menuScreensV2.js');setupJumpMenu();
    const {setupJumpExperience}=await import('./jumpExperience.js');setupJumpExperience();
  });
}
