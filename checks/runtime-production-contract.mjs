import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const assets=path.resolve('dist/assets');
const bundles=fs.existsSync(assets)?fs.readdirSync(assets).filter(name=>name.endsWith('.js')).map(name=>fs.readFileSync(path.join(assets,name),'utf8')).join('\n'):'';
assert(bundles,'Production bundle JavaScript was not found');
assert(!bundles.includes('chimpJumpTest'),'Normal production build must not contain the mutable chimpJumpTest API');
assert(bundles.includes('chimpJumpDiagnostics'),'Production build must expose the readonly diagnostics contract');
console.log('PASS production runtime contract: no mutable test API, readonly diagnostics present');
