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

// 1) Portals-safe GLB filenames inside dist only. Source GLBs stay untouched.
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

const pending = [];
let tempIndex = 0;
for (const [originalName, safeName] of renameMap) {
  if (originalName === safeName) continue;
  const originalPath = path.join(charactersDir, originalName);
  const tempName = `.portals-tmp-${tempIndex++}.glb`;
  const tempPath = path.join(charactersDir, tempName);
  fs.renameSync(originalPath, tempPath);
  pending.push({ tempPath, safeName });
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
  if (!safeName) throw new Error(`Avatar catalog points to missing built GLB: ${entry.url}`);
  entry.url = `model/characters/${safeName}`;
  rewritten++;
}
fs.writeFileSync(avatarsPath, JSON.stringify(avatars, null, 2) + '\n');

const invalid = fs.readdirSync(charactersDir)
  .filter(name => /[^A-Za-z0-9._-]/.test(name));
if (invalid.length) throw new Error(`Portals-unsafe avatar filenames remain: ${invalid.join(', ')}`);

// 2) Portals hosts the game below its own URL path. Root-absolute public paths
// such as /launcher/logo.png must become document-relative paths.
const localRoots = ['audio', 'environment', 'launcher', 'model', 'screens', 'ui'];
const localFiles = ['avatars.json', 'characters.json', 'environment.json', 'avatar-report.json', 'avatar-overrides.json'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function replaceAllLiteral(text, from, to) {
  return text.split(from).join(to);
}

function rewriteRuntimeRootPaths(text) {
  let result = text;
  for (const root of localRoots) {
    for (const quote of ['"', "'"]) {
      result = replaceAllLiteral(result, `${quote}/${root}/`, `${quote}./${root}/`);
    }
    result = replaceAllLiteral(result, `=/${root}/`, `=./${root}/`);
    result = replaceAllLiteral(result, `(/${root}/`, `(./${root}/`);
  }
  for (const file of localFiles) {
    for (const quote of ['"', "'"]) {
      result = replaceAllLiteral(result, `${quote}/${file}`, `${quote}./${file}`);
    }
    result = replaceAllLiteral(result, `=/${file}`, `=./${file}`);
    result = replaceAllLiteral(result, `(/${file}`, `(./${file}`);
  }

  for (const quote of ['"', "'"]) {
    result = replaceAllLiteral(result, `${quote}/?`, `${quote}./?`);
  }
  result = result
    .replace(/location\.href\s*=\s*"\/"/g, 'location.href="./"')
    .replace(/location\.href\s*=\s*'\/'/g, "location.href='./'");

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
for (const filePath of walk(distDir)) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.js', '.html', '.css'].includes(ext)) continue;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = ext === '.css' ? rewriteCssRootPaths(before, filePath) : rewriteRuntimeRootPaths(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    pathFilesChanged++;
  }
}

console.log(
  `Portals sanitizer: ${pending.length} built GLB filenames sanitized; ` +
  `${rewritten} avatar URLs rewritten; ${pathFilesChanged} built text files made subdirectory-safe. ` +
  `Source files and source GLBs were not modified.`
);
