export function hashDashSeed(value){
  let h=2166136261;
  for(const c of String(value)){
    h^=c.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0||1;
}

export function normalizeDashSeed(value){
  if(Number.isInteger(value)&&value>0)return value>>>0||1;
  return hashDashSeed(value);
}

export function nextDashRandom(holder){
  let t=holder.seedState=(holder.seedState+0x6D2B79F5)>>>0;
  t=Math.imul(t^t>>>15,t|1);
  t^=t+Math.imul(t^t>>>7,t|61);
  return((t^t>>>14)>>>0)/4294967296;
}

export function dashRandomInt(holder,maxExclusive){
  if(!Number.isInteger(maxExclusive)||maxExclusive<=0)throw new RangeError('maxExclusive must be a positive integer');
  return Math.floor(nextDashRandom(holder)*maxExclusive);
}

export function chooseDashWeighted(holder,list,weightKey='weight'){
  if(!list.length)return null;
  let total=0;
  for(const item of list)total+=Math.max(0,Number(item[weightKey])||0);
  if(total<=0)return list[0];
  let roll=nextDashRandom(holder)*total;
  for(const item of list){
    roll-=Math.max(0,Number(item[weightKey])||0);
    if(roll<=0)return item;
  }
  return list[list.length-1];
}
