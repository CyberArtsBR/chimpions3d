import fs from 'node:fs';
import crypto from 'node:crypto';

const EXPECTED=Object.freeze({
  'public/audio/music-full.mp3':'9606f2230f5a3b78fb7f9517b80014132205ec52',
  'public/dash/assets/jungle-v2.1f8e991e.webp':'1f8e991ee9a8c21fd65b337d14b46d21d7d0aa55',
  'public/dash/assets/ground-green.5163bede.png':'5163bedeef55b416fc3b1d438178d458befe3f64',
  'public/dash/assets/sprites/log.bdc546a2.png':'bdc546a23cf992d20f157a76f11a9554bda8ade6',
  'public/dash/assets/sprites/mushroom.ed146566.png':'ed1465669d236c791f099ed59f4c6de9efb0e00c',
  'public/dash/assets/sprites/thorns.9c23d2a8.png':'9c23d2a8f76d50f444e94767e4e9623cf9d20e5e',
  'public/dash/assets/sprites/stump.79b7a74b.png':'79b7a74b7ae8544cf254d9840b239fc25d7c336f',
  'public/dash/assets/sprites/spike.9209c4ec.png':'9209c4eccbacc16b6e625b78a5a0e7ac3274adbb',
  'public/dash/assets/sprites/puddle.63b40637.png':'63b40637b478548627c9cfea9c1a6b5bbe2bb9cb',
  'public/dash/assets/sprites/spike-patch.30ffeb5a.png':'30ffeb5add5ad8b4611e08b4a53889554d5f2df5',
  'public/dash/assets/sprites/branch.9e282e4d.png':'9e282e4d9940161e80eaeb242546b79dcb77a88c',
  'public/dash/assets/sprites/vine.4fa7e992.png':'4fa7e9928e39358fbf59cc7e8fa5e8796b6ad9dc',
  'public/dash/assets/sprites/canopy.953eaa4e.png':'953eaa4ee0c07fbc2dcc04ab043c3614fe5d963a',
  'public/dash/assets/sprites/banana.7595c6cd.png':'7595c6cdb7c890fba75f989df145d7d070460052',
  'public/dash/assets/sprites/golden.f3ec3655.png':'f3ec365582306b90107904e59b433cb4b3de9b5f'
});

function gitBlobSha(bytes){
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

let totalBytes=0;
for(const [file,expected] of Object.entries(EXPECTED)){
  if(!fs.existsSync(file))throw new Error('Missing prepared Dash runtime asset: '+file);
  const bytes=fs.readFileSync(file);
  const actual=gitBlobSha(bytes);
  if(actual!==expected)throw new Error(`Dash asset integrity mismatch for ${file}: ${actual} != ${expected}`);
  totalBytes+=bytes.length;
}
console.log(`Dash prepared runtime assets: ${Object.keys(EXPECTED).length} files · ${totalBytes} bytes · content-addressed and runtime-ready`);
