import './polish.css';
import './runtimeEnhancements.js';
import './visualCompletion.js';
import './mobileVisualBudget.js';
import './noBiomeBands.js';
import {setupBiomePolish} from './biome-polish.js';
import {setupMenuExtras} from './menuExtras.js';

const params=new URLSearchParams(location.search);
if(params.has('lab')){
  import('./chimpionsLab.js');
}else if(params.has('rig')){
  document.body.innerHTML=`<main id="panel"><div>State: <output id="state">IDLE</output></div><div>Speed: <output id="speed">0</output></div><div>Grounded: <output id="grounded">true</output></div><nav><button data-state="IDLE">Idle</button><button data-state="WALK">Walk</button><button data-state="RUN">Run</button><button data-state="JUMP">Jump</button></nav><label><input id="skeleton" type="checkbox"> Show Skeleton</label><div><a href="/" style="color:#80e4dc">Back to Chimp Jump</a></div></main><p id="message" role="status">Loading character…</p>`;
  import('./rig-lab.js');
}else{
  if(params.has('dev'))document.body.dataset.devTools='true';
  import('./game.js').then(()=>{setupBiomePolish();setupMenuExtras();});
}
