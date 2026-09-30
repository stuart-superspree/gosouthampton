// Publish checks. Pure: used by the demo admin before publishing and by
// scripts/validate-data.mjs in Node. Fails block publishing; warnings do not.
import { resolveDemoDates, dayKey } from '../time.js';
import { trailStops } from '../journey.js';

const hasBoth = (o) => !!(o && typeof o.en === 'string' && o.en.trim() && typeof o.de === 'string' && o.de.trim());

// imageExists(path) -> boolean or Promise<boolean>
export async function validateBundle(raw, { now, imageExists }) {
  const d = JSON.parse(resolveDemoDates(JSON.stringify(raw), now));
  const today = dayKey(now);
  const results = [];
  const add = (id, label, pass, detail = [], level = 'fail') => results.push({ id, label, pass, detail, level });
  const tagIds = new Set(d.tags.map((t) => t.id));
  const legsById = new Map(d.legs.map((l) => [l.id, l]));

  // 1. Every leg has step text in English and German.
  const missing = [];
  for (const l of d.legs) {
    if (!l.steps || !l.steps.length) { missing.push(`${l.id}: no step cards`); continue; }
    l.steps.forEach((s, i) => {
      if (!hasBoth(s.text)) missing.push(`${l.id} step ${i + 1}: text needs en and de`);
      if (s.title && !hasBoth(s.title)) missing.push(`${l.id} step ${i + 1}: title needs en and de`);
      if (s.access && !hasBoth(s.access)) missing.push(`${l.id} step ${i + 1}: access note needs en and de`);
    });
  }
  add('lang', 'Every leg has step text in English and German', missing.length === 0, missing);

  // 2. Every trail resolves to real legs in connected order.
  const broken = [];
  for (const tr of d.trails.filter((x) => x.type === 'trail')) {
    if (!tr.legs.length) { broken.push(`${tr.id}: has no legs`); continue; }
    tr.legs.forEach((id, i) => {
      const l = legsById.get(id);
      if (!l) broken.push(`${tr.id}: leg ${id} does not exist`);
      else if (i > 0) {
        const prev = legsById.get(tr.legs[i - 1]);
        if (prev && prev.to !== l.from) broken.push(`${tr.id}: ${prev.id} ends where ${id} does not start`);
      }
    });
    const stops = trailStops(tr, legsById);
    if (new Set(stops).size !== stops.length) broken.push(`${tr.id}: visits the same stop twice`);
  }
  for (const l of d.legs) if (!tagIds.has(l.from) || !tagIds.has(l.to)) broken.push(`${l.id}: starts or ends at an unknown place`);
  add('trails', 'Every trail resolves to real legs in connected order', broken.length === 0, broken);

  // 3. No expired dates in active items.
  const expired = [];
  for (const tr of d.trails) if (tr.activeTo && tr.activeTo < today && !tr.archived) expired.push(`${tr.id}: active until ${tr.activeTo}, which has passed. Archive it or change the dates.`);
  for (const c of d.campaigns || []) if (c.activeTo && c.activeTo < today && !c.archived) expired.push(`campaign ${c.id}: ended ${c.activeTo}`);
  for (const l of d.legs) if (l.closed && l.closedUntil && l.closedUntil < today) expired.push(`${l.id}: closure ended ${l.closedUntil}`);
  add('expired', 'No expired dates in active items', expired.length === 0, expired);

  // 4. Every place has an image or a placeholder.
  const noImage = [];
  for (const t of d.tags) {
    if (!t.image) { noImage.push(`${t.id} ${t.name?.en || ''}: no image set`); continue; }
    if (imageExists && !(await imageExists(t.image))) noImage.push(`${t.id} ${t.name?.en || ''}: ${t.image} not found`);
  }
  add('images', 'Every place has an image or a placeholder', noImage.length === 0, noImage);

  // Warnings (do not block).
  const pastReview = d.legs.filter((l) => l.reviewBy && l.reviewBy < today).map((l) => `${l.id}: review was due ${l.reviewBy}`);
  add('review', 'Legs past their review-by date', pastReview.length === 0, pastReview, 'warn');
  const unwalked = d.legs.filter((l) => !l.verifiedOn).length;
  add('walked', `Legs not yet walked and verified (${unwalked} of ${d.legs.length})`, unwalked === 0, unwalked ? ['Demo legs are marked "Not yet walked". Walk and verify before launch.'] : [], 'warn');
  const oldNotices = (d.notices || []).filter((n) => n.end && n.end < today).map((n) => `${n.id}: ended ${n.end} (hidden automatically)`);
  const oldEvents = (d.manualEvents || []).filter((e) => new Date(e.expires || e.end) <= now).map((e) => `${e.id}: expired (hidden automatically)`);
  add('autoexpired', 'Notices and manual events past their end date', !oldNotices.length && !oldEvents.length, [...oldNotices, ...oldEvents], 'warn');

  return { ok: results.filter((r) => r.level === 'fail').every((r) => r.pass), results };
}
