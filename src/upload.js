// Local-only GLB ingestion. Do not follow external buffer or image URLs.
export async function readLocalGLB(file){
 if(!/\.glb$/i.test(file.name))throw new Error('Choose a .glb file with embedded textures and a humanoid skeleton.');
 if(file.size>32*1024*1024)throw new Error('This avatar exceeds the 32 MB browser upload limit.');
 const buffer=await file.arrayBuffer();
 validateGLB(buffer);return buffer;
}
export function validateGLB(buffer){
 if(buffer.byteLength<20)throw new Error('This is not a complete GLB file.');
 const v=new DataView(buffer);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength)
  throw new Error('Choose a valid GLB version 2 file.');
 const length=v.getUint32(12,true);
 if(v.getUint32(16,true)!==0x4e4f534a||length>buffer.byteLength-20)throw new Error('The GLB metadata is damaged.');
 let json;try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));}catch{throw new Error('The GLB metadata could not be read.');}
 for(const resource of [...(json.buffers||[]),...(json.images||[])])
  if(resource.uri&&!resource.uri.startsWith('data:'))throw new Error('Please export a self-contained GLB with embedded textures.');
 if(!json.skins?.length)throw new Error('This model has no skinning. Use a rigged humanoid GLB.');
 if((json.nodes?.length||0)>2000)throw new Error('This avatar has too many scene nodes for this browser test.');
 const unsupported=(json.extensionsRequired||[]).filter(x=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(x));
 if(unsupported.length)throw new Error('Export without Draco, Meshopt or KTX2 compression for this loader.');
 return json;
}
