// Original fixed pixel dioramas. Only repaint during a stage dissolve or resize.
const palettes=[
 ['#72abb4','#c2d7ad','#638e89','#3d726b','#214e49','#183e38','#83ac69','#c9d28c'],
 ['#416e85','#a4c8bf','#527b83','#345861','#203e4d','#1a303a','#77b69b','#d0e1b1'],
 ['#a57691','#e8bf99','#907d8a','#696578','#3b465d','#30364a','#b5a477','#f5d59a'],
 ['#17233f','#536981','#344562','#2b3954','#1c2a42','#152236','#559c97','#bbe5ba']
];
export function createPixelBackdrop(parent){
 const canvas=document.createElement('canvas');canvas.id='pixel-backdrop';canvas.setAttribute('aria-hidden','true');parent.append(canvas);
 const ctx=canvas.getContext('2d'),cache=new Map();let aspect='',lastFrame='';
 function artwork(stage,portrait){
  if(cache.has(stage))return cache.get(stage);
  const image=document.createElement('canvas'),w=portrait?288:512,h=portrait?512:288;
  image.width=w;image.height=h;const c=image.getContext('2d');c.imageSmoothingEnabled=false;
  let seed=841+stage*183;const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const p=palettes[stage];
  const rect=(x,y,a,b,color)=>{c.fillStyle=color;c.fillRect(Math.floor(x),Math.floor(y),Math.ceil(a),Math.ceil(b));};
  function polygon(points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();}
  function disk(x,y,rad,color){for(let row=-rad;row<=rad;row++){const half=Math.floor(Math.sqrt(rad*rad-row*row));rect(x-half,y+row,half*2+1,1,color);}}
  // Deliberate palette bands and ordered stippling, rather than a smooth painted sky.
  for(let y=0;y<h;y+=4){const t=y/h,a=parseInt(p[0].slice(1),16),b=parseInt(p[1].slice(1),16);const rgb=[16,8,0].map(shift=>Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t));rect(0,y,w,4,`rgb(${rgb})`);}
  disk(w*.79,h*.16,stage===3?15:20,p[7]);
  if(stage===3)disk(w*.79+7,h*.16-4,14,p[0]);
  for(let i=0;i<26;i++){const x=r()*w,y=r()*h*.35;rect(x,y,14+r()*35,2,p[1]);rect(x+6,y-2,9+r()*18,2,p[1]);}
  for(let layer=0;layer<3;layer++){
   for(let i=0;i<14;i++){
    const x=(i/13)*w+(r()-.5)*20,y=h*(.33+layer*.16)+r()*h*.12,bw=18+r()*34;
    polygon([[x-7,h],[x-4,y+12],[x+4,y+12],[x+4,y],[x+bw-5,y],[x+bw-5,y+8],[x+bw,y+8],[x+bw+8,h]],p[2+layer]);
    for(let k=0;k<22;k++)rect(x+r()*bw,y+14+r()*(h-y),1+r()*3,2+r()*11,p[Math.min(5,3+layer)]);
    if(stage!==2)for(let j=0;j<9;j++)rect(x-5+r()*(bw+10),y-3+r()*12,6+r()*12,2+r()*4,j%3?p[2+layer]:p[6]);
    if(stage===0&&layer===0&&i%3===0){
     rect(x+bw*.6,y+9,5,h-y,'#8ebeb9');rect(x+bw*.6+1,y+9,2,h-y,'#c4ded0');
     for(let k=0;k<18;k++)rect(x+bw*.6,y+15+k*13,4,1,'#e0ead0');
    }
   }
  }
  if(stage===1){
   // Overgrown stone sanctuaries at the sides, leaving the central action readable.
   for(const side of [.10,.83]){
    const x=w*side,y=h*.47;
    for(let step=0;step<5;step++)rect(x-12-step*4,y+step*5,24+step*8,6,p[3]);
    rect(x-20,y+25,40,h*.3,p[4]);rect(x-9,y+31,18,h*.22,p[5]);
    for(let row=0;row<12;row++)for(let col=0;col<4;col++)rect(x-19+col*10+(row%2)*3,y+27+row*7,7,1,p[2]);
    for(let j=0;j<20;j++){const yy=y+20+j*4;rect(x+19+Math.sin(j)*2,yy,2,5,p[6]);}
   }
  }
  if(stage===2){
   // High-altitude terraced ridges and distant expedition pennants.
   for(const side of [.08,.9]){
    const x=w*side,y=h*.44;rect(x,y,2,43,p[5]);polygon([[x+2,y],[x+18,y+5],[x+2,y+11]],p[7]);
    for(let j=0;j<8;j++)rect(x-25-j*2,y+43+j*7,50+j*4,2,p[3]);
   }
   for(let i=0;i<12;i++){const x=r()*w,y=h*.16+r()*h*.16;rect(x,y,2,1,p[4]);rect(x+3,y+1,2,1,p[4]);}
  }
  if(stage===3){
   // Bioluminescent grove: clustered mushrooms, crystals and static fireflies.
   for(let i=0;i<22;i++){
    const x=i%2?w-r()*w*.18:r()*w*.18,y=h*.4+r()*h*.6,size=3+r()*7;
    rect(x,y,2,size*2,p[6]);disk(x,y,Math.round(size),p[6]);rect(x-size,y+1,size*2,size,p[4]);rect(x-2,y-size+2,2,1,p[7]);
   }
   for(const side of [.05,.92]){const x=w*side;polygon([[x,h*.91],[x-9,h*.76],[x-3,h*.68],[x+8,h*.74],[x+6,h*.9]],p[6]);rect(x-2,h*.73,2,h*.13,p[7]);}
  }
  // Restrained edge framing: no central trunk or imitation landing platforms.
  for(let i=0;i<140;i++){
   const x=i%2?w-r()*w*.09:r()*w*.09,y=r()*h;
   rect(x,y,4+r()*10,2+r()*5,p[5]);rect(x+1,y,3+r()*6,1,p[6]);
  }
  for(let i=0;i<stage*12+20;i++)rect(r()*w,r()*h,1,1,p[7]);
  // Keep the middle quiet while retaining texture at the frame edges.
  c.globalAlpha=.12;rect(w*.22,0,w*.56,h,p[5]);c.globalAlpha=1;
  cache.set(stage,image);return image;
 }
 function draw(stage,blend=1){
  const portrait=innerHeight>innerWidth,nextAspect=String(portrait);
  if(aspect!==nextAspect){aspect=nextAspect;cache.clear();lastFrame='';}
  blend=Math.max(0,Math.min(1,blend));const key=stage+':'+blend.toFixed(3)+':'+aspect;if(key===lastFrame)return;lastFrame=key;
  const next=artwork(stage,portrait),previous=blend<1?artwork((stage+3)%4,portrait):next;
  if(canvas.width!==next.width||canvas.height!==next.height){canvas.width=next.width;canvas.height=next.height;}
  ctx.imageSmoothingEnabled=false;ctx.globalAlpha=1;ctx.drawImage(previous,0,0);
  if(blend>0&&previous!==next){ctx.globalAlpha=blend;ctx.drawImage(next,0,0);ctx.globalAlpha=1;}
 }
 return {canvas,draw};
}
