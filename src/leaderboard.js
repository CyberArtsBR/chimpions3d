import {RULESET} from './physics.js';

function randomSeed(){
 if(globalThis.crypto?.getRandomValues){
  const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);return value[0]||1;
 }
 return (Math.floor(Math.random()*0xffffffff)||1)>>>0;
}

// Local run bootstrap only. Online leaderboard networking was intentionally removed.
export const leaderboard={
 async begin(){return {id:null,seed:randomSeed(),ruleset:RULESET};}
};
