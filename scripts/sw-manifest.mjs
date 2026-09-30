// Keeps two generated lists in step with the code (their output is committed,
// so the site itself needs no build step):
//   1. index.html: <link rel="modulepreload"> for every module the visitor app
//      imports at start, plus preloads for the base data files. This flattens the
//      module waterfall on slow connections.
//   2. sw.js: the service worker precache list, and a VERSION made from a hash of
//      every precached file, so any content change ships a new worker.
// Usage: node scripts/sw-manifest.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../site/', import.meta.url));
const check = process.argv.includes('--check');
let failed = false;
// Relative paths use forward slashes on every OS, since they become URLs.
const walk = (dir) => fs.readdirSync(path.join(site, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.posix.join(dir, d.name)) : [path.posix.join(dir, d.name)]));
function update(file, next, label) {
  const p = path.join(site, file);
  const cur = fs.readFileSync(p, 'utf8');
  if (check) {
    if (cur !== next) { console.error(`FAIL ${file}: ${label} is out of date. Run: node scripts/sw-manifest.mjs`); failed = true; } else console.log(`PASS ${file}: ${label}`);
  } else fs.writeFileSync(p, next);
}

// 1. Preloads in index.html
const queue = ['/src/app.js'];
const seen = new Set();
while (queue.length) {
  const f = queue.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const src = fs.readFileSync(path.join(site, f.slice(1)), 'utf8');
  for (const m of src.matchAll(/^import[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
}
const dataFiles = ['tags', 'legs', 'trails', 'campaigns', 'rewards', 'safe-places', 'notices', 'busy-calendar', 'settings', 'images', 'sources', 'manual-events'].map((f) => `/data/${f}.json`);
const preload = [
  ...[...seen].filter((f) => f !== '/src/app.js').sort().map((f) => `  <link rel="modulepreload" href="${f}" />`),
  ...dataFiles.map((f) => `  <link rel="preload" href="${f}" as="fetch" crossorigin />`),
].join('\n');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const nextHtml = html.replace(/(<!-- PRELOAD-START[^>]*-->\n)[\s\S]*?( {2}<!-- PRELOAD-END -->)/, `$1${preload}\n$2`);
update('index.html', nextHtml, `preloads ${seen.size - 1} modules and ${dataFiles.length} data files`);

// 2. Precache list and version in sw.js (hash uses the updated index.html)
const list = [
  '/', '/index.html', '/manifest.webmanifest', '/styles/app.css',
  '/fonts/inter-latin-var.woff2', '/fonts/playfair-latin-var.woff2',
  '/img/icons/icon.svg', '/img/photos/hero-welcome.webp', '/img/photos/whirlwind-tour.webp',
  ...walk('src').filter((f) => f.endsWith('.js') && !f.startsWith('src/admin') && !f.endsWith('redirect-404.js')).map((f) => `/${f}`),
  ...walk('strings').map((f) => `/${f}`),
  ...walk('data').filter((f) => f.endsWith('.json') || f.includes('fixtures')).map((f) => `/${f}`),
].sort();
const hash = crypto.createHash('sha256');
for (const f of list) {
  hash.update(f);
  hash.update(f === '/index.html' || f === '/' ? nextHtml : fs.readFileSync(path.join(site, f.slice(1))));
}
const version = `2.0.1-${hash.digest('hex').slice(0, 10)}`;
const sw = fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
const nextSw = sw
  .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(list, null, 2).replace(/"/g, "'")};`)
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
update('sw.js', nextSw, `precache list (${list.length} files) and version ${version}`);
if (!check) console.log(`wrote preloads (${seen.size - 1} modules) and ${list.length} precache entries, version ${version}`);
if (failed) process.exit(1);
