// Runs the admin's publish checks on the bundled data, in Node. Fails the
// build if a blocking check fails. Also confirms walk-back times match the graph.
import fs from 'node:fs';
import { validateBundle } from '../site/src/admin/validate.js';
import { buildGraph, shortestChain } from '../site/src/graph.js';
const site = new URL('../site/', import.meta.url);
const read = (f) => JSON.parse(fs.readFileSync(new URL(`data/${f}`, site), 'utf8'));
const raw = { tags: read('tags.json'), legs: read('legs.json'), trails: read('trails.json'), campaigns: read('campaigns.json'), notices: read('notices.json'), manualEvents: read('manual-events.json') };
const res = await validateBundle(raw, { now: new Date(), imageExists: (p) => fs.existsSync(new URL(p.replace(/^\//, ''), site)) });
for (const r of res.results) console.log(`${r.pass ? 'PASS' : r.level === 'warn' ? 'WARN' : 'FAIL'} ${r.label}${r.pass ? '' : `\n    ${r.detail.slice(0, 5).join('\n    ')}`}`);
const settings = read('settings.json');
const g = buildGraph(raw.legs, { closed: new Set(), stepFree: false });
const off = raw.tags.filter((t) => t.kind === 'loop' && t.id !== settings.terminalTag && shortestChain(g, t.id, settings.terminalTag)?.total !== t.walkBackMin);
console.log(off.length ? `FAIL walkBackMin differs from the leg graph for ${off.map((t) => t.slug).join(', ')}` : 'PASS walkBackMin matches the leg graph for every Loop point');
if (!res.ok || off.length) process.exit(1);
