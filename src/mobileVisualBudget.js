// Explicit visual-detail policy for Chimp Jump.
// This module deliberately does not patch Three.js prototypes. Callers opt in by
// applying the policy to the scene/group they own.

export function isConstrainedVisualDevice(){
  if(typeof matchMedia!=='function')return (globalThis.innerWidth||9999)<=600;
  return matchMedia('(pointer: coarse)').matches||(globalThis.innerWidth||9999)<=600;
}

export function allowsDesktopDetail(profile,{constrained=isConstrainedVisualDevice()}={}){
  if(constrained)return false;
  const name=typeof profile==='string'?profile:profile?.profile;
  return name==='high'||name==='ultra'||name==='cinematic-max';
}

export function applyVisualDetailBudget(root,profile,options={}){
  const allow=allowsDesktopDetail(profile,options);
  let shown=0,hidden=0;
  root?.traverse?.(node=>{
    if(!node?.userData?.desktopDetail)return;
    node.visible=allow;
    if(allow)shown++;else hidden++;
  });
  return {allowDesktopDetail:allow,shown,hidden};
}
