export const JUMP_GOALS=Object.freeze([
  {id:'height-25',title:'Canopy Scout',description:'Reach 25 m',test:s=>s.meters>=25},
  {id:'height-100',title:'High Climber',description:'Reach 100 m',test:s=>s.meters>=100},
  {id:'bananas-10',title:'Banana Pocket',description:'Collect 10 bananas in one run',test:s=>s.bananas>=10},
  {id:'bananas-25',title:'Banana Haul',description:'Collect 25 bananas in one run',test:s=>s.bananas>=25},
  {id:'landings-12',title:'Sure Footed',description:'Make 12 clean branch landings',test:s=>s.cleanLandings>=12},
  {id:'landings-30',title:'Canopy Rhythm',description:'Make 30 clean branch landings',test:s=>s.cleanLandings>=30}
]);

export function evaluateJumpGoals(stats,unlocked=[]){
  const known=new Set(unlocked);
  const achieved=JUMP_GOALS.filter(goal=>goal.test(stats||{})).map(goal=>goal.id);
  const newlyUnlocked=achieved.filter(id=>!known.has(id));
  for(const id of achieved)known.add(id);
  return {unlocked:[...known],newlyUnlocked};
}
