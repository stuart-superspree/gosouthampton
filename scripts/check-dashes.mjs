// House rule: no em dashes or en dashes anywhere (copy, code, comments, docs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const skip = new Set(['node_modules', '.git', 'out']);
const exts = /\.(js|mjs|json|html|css|md|csv|ics|txt|toml|webmanifest|svg)$|Caddyfile$/;
// Built from char codes so this file does not contain the characters it looks for.
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const hits = [];
(function walk(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(d.name)) continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (exts.test(d.name) && !/OFL\.txt$/.test(d.name)) fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => { if (DASH.test(line)) hits.push(`${path.relative(root, p)}:${i + 1}`); });
  }
})(root);
if (hits.length) { console.error(`FAIL dashes found:\n  ${hits.join('\n  ')}`); process.exit(1); }
console.log('PASS no em or en dashes in the repository');
