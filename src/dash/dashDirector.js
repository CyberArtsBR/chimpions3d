import {chooseDashWeighted,nextDashRandom} from './dashSeed.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ACTION_BY_FAMILY=Object.freeze({short:'jump',high:'high-jump',wide:'high-jump',overhead:'slide',flex:'jump-or-slide'});

export const DASH_DIRECTOR_TUNING=Object.freeze({
  pressureRetention:.67,
  pressureGain:.48,
  recoveryCredit:.34,
  visibilityPressure:.16,
  speedPressure:.12,
  repeatSoftLimit:2,
  historyActions:8,
  historyPatterns:6,
  firstSetPieceSeconds:78,
  setPieceMinInterval:82,
  setPieceIntervalVariance:48,
  setPiecePressureCeiling:.78,
  setPieceVisibilityFloor:.72
});

export const DASH_STAGE_IDENTITIES=Object.freeze([
  Object.freeze({id:'emerald-wilds',name:'EMERALD WILDS',focus:'intro',familyBias:Object.freeze({short:1.35,high:.92,wide:.88,overhead:.82,flex:.82}),risk:.78,precision:.95,rhythm:1.10}),
  Object.freeze({id:'canopy-run',name:'CANOPY RUN',focus:'transitions',familyBias:Object.freeze({short:.98,high:.92,wide:.88,overhead:1.42,flex:1.08}),risk:.92,precision:1,rhythm:1.18}),
  Object.freeze({id:'ancient-jungle',name:'ANCIENT JUNGLE',focus:'precision',familyBias:Object.freeze({short:1.12,high:1.28,wide:.96,overhead:1.06,flex:1.08}),risk:1.02,precision:1.34,rhythm:1.15}),
  Object.freeze({id:'waterfall-pass',name:'WATERFALL PASS',focus:'airtime',familyBias:Object.freeze({short:.90,high:1.08,wide:1.52,overhead:.86,flex:.94}),risk:1.06,precision:1.10,rhythm:.98}),
  Object.freeze({id:'golden-ruins',name:'GOLDEN RUINS',focus:'risk',familyBias:Object.freeze({short:.96,high:1.10,wide:1.08,overhead:1.02,flex:1.48}),risk:1.55,precision:1.24,rhythm:1.05}),
  Object.freeze({id:'storm-forest',name:'STORM FOREST',focus:'pressure',familyBias:Object.freeze({short:1.05,high:1.14,wide:1.10,overhead:1.18,flex:1.12}),risk:1.12,precision:1.10,rhythm:1.30}),
  Object.freeze({id:'moonlit-canopy',name:'MOONLIT CANOPY',focus:'mastery',familyBias:Object.freeze({short:1.06,high:1.14,wide:1.14,overhead:1.14,flex:1.18}),risk:1.24,precision:1.30,rhythm:1.24})
]);

export const DASH_SET_PIECES=Object.freeze([
  Object.freeze({
    id:'giant-root-rhythm',theme:'giant-root-rhythm',minStage:3,difficulty:4,weight:1.10,durationSeconds:13,
    items:Object.freeze([['short',0],['short',.82],['high',1.02],['short',.92],['overhead',1.02],['short',.90],['wide',1.18],['short',1.02]])
  }),
  Object.freeze({
    id:'temple-corridor',theme:'temple-corridor',minStage:3,difficulty:4,weight:1,durationSeconds:12,
    items:Object.freeze([['overhead',0],['short',.92],['overhead',.96],['high',1.10],['overhead',1.02],['short',.92],['overhead',.98]])
  }),
  Object.freeze({
    id:'waterfall-sequence',theme:'waterfall-sequence',minStage:4,difficulty:4,weight:1.08,durationSeconds:14,
    items:Object.freeze([['wide',0],['short',1.28],['wide',1.38],['high',1.24],['short',1.12],['wide',1.42]])
  }),
  Object.freeze({
    id:'canopy-sprint',theme:'canopy-sprint',minStage:4,difficulty:4,weight:1.02,durationSeconds:11,
    items:Object.freeze([['overhead',0],['short',.86],['overhead',.92],['short',.88],['flex',1.02],['overhead',.98],['short',.92]])
  }),
  Object.freeze({
    id:'ruin-gateway',theme:'ruin-gateway',minStage:5,difficulty:5,weight:.92,durationSeconds:15,
    items:Object.freeze([['high',0],['short',1.04],['flex',1.08],['overhead',1.02],['wide',1.30],['short',1.00],['high',1.12]])
  }),
  Object.freeze({
    id:'rolling-threat',theme:'rolling-visual-threat',minStage:6,difficulty:5,weight:.86,durationSeconds:16,
    items:Object.freeze([['short',0],['high',1.02],['overhead',1.02],['short',.92],['wide',1.20],['overhead',1.06],['high',1.10],['short',.96]])
  })
]);

export function dashStageIdentity(stage=1){
  const safe=Math.max(1,Math.floor(Number(stage)||1));
  const index=(safe-1)%DASH_STAGE_IDENTITIES.length;
  return{...DASH_STAGE_IDENTITIES[index],slot:index+1,cycle:Math.floor((safe-1)/DASH_STAGE_IDENTITIES.length)};
}

export function createDashDirectorState(){
  return{
    pressure:.12,
    recovery:1,
    actionVariety:.5,
    recentActions:[],
    recentPatterns:[],
    patternsSinceRecovery:0,
    recoverySections:0,
    nextSetPieceAt:DASH_DIRECTOR_TUNING.firstSetPieceSeconds,
    setPieceCount:0
  };
}

export function dashActionVariety(actions=[]){
  if(actions.length<2)return .5;
  const recent=actions.slice(-DASH_DIRECTOR_TUNING.historyActions);
  const unique=new Set(recent).size/Math.min(4,recent.length);
  let changes=0;
  for(let i=1;i<recent.length;i++)if(recent[i]!==recent[i-1])changes++;
  const transitions=changes/Math.max(1,recent.length-1);
  return clamp(unique*.55+transitions*.45,0,1);
}

export function dashRecentActionStreak(actions=[],action=null){
  if(!action||!actions.length)return 0;
  let count=0;
  for(let i=actions.length-1;i>=0&&actions[i]===action;i--)count++;
  return count;
}

export function dashPressureCapacity({stage=1,normalizedSpeed=0,visibility=1}={}){
  const mastery=Math.min(.10,Math.floor(Math.max(0,stage-1)/7)*.025);
  const visibilityPenalty=(1-clamp(visibility,0,1))*.14;
  return clamp(.69+clamp(normalizedSpeed,0,1)*.22+mastery-visibilityPenalty,.58,1.02);
}

export function dashPatternPressure(pattern,{normalizedSpeed=0,visibility=1,previousAction=null}={}){
  if(!pattern)return 0;
  const difficultyBase=[0,.16,.28,.42,.58,.73][Math.max(1,Math.min(5,Math.round(pattern.difficulty||1)))];
  const actions=(pattern.items||[]).map(item=>ACTION_BY_FAMILY[item[0]]||null).filter(Boolean);
  let transitions=0;
  let prior=previousAction;
  for(const action of actions){
    if(prior&&prior!==action)transitions++;
    prior=action;
  }
  const lengthExtra=Math.max(0,actions.length-1)*.045;
  const transitionExtra=transitions*.045;
  const speedExtra=clamp(normalizedSpeed,0,1)*DASH_DIRECTOR_TUNING.speedPressure;
  const visibilityExtra=(1-clamp(visibility,0,1))*DASH_DIRECTOR_TUNING.visibilityPressure;
  const riskExtra=pattern.riskReward||pattern.riskRoute?.reward? .035:0;
  const setPieceExtra=pattern.setPiece?.id?.length? .06:0;
  return clamp(difficultyBase+lengthExtra+transitionExtra+speedExtra+visibilityExtra+riskExtra+setPieceExtra,0,1.25);
}

export function dashDirectorSnapshot({state=createDashDirectorState(),time=0,stage=1,normalizedSpeed=0,visibility=1}={}){
  const capacity=dashPressureCapacity({stage,normalizedSpeed,visibility});
  const pressure=clamp(Number(state.pressure)||0,0,1.35);
  return{
    time,
    stage,
    identity:dashStageIdentity(stage),
    normalizedSpeed:clamp(normalizedSpeed,0,1),
    visibility:clamp(visibility,0,1),
    pressure,
    capacity,
    headroom:capacity-pressure,
    recovery:clamp(Number(state.recovery)||0,0,1.25),
    actionVariety:dashActionVariety(state.recentActions||[]),
    recentActions:[...(state.recentActions||[])],
    recentPatterns:[...(state.recentPatterns||[])]
  };
}

function patternFamilies(pattern){return(pattern.items||[]).map(item=>item[0]).filter(Boolean);}
function patternFirstAction(pattern){return ACTION_BY_FAMILY[pattern?.items?.[0]?.[0]]||null;}

export function dashPatternWeightModifier(pattern,{state=createDashDirectorState(),snapshot}={}){
  if(!pattern||!snapshot)return 1;
  const identity=dashStageIdentity(snapshot.stage);
  const families=patternFamilies(pattern);
  const familyBias=families.length?families.reduce((sum,f)=>sum+(identity.familyBias[f]||1),0)/families.length:1;
  const firstAction=patternFirstAction(pattern);
  const demand=dashPatternPressure(pattern,{
    normalizedSpeed:snapshot.normalizedSpeed,
    visibility:snapshot.visibility,
    previousAction:state.recentActions?.at(-1)||snapshot.previousAction||null
  });
  let weight=familyBias;

  const capacity=snapshot.pressureCapacity??snapshot.capacity??.75;
  const headroom=snapshot.pressureHeadroom??snapshot.headroom??0;
  const overshoot=demand-capacity;
  if(overshoot>0)weight*=clamp(1-overshoot*1.25,.18,1);
  if(demand>headroom+.28)weight*=.56;
  if((state.pressure||0)>capacity)weight*=pattern.recovery>=1.02 ? 1.42 : (pattern.difficulty>=4 ? .42 : .82);

  const streak=dashRecentActionStreak(state.recentActions||[],firstAction);
  if(streak>=DASH_DIRECTOR_TUNING.repeatSoftLimit+1&&!pattern.rhythmIntent)weight*=.08;
  else if(streak>=DASH_DIRECTOR_TUNING.repeatSoftLimit&&!pattern.rhythmIntent)weight*=.42;
  const lastAction=state.recentActions?.at(-1)||null;
  if(firstAction&&lastAction&&firstAction!==lastAction&&snapshot.actionVariety<.58)weight*=1.28;

  const recentPatterns=state.recentPatterns||[];
  if(recentPatterns.at(-1)===pattern.id)weight*=.58;
  if(recentPatterns.length>=2&&recentPatterns.at(-1)===pattern.id&&recentPatterns.at(-2)===pattern.id)weight*=.18;

  if(pattern.rhythmIntent)weight*=identity.rhythm;
  if(pattern.precision)weight*=identity.precision;
  if(pattern.riskReward||pattern.riskRoute?.reward)weight*=identity.risk;
  if(pattern.focus&&pattern.focus===identity.focus)weight*=1.22;
  if(identity.focus==='intro'&&pattern.difficulty>=4)weight*=.62;
  if(identity.focus==='pressure'&&pattern.difficulty>=4)weight*=1.18;
  if(identity.focus==='mastery'&&pattern.mastery)weight*=1.20;

  const cycleBoost=Math.min(.18,identity.cycle*.035);
  if(identity.cycle>0&&pattern.difficulty>=4)weight*=1+cycleBoost;
  return clamp(weight,.02,2.8);
}

export function advanceDashDirectorState(state,pattern,obstacles=[],{
  normalizedSpeed=0,
  visibility=1,
  stage=1
}={}){
  const target=state||createDashDirectorState();
  const previousAction=target.recentActions?.at(-1)||null;
  const demand=dashPatternPressure(pattern,{normalizedSpeed,visibility,previousAction});
  const recoverySeconds=Math.max(.55,Number(pattern?.recovery)||.8);
  const recoveryCredit=Math.max(0,recoverySeconds-.68)*DASH_DIRECTOR_TUNING.recoveryCredit+
    (pattern?.recoveryClass==='breather' ? 0.11 : 0);
  const retention=DASH_DIRECTOR_TUNING.pressureRetention+clamp(normalizedSpeed,0,1)*.045;
  target.pressure=clamp((target.pressure||0)*retention+demand*DASH_DIRECTOR_TUNING.pressureGain-recoveryCredit,0,1.35);
  target.recovery=clamp(recoverySeconds*(1-demand*.18),.45,1.25);

  const actions=(obstacles.length?obstacles.map(o=>o.action):(pattern?.items||[]).map(item=>ACTION_BY_FAMILY[item[0]])).filter(Boolean);
  if(!target.recentActions)target.recentActions=[];
  for(const action of actions){
    target.recentActions.push(action);
    if(target.recentActions.length>DASH_DIRECTOR_TUNING.historyActions)target.recentActions.shift();
  }
  target.actionVariety=dashActionVariety(target.recentActions);

  if(!target.recentPatterns)target.recentPatterns=[];
  if(pattern?.id)target.recentPatterns.push(pattern.id);
  if(target.recentPatterns.length>DASH_DIRECTOR_TUNING.historyPatterns)target.recentPatterns.shift();

  if(recoverySeconds>=1.12||pattern?.recoveryClass==='breather'){
    target.patternsSinceRecovery=0;
    target.recoverySections=(target.recoverySections||0)+1;
  }else target.patternsSinceRecovery=(target.patternsSinceRecovery||0)+1;

  target.stageIdentity=dashStageIdentity(stage).id;
  return target;
}

export function chooseDashSetPiece(holder,state,{time=0,stage=1,normalizedSpeed=0,visibility=1}={}){
  if(!holder||!state||stage<3||time<(state.nextSetPieceAt??DASH_DIRECTOR_TUNING.firstSetPieceSeconds))return null;
  if((state.pressure||0)>DASH_DIRECTOR_TUNING.setPiecePressureCeiling||visibility<DASH_DIRECTOR_TUNING.setPieceVisibilityFloor)return null;

  const identity=dashStageIdentity(stage);
  const eligible=DASH_SET_PIECES.filter(piece=>piece.minStage<=stage).map(piece=>{
    let weight=piece.weight;
    if(piece.theme.includes('waterfall')&&identity.id==='waterfall-pass')weight*=1.65;
    if(piece.theme.includes('ruin')&&identity.id==='golden-ruins')weight*=1.60;
    if(piece.theme.includes('canopy')&&identity.id==='canopy-run')weight*=1.45;
    if(piece.theme.includes('root')&&identity.id==='ancient-jungle')weight*=1.40;
    if(piece.theme.includes('rolling')&&identity.id==='storm-forest')weight*=1.50;
    return{...piece,weight};
  });
  if(!eligible.length)return null;
  const selected=chooseDashWeighted(holder,eligible);
  const interval=DASH_DIRECTOR_TUNING.setPieceMinInterval+nextDashRandom(holder)*DASH_DIRECTOR_TUNING.setPieceIntervalVariance;
  state.nextSetPieceAt=time+interval;
  state.setPieceCount=(state.setPieceCount||0)+1;
  return{
    id:'setpiece-'+selected.id,
    difficulty:selected.difficulty,
    baseWeight:1,
    minStage:selected.minStage,
    items:selected.items.map(item=>[...item]),
    recovery:1.24,
    recoveryClass:'breather',
    rhythmIntent:true,
    safeRoute:true,
    focus:'pressure',
    setPiece:{id:selected.id,theme:selected.theme,durationSeconds:selected.durationSeconds,index:state.setPieceCount},
    mastery:'mixed'
  };
}
