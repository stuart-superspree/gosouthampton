// SIMULATION of the small write API (taps, stamps, reward codes, prize claims
// and feedback). Its "database" is a separate key in this browser's storage,
// which the visitor app never reads directly: it only talks to api.js.
import { local } from './storage.js';
import { verifyTap, issueToken, verifyToken } from './mock-edge.js';
import { dayKey, addDays, startOfDay } from './time.js';

const DB_KEY = 'rl-mock-server';
const PRIZE_KEY = 'rl-mock-prize-store';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let ctx = { tags: [], campaigns: [], rewards: [], settings: {} };
export function configure(bundle) { ctx = { tags: bundle.tags, campaigns: bundle.campaigns, rewards: bundle.rewards, settings: bundle.settings }; }

function db() {
  const d = local.get(DB_KEY, null) || {};
  return { counters: {}, taps: [], stamps: {}, snow: {}, codes: {}, feedback: [], batches: 0, ...d };
}
function saveDb(d) {
  if (d.taps.length > 1500) d.taps = d.taps.slice(-1500);
  if (d.feedback.length > 1500) d.feedback = d.feedback.slice(-1500);
  local.set(DB_KEY, d);
}
export function readDbForAdmin() { return db(); }

const tagById = (id) => ctx.tags.find((t) => t.id === id);
const endOfLondonDay = (at) => startOfDay(addDays(dayKey(at), 1)).getTime();
function randomCode(prefix, len = 4, chars = CODE_CHARS) {
  const bytes = new Uint8Array(len); crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (b) => chars[b % chars.length]).join('')}`;
}

export function tap({ tagId, e, c, sid, at }) {
  const d = db();
  const tag = tagById(tagId);
  const result = verifyTap({ tagId, e, c, tag, counters: d.counters });
  d.taps.push({ tag: tagId, at, result: result.status });
  if (result.status !== 'valid') { saveDb(d); return { status: result.status }; }
  d.counters[tagId] = result.ctr;
  saveDb(d);
  const ttl = (ctx.settings.tokenTtlMin || 10) * 60000;
  const token = issueToken({ tag: tagId, sid, iat: at, exp: at + ttl, jti: Math.random().toString(36).slice(2, 10) });
  return { status: tag.status === 'maintenance' ? 'valid-maintenance' : 'valid', token, tag: tagId, exp: at + ttl };
}

function campaignRoutesFor(tagId, at) {
  const today = dayKey(new Date(at));
  const out = [];
  for (const c of ctx.campaigns || []) {
    if ((c.activeFrom && c.activeFrom > today) || (c.activeTo && c.activeTo < today)) continue;
    for (const r of Object.values(c.routes)) if (r.stops.some((s) => s.tag === tagId)) out.push({ campaign: c, route: r });
  }
  return out;
}

export function stamp({ token, sid, at }) {
  const p = verifyToken(token, at);
  if (!p || p.sid !== sid) return { ok: false, reason: 'token' };
  const d = db();
  const tag = tagById(p.tag);
  d.stamps[sid] = d.stamps[sid] || [];
  let newStamp = false;
  if (tag && tag.collectible && !d.stamps[sid].includes(p.tag)) { d.stamps[sid].push(p.tag); newStamp = true; }
  const snowNew = [];
  for (const { route } of campaignRoutesFor(p.tag, at)) {
    d.snow[sid] = d.snow[sid] || {};
    d.snow[sid][route.id] = d.snow[sid][route.id] || [];
    if (!d.snow[sid][route.id].includes(p.tag)) { d.snow[sid][route.id].push(p.tag); snowNew.push(route.id); }
  }
  saveDb(d);
  return { ok: true, tag: p.tag, newStamp, stamps: [...d.stamps[sid]], snow: { ...(d.snow[sid] || {}) }, snowNew };
}

export function claimReward({ token, sid, rewardId, at }) {
  const p = verifyToken(token, at);
  if (!p || p.sid !== sid) return { ok: false, reason: 'token' };
  const reward = (ctx.rewards || []).find((r) => r.id === rewardId);
  if (!reward) return { ok: false, reason: 'unknown-reward' };
  const d = db();
  const count = (d.stamps[sid] || []).filter((id) => tagById(id)?.collectible).length;
  if (count < reward.threshold) return { ok: false, reason: 'not-enough-stamps' };
  const existing = Object.entries(d.codes).find(([, v]) => v.kind === 'reward' && v.ref === rewardId && v.sid === sid && v.expires > at);
  if (existing) return { ok: true, code: existing[0], expires: existing[1].expires, used: existing[1].used };
  let code; do { code = randomCode(reward.codePrefix || 'LOOP'); } while (d.codes[code]);
  d.codes[code] = { kind: 'reward', ref: rewardId, sid, issued: at, expires: endOfLondonDay(new Date(at)), used: null };
  saveDb(d);
  return { ok: true, code, expires: d.codes[code].expires, used: null };
}

// Staff check at the partner: single use, expires at the end of the day.
export function redeemCode({ code, at }) {
  const d = db();
  const c = d.codes[String(code || '').trim().toUpperCase()];
  if (!c) return { status: 'unknown' };
  if (c.expires <= at) return { status: 'expired' };
  if (c.used) return { status: 'used', usedAt: c.used };
  c.used = at;
  saveDb(d);
  return { status: 'ok', kind: c.kind, ref: c.ref };
}

export function claimPrize({ token, sid, routeId, contact, at }) {
  const p = verifyToken(token, at);
  if (!p || p.sid !== sid) return { ok: false, reason: 'token' };
  const c = (ctx.campaigns || []).find((x) => x.routes && x.routes[routeId]);
  if (!c) return { ok: false, reason: 'unknown-route' };
  const route = c.routes[routeId];
  const finalTag = route.stops.find((s) => s.isFinal)?.tag;
  if (p.tag !== finalTag) return { ok: false, reason: 'claim-at-final' };
  const d = db();
  const got = ((d.snow[sid] || {})[routeId]) || [];
  if (!route.stops.every((s) => got.includes(s.tag))) return { ok: false, reason: 'not-all-found' };
  const existing = Object.entries(d.codes).find(([, v]) => v.kind === 'prize' && v.ref === routeId && v.sid === sid);
  let code;
  if (existing) code = existing[0];
  else {
    do { code = randomCode(route.codePrefix, 4, '0123456789'); } while (d.codes[code]);
    d.codes[code] = { kind: 'prize', ref: routeId, sid, issued: at, expires: endOfLondonDay(startOfDay(c.codeValidUntil)), used: null };
    saveDb(d);
  }
  let deleteAfter = null;
  if (contact) {
    deleteAfter = addDays(c.activeTo, c.prizeRetentionDays || 90);
    const store = local.get(PRIZE_KEY, []) || [];
    store.push({ code, route: routeId, contact, consentVersion: 'demo-1', created: new Date(at).toISOString(), deleteAfter });
    local.set(PRIZE_KEY, store);
  }
  return { ok: true, code, expires: d.codes[code].expires, deleteAfter };
}

// Feedback arrives in small batches. Each item carries the token from the tap
// at that place; it is checked, then stored without the token.
export function feedback({ items, at }) {
  const d = db();
  let accepted = 0; let rejected = 0;
  for (const it of items) {
    const p = verifyToken(it.token, it.ts);
    if (!p || p.tag !== it.tag || it.ts > at + 60000) { rejected++; continue; }
    d.feedback.push({ tag: it.tag, rating: it.rating, comment: String(it.comment || '').slice(0, 140), ts: it.ts, lang: it.lang, day: dayKey(new Date(it.ts)), sid: it.sid });
    accepted++;
  }
  d.batches += 1;
  saveDb(d);
  return { accepted, rejected };
}

export function prizeStoreForAdmin() { return local.get(PRIZE_KEY, []) || []; }
