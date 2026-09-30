// Runs `node --check` on every JavaScript file.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
(function walk(dir) { for (const d of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules', '.git'].includes(d.name)) continue; const p = path.join(dir, d.name); if (d.isDirectory()) walk(p); else if (/\.(m?js)$/.test(d.name)) files.push(p); } })(root);
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad++; console.error(`FAIL ${path.relative(root, f)}\n${e.stderr}`); } }
if (bad) process.exit(1);
console.log(`PASS node --check on ${files.length} JavaScript files`);
