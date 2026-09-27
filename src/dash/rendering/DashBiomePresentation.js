const KEYS=[
  'giantTrees','roots','elevatedCanopy','vines','temple','arches','brokenWalls',
  'waterCliffs','bridges','monument','wetness','darkCanopy','emissiveFlora','framing'
];

const value=(profile,key)=>Number(profile?.structure?.[key]??0);

export function createBiomePresentationState(){
  const state={};
  for(const key of KEYS)state[key]=0;
  return state;
}

export function blendBiomePresentation(out,from,to,t){
  for(const key of KEYS){
    const a=value(from,key),b=value(to,key);
    out[key]=a+(b-a)*t;
  }
  return out;
}

export const DASH_PRESENTATION_KEYS=Object.freeze([...KEYS]);
