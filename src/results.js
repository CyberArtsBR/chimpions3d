import {scoreFor,ordinal} from './score.js';
import {leaderboard} from './leaderboard.js';

const formatDuration=value=>{
 const seconds=Math.max(0,Math.round(Number(value)||0)),minutes=Math.floor(seconds/60);
 return minutes?`${minutes}:${String(seconds%60).padStart(2,'0')}`:`0:${String(seconds).padStart(2,'0')}`;
};

export function createResults({retry,replay,choose,back}){
 const dialog=document.createElement('dialog');
 dialog.id='results-dialog';
 dialog.setAttribute('aria-labelledby','results-title');
 dialog.setAttribute('aria-describedby','result-kicker');
 dialog.innerHTML=`<div class="eyebrow">EXPEDITION COMPLETE</div>
  <h2 id="results-title">Your climb</h2>
  <p class="result-kicker" id="result-kicker">Run summary</p>
  <section class="result-hero" aria-label="Climb result">
    <small>HEIGHT</small><strong id="result-height">0 m</strong>
    <p id="result-record" hidden>New Personal Best</p>
  </section>
  <div class="result-stats">
    <div class="result-stat"><small>BANANAS</small><strong id="result-bananas">0</strong></div>
    <div class="result-stat"><small>BEST</small><strong id="result-best">0 m</strong></div>
    <div class="result-stat"><small>CLEAN LANDINGS</small><strong id="result-landings">0</strong></div>
    <div class="result-stat"><small>PERFECT</small><strong id="result-perfect">0</strong></div>
    <div class="result-stat"><small>BEST FLOW</small><strong id="result-flow">×1</strong></div>
    <div class="result-stat"><small>RISK / DANGER</small><strong id="result-risk">0 / 0</strong></div>
    <div class="result-stat"><small>NEAR MISSES</small><strong id="result-near">0</strong></div>
    <div class="result-stat"><small>TIME</small><strong id="result-duration">0:00</strong></div>
  </div>
  <p id="result-goals" class="result-goals" role="status" aria-live="polite"></p>
  <p id="result-route" class="result-route"><span>ROUTE SEED</span><code id="result-seed">—</code></p>
  <details id="score-details" class="result-details">
    <summary>Score details</summary>
    <p id="score-formula"></p>
    <div class="score-conversion"><div><small>FINAL SCORE</small><strong id="converted-score">0</strong></div><span aria-hidden="true">+</span><div><small>MASTERY BONUS</small><strong id="remaining-bananas">0</strong></div></div>
  </details>
  <p id="ranking-status" role="status" aria-live="polite" aria-atomic="true"></p>
  <form id="record-name" hidden><label for="player-name">Your name · max 10 characters</label><div><input id="player-name" maxlength="10" minlength="1" required autocomplete="nickname" placeholder="CHIMPION"><button>Save record</button></div></form>
  <button id="retry-score" hidden>Retry online submission</button>
  <details id="result-records" class="result-details"><summary>All-time Top 10</summary><ol id="result-top"></ol></details>
  <div class="result-actions"><button id="try-again" class="primary" aria-label="Try Again">Retry</button><button id="replay-trail" aria-label="Replay this trail">Replay same route</button><button id="choose-again">Character Select</button><button id="back-to-games">Home</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
 let run,age=0,verified=null,finished=false,generation=0;

 function setSubmissionState(state,text){const node=$('ranking-status');node.dataset.state=state;node.textContent=text;}

 function renderBoard(entries){
  $('result-top').replaceChildren();
  for(const [i,row]of entries.entries()){const li=document.createElement('li');li.textContent=ordinal(i+1)+' · '+row.name+' — '+row.score.toLocaleString();$('result-top').append(li);}
  if(!entries.length){const li=document.createElement('li');li.textContent='No records yet. Be the first!';$('result-top').append(li);}
 }

 function announce(){
  if(!finished||!verified)return;
  if(Number.isFinite(Number(verified.score)))$('converted-score').textContent=Number(verified.score).toLocaleString();
  setSubmissionState('success',verified.rank?`SCORE SUBMITTED · ${ordinal(verified.rank)} place`:`SCORE SUBMITTED · ${verified.score.toLocaleString()} points`);
  $('record-name').hidden=!verified.rank;
 }

 async function submit(){
  const ticket=generation;$('retry-score').hidden=true;$('record-name').hidden=true;
  if(!run.id){setSubmissionState('offline','OFFLINE RUN · score kept locally; online records unavailable.');return;}
  setSubmissionState('submitting','SUBMITTING SCORE…');
  try{
   const result=await leaderboard.finish(run.id,run.trace);if(ticket!==generation)return;verified=result;renderBoard(result.entries);if(result.rank)dispatchEvent(new Event('chimp-record'));announce();
  }catch(error){
   if(ticket!==generation)return;setSubmissionState('error','SCORE SUBMISSION FAILED · '+error.message);$('retry-score').hidden=false;
  }
 }

 $('retry-score').onclick=submit;
 $('record-name').onsubmit=async event=>{
  event.preventDefault();const ticket=generation,button=$('record-name').querySelector('button');button.disabled=true;
  try{
   const result=await leaderboard.name(run.id,$('player-name').value);if(ticket!==generation)return;renderBoard(result.entries);$('record-name').hidden=true;setSubmissionState('success','SCORE SUBMITTED · '+ordinal(result.rank)+' place record saved.');
  }catch(error){if(ticket===generation)setSubmissionState('error','SCORE SUBMISSION FAILED · '+error.message);}
  finally{if(ticket===generation)button.disabled=false;}
 };
 $('try-again').onclick=()=>{generation++;dialog.close();retry();};
 $('replay-trail').onclick=()=>{generation++;const seed=run?.seed;dialog.close();replay?.(seed);};
 $('choose-again').onclick=()=>{generation++;dialog.close();choose();};
 $('back-to-games').onclick=()=>{generation++;dialog.close();back();};
 dialog.addEventListener('cancel',event=>{event.preventDefault();$('back-to-games')?.focus({preventScroll:true});});

 function finishScoreAnimation(){
  const total=scoreFor(run.meters,run.bananas,run.skillBonus);
  $('converted-score').textContent=total.toLocaleString();
  $('remaining-bananas').textContent=Math.max(0,Math.floor(Number(run.skillBonus)||0)).toLocaleString();
  finished=true;announce();
 }

 return {
  open(result){
   generation++;run=result;age=0;finished=false;verified=null;
   const meters=Math.floor(Number(result.meters)||0),bananas=Math.max(0,Number(result.bananas)||0),best=Math.floor(Number(result.best)||meters);
   const landings=Math.max(0,Math.floor(Number(result.cleanLandings)||0)),skillBonus=Math.max(0,Math.floor(Number(result.skillBonus)||0));
   const perfect=Math.max(0,Math.floor(Number(result.perfectLandings)||0)),near=Math.max(0,Math.floor(Number(result.nearMisses)||0));
   const risk=Math.max(0,Math.floor(Number(result.riskLandings)||0)),danger=Math.max(0,Math.floor(Number(result.dangerLandings)||0));
   const bestFlow=Math.max(1,Number(result.bestFlow)||1),seed=Number(result.seed),goals=result.goals||{};
   dialog.dataset.newBest=String(!!result.newBest);$('result-record').hidden=!result.newBest;
   $('result-height').textContent=meters.toLocaleString()+' m';
   $('result-bananas').textContent=bananas.toLocaleString();
   $('result-duration').textContent=formatDuration(result.duration);
   $('result-best').textContent=best.toLocaleString()+' m';
   $('result-landings').textContent=landings.toLocaleString();
   $('result-perfect').textContent=perfect.toLocaleString();
   $('result-flow').textContent='×'+String(bestFlow).replace('.0','');
   $('result-risk').textContent=risk.toLocaleString()+' / '+danger.toLocaleString();
   $('result-near').textContent=near.toLocaleString();
   $('result-seed').textContent=Number.isFinite(seed)?String(seed>>>0):'—';
   const completed=Math.max(0,Number(goals.completed)||0),totalGoals=Math.max(completed,Number(goals.total)||0),newGoals=Array.isArray(goals.newlyUnlocked)?goals.newlyUnlocked:[];
   $('result-goals').textContent=totalGoals?('GOALS · '+completed+' / '+totalGoals+(newGoals.length?' · NEW: '+newGoals.join(' + '):'')):'';
   $('result-goals').hidden=!totalGoals;
   $('replay-trail').hidden=!Number.isFinite(seed);
   $('record-name').hidden=true;$('record-name').querySelector('button').disabled=false;$('player-name').value='';
   $('score-formula').textContent='ALTITUDE '+meters.toLocaleString()+' · BANANAS '+bananas+' × 10 · MASTERY +'+skillBonus.toLocaleString();
   $('converted-score').textContent=String(meters);$('remaining-bananas').textContent=String(skillBonus);
   $('try-again').disabled=$('choose-again').disabled=false;
   $('score-details').open=false;$('result-records').open=false;
   renderBoard([]);setSubmissionState(result.id?'submitting':'offline',result.id?'SUBMITTING SCORE…':'OFFLINE RUN · score kept locally; online records unavailable.');
   dialog.showModal();requestAnimationFrame(()=>$('try-again')?.focus({preventScroll:true}));
   if(document.body.dataset.reducedMotion==='true')finishScoreAnimation();
   submit();
  },
  update(dt){
   if(!dialog.open||finished)return;
   age+=dt;const t=Math.min(age/.9,1),ease=1-(1-t)**3,total=scoreFor(run.meters,run.bananas,run.skillBonus),initial=run.meters;
   $('converted-score').textContent=Math.round(initial+(total-initial)*ease).toLocaleString();$('remaining-bananas').textContent=Math.round(Number(run.skillBonus)||0).toLocaleString();
   if(t===1)finishScoreAnimation();
  },
  get isOpen(){return dialog.open;}
 };
}

export function createRecordBook(){
 const dialog=document.createElement('dialog');dialog.id='record-book';dialog.setAttribute('aria-labelledby','record-book-title');dialog.innerHTML='<header><h2 id="record-book-title">All-time records</h2><button aria-label="Close records">×</button></header><p role="status" aria-live="polite"></p><ol></ol><button id="older-records">Older records</button>';document.body.append(dialog);let offset=0,ticket=0,opener=null;
 dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{const target=opener;opener=null;if(target?.isConnected)target.focus({preventScroll:true});});
 async function load(){const current=++ticket,more=dialog.querySelector('#older-records'),status=dialog.querySelector('p');more.disabled=true;status.textContent='Loading records…';try{const result=await leaderboard.records(offset);if(current!==ticket)return;for(const row of result.entries){const li=document.createElement('li');li.textContent=row.name+' · '+row.score.toLocaleString()+' points · '+row.meters+' m · '+row.bananas+' bananas';dialog.querySelector('ol').append(li);}offset+=result.entries.length;more.hidden=result.entries.length<20;status.textContent=offset?'Named records are kept even after leaving the Top 10.':'No records yet.';}catch(error){if(current===ticket)status.textContent=error.message;}finally{if(current===ticket)more.disabled=false;}}
 dialog.querySelector('#older-records').onclick=load;
 return {open(){opener=document.activeElement;offset=0;dialog.querySelector('ol').replaceChildren();dialog.querySelector('#older-records').hidden=false;dialog.showModal();requestAnimationFrame(()=>dialog.querySelector('header button')?.focus({preventScroll:true}));load();},get isOpen(){return dialog.open;}};
}