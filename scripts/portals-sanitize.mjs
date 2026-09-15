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

// ---------------------------------------------------------------------------
// 1) Portals-safe GLB filenames inside dist only. Source GLBs stay untouched.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 2) Portals hosts the game below its own URL path. Root-absolute public paths
//    such as /launcher/logo.png therefore point outside the game. Rewrite only
//    known local project paths in the built output; do not touch external URLs.
// ---------------------------------------------------------------------------
const localRoots = [
  'audio',
  'environment',
  'launcher',
  'model',
  'screens',
  'ui'
];
const localFiles = [
  'avatars.json',
  'characters.json',
  'environment.json',
  'avatar-report.json',
  'avatar-overrides.json'
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function rewriteRuntimeRootPaths(text) {
  let result = text;
  for (const root of localRoots) {
    // Root paths embedded in JS/HTML strings or HTML attributes resolve against
    // the document, so ./ keeps them inside the Portals game directory.
    const re = new RegExp(`(^|[\\"'\\`=:(\\s])\\/${root}\\/`, 'g');
    result = result.replace(re, `$1./${root}/`);
  }
  for (const file of localFiles) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[\\"'\\`=:(\\s])\\/${escaped}`, 'g');
    result = result.replace(re, `$1./${file}`);
  }

  // Internal launcher routes such as /?dash=1 must stay inside the embedded
  // Portals game path instead of navigating to the Portals domain root.
  result = result
    .replace(/([\"'`=:(\s])\/\?/g, '$1./?')
    .replace(/location\.href\s*=\s*([\"'`])\/\1/g, 'location.href=$1./$1');

  return result;
}

function rewriteCssRootPaths(text, cssPath) {
  const fromCssToDist = path.relative(path.dirname(cssPath), distDir).replaceAll('\\', '/') || '.';
  const allowed = new Set([...localRoots, ...localFiles]);
  return text.replace(/url\(\s*(["']?)\/([^"')]+)\1\s*\)/g, (whole, quote, target) => {
    const first = target.split('/')[0];
    if (!allowed.has(first)) return whole;
    return `url(${quote}${fromCssToDist}/${target}${quote})`;
  });
}

let pathFilesChanged = 0;
let pathRefsChanged = 0;
for (const filePath of walk(distDir)) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.js', '.html', '.css'].includes(ext)) continue;
  const before = fs.readFileSync(filePath, 'utf8');
  let after = before;
  if (ext === '.css') after = rewriteCssRootPaths(after, filePath);
  else after = rewriteRuntimeRootPaths(after);
  if (after !== before) {
    pathRefsChanged += (before.match(/\/(?:launcher|audio|environment|model|screens|ui)\//g) || []).length;
    fs.writeFileSync(filePath, after);
    pathFilesChanged++;
  }
}

console.log(
  `Portals sanitizer: ${pending.length} built GLB filenames sanitized; ` +
  `${rewritten} avatar URLs rewritten; ${pathFilesChanged} built text files made subdirectory-safe ` +
  `(${pathRefsChanged} local path references inspected). Source files and source GLBs were not modified.`
);
