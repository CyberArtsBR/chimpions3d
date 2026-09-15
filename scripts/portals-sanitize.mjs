import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const charactersDir = path.join(distDir, 'model', 'characters');
const avatarsPath = path.join(distDir, 'avatars.json');

function safeFilename(filename) {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  const safeExt = ext.replace(/[^A-Za-z0-9.]/g, '');
  if (!stem) throw new Error(`Cannot create a Portals-safe filename for: ${filename}`);
  return `${stem}${safeExt}`;
}

if (!fs.existsSync(charactersDir)) {
  throw new Error(`Expected built avatar directory was not found: ${charactersDir}`);
}
if (!fs.existsSync(avatarsPath)) {
  throw new Error(`Expected built avatar catalog was not found: ${avatarsPath}`);
}

const files = fs.readdirSync(charactersDir, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => entry.name);

const targetOwners = new Map();
const renameMap = new Map();
for (const originalName of files) {
  const safeName = safeFilename(originalName);
  const key = safeName.toLowerCase();
  const prior = targetOwners.get(key);
  if (prior && prior !== originalName) {
    throw new Error(`Portals filename collision: "${prior}" and "${originalName}" both become "${safeName}"`);
  }
  targetOwners.set(key, originalName);
  renameMap.set(originalName, safeName);
}

// Rename via temporary names first so case-only or cross-name changes are safe.
const pending = [];
let tempIndex = 0;
for (const [originalName, safeName] of renameMap) {
  if (originalName === safeName) continue;
  const originalPath = path.join(charactersDir, originalName);
  const tempName = `.portals-tmp-${tempIndex++}.glb`;
  const tempPath = path.join(charactersDir, tempName);
  fs.renameSync(originalPath, tempPath);
  pending.push({ tempPath, safeName, originalName });
}
for (const { tempPath, safeName } of pending) {
  fs.renameSync(tempPath, path.join(charactersDir, safeName));
}

const avatars = JSON.parse(fs.readFileSync(avatarsPath, 'utf8'));
let rewritten = 0;
for (const entry of avatars) {
  if (typeof entry.url !== 'string' || !entry.url.startsWith('model/characters/')) continue;
  const encodedName = entry.url.slice('model/characters/'.length);
  const originalName = decodeURIComponent(encodedName);
  const safeName = renameMap.get(originalName);
  if (!safeName) {
    throw new Error(`Avatar catalog points to missing built GLB: ${entry.url}`);
  }
  entry.url = `model/characters/${safeName}`;
  rewritten++;
}
fs.writeFileSync(avatarsPath, JSON.stringify(avatars, null, 2) + '\n');

const invalid = fs.readdirSync(charactersDir)
  .filter(name => /[^A-Za-z0-9._-]/.test(name));
if (invalid.length) {
  throw new Error(`Portals-unsafe avatar filenames remain: ${invalid.join(', ')}`);
}

console.log(`Portals sanitizer: ${pending.length} built GLB filenames sanitized; ${rewritten} avatar URLs rewritten. Source GLBs were not modified.`);
