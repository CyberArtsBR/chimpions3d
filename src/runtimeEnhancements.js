import {inputManager} from './InputManager.js';
const isVisible=el=>{
 if(!el||el.disabled||el.hidden)return false;
 const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&el.getClientRects().length>0;
};
const focusables=root=>[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(isVisible);
const focusElement=el=>{if(el&&isVisible(el)){el.focus({preventScroll:true});el.scrollIntoView?.({block:'nearest',inline:'nearest'});return true;}return false;};
const openDialog=()=>document.querySelector('#collection-dialog[open],#results-dialog[open],#record-book[open]');

function moveCollection(dx,dy){
 const dialog=document.querySelector('#collection-dialog[open]');if(!dialog)return false;
 const active=document.activeElement,grid=[...dialog.querySelectorAll('.avatar-option:not(:disabled)')].filter(isVisible);
 if(active?.classList?.contains('avatar-option')&&grid.length){
  const index=grid.indexOf(active),firstTop=grid[0].offsetTop,nextRow=grid.findIndex((el,i)=>i>0&&el.offsetTop!==firstTop),columns=nextRow>0?nextRow:grid.length,target=index+(dx||dy*columns);
  if(target>=0&&target<grid.length)return focusElement(grid[target]);
  if(dy<0)return focusElement(dialog.querySelector('#avatar-list input[type="search"]'))||focusElement(dialog.querySelector('#random-chimpion'));
  if(dy>0)return focusElement([...dialog.querySelectorAll('.collection-nav button:not(:disabled)')][0]||dialog.querySelector('#confirm-chimpion'));
  return false;
 }
 const items=focusables(dialog);if(!items.length)return false;
 let index=items.indexOf(active);
 if(index<0)return focusElement(dialog.querySelector('#random-chimpion')||items[0]);
 const step=(dy||dx)>0?1:-1;index=(index+step+items.length)%items.length;return focusElement(items[index]);
}
function moveDialog(dialog,direction){
 const items=focusables(dialog);if(!items.length)return false;
 let index=items.indexOf(document.activeElement);
 if(index<0)return focusElement(dialog.querySelector('#try-again')||dialog.querySelector('header button')||items[0]);
 index=(index+direction+items.length)%items.length;return focusElement(items[index]);
}
function moveMenu(direction){
 const overlay=document.querySelector('#overlay');if(!overlay||overlay.hidden)return false;
 const items=focusables(overlay).filter(el=>!el.closest('#avatar-list'));
 if(!items.length)return false;
 let index=items.indexOf(document.activeElement);
 if(index<0)return focusElement(isVisible(document.querySelector('#play'))?document.querySelector('#play'):items[0]);
 index=(index+direction+items.length)%items.length;return focusElement(items[index]);
}
function activateFocused(){
 const dialog=openDialog(),active=document.activeElement;
 if(dialog){
  if(active&&dialog.contains(active)&&isVisible(active)){active.click();return;}
  const preferred=dialog.querySelector('#random-chimpion')||dialog.querySelector('#try-again')||dialog.querySelector('header button')||focusables(dialog)[0];
  if(preferred?.click)preferred.click();else focusElement(preferred);return;
 }
 const mode=document.body?.dataset?.mode||'';
 if(mode==='menu'||mode==='paused'){
  if(active&&document.querySelector('#overlay')?.contains(active)&&isVisible(active)){active.click();return;}
  const play=document.querySelector('#play');if(isVisible(play))play.click();
 }
}

inputManager.subscribe(({menuX,menuY,confirmPressed,cancelPressed})=>{
 const mode=document.body?.dataset?.mode||'',dialog=openDialog(),navigating=dialog||mode==='menu'||mode==='paused';
 if(!navigating)return;
 if(menuX){if(dialog?.id==='collection-dialog')moveCollection(menuX,0);else if(dialog)moveDialog(dialog,menuX);else moveMenu(menuX);}
 if(menuY){if(dialog?.id==='collection-dialog')moveCollection(0,menuY);else if(dialog)moveDialog(dialog,menuY);else moveMenu(menuY);}
 if(confirmPressed)activateFocused();
 if(cancelPressed){if(dialog?.id==='collection-dialog')document.querySelector('#close-collection')?.click();else if(dialog?.id==='record-book')dialog.querySelector('header button')?.click();}
});
