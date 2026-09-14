export const scoreFor=(meters,bananas)=>Math.max(0,Math.floor(meters))+Math.max(0,Math.floor(bananas))*10;
export const ordinal=n=>n+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
