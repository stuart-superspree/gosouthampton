// SIMULATION of the server's scheduled import job. In the live product this runs
// on the server every few hours, fetches each approved source politely, and
// publishes the Events and Places registers as small files. In the demo it
// reads bundled sample files (fixtures) instead of websites, because a browser
// cannot fetch other sites, and it keeps its output in this browser's storage.
import { importSource, dedupe } from './importer.js';
import { resolveDemoDates, dayKey, isoLondon } from './time.js';
import { local } from './storage.js';

export const REGISTER_KEY = 'rl-register';
export const SOURCES_KEY = 'rl-live-sources';
const REFRESH_MS = 6 * 60 * 60 * 1000;

const IMPORTABLE = new Set(['csv', 'json', 'ical', 'recipe']);

// Pure job: sources + fixtures in, registers + health out.
export async function runImport({ sources, tags, manualEvents = [], now, fetchText, previous = null }) {
  const health = {}; const lastGood = { ...(previous?.lastGood || {}) };
  let events = []; let places = [];
  for (const src of sources) {
    if (!IMPORTABLE.has(src.method) || !src.fixture) { health[src.id] = { lastOk: null, records: 0, lastError: null, skipped: src.method }; continue; }
    if (src.paused) { health[src.id] = { ...(previous?.health?.[src.id] || {}), paused: true }; continue; }
    try {
      if (src.simulateFailure) throw new Error('Simulated failure: the source returned HTTP 503');
      const text = resolveDemoDates(await fetchText(src.fixture), now);
      const res = importSource(src, text, { tags, now });
      lastGood[src.id] = { at: now.toISOString(), kind: res.kind, records: res.records };
      health[src.id] = { lastOk: now.toISOString(), records: res.records.length, rows: res.rows, lastError: null, problems: res.problems.length };
      (res.kind === 'places' ? places : events).push(...res.records);
    } catch (err) {
      // A failed import keeps the last good records until they expire.
      const kept = (lastGood[src.id]?.records || []).filter((r) => !r.expires || new Date(r.expires) > now);
      health[src.id] = { lastOk: previous?.health?.[src.id]?.lastOk || null, records: kept.length, lastError: err.message, usingLastGood: kept.length > 0 };
      (lastGood[src.id]?.kind === 'places' ? places : events).push(...kept);
    }
  }
  for (const m of manualEvents) {
    if (new Date(m.expires || m.end) > now) events.push({ ...m, sourceId: m.sourceId || 'manual', alsoFrom: m.alsoFrom || [], access: m.access || [] });
  }
  events = dedupe(events, [...sources, { id: 'manual', priority: 0 }]);
  return { generatedAt: now.toISOString(), day: dayKey(now), events, places, health, lastGood };
}

export function liveSources(bundle) {
  const s = local.get(SOURCES_KEY, null);
  return Array.isArray(s) ? s : bundle.sources;
}
export function saveLiveSources(sources) {
  local.set(SOURCES_KEY, sources);
  window.dispatchEvent(new CustomEvent('rl-sources'));
}

const browserFetchText = async (url) => {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
};

export function cachedRegister() { return local.get(REGISTER_KEY, null); }

function isFresh(reg, bundle, sources, now) {
  return reg && reg.day === dayKey(now) && reg.bundleVersion === bundle.version
    && reg.sourcesStamp === JSON.stringify(sources.map((s) => [s.id, s.paused, s.simulateFailure, s.fixture, s.venueMap]))
    && now - new Date(reg.generatedAt) < REFRESH_MS && now >= new Date(reg.generatedAt);
}

export async function ensureRegister(bundle, now, { force = false, fetchText = browserFetchText, persist = true } = {}) {
  const sources = liveSources(bundle);
  const prev = cachedRegister();
  if (!force && persist && isFresh(prev, bundle, sources, now)) return prev;
  const reg = await runImport({ sources, tags: bundle.tags, manualEvents: bundle.manualEvents, now, fetchText, previous: prev });
  reg.bundleVersion = bundle.version;
  reg.sourcesStamp = JSON.stringify(sources.map((s) => [s.id, s.paused, s.simulateFailure, s.fixture, s.venueMap]));
  if (persist) { local.set(REGISTER_KEY, reg); window.dispatchEvent(new CustomEvent('rl-register')); }
  return reg;
}

export { isoLondon };
