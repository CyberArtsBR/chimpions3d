export const DASH_BIOMES=[
  {
    id:'emerald-wilds',name:'THE EMERALD WILDS',
    skyTop:0x75d5ad,skyBottom:0x174b3c,fog:0x376f59,ground:0x36552b,dirt:0x6f5734,
    canopy:0x215a3c,mid:0x2f7448,accent:0xa9df6d,sun:0xffe5a4,rim:0x9de8ce,ambient:0xdff7d8,
    fogDensity:.018,exposure:1.06,canopyDensity:1,foreground:.72,waterfall:0,ruins:0,moon:0,storm:0,pollen:1
  },
  {
    id:'canopy-run',name:'CANOPY RUN',
    skyTop:0x5fc59c,skyBottom:0x103d32,fog:0x2d6851,ground:0x314d28,dirt:0x69502f,
    canopy:0x17462f,mid:0x28653d,accent:0x7ed66a,sun:0xf8e99f,rim:0x85d9c0,ambient:0xd7efd1,
    fogDensity:.022,exposure:1.02,canopyDensity:1.3,foreground:1,waterfall:0,ruins:0,moon:0,storm:0,pollen:.85
  },
  {
    id:'ancient-jungle',name:'ANCIENT JUNGLE',
    skyTop:0x8dbb91,skyBottom:0x384a34,fog:0x66735a,ground:0x4b4c2d,dirt:0x79613c,
    canopy:0x3c5a36,mid:0x587043,accent:0xc9bf72,sun:0xffdda0,rim:0xa7d4ad,ambient:0xe6e5c8,
    fogDensity:.024,exposure:.98,canopyDensity:.9,foreground:.6,waterfall:0,ruins:1,moon:0,storm:0,pollen:.55
  },
  {
    id:'waterfall-pass',name:'WATERFALL PASS',
    skyTop:0x83d3dc,skyBottom:0x24546c,fog:0x6ca5ac,ground:0x36584a,dirt:0x647262,
    canopy:0x244f4b,mid:0x39726b,accent:0xa7f2df,sun:0xf4f3cf,rim:0xa6f4ef,ambient:0xdff9f0,
    fogDensity:.032,exposure:1.08,canopyDensity:.8,foreground:.48,waterfall:1,ruins:.2,moon:0,storm:0,pollen:.35
  },
  {
    id:'golden-ruins',name:'GOLDEN RUINS',
    skyTop:0xd9bf78,skyBottom:0x5c5738,fog:0x8d7e58,ground:0x554d2f,dirt:0x8c6f3c,
    canopy:0x495130,mid:0x65643a,accent:0xffd76a,sun:0xffd384,rim:0xe9cf94,ambient:0xf0e2bc,
    fogDensity:.021,exposure:1.04,canopyDensity:.62,foreground:.42,waterfall:0,ruins:1.35,moon:0,storm:0,pollen:.7
  },
  {
    id:'storm-forest',name:'STORM FOREST',
    skyTop:0x708798,skyBottom:0x162a36,fog:0x3e5360,ground:0x293b32,dirt:0x4e5547,
    canopy:0x18312d,mid:0x2b4741,accent:0x8ccac0,sun:0xa9c2ca,rim:0x82b8c4,ambient:0xbdd0cf,
    fogDensity:.03,exposure:.88,canopyDensity:1.05,foreground:.9,waterfall:.25,ruins:0,moon:0,storm:1,pollen:.18
  },
  {
    id:'moonlit-canopy',name:'MOONLIT CANOPY',
    skyTop:0x5d68ad,skyBottom:0x121b45,fog:0x303969,ground:0x27343b,dirt:0x4a4652,
    canopy:0x172b36,mid:0x263e4b,accent:0x9bd8ce,sun:0x9fb9ff,rim:0xa5c6ff,ambient:0xaec7de,
    fogDensity:.026,exposure:.92,canopyDensity:1.12,foreground:.78,waterfall:0,ruins:.15,moon:1,storm:0,pollen:.55
  }
];

export function biomeForStage(stage=1){
  const index=Math.max(0,(Math.floor(stage)-1)%DASH_BIOMES.length);
  return{index,profile:DASH_BIOMES[index]};
}
