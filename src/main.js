const params=new URLSearchParams(location.search);
if(!['dash','lab','rig','play','dev','arena'].some(key=>params.has(key))){
  import('./launcherV2.js');
}else if(params.has('arena')){
  import('./menuScreensV2.js').then(({setupArenaGate})=>setupArenaGate());
}else if(params.has('dash')||params.has('lab')){
  import('./polish.css');
  import('./chimpionsLab.js').then(()=>import('./menuScreensV2.js')).then(({setupDashMenu})=>setupDashMenu());
}else if(params.has('rig')){
  import('./polish.css');
  document.body.innerHTML=`<main id="panel"><div>State: <output id="state">IDLE</output></div><div>Speed: <output id="speed">0</output></div><div>Grounded: <output id="grounded">true</output></div><nav><button data-state="IDLE">Idle</button><button data-state="WALK">Walk</button><button data-state="RUN">Run</button><button data-state="JUMP">Jump</button></nav><label><input id="skeleton" type="checkbox"> Show Skeleton</label><div><a href="/" style="color:#80e4dc">Back to Chimp Jump</a></div></main><p id="message" role="status">Loading character…</p>`;
  import('./rig-lab.js');
}else{
  import('./polish.css');
  if(params.has('dev'))document.body.dataset.devTools='true';
  Promise.all([
    import('./runtimeEnhancements.js'),
    import('./visualCompletion.js'),
    import('./mobileVisualBudget.js'),
    import('./noBiomeBands.js')
  ]).then(async()=>{
    const [{setupBiomePolish},{setupMenuExtras}]=await Promise.all([
      import('./biome-polish.js'),
      import('./menuExtras.js')
    ]);
    await import('./game.js');
    setupBiomePolish();
    setupMenuExtras();
    const {setupJumpMenu}=await import('./menuScreensV2.js');setupJumpMenu();
  });
}
