// Content bundles. The base bundle is the JSON in /data. When the demo admin
// publishes, it saves a new versioned bundle and moves a "current" pointer to
// it. The visitor app reads whichever bundle the pointer names; rollback just
// moves the pointer back. In the live product the bundles are versioned files
// on the CDN; in this demo they live in this browser's storage.
import { local } from './storage.js';
import { resolveDemoDates } from './time.js';
import { now } from './clock.js';

export const FILES = {
  tags: 'tags.json', legs: 'legs.json', trails: 'trails.json', campaigns: 'campaigns.json',
  rewards: 'rewards.json', safePlaces: 'safe-places.json', notices: 'notices.json', busy: 'busy-calendar.json',
  settings: 'settings.json', images: 'images.json', sources: 'sources.json', manualEvents: 'manual-events.json',
};
export const BUNDLES_KEY = 'rl-bundles';
export const DRAFT_KEY = 'rl-admin-draft';
const MAX_VERSIONS = 12;

export async function loadBase() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    const res = await fetch(`/data/${f}`);
    if (!res.ok) throw new Error(`/data/${f}: HTTP ${res.status}`);
    return [k, await res.json()];
  }));
  return Object.fromEntries(entries);
}

export function registry() {
  const r = local.get(BUNDLES_KEY, null);
  return r && Array.isArray(r.versions) ? r : { current: 'base', versions: [] };
}

export function publishVersion(data, { user, role, note }) {
  const r = registry();
  const n = r.versions.reduce((m, v) => Math.max(m, Number(v.id.slice(1)) || 0), 0) + 1;
  const version = { id: `v${n}`, time: new Date().toISOString(), user, role, note, previous: r.current, data };
  r.versions.push(version);
  while (r.versions.length > MAX_VERSIONS) r.versions.shift();
  r.current = version.id;
  local.set(BUNDLES_KEY, r);
  return version;
}

export function setPointer(id) {
  const r = registry();
  if (id !== 'base' && !r.versions.some((v) => v.id === id)) throw new Error(`No version ${id}`);
  r.current = id;
  local.set(BUNDLES_KEY, r);
}

// Resolve demo date tokens and build lookups. Tokens only appear in demo records.
export function prepare(raw, version) {
  const text = resolveDemoDates(JSON.stringify(raw), now());
  const b = JSON.parse(text);
  b.version = version;
  b.manualEvents = b.manualEvents || [];
  b.tagById = new Map(b.tags.map((t) => [t.id, t]));
  b.legById = new Map(b.legs.map((l) => [l.id, l]));
  b.trailById = new Map(b.trails.map((t) => [t.id, t]));
  b.imageByFile = new Map((b.images || []).map((i) => [i.file, i]));
  return b;
}

export async function loadRaw({ preview = false } = {}) {
  if (preview) {
    const draft = local.get(DRAFT_KEY, null);
    if (draft && draft.data) return { raw: draft.data, version: 'draft' };
  }
  const r = registry();
  if (r.current !== 'base') {
    const v = r.versions.find((x) => x.id === r.current);
    if (v) return { raw: v.data, version: v.id };
  }
  return { raw: await loadBase(), version: 'base' };
}

export async function loadBundle(opts) {
  const { raw, version } = await loadRaw(opts);
  return prepare(raw, version);
}
