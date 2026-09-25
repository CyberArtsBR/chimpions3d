import {DEFAULT_GAMEPAD_DEADZONE,DEFAULT_MENU_DEADZONE,readPad} from './input.js';

const isFormTarget=target=>!!target?.closest?.('input,textarea,select,[contenteditable="true"]');
const neutralPad=()=>({axis:0,axisY:0,menuX:0,menuY:0,buttons:[],connected:false,index:-1,controllerType:'none',rawX:0,rawY:0});

export class InputManager{
 constructor({target=globalThis,doc=globalThis.document,nav=globalThis.navigator,deadzone=DEFAULT_GAMEPAD_DEADZONE,menuDeadzone=DEFAULT_MENU_DEADZONE,pollMs=16,autoStart=true}={}){
  this.target=target;this.doc=doc;this.nav=nav;this.deadzone=deadzone;this.menuDeadzone=menuDeadzone;this.pollMs=pollMs;
  this.keys=new Set();this.touches=new Map();this.mouseTarget=null;this.pad=neutralPad();this.previousButtons=[];this.previousMenuX=0;this.previousMenuY=0;this.listeners=new Set();this.timer=null;
  this._keydown=e=>this.handleKeyDown(e);this._keyup=e=>this.handleKeyUp(e);this._blur=()=>this.clearGameplay();
  target?.addEventListener?.('keydown',this._keydown);target?.addEventListener?.('keyup',this._keyup);target?.addEventListener?.('blur',this._blur);
  if(autoStart&&typeof target?.setInterval==='function')this.start();
 }
 start(){if(this.timer!==null)return;this.timer=this.target.setInterval(()=>this.pollGamepads(),this.pollMs);this.pollGamepads();}
 stop(){if(this.timer!==null){this.target.clearInterval?.(this.timer);this.timer=null;}}
 destroy(){this.stop();this.target?.removeEventListener?.('keydown',this._keydown);this.target?.removeEventListener?.('keyup',this._keyup);this.target?.removeEventListener?.('blur',this._blur);this.listeners.clear();}
 subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 emit(event){const payload=Object.freeze({...event,connected:this.pad.connected,controllerType:this.pad.controllerType});for(const listener of [...this.listeners])listener(payload);}
 handleKeyDown(event){
  if(isFormTarget(event?.target))return;const code=event?.code||'';
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(code)){this.keys.add(code);if(this.doc?.body?.dataset?.mode==='playing')event.preventDefault?.();}
  if(event?.repeat)return;
  if(code==='Enter'&&event?.target?.closest?.('button,a[href]'))return;
  if(code==='Enter')this.emit({confirmPressed:true,cancelPressed:false,pausePressed:false,menuX:0,menuY:0,source:'keyboard'});
  else if(code==='Escape')this.emit({confirmPressed:false,cancelPressed:true,pausePressed:true,menuX:0,menuY:0,source:'keyboard'});
  else if(code==='KeyP')this.emit({confirmPressed:false,cancelPressed:false,pausePressed:true,menuX:0,menuY:0,source:'keyboard'});
 }
 handleKeyUp(event){this.keys.delete(event?.code||'');}
 setDeadzone(value){this.deadzone=Math.max(0,Math.min(.95,Number(value)||0));}
 bindMouseSurface(element,mapEvent){
  const move=event=>{if(event.pointerType!=='mouse')return;const value=mapEvent(event);if(Number.isFinite(value))this.mouseTarget=value;};
  const leave=()=>{this.mouseTarget=null;};element.addEventListener('pointermove',move);element.addEventListener('pointerleave',leave);return()=>{element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',leave);};
 }
 bindTouchButton(element,direction){
  const down=event=>{event.preventDefault?.();element.setPointerCapture?.(event.pointerId);this.touches.set(event.pointerId,direction);};
  const up=event=>this.touches.delete(event.pointerId);element.addEventListener('pointerdown',down);for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,up);
  return()=>{element.removeEventListener('pointerdown',down);for(const name of ['pointerup','pointercancel','lostpointercapture'])element.removeEventListener(name,up);};
 }
 clearGameplay(){this.keys.clear();this.touches.clear();this.mouseTarget=null;}
 pollGamepads(){
  const next=readPad(this.nav?.getGamepads?.()||[],{deadzone:this.deadzone,menuDeadzone:this.menuDeadzone});const prevConnected=this.pad.connected,buttons=next.buttons||[];
  if(next.axis)this.mouseTarget=null;
  const event={confirmPressed:!!buttons[0]&&!this.previousButtons[0],cancelPressed:!!buttons[1]&&!this.previousButtons[1],pausePressed:!!buttons[9]&&!this.previousButtons[9],menuX:next.menuX&&next.menuX!==this.previousMenuX?next.menuX:0,menuY:next.menuY&&next.menuY!==this.previousMenuY?next.menuY:0,source:'gamepad'};
  this.pad=next;this.previousButtons=buttons.slice();this.previousMenuX=next.menuX;this.previousMenuY=next.menuY;
  if(event.confirmPressed||event.cancelPressed||event.pausePressed||event.menuX||event.menuY||prevConnected!==next.connected)this.emit(event);
  return this.snapshot();
 }
 getMoveX({x=0,vx=0}={}){
  const right=this.keys.has('ArrowRight')||this.keys.has('KeyD')||[...this.touches.values()].includes(1),left=this.keys.has('ArrowLeft')||this.keys.has('KeyA')||[...this.touches.values()].includes(-1);
  const digital=Number(right)-Number(left);if(digital)return digital;
  if(this.pad.axis)return this.pad.axis;
  if(this.mouseTarget!==null){const delta=this.mouseTarget-x-vx*Math.abs(vx)/48;return Math.abs(delta)<.12?0:Math.max(-1,Math.min(1,delta*3));}
  return 0;
 }
 snapshot(){return Object.freeze({moveX:this.getMoveX(),menuX:this.pad.menuX||0,menuY:this.pad.menuY||0,connected:this.pad.connected,controllerType:this.pad.controllerType,deadzone:this.deadzone,rawX:this.pad.rawX||0,rawY:this.pad.rawY||0});}
}

export const inputManager=new InputManager({autoStart:typeof window!=='undefined'});
