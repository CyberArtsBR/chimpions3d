export const DASH_EVENTS=Object.freeze({
  jump:'dash:jump',apex:'dash:apex',land:'dash:land',slideStart:'dash:slide-start',slideEnd:'dash:slide-end',
  obstaclePass:'dash:obstacle-pass',perfectJump:'dash:perfect-jump',perfectSlide:'dash:perfect-slide',perfectChain:'dash:perfect-chain',nearMiss:'dash:near-miss',
  riskLine:'dash:risk-line',comboBreak:'dash:combo-break',flowChange:'dash:flow-change',multiplierChange:'dash:multiplier-change',
  banana:'dash:banana',goldenBanana:'dash:golden-banana',
  setPieceQueued:'dash:set-piece-queued',setPieceStart:'dash:set-piece-start',setPieceEnd:'dash:set-piece-end',flowSave:'dash:flow-save',
  stageChange:'dash:stage-change',death:'dash:death',tutorial:'dash:tutorial'
});

export function emitDashEvent(type,detail={}){
  if(typeof globalThis.dispatchEvent!=='function'||typeof globalThis.CustomEvent!=='function')return false;
  globalThis.dispatchEvent(new CustomEvent(type,{detail}));
  return true;
}
