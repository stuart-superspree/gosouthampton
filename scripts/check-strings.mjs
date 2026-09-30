// Fails if any English string key is missing in German (or the other way round),
// or if a string is empty.
import fs from 'node:fs';
const read = (l) => JSON.parse(fs.readFileSync(new URL(`../site/strings/${l}.json`, import.meta.url), 'utf8'));
const en = read('en'); const de = read('de');
const missingDe = Object.keys(en).filter((k) => !(k in de));
const extraDe = Object.keys(de).filter((k) => !(k in en));
const empty = [...Object.entries(en), ...Object.entries(de)].filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
if (missingDe.length || extraDe.length || empty.length) {
  if (missingDe.length) console.error(`FAIL missing in de.json: ${missingDe.join(', ')}`);
  if (extraDe.length) console.error(`FAIL only in de.json: ${extraDe.join(', ')}`);
  if (empty.length) console.error(`FAIL empty strings: ${empty.join(', ')}`);
  process.exit(1);
}
console.log(`PASS strings: ${Object.keys(en).length} keys in en.json, all present in de.json`);
