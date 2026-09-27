import * as THREE from 'three';

export const DASH_SCENERY_CAPACITY=Object.freeze({
  heroTrunks:18,heroCrowns:18,giantRoots:24,cliffFaces:14,wetCliffs:10,
  templeColumns:18,templeArches:8,brokenWalls:12,monoliths:8,
  hangingVines:20,canopyBranches:14,bridgePlanks:16,moonFlora:24,foregroundFrames:20
});

function makeTrunkGeometry(){
  const profile=[
    new THREE.Vector2(.82,0),new THREE.Vector2(1.02,.08),new THREE.Vector2(.72,.22),
    new THREE.Vector2(.52,.72),new THREE.Vector2(.42,1.28),new THREE.Vector2(.28,1.92),
    new THREE.Vector2(.2,2.18)
  ];
  const g=new THREE.LatheGeometry(profile,9);
  g.computeVertexNormals();
  return g;
}

function makeCrownGeometry(){
  const g=new THREE.SphereGeometry(1,9,6);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const wobble=1+.11*Math.sin(x*5.1+y*3.7)+.07*Math.cos(z*6.3-y*2.4);
    p.setXYZ(i,x*wobble*(1+.08*y),y*wobble,z*wobble*.72);
  }
  p.needsUpdate=true;g.computeVertexNormals();
  return g;
}

function makeCliffGeometry(){
  const s=new THREE.Shape();
  s.moveTo(-1.2,-1);s.lineTo(-1.08,.18);s.lineTo(-.72,.78);s.lineTo(-.42,1.48);
  s.lineTo(.02,1.18);s.lineTo(.34,1.62);s.lineTo(.7,.82);s.lineTo(1.12,.42);
  s.lineTo(1.24,-1);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.34,bevelEnabled:true,bevelSize:.08,bevelThickness:.06,bevelSegments:1,curveSegments:2});
  g.translate(0,0,-.17);g.computeVertexNormals();
  return g;
}

function makeRootGeometry(){
  const curve=new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-1.15,0,0),new THREE.Vector3(-.08,.34,.06),new THREE.Vector3(1.08,.02,0)
  );
  return new THREE.TubeGeometry(curve,9,.13,6,false);
}

function makeColumnGeometry(){
  const profile=[
    new THREE.Vector2(.42,0),new THREE.Vector2(.5,.08),new THREE.Vector2(.38,.18),
    new THREE.Vector2(.31,1.45),new THREE.Vector2(.42,1.55),new THREE.Vector2(.5,1.7),
    new THREE.Vector2(.4,1.82)
  ];
  const g=new THREE.LatheGeometry(profile,8);g.computeVertexNormals();return g;
}

function makeArchGeometry(){
  const g=new THREE.TorusGeometry(1,.2,5,14,Math.PI);
  g.computeVertexNormals();
  return g;
}

function makeWallGeometry(){
  const s=new THREE.Shape();
  s.moveTo(-1,-.55);s.lineTo(-1,.7);s.lineTo(-.68,.88);s.lineTo(-.38,.68);
  s.lineTo(-.04,.94);s.lineTo(.28,.62);s.lineTo(.58,.8);s.lineTo(.9,.5);s.lineTo(1,-.55);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.28,bevelEnabled:true,bevelSize:.045,bevelThickness:.04,bevelSegments:1});
  g.translate(0,0,-.14);g.computeVertexNormals();return g;
}

function makeMonolithGeometry(){
  const s=new THREE.Shape();
  s.moveTo(-.7,-1);s.lineTo(-.78,.55);s.lineTo(-.42,1.06);s.lineTo(0,1.32);
  s.lineTo(.42,1.06);s.lineTo(.78,.55);s.lineTo(.7,-1);s.closePath();
  const h=new THREE.Path();
  h.moveTo(-.22,-.35);h.lineTo(-.22,.45);h.quadraticCurveTo(0,.72,.22,.45);h.lineTo(.22,-.35);h.closePath();
  s.holes.push(h);
  const g=new THREE.ExtrudeGeometry(s,{depth:.34,bevelEnabled:true,bevelSize:.05,bevelThickness:.05,bevelSegments:1});
  g.translate(0,0,-.17);g.computeVertexNormals();return g;
}

function makeVineGeometry(){
  const c=new THREE.CubicBezierCurve3(
    new THREE.Vector3(0,0,0),new THREE.Vector3(.22,-.62,.04),
    new THREE.Vector3(-.18,-1.55,-.02),new THREE.Vector3(.08,-2.45,0)
  );
  return new THREE.TubeGeometry(c,12,.045,5,false);
}

function makeBranchGeometry(){
  const c=new THREE.CubicBezierCurve3(
    new THREE.Vector3(-1.2,0,0),new THREE.Vector3(-.5,.18,.03),
    new THREE.Vector3(.42,-.12,-.03),new THREE.Vector3(1.2,.02,0)
  );
  return new THREE.TubeGeometry(c,10,.16,6,false);
}

function makePlankGeometry(){
  const s=new THREE.Shape();
  s.moveTo(-.58,-.16);s.lineTo(.54,-.13);s.lineTo(.61,.12);s.lineTo(-.52,.16);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:false});
  g.translate(0,0,-.08);g.computeVertexNormals();return g;
}

function makeFlowerGeometry(){
  const s=new THREE.Shape(),petals=12;
  for(let i=0;i<petals;i++){
    const a=(i/petals)*Math.PI*2,r=i%2===0?1:.46,x=Math.cos(a)*r,y=Math.sin(a)*r;
    if(i===0)s.moveTo(x,y);else s.lineTo(x,y);
  }
  s.closePath();
  const g=new THREE.ShapeGeometry(s,2);g.computeVertexNormals();return g;
}

function makeFrameGeometry(){
  const s=new THREE.Shape();
  const pts=[[-1,0],[-.66,.24],[-.82,.62],[-.4,.46],[-.28,1],[0,.56],[.28,1],[.4,.46],[.82,.62],[.66,.24],[1,0],[.4,.08],[0,-.18],[-.4,.08]];
  pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
  const g=new THREE.ShapeGeometry(s,2);g.computeVertexNormals();return g;
}

function instanced(root,geometry,material,count,z,register){
  const mesh=new THREE.InstancedMesh(geometry,material,count);
  mesh.count=0;mesh.position.z=z;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;
  root.add(mesh);register?.(geometry);return mesh;
}

export function buildDashSceneryKit({root,materials,register}){
  const trunk=makeTrunkGeometry(),crown=makeCrownGeometry(),cliff=makeCliffGeometry(),rootGeo=makeRootGeometry();
  const column=makeColumnGeometry(),arch=makeArchGeometry(),wall=makeWallGeometry(),monolith=makeMonolithGeometry();
  const vine=makeVineGeometry(),branch=makeBranchGeometry(),plank=makePlankGeometry(),flower=makeFlowerGeometry(),frame=makeFrameGeometry();
  return{
    heroTrunks:instanced(root,trunk,materials.barkHero,DASH_SCENERY_CAPACITY.heroTrunks,-5.7,register),
    heroCrowns:instanced(root,crown,materials.foliageHero,DASH_SCENERY_CAPACITY.heroCrowns,-5.45,register),
    giantRoots:instanced(root,rootGeo,materials.barkHero,DASH_SCENERY_CAPACITY.giantRoots,-4.8,register),
    cliffFaces:instanced(root,cliff,materials.stoneDry,DASH_SCENERY_CAPACITY.cliffFaces,-11.2,register),
    wetCliffs:instanced(root,cliff,materials.stoneWet,DASH_SCENERY_CAPACITY.wetCliffs,-8.7,()=>{}),
    templeColumns:instanced(root,column,materials.stoneDry,DASH_SCENERY_CAPACITY.templeColumns,-5.15,register),
    templeArches:instanced(root,arch,materials.ruinGold,DASH_SCENERY_CAPACITY.templeArches,-5.05,register),
    brokenWalls:instanced(root,wall,materials.stoneDry,DASH_SCENERY_CAPACITY.brokenWalls,-5.25,register),
    monoliths:instanced(root,monolith,materials.ruinGold,DASH_SCENERY_CAPACITY.monoliths,-5.0,register),
    hangingVines:instanced(root,vine,materials.vine,DASH_SCENERY_CAPACITY.hangingVines,-4.4,register),
    canopyBranches:instanced(root,branch,materials.barkHero,DASH_SCENERY_CAPACITY.canopyBranches,-4.65,register),
    bridgePlanks:instanced(root,plank,materials.barkHero,DASH_SCENERY_CAPACITY.bridgePlanks,-4.45,register),
    moonFlora:instanced(root,flower,materials.floraGlow,DASH_SCENERY_CAPACITY.moonFlora,-.72,register),
    foregroundFrames:instanced(root,frame,materials.foreground,DASH_SCENERY_CAPACITY.foregroundFrames,2.72,register)
  };
}
