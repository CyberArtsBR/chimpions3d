const freezeValue=value=>{if(Array.isArray(value))return Object.freeze(value.map(freezeValue));if(value&&typeof value==='object'){const copy={};for(const [key,item]of Object.entries(value))copy[key]=freezeValue(item);return Object.freeze(copy);}return value;};
export function installDiagnostics(target,getSnapshot){
 const api=Object.freeze({snapshot:()=>freezeValue(getSnapshot())});
 Object.defineProperty(target,'chimpJumpDiagnostics',{value:api,writable:false,configurable:false,enumerable:true});return api;
}
