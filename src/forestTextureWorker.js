const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

function drawForest(seed,scale){
  const density=clamp(Number(scale)||1,1,1.6);
  const w=Math.round(1024*density),h=Math.round(1536*density);
  const canvas=new OffscreenCanvas(w,h),c=canvas.getContext('2d',{alpha:true}),r=rng(seed);

  const haze=c.createLinearGradient(0,0,0,h);
  haze.addColorStop(0,'#9bc9b922');haze.addColorStop(.55,'#355f5530');haze.addColorStop(1,'#18382f55');
  c.fillStyle=haze;c.fillRect(0,0,w,h);

  function limb(x,y,len,angle,width,depth){
    angle=clamp(angle,-1.15,1.15);
    const nx=x+Math.sin(angle)*len,ny=y-Math.cos(angle)*len;
    c.strokeStyle='#42675c';c.lineWidth=width;c.lineCap='round';
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.sin(angle-.2)*len*.5,y-Math.cos(angle)*len*.5,nx,ny);c.stroke();
    c.strokeStyle='#a8c2982b';c.lineWidth=Math.max(1,width*.14);
    c.beginPath();c.moveTo(x+width*.12,y);c.quadraticCurveTo(x+Math.sin(angle-.2)*len*.5+width*.08,y-Math.cos(angle)*len*.5,nx+width*.08,ny);c.stroke();
    if(depth>0){
      limb(nx,ny,len*(.62+r()*.13),angle-.42-r()*.25,width*.62,depth-1);
      limb(nx,ny,len*(.6+r()*.17),angle+.3+r()*.4,width*.6,depth-1);
    }else{
      const palette=['#3c6652','#507b5d','#6f9669','#9aaf72','#b7c77e'];
      for(let j=0;j<38;j++){
        c.fillStyle=palette[Math.floor(r()*palette.length)];
        c.beginPath();c.ellipse(nx+(r()-.5)*105*density,ny+(r()-.5)*62*density,(9+r()*19)*density,(4+r()*10)*density,r()*3,0,Math.PI*2);c.fill();
      }
    }
  }

  for(let i=0;i<7;i++)limb((i+.22+r()*.38)*w/7,h+120*density,(330+r()*440)*density,(r()-.5)*.18,(11+r()*26)*density,4);
  for(let i=0;i<78;i++){
    const x=r()*w,y=h-r()*190*density;
    for(let j=0;j<10;j++){
      c.fillStyle=j%3?'#416c55':'#719363';c.globalAlpha=.45+r()*.35;
      c.beginPath();c.ellipse(x+(j-4.5)*6*density,y-j*8*density,18*density,4.5*density,-.8,0,Math.PI*2);c.fill();
    }
  }
  c.globalAlpha=1;
  for(let i=0;i<22;i++){
    const x=r()*w,len=(90+r()*310)*density;
    c.strokeStyle=i%2?'#315c48aa':'#63866877';c.lineWidth=(1+r()*2.2)*density;
    c.beginPath();c.moveTo(x,-20);c.bezierCurveTo(x+Math.sin(i)*30*density,len*.32,x-Math.cos(i*.7)*24*density,len*.7,x+(r()-.5)*22*density,len);c.stroke();
  }
  for(let i=0;i<110;i++){
    c.fillStyle=i%3?'#d5e59f':'#f4e7a1';c.globalAlpha=.02+r()*.06;
    c.beginPath();c.arc(r()*w,r()*h*.76,(1+r()*4)*density,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  return canvas.transferToImageBitmap();
}

self.onmessage=event=>{
  const {id,index,scale,seed}=event.data||{};
  try{
    const bitmap=drawForest(seed,scale);
    self.postMessage({id,index,scale,bitmap},[bitmap]);
  }catch(error){
    self.postMessage({id,index,scale,error:String(error?.message||error)});
  }
};
