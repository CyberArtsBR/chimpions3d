import {scoreFor,ordinal} from './score.js';

const STORAGE_KEY='chimp-jump-local-records-v1';

function readRecords(){
 try{
  const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
  return Array.isArray(parsed)?parsed:[];
 }catch{return [];}
}
function writeRecords(records){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));}catch{}}
function normalizeRun(run){
 const meters=Math.max(0,Math.floor(Number(run?.meters)||0));
 const bananas=Math.max(0,Math.floor(Number(run?.bananas)||0));
 return {meters,bananas,score:scoreFor(meters,bananas),at:Date.now()};
}
function saveRecord(run){
 const entry=normalizeRun(run),records=[...readRecords(),entry]
  .sort((a,b)=>b.score-a.score||b.meters-a.meters||a.at-b.at)
  .slice(0,50);
 writeRecords(records);
 return {entry,records,rank:records.findIndex(row=>row.at===entry.at&&row.score===entry.score&&row.meters===entry.meters)+1};
}
function renderRows(list,records,limit=10){
 list.replaceChildren();
 for(const [index,row] of records.slice(0,limit).entries()){
  const li=document.createElement('li');
  li.textContent=ordinal(index+1)+' · '+Number(row.score||0).toLocaleString()+' points · '+Number(row.meters||0).toLocaleString()+'m · '+Number(row.bananas||0)+' bananas';
  list.append(li);
 }
 if(!list.children.length){const li=document.createElement('li');li.textContent='No local records yet.';list.append(li);}
}

export function createResults({retry,choose}){
 const dialog=document.createElement('dialog');dialog.id='results-dialog';
 dialog.innerHTML=`<div class="eyebrow">THE CLIMB IS OVER</div><h2>Your expedition</h2><p id="score-formula"></p><div class="score-conversion"><div><small>POINTS</small><strong id="converted-score">0</strong></div><span>×</span><div><small>BANANAS LEFT</small><strong id="remaining-bananas">0</strong></div></div><p id="ranking-status" role="status"></p><h3>Local Top 10</h3><ol id="result-top"></ol><div class="result-actions"><button id="try-again" class="primary">Try Again</button><button id="choose-again">Choose your Chimpion</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
 let run,age=0,finished=false;
 $('try-again').onclick=()=>{dialog.close();retry();};
 $('choose-again').onclick=()=>{dialog.close();choose();};
 dialog.addEventListener('cancel',e=>e.preventDefault());
 return {
  open(result){
   run=result;age=0;finished=false;
   const local=saveRecord(result);
   $('score-formula').textContent=result.meters.toLocaleString()+' meters × '+result.bananas+' bananas';
   $('converted-score').textContent=String(result.bananas?result.meters:0);
   $('remaining-bananas').textContent=String(result.bananas);
   $('ranking-status').textContent=local.rank?'Local record: '+ordinal(local.rank)+' place on this device.':'Saved locally on this device.';
   renderRows($('result-top'),local.records);
   $('try-again').disabled=$('choose-again').disabled=false;
   dialog.showModal();
  },
  update(dt){
   if(!dialog.open||finished)return;
   age+=dt;const t=Math.min(age/2.2,1),ease=1-(1-t)**3,total=scoreFor(run.meters,run.bananas),initial=run.bananas?run.meters:0;
   $('converted-score').textContent=Math.round(initial+(total-initial)*ease).toLocaleString();
   $('remaining-bananas').textContent=String(Math.max(0,run.bananas-Math.floor(run.bananas*ease)));
   if(t===1)finished=true;
  },
  get isOpen(){return dialog.open;}
 };
}

export function createRecordBook(){
 const dialog=document.createElement('dialog');dialog.id='record-book';
 dialog.innerHTML='<header><h2>Local records</h2><button aria-label="Close records">×</button></header><p role="status">Stored only on this device.</p><ol></ol>';
 document.body.append(dialog);
 dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
 return {
  open(){renderRows(dialog.querySelector('ol'),readRecords(),50);dialog.showModal();},
  get isOpen(){return dialog.open;}
 };
}
