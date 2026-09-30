// Tap entry. A secured tap opens /t/<tagId>?e=<message>&c=<check>. The app asks
// the (mock) edge function to verify it; only a valid, never-seen counter gives a
// short-lived token, and only a token gives stamps, reward codes or feedback.
// A place link without e and c is browse mode: content, but no stamp.
import { state, save } from './state.js';
import { ctx, setToken, tagById, placeName } from './ctx.js';
import { api, isOnline } from './api.js';
import { queueTap } from './outbox.js';
import { t, pick } from './i18n.js';
import { replaceUrl } from './storage.js';
import { resetTo } from './router.js';
import { toast, vibrate, setTapBanner } from './ui/common.js';
import { arrive, afterArrival, offTrail } from './ui/trail.js';
import { openWindowForTag } from './ui/snow.js';
import { stampCount } from './ui/passport.js';

export function parseTapLocation(loc, legacySlugs = {}) {
  const q = new URLSearchParams(loc.search);
  const m = loc.pathname.match(/^\/t\/([A-Za-z0-9]{3,16})\/?$/);
  const tagId = m ? m[1] : q.get('t');
  if (tagId) return { tagId, e: q.get('e'), c: q.get('c') };
  const slug = q.get('tag');
  if (slug) return { tagId: legacySlugs[slug] || slug, e: null, c: null, legacy: true };
  return null;
}

// Remove tap values from the address bar so a reload is not a replay.
export function cleanTapUrl() {
  const q = new URLSearchParams(location.search);
  ['t', 'e', 'c', 'tag', 'plan', 'reset'].forEach((k) => q.delete(k));
  const qs = q.toString();
  replaceUrl(`/${qs ? `?${qs}` : ''}`);
}

function browseAt(tag, msg, kind = '') {
  if (tag.kind === 'loop') { state.currentPlace = tag.id; state.placeVerified = false; save(); }
  setTapBanner(kind, msg || t('tap.browse'));
}

export async function handleTap(p, { configured = true } = {}) {
  const tag = tagById(p.tagId);
  if (!tag || tag.status === 'retired') { setTapBanner('bad', t('tap.unknown')); return 'unknown'; }
  if (!p.e || !p.c) { browseAt(tag); return 'browse'; }
  const queue = () => { queueTap({ tagId: p.tagId, e: p.e, c: p.c, at: Date.now() }); browseAt(tag, t('tap.queued')); return 'queued'; };
  if (!isOnline()) return queue();
  setTapBanner('', t('tap.checking'));
  let res;
  try { res = await api.verifyTap(p.tagId, p.e, p.c, ctx.sid); } catch (err) { if (err.offline) return queue(); throw err; }
  if (res.status === 'replay' || res.status === 'invalid') { browseAt(tag, t('tap.replay'), 'bad'); return res.status; }
  if (res.status === 'unknown') { setTapBanner('bad', t('tap.unknown')); return 'unknown'; }
  return verified(p.tagId, res, { configured, navigate: true });
}

async function verified(tagId, res, { configured, navigate }) {
  setToken(res.token, tagId, res.exp);
  const before = stampCount();
  const s = await api.stamp(res.token, ctx.sid);
  const tag = tagById(tagId);
  state.passport = s.stamps.slice();
  for (const [rid, list] of Object.entries(s.snow || {})) state.snow.stamps[rid] = list.slice();
  if (tag.kind === 'loop') { state.currentPlace = tagId; state.placeVerified = true; }
  save();
  setTapBanner(res.status === 'valid-maintenance' ? '' : null, res.status === 'valid-maintenance' ? t('tap.maintenance') : null);
  vibrate(s.newStamp ? [40, 30, 60] : 50);
  if (s.newStamp || (s.snowNew && s.snowNew.length)) {
    setTimeout(() => toast(`${t('passport.stampedToast')} ${pick(tag.name)}`), 400);
    const after = stampCount();
    const unlocked = (ctx.bundle.rewards || []).find((r) => before < r.threshold && after >= r.threshold);
    if (unlocked) setTimeout(() => toast(`${t('passport.rewardUnlockedToast')} ${pick(unlocked.title)}`, unlocked.icon, 3500), 3300);
  }
  if (!configured || !navigate) return 'valid';
  if (tag.kind === 'snow-window' && openWindowForTag(tagId)) return 'valid';
  if (!state.journey && s.snowNew && s.snowNew.length && openWindowForTag(tagId)) return 'valid';
  if (state.journey && tag.kind === 'loop') {
    const r = arrive(tagId, { verified: true });
    if (r === 'off-trail') { offTrail(tagId); resetTo('home'); return 'valid'; }
    if (r === 'advanced' || r === 'complete') {
      if (!s.newStamp) setTimeout(() => toast(t('tap.arrivedToast', { place: placeName(tagId) })), 400);
      resetTo('home', { focus: false });
      afterArrival(r);
      return 'valid';
    }
  }
  resetTo('home');
  return 'valid';
}

// Taps made with no signal are verified later, in order, when back online.
export async function processQueuedTap(item) {
  const tag = tagById(item.tagId);
  if (!tag) return;
  const res = await api.verifyTap(item.tagId, item.e, item.c, ctx.sid);
  if (res.status === 'valid' || res.status === 'valid-maintenance') await verified(item.tagId, res, { configured: true, navigate: false });
}

// Kept from the prototype: on Android Chrome, Web NFC can read a Loop while the
// app is already open. A secured Loop carries its /t/ URL, so we simply open it
// and the normal verification runs. iPhones open the URL from the tag directly.
export function startWebNfc() {
  if (!('NDEFReader' in window)) return;
  try {
    const reader = new window.NDEFReader();
    reader.scan().then(() => {
      reader.addEventListener('reading', ({ message }) => {
        for (const record of message.records) {
          if (record.recordType !== 'url') continue;
          try {
            const url = new URL(new TextDecoder().decode(record.data));
            if (url.origin === location.origin && /^\/t\//.test(url.pathname)) location.assign(url.href);
          } catch { /* not a Loop URL */ }
        }
      });
    }).catch(() => { /* permission refused or NFC off: taps still work through the OS */ });
  } catch { /* unsupported */ }
}
