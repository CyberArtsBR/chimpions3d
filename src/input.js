export const DEFAULT_GAMEPAD_DEADZONE=.2;
export const DEFAULT_MENU_DEADZONE=.45;
const clamp=value=>Math.max(-1,Math.min(1,Number(value)||0));

export function applyDeadzone(value,deadzone=DEFAULT_GAMEPAD_DEADZONE){
 const v=clamp(value),d=Math.max(0,Math.min(.95,Number(deadzone)||0));
 if(Math.abs(v)<=d)return 0;
 return Math.sign(v)*(Math.abs(v)-d)/(1-d);
}

export function controllerType(id=''){
 const value=String(id).toLowerCase();
 if(/xbox|xinput/.test(value))return 'xbox';
 if(/playstation|dualshock|dualsense|sony/.test(value))return 'playstation';
 if(/nintendo|switch|joy-con/.test(value))return 'nintendo';
 return value?'generic':'none';
}

// Pure gamepad normalization. Edge detection belongs to InputManager so every consumer
// observes one authoritative previous/current button state.
export function readPad(pads,{deadzone=DEFAULT_GAMEPAD_DEADZONE,menuDeadzone=DEFAULT_MENU_DEADZONE}={}){
 const connected=Array.from(pads||[]).filter(p=>p?.connected);
 const active=connected.find(p=>Math.abs(p.axes?.[0]||0)>deadzone||Math.abs(p.axes?.[1]||0)>deadzone||p.buttons?.some(b=>b?.pressed))||connected[0];
 if(!active)return {axis:0,axisY:0,menuX:0,menuY:0,buttons:[],connected:false,index:-1,controllerType:'none',rawX:0,rawY:0};
 const buttons=Array.from(active.buttons||[],b=>!!b?.pressed),rawX=clamp(active.axes?.[0]||0),rawY=clamp(active.axes?.[1]||0);
 const dpadX=Number(buttons[15])-Number(buttons[14]),dpadY=Number(buttons[13])-Number(buttons[12]);
 const axis=dpadX||applyDeadzone(rawX,deadzone),axisY=dpadY||applyDeadzone(rawY,deadzone);
 const menuX=dpadX||(Math.abs(rawX)>=menuDeadzone?Math.sign(rawX):0),menuY=dpadY||(Math.abs(rawY)>=menuDeadzone?Math.sign(rawY):0);
 return {axis,axisY,menuX,menuY,buttons,connected:true,index:Number.isInteger(active.index)?active.index:connected.indexOf(active),controllerType:controllerType(active.id),rawX,rawY};
}
