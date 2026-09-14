import * as THREE from 'three';

// Keep the death presentation intentionally simple: freeze the last gameplay pose,
// then let the whole avatar fall naturally out of frame. This patch runs before
// game.js creates its renderer, so scenery's renderer wrapper binds to it.
const renderPrototype=THREE.WebGLRenderer.prototype;
if(!renderPrototype.__chimpSimpleDeathPatched){
 const originalRender=renderPrototype.render;
 let trackedRoot=null,nodes=[],snapshot=new Float32Array(0),lastMode='',deathStarted=0,fallX=0,fallY=0,fallZ=0,fallGravity=18;
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
 function patchedRender(scene,camera){
  const mode=document.body?.dataset?.mode||'';
  const root=findAvatarRoot(scene);
  if(root!==trackedRoot)rebuild(root);
  if(root&&mode==='playing'){
   capture();
  }else if(root&&mode==='dying'&&snapshot.length){
   if(lastMode!=='dying'){
    deathStarted=performance.now();
    fallX=snapshot[0];fallY=snapshot[1];fallZ=snapshot[2];
    const bottom=camera.position.y+(camera.bottom/camera.zoom);
    const distance=Math.max(4,fallY-(bottom-1.8));
    const target=.88,initial=.8;
    fallGravity=Math.max(14,2*(distance-initial*target)/(target*target));
   }
   restore();
   const t=Math.max(0,(performance.now()-deathStarted)/1000);
   root.position.set(fallX,fallY-.8*t-.5*fallGravity*t*t,fallZ);
  }
  lastMode=mode;
  return originalRender.call(this,scene,camera);
 }
 patchedRender.__chimpSimpleDeathPatched=true;
 renderPrototype.render=patchedRender;
}

const isVisible=el=>{
 if(!el||el.disabled||el.hidden)return false;
 const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&el.getClientRects().length>0;
};
const focusables=root=>[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(isVisible);
const focusElement=el=>{if(el&&isVisible(el)){el.focus({preventScroll:true});el.scrollIntoView?.({block:'nearest',inline:'nearest'});return true;}return false;};

function moveCollection(dx,dy){
 const dialog=document.querySelector('#collection-dialog[open]');if(!dialog)return false;
 const active=document.activeElement,grid=[...dialog.querySelectorAll('.avatar-option:not(:disabled)')].filter(isVisible);
 if(active?.classList?.contains('avatar-option')&&grid.length){
  const index=grid.indexOf(active),columns=3;
  let target=index+(dx||dy*columns);
  if(target>=0&&target<grid.length)return focusElement(grid[target]);
  if(dy<0)return focusElement(dialog.querySelector('#avatar-list input[type="search"]'))||focusElement(dialog.querySelector('#random-chimpion'));
  if(dy>0)return focusElement([...dialog.querySelectorAll('.collection-nav button:not(:disabled)')][0]||dialog.querySelector('#confirm-chimpion'));
  return false;
 }
 const items=focusables(dialog);if(!items.length)return false;
 let index=items.indexOf(active);
 if(index<0){const preferred=dialog.querySelector('#random-chimpion')||items[0];return focusElement(preferred);}
 const step=(dy||dx)>0?1:-1;index=(index+step+items.length)%items.length;return focusElement(items[index]);
}
function moveMenu(direction){
 const overlay=document.querySelector('#overlay');if(!overlay||overlay.hidden)return false;
 const items=focusables(overlay).filter(el=>!el.closest('#avatar-list'));
 if(!items.length)return false;
 let index=items.indexOf(document.activeElement);
 if(index<0){const play=document.querySelector('#play');return focusElement(isVisible(play)?play:items[0]);}
 index=(index+direction+items.length)%items.length;return focusElement(items[index]);
}
function activateFocused(){
 const dialog=document.querySelector('#collection-dialog[open]');
 const active=document.activeElement;
 if(dialog){if(active&&dialog.contains(active)&&isVisible(active)){active.click();return;}focusElement(dialog.querySelector('#random-chimpion'));return;}
 const mode=document.body?.dataset?.mode||'';
 if(mode==='menu'||mode==='paused'){
  if(active&&document.querySelector('#overlay')?.contains(active)&&isVisible(active)){active.click();return;}
  const play=document.querySelector('#play');if(isVisible(play))play.focus({preventScroll:true});
 }
}

let previousX=0,previousY=0,previousA=false,previousB=false;
setInterval(()=>{
 const mode=document.body?.dataset?.mode||'';
 const pads=[...(navigator.getGamepads?.()||[])].filter(p=>p?.connected);
 if(!pads.length)return;
 const p=pads.find(p=>Math.abs(p.axes?.[0]||0)>.35||Math.abs(p.axes?.[1]||0)>.35||p.buttons?.some(b=>b.pressed))||pads[0];
 const x=Number(p.buttons?.[15]?.pressed)-Number(p.buttons?.[14]?.pressed)||(Math.abs(p.axes?.[0]||0)>.45?Math.sign(p.axes[0]):0);
 const y=Number(p.buttons?.[13]?.pressed)-Number(p.buttons?.[12]?.pressed)||(Math.abs(p.axes?.[1]||0)>.45?Math.sign(p.axes[1]):0);
 const a=!!p.buttons?.[0]?.pressed,b=!!p.buttons?.[1]?.pressed;
 const navigating=document.querySelector('#collection-dialog[open]')||mode==='menu'||mode==='paused';
 if(navigating){
  if(x&&x!==previousX)document.querySelector('#collection-dialog[open]')?moveCollection(x,0):moveMenu(x);
  if(y&&y!==previousY)document.querySelector('#collection-dialog[open]')?moveCollection(0,y):moveMenu(y);
  if(a&&!previousA)activateFocused();
  if(b&&!previousB&&document.querySelector('#collection-dialog[open]'))document.querySelector('#close-collection')?.click();
 }
 previousX=x;previousY=y;previousA=a;previousB=b;
},80);

// Relative mouse steering: direction comes from movement delta, never cursor position.
let mouseCode=null,mouseRelease=0;
const dispatchKey=(type,code)=>document.body.dispatchEvent(new KeyboardEvent(type,{code,key:code==='ArrowLeft'?'ArrowLeft':'ArrowRight',bubbles:true}));
const releaseMouse=()=>{
 if(mouseCode)dispatchKey('keyup',mouseCode);mouseCode=null;clearTimeout(mouseRelease);mouseRelease=0;
};
document.addEventListener('pointermove',event=>{
 if(event.pointerType!=='mouse'||document.body?.dataset?.mode!=='playing')return;
 const dx=event.movementX;if(Math.abs(dx)<.25)return;
 // Stop game.js from converting absolute cursor position into a delayed target.
 event.stopPropagation();
 const next=dx<0?'ArrowLeft':'ArrowRight';
 if(mouseCode&&mouseCode!==next)dispatchKey('keyup',mouseCode);
 if(mouseCode!==next)dispatchKey('keydown',next);
 mouseCode=next;clearTimeout(mouseRelease);mouseRelease=setTimeout(releaseMouse,110);
},true);

document.addEventListener('pointerdown',event=>{
 if(event.pointerType!=='mouse'||document.body?.dataset?.mode!=='playing')return;
 const canvas=document.querySelector('#world canvas');
 if(canvas&&event.target===canvas&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.().catch?.(()=>{});
},true);
document.addEventListener('click',event=>{
 const target=event.target.closest?.('#confirm-chimpion,#try-again,#quick-retry');if(!target)return;
 const canvas=document.querySelector('#world canvas');if(canvas&&matchMedia('(pointer:fine)').matches&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.().catch?.(()=>{});
},true);
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)releaseMouse();});
setInterval(()=>{
 if(document.body?.dataset?.mode!=='playing'){
  releaseMouse();
  if(document.pointerLockElement===document.querySelector('#world canvas'))document.exitPointerLock?.();
 }
},200);
