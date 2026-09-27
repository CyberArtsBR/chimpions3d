import {dashDifficultySnapshot,dashPlanningSpeed} from './dashDifficulty.js';
import {chooseDashWeighted,dashRandomInt} from './dashSeed.js';
import {dashJumpArcProfiles,DASH_PHYSICS} from './dashPhysics.js';
import {
  createDashDirectorState,
  dashPatternWeightModifier,
  advanceDashDirectorState,
  chooseDashSetPiece
} from './dashDirector.js';

export const DASH_OBSTACLE_TYPES=Object.freeze([
 {id:'log',name:'fallen log',family:'short',action:'jump',w:64,h:38,boxes:[[9,0,46,28]],minStage:1,difficulty:1,recovery:.58},
 {id:'mushroom',name:'mushrooms',family:'short',action:'jump',w:58,h:38,boxes:[[11,0,36,27]],minStage:1,difficulty:1,recovery:.58},
 {id:'thorns',name:'thorn bush',family:'short',action:'jump',w:60,h:44,boxes:[[11,1,38,31]],minStage:2,difficulty:2,recovery:.62},
 {id:'stump',name:'tree stump',family:'high',action:'high-jump',w:58,h:98,boxes:[[7,0,44,84]],minStage:2,difficulty:2,recovery:.82},
 {id:'spike',name:'spike plant',family:'high',action:'high-jump',w:55,h:94,boxes:[[8,0,39,76]],minStage:3,difficulty:3,recovery:.84},
 {id:'log-pile',name:'log pile',family:'wide',action:'high-jump',w:138,h:40,boxes:[[7,0,124,19]],minStage:1,difficulty:2,recovery:.95},
 {id:'puddle',name:'wide puddle',family:'wide',action:'high-jump',w:132,h:24,boxes:[[3,0,126,12]],minStage:2,difficulty:2,recovery:.95},
 {id:'spike-patch',name:'wide spikes',family:'wide',action:'high-jump',w:148,h:38,boxes:[[5,0,138,22]],minStage:3,difficulty:3,recovery:1},
 {id:'branch',name:'hanging branch',family:'overhead',action:'slide',w:115,h:78,boxes:[[5,52,105,22]],minStage:2,difficulty:2,recovery:.62},
 {id:'vine',name:'hanging vines',family:'overhead',action:'slide',w:96,h:82,boxes:[[7,50,82,25]],minStage:3,difficulty:2,recovery:.66},
 {id:'canopy',name:'fallen canopy',family:'flex',action:'jump-or-slide',w:98,h:74,boxes:[[5,49,88,20]],minStage:4,difficulty:3,recovery:.72}
]);

export const DASH_PATTERN_DEFINITIONS=Object.freeze([
 {id:'easy-hop',difficulty:1,baseWeight:4.2,minStage:1,items:[['short',0]],recovery:.82,focus:'intro'},
 {id:'breather-hop',difficulty:1,baseWeight:1.35,minStage:1,items:[['short',0]],recovery:1.18,recoveryClass:'breather',focus:'intro'},
 {id:'stage-one-long-jump',difficulty:2,baseWeight:2.0,minStage:1,maxStage:1,items:[['wide',0]],recovery:1.08,mastery:'hold',focus:'airtime'},
 {id:'tap-landing',difficulty:2,baseWeight:1.7,minStage:1,items:[['short',0]],recovery:.94,mastery:'tap',precision:true,focus:'precision',safeRoute:true,riskRoute:{kind:'precision-landing',reward:'banana'}},
 {id:'high-wall',difficulty:2,baseWeight:2.9,minStage:2,items:[['high',0]],recovery:.98,mastery:'hold'},
 {id:'wide-leap',difficulty:2,baseWeight:2.9,minStage:1,items:[['wide',0]],recovery:1.06,mastery:'hold',focus:'airtime'},
 {id:'duck-under',difficulty:2,baseWeight:3.7,minStage:2,items:[['overhead',0]],recovery:.82,focus:'transitions'},
 {id:'low-low-rhythm',difficulty:2,baseWeight:1.8,minStage:2,items:[['short',0],['short',.74]],recovery:.96,rhythmIntent:true,mastery:'tap',focus:'intro'},
 {id:'choice-line',difficulty:3,baseWeight:2.0,minStage:4,items:[['flex',0]],recovery:.88,riskReward:true,safeRoute:true,riskRoute:{kind:'high-arc',reward:'flow'},focus:'risk'},
 {id:'low-to-high',difficulty:3,baseWeight:2.35,minStage:2,items:[['short',0],['high',.88]],recovery:1.00,mastery:'transition',focus:'precision'},
 {id:'high-to-low',difficulty:3,baseWeight:1.85,minStage:3,items:[['high',0],['short',.98]],recovery:1.04,mastery:'hold',precision:true,focus:'precision'},
 {id:'duck-then-hop',difficulty:3,baseWeight:2.55,minStage:3,items:[['overhead',0],['short',.84]],recovery:.96,mastery:'transition',focus:'transitions'},
 {id:'slide-to-high',difficulty:3,baseWeight:2.05,minStage:3,items:[['overhead',0],['high',.88]],recovery:1.02,mastery:'transition',focus:'transitions'},
 {id:'slide-gauntlet',difficulty:3,baseWeight:2.35,minStage:4,items:[['overhead',0],['overhead',.90]],recovery:.90,rhythmIntent:true,focus:'transitions'},
 {id:'wide-recovery',difficulty:3,baseWeight:1.45,minStage:4,items:[['wide',0]],recovery:1.24,recoveryClass:'breather',mastery:'hold',focus:'airtime'},
 {id:'risk-arc',difficulty:3,baseWeight:1.4,minStage:5,items:[['flex',0]],recovery:.92,riskReward:true,safeRoute:true,riskRoute:{kind:'high-arc',reward:'golden'},precision:true,focus:'risk'},
 {id:'hop-then-duck',difficulty:4,baseWeight:2.0,minStage:4,items:[['short',0],['overhead',.98]],recovery:1.00,mastery:'tap',focus:'transitions'},
 {id:'tap-then-slide',difficulty:4,baseWeight:1.35,minStage:4,items:[['short',0],['overhead',1.05]],recovery:1.02,mastery:'tap',precision:true,focus:'precision',safeRoute:true,riskRoute:{kind:'precision-landing',reward:'banana'}},
 {id:'double-rhythm',difficulty:4,baseWeight:1.45,minStage:5,items:[['short',0],['short',.82]],recovery:.94,rhythmIntent:true,mastery:'tap'},
 {id:'low-low-slide',difficulty:4,baseWeight:1.2,minStage:5,items:[['short',0],['short',.80],['overhead',.96]],recovery:1.02,rhythmIntent:true,mastery:'tap',focus:'pressure'},
 {id:'wide-into-slide',difficulty:4,baseWeight:1.9,minStage:5,items:[['wide',0],['overhead',1.05]],recovery:1.04,mastery:'transition',focus:'airtime'},
 {id:'high-into-slide',difficulty:4,baseWeight:1.9,minStage:5,items:[['high',0],['overhead',.96]],recovery:1.02,mastery:'transition',focus:'transitions'},
 {id:'slide-to-wide',difficulty:4,baseWeight:1.55,minStage:5,items:[['overhead',0],['wide',.94]],recovery:1.08,mastery:'transition',focus:'airtime'},
 {id:'high-precision-landing',difficulty:4,baseWeight:1.25,minStage:5,items:[['high',0],['short',1.08]],recovery:1.08,mastery:'hold',precision:true,focus:'precision',safeRoute:true,riskRoute:{kind:'precision-landing',reward:'golden'}},
 {id:'jump-slide-jump',difficulty:4,baseWeight:1.15,minStage:5,items:[['short',0],['overhead',.98],['short',.90]],recovery:1.03,rhythmIntent:true,mastery:'mixed',focus:'transitions'},
 {id:'beam-pressure',difficulty:5,baseWeight:1.45,minStage:6,items:[['overhead',0],['short',.90],['overhead',.92]],recovery:.98,rhythmIntent:true,mastery:'mixed',focus:'pressure'},
 {id:'triple-rhythm',difficulty:5,baseWeight:1.05,minStage:7,items:[['short',0],['overhead',.92],['wide',1.02]],recovery:1.04,rhythmIntent:true,mastery:'mixed',focus:'mastery'},
 {id:'moonlit-mix',difficulty:5,baseWeight:.90,minStage:7,items:[['high',0],['short',.98],['overhead',1.02],['wide',1.12]],recovery:1.10,mastery:'mixed',precision:true,focus:'mastery'},
 {id:'expert-choice-chain',difficulty:5,baseWeight:.76,minStage:7,items:[['flex',0],['short',.94],['overhead',1.02]],recovery:1.08,riskReward:true,safeRoute:true,riskRoute:{kind:'high-arc',reward:'golden'},mastery:'mixed',focus:'risk'}
]);

export const DASH_REACTION_CONTRACT=Object.freeze({
  base:Object.freeze({jump:.46,'high-jump':.60,slide:.50,'jump-or-slide':.48}),
  transitions:Object.freeze({
    'jump>jump':.58,
    'jump>high-jump':.72,
    'high-jump>jump':.74,
    'high-jump>high-jump':.84,
    'jump>slide':.76,
    'high-jump>slide':.88,
    'slide>jump':.72,
    'slide>high-jump':.84,
    'slide>slide':.60,
    'jump-or-slide>jump':.68,
    'jump-or-slide>slide':.64,
    'jump-or-slide>high-jump':.76,
    'high-jump>jump-or-slide':.78,
    'slide>jump-or-slide':.72
  }),
  chainExtra:Object.freeze({2:.05,3:.10}),
  visibilityFloor:.42
});

const ACTION_BY_FAMILY=Object.freeze({short:'jump',high:'high-jump',wide:'high-jump',overhead:'slide',flex:'jump-or-slide'});

function transientDirector({recentPressure=0,recentRecovery=1,recentActionVariety=.5,previousAction=null}={}){
  const state=createDashDirectorState();
  state.pressure=recentPressure;
  state.recovery=recentRecovery;
  state.actionVariety=recentActionVariety;
  if(previousAction)state.recentActions=[previousAction];
  return state;
}

export function dashPatternCatalog(snapshot,directorState=null){
  const {stage,maxPatternDifficulty}=snapshot;
  const state=directorState||transientDirector({
    recentPressure:snapshot.pressure,
    recentRecovery:snapshot.recentRecovery,
    recentActionVariety:snapshot.recentActionVariety,
    previousAction:snapshot.previousAction
  });
  return DASH_PATTERN_DEFINITIONS
    .filter(p=>p.minStage<=stage&&(!p.maxStage||stage<=p.maxStage)&&p.difficulty<=maxPatternDifficulty)
    .map(p=>{
      let weight=p.baseWeight;
      const firstAction=ACTION_BY_FAMILY[p.items[0]?.[0]]||null;
      if(p.id==='duck-under'&&stage>=5)weight*=1.22;
      if(p.id==='wide-leap'&&stage===1)weight*=.72;
      if(p.difficulty>=4&&snapshot.effectiveDifficulty<3.6)weight*=.42;
      if(snapshot.visibility<.9&&p.difficulty>=4)weight*=.68;
      weight*=dashPatternWeightModifier({...p,firstAction},{state,snapshot});
      return{...p,firstAction,weight};
    });
}

export function requiredDashWarningTime(next){
  const c=DASH_REACTION_CONTRACT;
  return Math.max(c.visibilityFloor,c.base[next?.action]??c.visibilityFloor);
}

export function dashWarningReport(next,{speed,viewportWidth,playerX=DASH_PHYSICS.playerX,obstacleWidth=0}={}){
  const anticipationInset=Math.min(48,Math.max(0,obstacleWidth)*.25);
  const visibleDistance=Math.max(0,viewportWidth-playerX-anticipationInset);
  const available=visibleDistance/Math.max(1,speed);
  const required=requiredDashWarningTime(next);
  return{available,required,visibleDistance,ok:available+1e-9>=required};
}

export function requiredDashReactionTime(previous,next,{chainLength=1,requested=0}={}){
  const c=DASH_REACTION_CONTRACT;
  const base=c.base[next?.action]??c.visibilityFloor;
  if(!previous)return Math.max(base,requested,c.visibilityFloor);
  const key=`${previous.action}>${next.action}`;
  const transition=c.transitions[key]??Math.max(base,previous.recovery||0);
  const extra=c.chainExtra[Math.min(3,Math.max(1,chainLength))]||0;
  return Math.max(requested,base,transition,previous.recovery||0)+extra;
}

export function dashTransitionGapDistance(previous,next,{speed,chainLength=1,requested=0}={}){
  return Math.max(0,speed)*requiredDashReactionTime(previous,next,{chainLength,requested});
}

export function dashTransitionReport(previous,next,{gapDistance,speed,chainLength=1,requested=0}={}){
  const required=requiredDashReactionTime(previous,next,{chainLength,requested});
  const available=gapDistance/Math.max(1,speed);
  return{available,required,ok:available+1e-9>=required,previousAction:previous?.action||null,nextAction:next?.action||null};
}

export function chooseDashObstacle(holder,{family,difficulty,stage}){
  const list=DASH_OBSTACLE_TYPES.filter(t=>t.family===family&&t.minStage<=stage&&t.difficulty<=difficulty+1);
  return list[dashRandomInt(holder,list.length)]||DASH_OBSTACLE_TYPES[0];
}

export function chooseDashPattern(holder,{
  time,
  previousDifficulty=1,
  previousAction=null,
  recentPressure=0,
  recentRecovery=1,
  recentActionVariety=.5,
  visibility=1,
  directorState=null,
  allowSetPiece=true
}={}){
  const state=directorState||transientDirector({recentPressure,recentRecovery,recentActionVariety,previousAction});
  const snapshot=dashDifficultySnapshot({
    time,previousDifficulty,previousAction,
    recentPressure:state.pressure??recentPressure,
    recentRecovery:state.recovery??recentRecovery,
    recentActionVariety:state.actionVariety??recentActionVariety,
    visibility
  });
  if(allowSetPiece){
    const setPiece=chooseDashSetPiece(holder,state,{
      time,stage:snapshot.stage,normalizedSpeed:snapshot.normalizedSpeed,visibility:snapshot.visibility
    });
    if(setPiece)return{pattern:setPiece,snapshot,directorState:state};
  }
  const options=dashPatternCatalog(snapshot,state);
  const pattern=chooseDashWeighted(holder,options);
  return{pattern,snapshot,directorState:state};
}

export function planDashPattern(holder,{
  time,
  spawnX,
  currentScroll=0,
  playerX=DASH_PHYSICS.playerX,
  previousDifficulty=1,
  previousAction=null,
  recentPressure=0,
  recentRecovery=1,
  recentActionVariety=.5,
  visibility=1,
  directorState=null,
  allowSetPiece=true
}={}){
  const state=directorState||transientDirector({recentPressure,recentRecovery,recentActionVariety,previousAction});
  const {pattern,snapshot}=chooseDashPattern(holder,{
    time,previousDifficulty,previousAction,recentPressure,recentRecovery,recentActionVariety,
    visibility,directorState:state,allowSetPiece
  });
  if(!pattern)return{pattern:null,snapshot,obstacles:[],nextSpawn:spawnX,recoverySeconds:1,directorState:state};

  const obstacles=[];
  let x=spawnX;
  for(let i=0;i<pattern.items.length;i++){
    const [family,requested]=pattern.items[i];
    const type=chooseDashObstacle(holder,{family,difficulty:pattern.difficulty,stage:snapshot.stage});
    let transitionSpeed=null;
    if(i){
      const previous=obstacles[obstacles.length-1];
      transitionSpeed=dashPlanningSpeed({runTime:time,worldDistance:previous.x+previous.w,currentScroll,playerX});
      x=previous.x+previous.w+dashTransitionGapDistance(previous,type,{speed:transitionSpeed,chainLength:pattern.items.length,requested});
    }
    obstacles.push({...type,x,transitionSpeed});
  }
  const last=obstacles[obstacles.length-1];
  const recoverySpeed=dashPlanningSpeed({runTime:time,worldDistance:(last?.x||x)+(last?.w||0),currentScroll,playerX});
  const recoverySeconds=Math.max(1.02,pattern.recovery+.28);
  const nextSpawn=(last?.x||x)+(last?.w||0)+recoverySpeed*recoverySeconds;
  advanceDashDirectorState(state,pattern,obstacles,{
    normalizedSpeed:snapshot.normalizedSpeed,visibility:snapshot.visibility,stage:snapshot.stage
  });
  return{pattern,snapshot,obstacles,nextSpawn,recoverySeconds,directorState:state};
}

export function validateDashObstacleGeometry(){
  const arcs=dashJumpArcProfiles();
  const tapApex=arcs.tap.apex;
  const fullApex=arcs.full.apex;
  const issues=[];
  for(const type of DASH_OBSTACLE_TYPES){
    const top=Math.max(...type.boxes.map(b=>b[1]+b[3]));
    if(type.family==='short'&&top+8>tapApex)issues.push(`${type.id}: tap apex ${tapApex.toFixed(2)} below required ${top+8}`);
    if((type.family==='high'||type.family==='wide')&&top+8>fullApex)issues.push(`${type.id}: held apex ${fullApex.toFixed(2)} below required ${top+8}`);
    if(type.family==='overhead'){
      const bottom=Math.min(...type.boxes.map(b=>b[1]));
      if(bottom<DASH_PHYSICS.colliderBottom+DASH_PHYSICS.slidingHeight+6)issues.push(`${type.id}: slide clearance ${bottom} too low`);
      if(bottom>DASH_PHYSICS.colliderBottom+DASH_PHYSICS.standingHeight)issues.push(`${type.id}: standing collider would pass beneath hazard`);
    }
  }
  return issues;
}
