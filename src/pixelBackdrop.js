// Original, deterministic pixel artwork. Repaint only on stage/aspect changes.
export function createPixelBackdrop(parent){
 const canvas=document.createElement('canvas');canvas.id='pixel-backdrop';parent.append(canvas);
 const ctx=canvas.getContext('2d');let previous='';
 const palettes=[
 ['#78b9c0','#d7df9d','#517f79','#295c58','#153c3b','#453827','#715237','#a37942','#579654','#a9c968'],
 ['#426f82','#a1c6b3','#385a65','#284a50','#142f3c','#373c32','#546049','#798468','#3d8d78','#83baa0'],
 ['#9b647f','#f3c18a','#7d6872','#534f5b','#2d3945','#4d3033','#855044','#bc7b4e','#8b8e45','#d5bc62'],
 ['#141e3d','#4e6586','#293853','#202f49','#111e31','#292738','#42394d','#63516a','#36596a','#79a69b']];
 function draw(stage){
 const portrait=innerHeight>innerWidth,key=stage+':'+portrait;if(key===previous)return;previous=key;
 const w=portrait?270:480,h=portrait?480:270;canvas.width=w;canvas.height=h;
 let seed=841+stage*183;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const p=palettes[stage%4];const rect=(x,y,a,b,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(a),Math.ceil(b));};
 const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,p[0]);gradient.addColorStop(1,p[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
 // Stepped sun/moon disk and distant cloud ribbons.
 for(let y=-15;y<=15;y++){const half=Math.floor(Math.sqrt(225-y*y));rect(w*.81-half,h*.16+y,half*2,1,stage===3?'#c3d4d6':'#f6dfa0');}
 for(let i=0;i<24;i++)rect(r()*w,r()*h*.4,15+r()*50,2+r()*3,stage===3?'#647593':'#cbd7bc');
 // Three layers of cliffs, ruins, waterfalls and dense canopy crowns.
 for(let layer=0;layer<3;layer++){
 for(let i=0;i<18;i++){
 const x=r()*w,y=h*(.28+layer*.16)+r()*h*.18,bw=12+r()*27;
 rect(x,y,bw,h-y,p[2+layer]);
 for(let j=0;j<12;j++)rect(x+r()*bw,y+r()*(h-y),1+r()*3,4+r()*12,p[Math.min(4,3+layer)]);
 for(let j=0;j<12;j++){const lx=x+(r()-.3)*bw,ly=y+r()*14;rect(lx,ly,5+r()*13,3+r()*6,j%3?p[2+layer]:p[8]);}
 if(layer===0&&i%4===0){rect(x+bw*.6,y+10,3,h*.45,'#91c9c5');rect(x+bw*.6+1,y+14,1,h*.4,'#d0dfd0');}
 }
 }
 // Massive straight ancient trunk with broken bark plates and luminous moss.
 const left=w*.22,right=w*.78;
 rect(left,0,right-left,h,p[5]);
 for(let i=0;i<1900;i++){
 const x=left+r()*(right-left),y=r()*h,bw=1+r()*7,bh=2+r()*19;
 rect(x,y,bw,bh,p[r()<.65?6:7]);
 if(i%3===0)rect(x,y,1,bh,p[5]);
 }
 for(let i=0;i<13;i++){
 const x=left+r()*(right-left);for(let y=0;y<h;y+=5)rect(x+Math.sin(y*.024+i)*3,y,2,7,p[5]);
 }
 // Knot rings assembled from square pixels.
 for(let k=0;k<7;k++){
 const x=left+10+r()*(right-left-20),y=r()*h;
 for(let a=0;a<48;a++){const t=a/48*Math.PI*2;rect(x+Math.cos(t)*5,y+Math.sin(t)*10,2,3,p[5]);}
 rect(x-1,y-5,2,11,p[7]);
 }
 for(const side of [left,right])for(let y=0;y<h;y+=3){
 const x=side+Math.sin(y*.055)*5;rect(x,y,2,4,p[8]);
 if(y%9===0){rect(x-7,y,7,3,p[8]);rect(x+2,y+3,7,3,p[9]);rect(x+3,y+3,3,1,'#b8d58c');}
 }
 // Foreground leaves frame the playfield without adding fake landing surfaces.
 for(let i=0;i<150;i++){
 const side=i%2?1:0,x=side?w-r()*w*.12:r()*w*.12,y=r()*h;
 rect(x,y,5+r()*12,3+r()*6,p[4]);rect(x+2,y,4+r()*8,2,p[8]);
 }
 for(let i=0;i<85;i++){const x=r()*w,y=r()*h;rect(x,y,1,1,stage===3?'#cfeead':'#d3d79d');}
 }
 return {canvas,draw};
}
