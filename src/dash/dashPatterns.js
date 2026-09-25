import {dashDifficultySnapshot,dashPlanningSpeed} from './dashDifficulty.js';
import {chooseDashWeighted,dashRandomInt} from './dashSeed.js';
import {dashJumpArcProfiles,DASH_PHYSICS} from './dashPhysics.js';

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

const PATTERNS=Object.freeze([
 {id:'easy-hop',difficulty:1,baseWeight:4.6,minStage:1,items:[['short',0]],recovery:.75},
 {id:'stage-one-long-jump',difficulty:2,baseWeight:2.1,minStage:1,maxStage:1,items:[['wide',0]],recovery:1.04},
 {id:'high-wall',difficulty:2,baseWeight:3,minStage:2,items:[['high',0]],recovery:.95},
 {id:'wide-leap',difficulty:2,baseWeight:3.2,minStage:1,items:[['wide',0]],recovery:1.03},
 {id:'duck-under',difficulty:2,baseWeight:4,minStage:2,items:[['overhead',0]],recovery:.78},
 {id:'choice-line',difficulty:3,baseWeight:2.1,minStage:4,items:[['flex',0]],recovery:.82,riskReward:true},
 {id:'quick-hop-high',difficulty:3,baseWeight:2.4,minStage:2,items:[['short',0],['high',.88]],recovery:.98},
 {id:'duck-then-hop',difficulty:3,baseWeight:2.8,minStage:3,items:[['overhead',0],['short',.84]],recovery:.92},
 {id:'slide-gauntlet',difficulty:3,baseWeight:3.2,minStage:4,items:[['overhead',0],['overhead',.90]],recovery:.86},
 {id:'hop-then-duck',difficulty:4,baseWeight:2.2,minStage:4,items:[['short',0],['overhead',.98]],recovery:.96},
 {id:'double-rhythm',difficulty:4,baseWeight:1.4,minStage:5,items:[['short',0],['short',.82]],recovery:.90},
 {id:'wide-into-slide',difficulty:4,baseWeight:2.1,minStage:5,items:[['wide',0],['overhead',1.05]],recovery:.98},
 {id:'high-into-slide',difficulty:4,baseWeight:2.1,minStage:5,items:[['high',0],['overhead',.96]],recovery:.96},
 {id:'beam-pressure',difficulty:5,baseWeight:1.8,minStage:6,items:[['overhead',0],['short',.90],['overhead',.92]],recovery:.94},
 {id:'triple-rhythm',difficulty:5,baseWeight:1,minStage:7,items:[['short',0],['overhead',.92],['wide',1.02]],recovery:1}
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
    'jump-or-slide>slide':.64
  }),
  chainExtra:Object.freeze({2:.05,3:.10}),
  visibilityFloor:.42
});

export function dashPatternCatalog(snapshot){
  const {stage,maxPatternDifficulty}=snapshot;
  return PATTERNS.filter(p=>p.minStage<=stage&&(!p.maxStage||stage<=p.maxStage)&&p.difficulty<=maxPatternDifficulty).map(p=>{
    let weight=p.baseWeight;
    if(p.id==='duck-under'&&stage>=5)weight=6;
    if(p.id==='wide-leap'&&stage===1)weight=1.4;
    if(p.difficulty>=4&&snapshot.effectiveDifficulty<3.6)weight*=.35;
    return{...p,weight};
  });
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

export function chooseDashPattern(holder,{time,previousDifficulty=1,recentPressure=0,recentRecovery=1,recentActionVariety=.5}={}){
  const snapshot=dashDifficultySnapshot({time,previousDifficulty,recentPressure,recentRecovery,recentActionVariety});
  let options=dashPatternCatalog(snapshot);
  if(previousDifficulty>=4)options=options.filter(p=>p.difficulty<=2.5);
  const pattern=chooseDashWeighted(holder,options);
  return{pattern,snapshot};
}

export function planDashPattern(holder,{time,spawnX,currentScroll=0,playerX=DASH_PHYSICS.playerX,previousDifficulty=1}={}){
  const {pattern,snapshot}=chooseDashPattern(holder,{time,previousDifficulty});
  const obstacles=[];
  let x=spawnX;
  for(let i=0;i<pattern.items.length;i++){
    const [family,requested]=pattern.items[i];
    const type=chooseDashObstacle(holder,{family,difficulty:pattern.difficulty,stage:snapshot.stage});
    if(i){
      const previous=obstacles[obstacles.length-1];
      const speed=dashPlanningSpeed({runTime:time,worldDistance:x,currentScroll,playerX});
      x=previous.x+previous.w+dashTransitionGapDistance(previous,type,{speed,chainLength:pattern.items.length,requested});
    }
    obstacles.push({...type,x});
  }
  const last=obstacles[obstacles.length-1];
  const recoverySpeed=dashPlanningSpeed({runTime:time,worldDistance:last?.x||x,currentScroll,playerX});
  const recoverySeconds=Math.max(1.02,pattern.recovery+.28);
  const nextSpawn=(last?.x||x)+(last?.w||0)+recoverySpeed*recoverySeconds;
  return{pattern,snapshot,obstacles,nextSpawn,recoverySeconds};
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
