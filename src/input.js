// Standard mapping supports Xbox/PlayStation; generic pads fall back to axis 0.
export function readPad(pads){
 const connected=Array.from(pads).filter(p=>p?.connected);
 const active=connected.find(p=>Math.abs(p.axes?.[0]||0)>.2||p.buttons?.some(b=>b.pressed))||connected[0];
 if(!active)return {axis:0,buttons:[]};
 const buttons=active.buttons.map(b=>b.pressed);
 const raw=Math.max(-1,Math.min(1,active.axes?.[0]||0));
 const axis=Number(buttons[15])-Number(buttons[14])||(Math.abs(raw)>.2?Math.sign(raw)*(Math.abs(raw)-.2)/.8:0);
 return {axis,buttons};
}
