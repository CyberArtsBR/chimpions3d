import * as THREE from 'three';
import {buildDashSceneryKit,DASH_SCENERY_CAPACITY} from './DashSceneryKit.js';

const TMP_MATRIX=new THREE.Matrix4();
const TMP_POS=new THREE.Vector3();
const TMP_QUAT=new THREE.Quaternion();
const TMP_SCALE=new THREE.Vector3();
const Z_AXIS=new THREE.Vector3(0,0,1);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=(v,span)=>{const half=span/2;return((v+half)%span+span)%span-half;};

function seeded(seed=1){
  let s=seed>>>0||1;
  return()=>{s=(Math.imul(s^s>>>15,1|s)+0x6d2b79f5)|0;return((s^s>>>14)>>>0)/4294967296;};
}

function applyMatrix(mesh,index,x,y,z,sx,sy,sz,rotation=0){
  TMP_POS.set(x,y,z);TMP_QUAT.setFromAxisAngle(Z_AXIS,rotation);TMP_SCALE.set(sx,sy,sz);
  TMP_MATRIX.compose(TMP_POS,TMP_QUAT,TMP_SCALE);mesh.setMatrixAt(index,TMP_MATRIX);
}

function makeSeeds(count,random){
  return Array.from({length:count},(_,i)=>({
    x:(i/(Math.max(1,count-1))-.5)+((random()-.5)/Math.max(1,count))*1.8,
    y:random(),s:.72+random()*.72,r:(random()-.5)*.5,p:random()*Math.PI*2
  }));
}

function finish(mesh,count){
  mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
}

export class DashEnvironment{
  constructor({root,materials,quality,register}){
    this.root=root;this.materials=materials;this.quality=quality;
    this.viewW=20;this.viewH=12;this.groundY=-4;
    this.mesh=buildDashSceneryKit({root,materials,register});
    const random=seeded(0x7a3c19d);
    this.seed={};
    for(const [key,count] of Object.entries(DASH_SCENERY_CAPACITY))this.seed[key]=makeSeeds(count,random);
  }

  setQuality(quality){this.quality=quality;}
  resize({viewW=this.viewW,viewH=this.viewH,groundY=this.groundY}={}){
    this.viewW=viewW;this.viewH=viewH;this.groundY=groundY;
  }

  update({scrollWorld=0,time=0,speedRatio=1,features}){
    const span=this.viewW*1.55;
    const heroLimit=Math.min(DASH_SCENERY_CAPACITY.heroTrunks,this.quality.heroCount||10);
    const structureLimit=Math.min(18,this.quality.structureCount||7);
    const detailLimit=Math.min(24,this.quality.sceneryDetail||10);

    let count=Math.min(heroLimit,Math.round(heroLimit*clamp(features.giantTrees,0,1.4)));
    for(let i=0;i<count;i++){
      const d=this.seed.heroTrunks[i],x=wrap(d.x*span-scrollWorld*.105,span),h=1.35+d.s*1.18;
      applyMatrix(this.mesh.heroTrunks,i,x,this.groundY-.02,0,.48+d.s*.2,h,.72,d.r*.12);
      const canopyBulk=1+.15*clamp(features.darkCanopy,0,1.5);applyMatrix(this.mesh.heroCrowns,i,x+d.r*.3,this.groundY+2.35+h*.84,0,(1.2+d.s*.72)*canopyBulk,(.82+d.s*.48)*canopyBulk,1,d.r*.65);
    }
    finish(this.mesh.heroTrunks,count);finish(this.mesh.heroCrowns,count);

    count=Math.min(DASH_SCENERY_CAPACITY.giantRoots,Math.round(detailLimit*1.25*clamp(features.roots,0,1.4)));
    for(let i=0;i<count;i++){
      const d=this.seed.giantRoots[i],x=wrap(d.x*span-scrollWorld*.16,span),scale=.72+d.s*.62;
      applyMatrix(this.mesh.giantRoots,i,x,this.groundY+.05,-.02,scale*1.25,scale*.72,.85,d.r*.32);
    }
    finish(this.mesh.giantRoots,count);

    const baseCliffs=Math.max(3,Math.round(structureLimit*.42));
    count=Math.min(DASH_SCENERY_CAPACITY.cliffFaces,baseCliffs+Math.round(structureLimit*.5*features.waterCliffs));
    for(let i=0;i<count;i++){
      const d=this.seed.cliffFaces[i],x=wrap(d.x*span-scrollWorld*.032,span),s=1.7+d.s*1.5;
      applyMatrix(this.mesh.cliffFaces,i,x,this.groundY+1.25+d.y*.8,0,s*1.08,s*1.15,1,d.r*.12);
    }
    finish(this.mesh.cliffFaces,count);

    count=Math.min(DASH_SCENERY_CAPACITY.wetCliffs,Math.round(structureLimit*.72*clamp(features.waterCliffs+features.wetness*.35,0,1.5)));
    for(let i=0;i<count;i++){
      const d=this.seed.wetCliffs[i],x=wrap(d.x*span-scrollWorld*.07,span),s=1.15+d.s*1.08;
      applyMatrix(this.mesh.wetCliffs,i,x,this.groundY+.95+d.y*.62,0,s,s*1.2,1,d.r*.08);
    }
    finish(this.mesh.wetCliffs,count);

    count=Math.min(DASH_SCENERY_CAPACITY.canopyBranches,Math.round(structureLimit*clamp(features.elevatedCanopy,0,1.5)));
    for(let i=0;i<count;i++){
      const d=this.seed.canopyBranches[i],x=wrap(d.x*span-scrollWorld*.13,span),y=this.groundY+this.viewH*(.49+d.y*.2);
      applyMatrix(this.mesh.canopyBranches,i,x,y,0,1.25+d.s*1.2,.9+d.s*.18,1,d.r*.12);
    }
    finish(this.mesh.canopyBranches,count);

    count=Math.min(DASH_SCENERY_CAPACITY.hangingVines,Math.round(detailLimit*clamp(features.vines,0,1.5)));
    for(let i=0;i<count;i++){
      const d=this.seed.hangingVines[i],x=wrap(d.x*span-scrollWorld*.145,span),top=this.groundY+this.viewH*(.68+d.y*.2);
      applyMatrix(this.mesh.hangingVines,i,x,top,0,.78+d.s*.42,.78+d.s*.5,1,d.r*.16+Math.sin(time*.72+d.p)*.045);
    }
    finish(this.mesh.hangingVines,count);

    const temple=Math.max(features.temple,features.monument*.72);
    count=Math.min(DASH_SCENERY_CAPACITY.templeColumns,Math.round(structureLimit*1.1*clamp(temple,0,1.5)));
    for(let i=0;i<count;i++){
      const d=this.seed.templeColumns[i],x=wrap(d.x*span-scrollWorld*.085,span),s=.72+d.s*.5;
      applyMatrix(this.mesh.templeColumns,i,x,this.groundY+.02,0,s,s*(1.55+d.y*.55),1,d.r*.05);
    }
    finish(this.mesh.templeColumns,count);

    count=Math.min(DASH_SCENERY_CAPACITY.templeArches,Math.round((structureLimit*.52)*clamp(features.arches,0,1.6)));
    for(let i=0;i<count;i++){
      const d=this.seed.templeArches[i],x=wrap(d.x*span-scrollWorld*.082,span),s=1.15+d.s*.7;
      applyMatrix(this.mesh.templeArches,i,x,this.groundY+2.2+d.y*.7,0,s,s*.82,1,d.r*.05);
    }
    finish(this.mesh.templeArches,count);

    count=Math.min(DASH_SCENERY_CAPACITY.brokenWalls,Math.round(structureLimit*.8*clamp(features.brokenWalls+features.temple*.35,0,1.6)));
    for(let i=0;i<count;i++){
      const d=this.seed.brokenWalls[i],x=wrap(d.x*span-scrollWorld*.09,span),s=.72+d.s*.62;
      applyMatrix(this.mesh.brokenWalls,i,x,this.groundY+.55,0,s*1.15,s,1,d.r*.12);
    }
    finish(this.mesh.brokenWalls,count);

    count=Math.min(DASH_SCENERY_CAPACITY.monoliths,Math.round(structureLimit*.5*clamp(features.monument,0,1.7)));
    for(let i=0;i<count;i++){
      const d=this.seed.monoliths[i],x=wrap(d.x*span-scrollWorld*.062,span),s=1.05+d.s*.75;
      applyMatrix(this.mesh.monoliths,i,x,this.groundY+1.25,0,s,s*1.18,1,d.r*.06);
    }
    finish(this.mesh.monoliths,count);

    count=Math.min(DASH_SCENERY_CAPACITY.bridgePlanks,Math.round(detailLimit*.85*clamp(features.bridges,0,1.5)));
    for(let i=0;i<count;i++){
      const d=this.seed.bridgePlanks[i],group=Math.floor(i/8),slot=i%8;
      const center=wrap((group-.5)*this.viewW*.56-scrollWorld*.11,span);
      const x=center+(slot-3.5)*.52,y=this.groundY+this.viewH*(.42+.04*group)+Math.sin(slot*.9+d.p)*.035;
      applyMatrix(this.mesh.bridgePlanks,i,x,y,0,.5,.85,1,d.r*.05);
    }
    finish(this.mesh.bridgePlanks,count);

    count=Math.min(DASH_SCENERY_CAPACITY.moonFlora,Math.round(detailLimit*1.2*clamp(features.emissiveFlora,0,1.6)));
    for(let i=0;i<count;i++){
      const d=this.seed.moonFlora[i],x=wrap(d.x*span-scrollWorld*.62,span),edge=(i%3===0),y=edge?this.groundY+.18:this.groundY-.12-d.y*.24,s=.1+d.s*.11;
      applyMatrix(this.mesh.moonFlora,i,x,y,0,s,s,1,time*.08+d.p);
    }
    finish(this.mesh.moonFlora,count);

    const speedFade=clamp(1-(speedRatio-1)*.24,.52,1);
    count=Math.min(DASH_SCENERY_CAPACITY.foregroundFrames,Math.round((this.quality.foregroundCount||4)*clamp(features.framing,0,1.35)*speedFade));
    const safeTop=this.groundY+Math.max(3.15,this.viewH*.3);
    for(let i=0;i<count;i++){
      const d=this.seed.foregroundFrames[i],x=wrap(d.x*span-scrollWorld*(1.2+speedRatio*.035),span),top=i%2===0;
      const y=top?safeTop+1.1+d.y*this.viewH*.34:this.groundY-.48-d.y*.5,s=(.42+d.s*.34)*speedFade;
      applyMatrix(this.mesh.foregroundFrames,i,x,y,0,s*1.45,s,1,d.r+Math.sin(time*.82+d.p)*.055);
    }
    finish(this.mesh.foregroundFrames,count);

    this.materials.stoneWet.roughness=.2+.18*(1-clamp(features.wetness,0,1));
    this.materials.floraGlow.emissiveIntensity=.16+.82*clamp(features.emissiveFlora,0,1.4);
  }

  instanceCount(){
    let total=0;
    for(const mesh of Object.values(this.mesh))total+=mesh.count||0;
    return total;
  }
}
