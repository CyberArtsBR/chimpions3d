export const DASH_EVENTS=Object.freeze({
  jump:'dash:jump',takeoff:'dash:jump',apex:'dash:apex',land:'dash:land',landing:'dash:land',
  slideStart:'dash:slide-start',slideEnter:'dash:slide-start',slideEnd:'dash:slide-end',slideExit:'dash:slide-end',
  obstaclePass:'dash:obstacle-pass',perfectJump:'dash:perfect-jump',perfectSlide:'dash:perfect-slide',nearMiss:'dash:near-miss',
  comboBreak:'dash:combo-break',flowChange:'dash:flow-change',multiplierChange:'dash:multiplier-change',banana:'dash:banana',goldenBanana:'dash:golden-banana',
  stageChange:'dash:stage-change',death:'dash:death',tutorial:'dash:tutorial'
});

export function emitDashEvent(type,detail={}){
  if(typeof globalThis.dispatchEvent!=='function'||typeof globalThis.CustomEvent!=='function')return false;
  globalThis.dispatchEvent(new CustomEvent(type,{detail}));
  return true;
}
