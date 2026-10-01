export const scoreFor=(meters,bananas,skillBonus=0)=>
 Math.max(0,Math.floor(meters))+
 Math.max(0,Math.floor(bananas))*10+
 Math.max(0,Math.floor(skillBonus));

export const scoreBreakdown=(meters,bananas,skillBonus=0)=>Object.freeze({
 altitude:Math.max(0,Math.floor(meters)),
 bananas:Math.max(0,Math.floor(bananas))*10,
 skill:Math.max(0,Math.floor(skillBonus)),
 total:scoreFor(meters,bananas,skillBonus)
});

export const ordinal=n=>n+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
