export const DASH_TUTORIAL_KEY='chimpions-dash-tutorial-v1';

export const DASH_TUTORIAL_STEPS=Object.freeze([
  {id:'tap-jump',prompt:'TAP JUMP',families:['short'],completion:'obstacle-pass'},
  {id:'hold-jump',prompt:'HOLD JUMP',families:['wide'],completion:'obstacle-pass'},
  {id:'slide',prompt:'SLIDE',families:['overhead'],completion:'obstacle-pass'},
  {id:'bananas-flow',prompt:'BANANAS + FLOW',families:['short'],completion:'banana-encounter'},
  {id:'simple-combo',prompt:'JUMP → SLIDE',families:['short','overhead'],completion:'pattern-pass'}
]);

export function createDashTutorialState(enabled=false){
  return{enabled:!!enabled,index:0,passedInPattern:0,bananaCollected:false,misses:0,complete:!enabled};
}

export function currentDashTutorialStep(state){
  return state?.enabled&&!state.complete?DASH_TUTORIAL_STEPS[state.index]||null:null;
}

export function advanceDashTutorial(state,event){
  const step=currentDashTutorialStep(state);
  if(!step)return{advanced:false,complete:!!state?.complete,step:null};
  let done=false,retry=false;
  if(step.completion===event.type)done=true;
  if(step.completion==='banana-encounter'){
    if(event.type==='banana')state.bananaCollected=true;
    if(event.type==='obstacle-pass'){
      if(state.bananaCollected)done=true;
      else{
        state.misses++;
        if(state.misses>=2)done=true;
        else retry=true;
      }
    }
  }
  if(step.completion==='pattern-pass'&&event.type==='obstacle-pass'){
    state.passedInPattern++;
    done=state.passedInPattern>=step.families.length;
  }
  if(!done)return{advanced:false,retry,complete:false,step};
  state.index++;
  state.passedInPattern=0;state.bananaCollected=false;state.misses=0;
  if(state.index>=DASH_TUTORIAL_STEPS.length)state.complete=true;
  return{advanced:true,retry:false,complete:state.complete,step:currentDashTutorialStep(state)};
}

export function dashTutorialPattern(state){
  const step=currentDashTutorialStep(state);
  if(!step)return null;
  return{
    id:`tutorial-${step.id}`,
    difficulty:1,
    weight:1,
    items:step.families.map((family,index)=>[family,index?1.05:0]),
    recovery:1.15,
    tutorial:true,
    prompt:step.prompt
  };
}
