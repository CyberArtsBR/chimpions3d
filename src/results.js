import {scoreFor,ordinal} from './score.js';
import {leaderboard} from './leaderboard.js';

export function createResults({retry,choose}){
 const dialog=document.createElement('dialog');dialog.id='results-dialog';
 dialog.innerHTML=`<div class="eyebrow">THE CLIMB IS OVER</div><h2>Your expedition</h2><p id="score-formula"></p><div class="score-conversion"><div><small>POINTS</small><strong id="converted-score">0</strong></div><span>×</span><div><small>BANANAS LEFT</small><strong id="remaining-bananas">0</strong></div></div><p id="ranking-status" role="status"></p><form id="record-name" hidden><label for="player-name">Your name · max 10 characters</label><div><input id="player-name" maxlength="10" minlength="1" required autocomplete="nickname" placeholder="CHIMPION"><button>Save record</button></div></form><button id="retry-score" hidden>Retry online submission</button><h3>All-time Top 10</h3><ol id="result-top"></ol><div class="result-actions"><button id="try-again" class="primary">Try Again</button><button id="choose-again">Choose your Chimpion</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
 let run,age=0,verified=null,finished=false,generation=0;
 function renderBoard(entries){$('result-top').replaceChildren();for(const [i,row]of entries.entries()){const li=document.createElement('li');li.textContent=ordinal(i+1)+' · '+row.name+' — '+row.score.toLocaleString();$('result-top').append(li);}if(!entries.length){const li=document.createElement('li');li.textContent='No records yet. Be the first!';$('result-top').append(li);}}
 function announce(){if(!finished||!verified)return;$('ranking-status').textContent=verified.rank?'Congratulations! You got '+ordinal(verified.rank)+' place!':'Final score: '+verified.score.toLocaleString();$('record-name').hidden=!verified.rank;}
 async function submit(){const ticket=generation;$('retry-score').hidden=true;$('ranking-status').textContent='Checking your online placement…';try{if(!run.id)throw new Error('This run was played offline. Online records are unavailable.');const result=await leaderboard.finish(run.id,run.trace);if(ticket!==generation)return;verified=result;renderBoard(result.entries);announce();}catch(error){if(ticket!==generation)return;$('ranking-status').textContent=error.message;$('retry-score').hidden=!run.id;}}
 $('retry-score').onclick=submit;
 $('record-name').onsubmit=async event=>{event.preventDefault();const ticket=generation,button=$('record-name').querySelector('button');button.disabled=true;try{const result=await leaderboard.name(run.id,$('player-name').value);if(ticket!==generation)return;renderBoard(result.entries);$('record-name').hidden=true;$('ranking-status').textContent='Congratulations! Your '+ordinal(result.rank)+' place record is saved.';}catch(error){if(ticket===generation)$('ranking-status').textContent=error.message;}finally{if(ticket===generation)button.disabled=false;}};
 $('try-again').onclick=()=>{dialog.close();retry();};$('choose-again').onclick=()=>{dialog.close();choose();};
 dialog.addEventListener('cancel',e=>e.preventDefault());
 return {
  open(result){generation++;run=result;age=0;finished=false;verified=null;$('record-name').hidden=true;$('record-name').querySelector('button').disabled=false;$('player-name').value='';$('score-formula').textContent=result.meters.toLocaleString()+' meters × '+result.bananas+' bananas';$('converted-score').textContent=String(result.bananas?result.meters:0);$('remaining-bananas').textContent=String(result.bananas);$('try-again').disabled=$('choose-again').disabled=true;renderBoard([]);dialog.showModal();submit();},
  update(dt){if(!dialog.open||finished)return;age+=dt;const t=Math.min(age/2.2,1),ease=1-(1-t)**3,total=scoreFor(run.meters,run.bananas),initial=run.bananas?run.meters:0;$('converted-score').textContent=Math.round(initial+(total-initial)*ease).toLocaleString();$('remaining-bananas').textContent=String(Math.max(0,run.bananas-Math.floor(run.bananas*ease)));if(t===1){finished=true;$('try-again').disabled=$('choose-again').disabled=false;announce();}},
  get isOpen(){return dialog.open;}
 };
}

export function createRecordBook(){
 const dialog=document.createElement('dialog');dialog.id='record-book';dialog.innerHTML='<header><h2>All-time records</h2><button aria-label="Close records">×</button></header><p role="status"></p><ol></ol><button id="older-records">Older records</button>';document.body.append(dialog);let offset=0,ticket=0;
 dialog.querySelector('header button').onclick=()=>dialog.close();
 async function load(){const current=++ticket,more=dialog.querySelector('#older-records'),status=dialog.querySelector('p');more.disabled=true;status.textContent='Loading records…';try{const result=await leaderboard.records(offset);if(current!==ticket)return;for(const row of result.entries){const li=document.createElement('li');li.textContent=row.name+' · '+row.score.toLocaleString()+' points · '+row.meters+'m × '+row.bananas;dialog.querySelector('ol').append(li);}offset+=result.entries.length;more.hidden=result.entries.length<20;status.textContent=offset?'Named records are kept even after leaving the Top 10.':'No records yet.';}catch(error){if(current===ticket)status.textContent=error.message;}finally{if(current===ticket)more.disabled=false;}}
 dialog.querySelector('#older-records').onclick=load;
 return {open(){offset=0;dialog.querySelector('ol').replaceChildren();dialog.querySelector('#older-records').hidden=false;dialog.showModal();load();},get isOpen(){return dialog.open;}};
}
