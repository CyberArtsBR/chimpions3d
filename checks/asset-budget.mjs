import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifestPath='public/asset-manifest.json';
assert(fs.existsSync(manifestPath),'Missing public/asset-manifest.json. Run the build/asset manifest step first.');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));

const MiB=1048576;
const limits=Object.freeze({
  initialShell:0.50*MiB,
  menuArt:0.35*MiB,
  defaultCharacter:15.0*MiB,
  environment:9.0*MiB,
  music:4.5*MiB,
  optionalCharacters:30.0*MiB,
  largestSingleAsset:15.0*MiB
});

const categories={};
for(const [name,limit] of Object.entries(limits)){
  const bytes=name==='largestSingleAsset'
    ? Number(manifest.largestSingleAsset?.bytes||0)
    : Number(manifest.categories?.[name]?.bytes||0);
  categories[name]={
    bytes,
    miB:Number((bytes/MiB).toFixed(2)),
    limitBytes:limit,
    limitMiB:Number((limit/MiB).toFixed(2)),
    utilization:Number((bytes/limit).toFixed(3)),
    files:name==='largestSingleAsset'
      ? [manifest.largestSingleAsset?.path].filter(Boolean)
      : manifest.categories?.[name]?.files||[]
  };
  assert(bytes<=limit,`${name} payload ${(bytes/MiB).toFixed(2)} MiB exceeds mandatory ${(limit/MiB).toFixed(2)} MiB budget`);
}

const report={
  status:'PASS',
  manifestVersion:manifest.version,
  manifestHash:manifest.contentHash,
  categories,
  largestSingleAsset:manifest.largestSingleAsset,
  note:'Budgets model network-relevant controlled categories; total public/ size is intentionally not used as the release gate because lazy assets are not all fetched initially.'
};

fs.writeFileSync('checks/asset-budget-report.json',JSON.stringify(report,null,2));
console.log('ASSET_BUDGET:'+JSON.stringify(report));
