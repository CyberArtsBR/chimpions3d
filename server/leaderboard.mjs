import {pathToFileURL} from 'node:url';
import {createLeaderboardService} from './lib/service.mjs';

export {createLeaderboardService};
function envBool(name,defaultValue=false){const value=process.env[name];if(value==null)return defaultValue;return /^(1|true|yes|on)$/i.test(value);}
function configuredOrigins(){return (process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:4173').split(',').map(value=>value.trim()).filter(Boolean);}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const service=createLeaderboardService({dbPath:process.env.SCORES_DB||'data/scores.sqlite',allowedOrigins:configuredOrigins(),trustProxy:envBool('TRUST_PROXY',false)});
 const port=Number(process.env.PORT||3001);let shuttingDown=false;
 service.server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'leaderboard_listening',port})));
 const shutdown=signal=>{
  if(shuttingDown)return;shuttingDown=true;console.log(JSON.stringify({event:'shutdown_started',signal}));
  const force=setTimeout(()=>process.exit(1),5_000);force.unref();
  service.server.close(error=>{clearTimeout(force);try{service.closeResources();}finally{process.exit(error?1:0);}});
  service.server.closeIdleConnections?.();
 };
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
