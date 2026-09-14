import * as THREE from 'three';

// Death presentation contract:
// - never teleport the avatar back into frame
// - never add a death pose, spin, flail, squash or other animation
// - preserve the last gameplay pose
// - continue downward at the same measured falling speed until the full avatar is offscreen
// - only then announce the impact so audio + red splash can fire
const renderPrototype=THREE.WebGLRenderer.prototype;
if(!renderPrototype.__chimpContinuousDeathPatched){
 const originalRender=renderPrototype.render;
 let trackedRoot=null,nodes=[],snapshot=new Float32Array(0);
 let lastMode='',lastPlayY=0,previousPlayY=0,lastPlayAt=0,previousPlayAt=0;
 let deathStartedAt=0,deathStartX=0,deathStartY=0,deathStartZ=0,deathVelocity=-8,deathAnnounced=false;
 const bounds=new THREE.Box3();

 const findAvatarRoot=scene=>{
  let skinned=null;
  scene.traverse(o=>{if(!skinned&&o.isSkinnedMesh)skinned=o;});
  if(!skinned)return null;
  let node=skinned;
  while(node.parent&&node.parent!==scene&&node.parent.parent!==scene)node=node.parent;
  return node;
 };
 const rebuild=root=>{
  trackedRoot=root;nodes=[];root?.traverse(o=>nodes.push(o));snapshot=new Float32Array(nodes.length*10);
  lastPlayAt=previousPlayAt=0;deathAnnounced=false;
 };
 const capture=()=>{
  for(let i=0;i<nodes.length;i++){
   const o=nodes[i],j=i*10;
   snapshot[j]=o.position.x;snapshot[j+1]=o.position.y;snapshot[j+2]=o.position.z;
   snapshot[j+3]=o.quaternion.x;snapshot[j+4]=o.quaternion.y;snapshot[j+5]=o.quaternion.z;snapshot[j+6]=o.quaternion.w;
   snapshot[j+7]=o.scale.x;snapshot[j+8]=o.scale.y;snapshot[j+9]=o.scale.z;
  }
 };
 const restore=()=>{
  for(let i=0;i<nodes.length;i++){
   const o=nodes[i],j=i*10;
   o.position.set(snapshot[j],snapshot[j+1],snapshot[j+2]);
   o.quaternion.set(snapshot[j+3],snapshot[j+4],snapshot[j+5],snapshot[j+6]);
   o.scale.set(snapshot[j+7],snapshot[j+8],snapshot[j+9]);
  }
 };
 const beginDeath=(root,camera,now)=>{
  deathStartedAt=now;deathStartX=snapshot[0];deathStartZ=snapshot[2];deathAnnounced=false;
  const dt=Math.max(.001,(lastPlayAt-previousPlayAt)/1000);
  const measured=(lastPlayY-previousPlayY)/dt;
  // The last two rendered gameplay frames provide the actual visual fall speed.
  // Never reverse direction and never accelerate after gameplay has ended.
  deathVelocity=Number.isFinite(measured)&&measured<-.35?measured:-8;
  // Extrapolate from the previous rendered frame to 'now'. This removes the last
  // possible one-frame upward snap when game.js switches into its dying state.
  const sinceLast=Math.max(0,(now-lastPlayAt)/1000);
  deathStartY=lastPlayY+deathVelocity*sinceLast;
  restore();root.position.set(deathStartX,deathStartY,deathStartZ);root.updateWorldMatrix(true,true);
  bounds.setFromObject(root,true);
  const bottom=camera.position.y+camera.bottom/camera.zoom;
  if(bounds.max.y<bottom)announceOffscreen(root,camera,bottom);
 };
 const announceOffscreen=(root,camera,bottom)=>{
  if(deathAnnounced)return;deathAnnounced=true;
  const x=root.position.x,y=bottom+.12;
  window.dispatchEvent(new CustomEvent('chimp-death-offscreen',{detail:{x,y}}));
 };
 function patchedRender(scene,camera){
  const now=performance.now(),mode=document.body?.dataset?.mode||'';
  const root=trackedRoot?.parent?trackedRoot:findAvatarRoot(scene);
  if(root!==trackedRoot)rebuild(root);
  if(root&&mode==='playing'){
   previousPlayY=lastPlayY;previousPlayAt=lastPlayAt;
   lastPlayY=root.position.y;lastPlayAt=now;capture();
  }else if(root&&mode==='dying'&&snapshot.length){
   if(lastMode!=='dying')beginDeath(root,camera,now);
   restore();
   const t=Math.max(0,(now-deathStartedAt)/1000);
   root.position.set(deathStartX,deathStartY+deathVelocity*t,deathStartZ);
   // Keep the exact last gameplay orientation and pose. No death animation whatsoever.
   root.updateWorldMatrix(true,true);bounds.setFromObject(root,true);
   const bottom=camera.position.y+camera.bottom/camera.zoom;
   if(bounds.max.y<bottom)announceOffscreen(root,camera,bottom);
  }
  lastMode=mode;
  return originalRender.call(this,scene,camera);
 }
 patchedRender.__chimpContinuousDeathPatched=true;
 renderPrototype.render=patchedRender;
}

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
  const index=grid.indexOf(active),columns=3,target=index+(dx||dy*columns);
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

let previousX=0,previousY=0,previousA=false,previousB=false;
setInterval(()=>{
 const mode=document.body?.dataset?.mode||'';
 const pads=[...(navigator.getGamepads?.()||[])].filter(p=>p?.connected);
 if(!pads.length){previousX=previousY=0;previousA=previousB=false;return;}
 const p=pads.find(p=>Math.abs(p.axes?.[0]||0)>.35||Math.abs(p.axes?.[1]||0)>.35||p.buttons?.some(b=>b.pressed))||pads[0];
 const x=Number(p.buttons?.[15]?.pressed)-Number(p.buttons?.[14]?.pressed)||(Math.abs(p.axes?.[0]||0)>.45?Math.sign(p.axes[0]):0);
 const y=Number(p.buttons?.[13]?.pressed)-Number(p.buttons?.[12]?.pressed)||(Math.abs(p.axes?.[1]||0)>.45?Math.sign(p.axes[1]):0);
 const a=!!p.buttons?.[0]?.pressed,b=!!p.buttons?.[1]?.pressed;
 const dialog=openDialog(),navigating=dialog||mode==='menu'||mode==='paused';
 if(navigating){
  if(x&&x!==previousX){if(dialog?.id==='collection-dialog')moveCollection(x,0);else if(dialog)moveDialog(dialog,x);else moveMenu(x);}
  if(y&&y!==previousY){if(dialog?.id==='collection-dialog')moveCollection(0,y);else if(dialog)moveDialog(dialog,y);else moveMenu(y);}
  if(a&&!previousA)activateFocused();
  if(b&&!previousB){if(dialog?.id==='collection-dialog')document.querySelector('#close-collection')?.click();else if(dialog?.id==='record-book')dialog.querySelector('header button')?.click();}
 }
 previousX=x;previousY=y;previousA=a;previousB=b;
},80);

// Relative mouse steering: only movement direction matters, never cursor position.
let mouseCode=null,mouseRelease=0,lockGraceUntil=0;
const dispatchKey=(type,code)=>document.body.dispatchEvent(new KeyboardEvent(type,{code,key:code==='ArrowLeft'?'ArrowLeft':'ArrowRight',bubbles:true}));
const releaseMouse=()=>{if(mouseCode)dispatchKey('keyup',mouseCode);mouseCode=null;clearTimeout(mouseRelease);mouseRelease=0;};
document.addEventListener('pointermove',event=>{
 if(event.pointerType!=='mouse'||document.body?.dataset?.mode!=='playing')return;
 const dx=event.movementX;if(Math.abs(dx)<.25)return;
 event.stopPropagation();
 const next=dx<0?'ArrowLeft':'ArrowRight';
 if(mouseCode&&mouseCode!==next)dispatchKey('keyup',mouseCode);
 if(mouseCode!==next)dispatchKey('keydown',next);
 mouseCode=next;clearTimeout(mouseRelease);mouseRelease=setTimeout(releaseMouse,110);
},true);
const requestLock=canvas=>{try{const result=canvas?.requestPointerLock?.();result?.catch?.(()=>{});}catch{}};
document.addEventListener('pointerdown',event=>{
 if(event.pointerType!=='mouse'||document.body?.dataset?.mode!=='playing')return;
 const canvas=document.querySelector('#world canvas');if(canvas&&event.target===canvas&&document.pointerLockElement!==canvas)requestLock(canvas);
},true);
document.addEventListener('click',event=>{
 const mode=document.body?.dataset?.mode||'';
 const target=event.target.closest?.('#confirm-chimpion,#try-again,#quick-retry,#play');
 if(!target||target.id==='play'&&mode!=='paused')return;
 const canvas=document.querySelector('#world canvas');
 if(canvas&&matchMedia('(pointer:fine)').matches){lockGraceUntil=performance.now()+4000;if(document.pointerLockElement!==canvas)requestLock(canvas);}
},true);
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)releaseMouse();});
setInterval(()=>{
 const mode=document.body?.dataset?.mode||'';
 if(mode==='playing'){lockGraceUntil=0;return;}
 if(performance.now()<lockGraceUntil)return;
 releaseMouse();if(document.pointerLockElement===document.querySelector('#world canvas'))document.exitPointerLock?.();
},200);
