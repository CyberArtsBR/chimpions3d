export const RAIN_LEVEL_HEIGHT=220;

export function rainLevelAt(height=0){
  return Math.max(0,Math.floor(Math.max(0,Number(height)||0)/RAIN_LEVEL_HEIGHT));
}

export function rainProfileAt(height=0,biome=0,blend=1){
  const level=rainLevelAt(height);
  const active=level%5===1||level%5===4;
  const current=((Number(biome)||0)%4+4)%4;
  const previous=(current+3)%4;
  const t=Math.max(0,Math.min(1,Number(blend)||0));
  const wetness=[.38,1,.24,.72];
  const intensity=active?(wetness[current]*t+wetness[previous]*(1-t)):0;
  return Object.freeze({level,active,intensity});
}
