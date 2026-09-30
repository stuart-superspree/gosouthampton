// The importer turns a source's raw text into register records. It is pure
// (no network, no DOM) so it runs the same in the browser demo and in Node.
// Steps: parse (iCal, JSON, CSV or HTML recipe), map fields, clean text,
// match the venue to a Loop point, map the category, set expiry, drop
// expired records, then merge duplicates across sources.
import { parseHtml, selectAll, readField } from './mini-html.js';
import { dayKey, addDays, startOfDay, isoLondon, zoned } from './time.js';

// ---------- parsers ----------
export function parseCsv(text) {
  const rows = [];
  let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((c) => c !== '')) rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

function icsDate(value, params) {
  if (/^\d{8}$/.test(value)) {
    const [y, m, d] = [value.slice(0, 4), value.slice(4, 6), value.slice(6, 8)].map(Number);
    return { date: zoned(y, m, d, 0, 0), allDay: true };
  }
  const mm = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!mm) return null;
  const [, y, m, d, h, mi, , z] = mm;
  if (z) return { date: new Date(Date.UTC(+y, +m - 1, +d, +h, +mi)), allDay: false };
  // Local times are read as Europe/London (the only TZID the demo feeds use).
  if (params.TZID && params.TZID !== 'Europe/London') return null;
  return { date: zoned(+y, +m, +d, +h, +mi), allDay: false };
}

export function parseIcs(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const unfolded = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  const events = [];
  let ev = null;
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const [name, ...paramParts] = line.slice(0, idx).split(';');
    const params = Object.fromEntries(paramParts.map((p) => p.split('=')));
    const raw = line.slice(idx + 1);
    const value = raw.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
    if (name === 'DTSTART' || name === 'DTEND') ev[name] = icsDate(raw.trim(), params);
    else ev[name] = value;
  }
  return events;
}

export function parseJsonFeed(text, mapping) {
  const data = JSON.parse(text);
  const items = mapping.items ? mapping.items.split('.').reduce((o, k) => (o ? o[k] : undefined), data) : data;
  return Array.isArray(items) ? items : [];
}

export function parseRecipe(text, recipe) {
  const root = parseHtml(text);
  return selectAll(root, recipe.item).map((node) => {
    const out = { ...(recipe.defaults || {}) };
    for (const [field, sel] of Object.entries(recipe.fields)) {
      const v = readField(node, sel);
      if (Array.isArray(v) ? v.length : v) out[field] = v;
    }
    return out;
  });
}

// ---------- cleaning and mapping ----------
export function cleanText(s, max = 140) {
  let t = String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length > 6 && letters === letters.toUpperCase()) {
    t = t.toLowerCase().replace(/(^|[\s(:'-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }
  return t.length > max ? t.slice(0, max - 3).trimEnd() + '...' : t;
}

const CATEGORY_WORDS = [
  ['theatre', ['theatre', 'musical', 'drama', 'comedy', 'dance', 'pantomime', 'opera', 'play']],
  ['music', ['music', 'concert', 'gig', 'jazz']],
  ['exhibition', ['exhibition', 'exhibitions', 'display']],
  ['family', ['family', 'kids', 'children']],
  ['talk', ['talk', 'talks', 'lecture', 'workshop']],
  ['tour', ['tour', 'tours', 'walk', 'walks']],
  ['market', ['market', 'markets', 'shopping', 'fair']],
  ['food', ['food', 'drink']],
];
export function mapCategory(raw) {
  const words = String(raw || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const [cat, keys] of CATEGORY_WORDS) if (words.some((w) => keys.includes(w))) return cat;
  return 'other';
}

const PLACE_CATEGORIES = { museums: 'museums', galleries: 'galleries', theatres: 'theatres', heritage: 'heritage', waterfront: 'waterfront', shopping: 'shopping', 'food and drink': 'food', sport: 'sport', parks: 'parks' };
export function mapPlaceCategory(raw) { return PLACE_CATEGORIES[String(raw || '').trim().toLowerCase()] || 'other'; }

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const normTitle = (s) => norm(s).replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, '');

// Match free-text venue names to a Loop point using each tag's aliases.
// A source's own venueMap (corrected by staff in the admin) wins.
export function matchVenue(venueText, tags, venueMap = {}) {
  if (!venueText) return null;
  if (venueMap[venueText]) return venueMap[venueText];
  const v = norm(venueText);
  let best = null; let bestLen = 0;
  for (const t of tags) {
    if (t.kind !== 'loop' || t.status === 'retired') continue;
    for (const alias of [t.name?.en, ...(t.aliases || [])]) {
      const a = norm(alias);
      if (a && (v === a || v.startsWith(a + ' ') || v.includes(' ' + a) || v.includes(a)) && a.length > bestLen) { best = t.id; bestLen = a.length; }
    }
  }
  return best;
}

function toDate(v) {
  if (!v) return null;
  if (v.date instanceof Date) return v.date;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

// Raw source rows -> uniform rows {title, title_de, start, end, venue, category, url, summary, access}
export function extractRows(source, text) {
  const map = source.mapping || {};
  switch (source.method) {
    case 'csv':
      return parseCsv(text).map((r) => ({ title: r[map.title], start: r[map.start], end: r[map.end], venue: r[map.venue], category: r[map.category], url: r[map.url], summary: r[map.summary] }));
    case 'json':
      return parseJsonFeed(text, map).map((r) => ({ title: r[map.title], title_de: r[map.title_de], start: r[map.start], end: r[map.end], venue: r[map.venue], category: r[map.category], url: r[map.url], summary: r[map.summary] }));
    case 'ical':
      return parseIcs(text).map((e) => ({ title: e[map.title || 'SUMMARY'], start: e[map.start || 'DTSTART'], end: e[map.end || 'DTEND'], venue: e[map.venue || 'LOCATION'], category: e[map.category || 'CATEGORIES'], url: e[map.url || 'URL'] }));
    case 'recipe':
      return parseRecipe(text, source.recipe);
    default:
      return [];
  }
}

// Uniform rows -> event records, with expiry and venue matching. Expired rows are dropped.
export function toEvents(source, rows, { tags, now }) {
  const out = []; const problems = [];
  const tagById = new Map(tags.map((t) => [t.id, t]));
  for (const r of rows) {
    const title = cleanText(r.title, 120);
    const start = toDate(r.start);
    if (!title || !start) { problems.push({ row: r, reason: !title ? 'missing title' : 'missing or unreadable start date' }); continue; }
    const allDay = !!(r.start && r.start.allDay);
    let end = toDate(r.end);
    if (!end || end < start) end = new Date(start.getTime() + (allDay ? 24 * 60 : 120) * 60000);
    // Expires at the end of the London day on which the event ends.
    const expires = startOfDay(addDays(dayKey(new Date(end.getTime() - 1)), 1));
    if (expires <= now) continue;
    const venueText = cleanText(r.venue, 80);
    const venueTag = matchVenue(venueText, tags, source.venueMap);
    const category = mapCategory(r.category);
    const dedupeKey = `${venueTag || norm(venueText).replace(/\s+/g, '-') || 'unknown'}|${dayKey(start)}|${normTitle(title)}`;
    const safeUrl = /^https:\/\//i.test(r.url || '') ? r.url : source.url;
    out.push({
      id: `ev-${shortHash(source.id + '|' + dedupeKey)}`,
      title: { en: title, ...(r.title_de ? { de: cleanText(r.title_de, 120) } : {}) },
      start: isoLondon(start), end: isoLondon(end), allDay,
      venueText, venueTag, zone: venueTag ? tagById.get(venueTag)?.zone || null : null,
      category, categoryRaw: cleanText(r.category, 40),
      access: Array.isArray(r.access) ? r.access.map((a) => cleanText(a, 40)) : [],
      sourceId: source.id, sourceUrl: safeUrl, alsoFrom: [],
      expires: isoLondon(expires), dedupeKey, demo: source.demo !== false,
    });
  }
  return { records: out, problems };
}

export function toPlaces(source, rows, { tags }) {
  return rows.map((r) => {
    const name = cleanText(r.title, 80);
    if (!name) return null;
    const venueTag = matchVenue(name, tags, source.venueMap);
    return {
      id: `pl-${shortHash(source.id + '|' + norm(name))}`, name, category: mapPlaceCategory(r.category),
      summary: cleanText(r.summary, 160), venueTag,
      sourceId: source.id, sourceUrl: /^https:\/\//i.test(r.url || '') ? r.url : source.url, demo: source.demo !== false,
    };
  }).filter(Boolean);
}

// Merge records that share venue, London date and normalised title.
// The source with the lowest priority number (the venue's own listing) leads.
export function dedupe(records, sources) {
  const prio = new Map(sources.map((s) => [s.id, s.priority ?? 5]));
  const groups = new Map();
  for (const r of records) {
    const g = groups.get(r.dedupeKey);
    if (g) g.push(r); else groups.set(r.dedupeKey, [r]);
  }
  const out = [];
  for (const g of groups.values()) {
    g.sort((a, b) => (prio.get(a.sourceId) ?? 5) - (prio.get(b.sourceId) ?? 5));
    const lead = { ...g[0], title: { ...g[0].title }, access: [...g[0].access] };
    for (const other of g.slice(1)) {
      if (other.sourceId !== lead.sourceId && !lead.alsoFrom.some((a) => a.sourceId === other.sourceId)) lead.alsoFrom.push({ sourceId: other.sourceId, url: other.sourceUrl });
      if (!lead.title.de && other.title.de) lead.title.de = other.title.de;
      for (const a of other.access) if (!lead.access.includes(a)) lead.access.push(a);
      if (!lead.venueTag && other.venueTag) { lead.venueTag = other.venueTag; lead.zone = other.zone; }
    }
    out.push(lead);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.en.localeCompare(b.title.en));
}

export function importSource(source, text, ctx) {
  const rows = extractRows(source, text);
  if (source.register === 'places') return { kind: 'places', records: toPlaces(source, rows, ctx), problems: [], rows: rows.length };
  const { records, problems } = toEvents(source, rows, ctx);
  return { kind: 'events', records, problems, rows: rows.length };
}
