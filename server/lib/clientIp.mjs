import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

export function normalizeIp(value){
 let raw=String(value||'').trim();if(!raw)return null;
 if(raw.startsWith('[')){const end=raw.indexOf(']');if(end>0)raw=raw.slice(1,end);}
 if(raw.startsWith('::ffff:'))raw=raw.slice(7);
 if(!isIP(raw)&&/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw))raw=raw.slice(0,raw.lastIndexOf(':'));
 return isIP(raw)?raw:null;
}
export function clientIp(req,{trustProxy=false}={}){
 const remote=normalizeIp(req.socket?.remoteAddress)||'unknown';
 if(!trustProxy)return remote;
 const forwarded=Array.isArray(req.headers['x-forwarded-for'])?req.headers['x-forwarded-for'][0]:req.headers['x-forwarded-for'];
 if(typeof forwarded!=='string')return remote;
 const first=forwarded.split(',').map(normalizeIp).find(Boolean);
 return first||remote;
}
export function ephemeralIpKey(ip){return createHash('sha256').update(String(ip)).digest('base64url').slice(0,22);}
