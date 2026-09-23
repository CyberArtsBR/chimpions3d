export const BUILT_IN_CHIMPION_NAMES=Object.freeze([
  "The Archon",
  "The Heretic",
  "The Commodore",
  "The Pioneer",
  "The Punk",
  "The Street Fighter",
  "The Bosun",
  "The Adolescent",
  "The Angsty",
  "The Apologetic"
]);
const NAME_SET=new Set(BUILT_IN_CHIMPION_NAMES);
export function isBuiltInChimpion(entry){return !!entry&&NAME_SET.has(entry.name);}
export function filterBuiltInRoster(entries=[]){const byName=new Map(entries.filter(isBuiltInChimpion).map(entry=>[entry.name,entry]));return BUILT_IN_CHIMPION_NAMES.map(name=>byName.get(name)).filter(Boolean);}
export function fallbackBuiltIn(entries=[]){return filterBuiltInRoster(entries)[0]||null;}
