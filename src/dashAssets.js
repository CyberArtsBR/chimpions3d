const ROOT=`${import.meta.env.BASE_URL}dash/assets/`;

const SPRITE_FILES=Object.freeze({
  log:'sprites/log.bdc546a2.png',
  mushroom:'sprites/mushroom.ed146566.png',
  thorns:'sprites/thorns.9c23d2a8.png',
  stump:'sprites/stump.79b7a74b.png',
  spike:'sprites/spike.9209c4ec.png',
  puddle:'sprites/puddle.63b40637.png',
  'spike-patch':'sprites/spike-patch.30ffeb5a.png',
  branch:'sprites/branch.9e282e4d.png',
  vine:'sprites/vine.4fa7e992.png',
  canopy:'sprites/canopy.953eaa4e.png',
  banana:'sprites/banana.7595c6cd.png',
  golden:'sprites/golden.f3ec3655.png'
});

export const DASH_SCENERY=Object.freeze({
  jungle:ROOT+'jungle-v2.1f8e991e.webp',
  ground:ROOT+'ground-green.5163bede.png'
});

// Music is non-critical and remains lazy-loaded from the pinned legacy bundle until
// the 4.5 MiB source track can be migrated without changing the audio master.
export const DASH_MUSIC_URL='https://raw.githubusercontent.com/CyberArtsBR/chimpions-dash/62a6f4a95cf729b535d7fb04d3c0265a7104f4aa/dist/assets/chimpions-army.mp3';

export function dashSpriteUrl(id){
  const key=id==='log-pile'?'log':id;
  const file=SPRITE_FILES[key];
  if(!file)throw new Error('Unknown Dash sprite: '+id);
  return ROOT+file;
}

export function warmDashImages(ids){
  for(const id of ids){
    const image=new Image();
    image.decoding='async';
    image.loading='eager';
    image.src=id==='jungle'?DASH_SCENERY.jungle:id==='ground'?DASH_SCENERY.ground:dashSpriteUrl(id);
    image.decode?.().catch(()=>{});
  }
}
