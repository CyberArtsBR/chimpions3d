export const DEFAULT_RATE_POLICIES=Object.freeze({
 runCreate:{limit:20,windowMs:60_000},
 runFinish:{limit:30,windowMs:60_000},
 runName:{limit:30,windowMs:60_000},
 leaderboardRead:{limit:120,windowMs:60_000},
 recordsRead:{limit:120,windowMs:60_000}
});
export class MemoryRateLimiter{
 constructor(policies=DEFAULT_RATE_POLICIES){this.policies=policies;this.buckets=new Map();}
 check(policy,key,now=Date.now()){
  const settings=this.policies[policy];if(!settings)throw new Error(`Unknown rate policy: ${policy}`);
  const id=`${policy}:${key}`;let bucket=this.buckets.get(id);
  if(!bucket||bucket.resetAt<=now){bucket={count:0,resetAt:now+settings.windowMs};this.buckets.set(id,bucket);}
  bucket.count++;
  return {allowed:bucket.count<=settings.limit,remaining:Math.max(0,settings.limit-bucket.count),retryAfterSeconds:Math.max(1,Math.ceil((bucket.resetAt-now)/1000))};
 }
 cleanup(now=Date.now()){for(const [key,value] of this.buckets)if(value.resetAt<=now)this.buckets.delete(key);}
}
