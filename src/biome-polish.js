const biomeNames={
  'Jungle Morning':'morning',
  'Emerald Mist':'emerald',
  'Golden Canopy':'golden',
  'Moonlit Grove':'moonlit'
};

export function setupBiomePolish(){
  const theme=document.getElementById('theme');
  if(!theme)return;
  let current='';
  const sync=()=>{
    const next=biomeNames[theme.textContent.trim()]||'morning';
    if(next===current)return;
    current=next;
    document.body.dataset.biome=next;
  };
  sync();
  new MutationObserver(sync).observe(theme,{childList:true,characterData:true,subtree:true});
}
