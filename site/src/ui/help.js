// Help and safe spots, plus the buddy link: anyone in a party can open the same
// link and see the same trail, the same stop and the same way back. The link
// carries no personal data and grants no stamps.
import { state, save } from '../state.js';
import { ctx, trailById } from '../ctx.js';
import { t, pick, getLang, setLang } from '../i18n.js';
import { esc, $ } from '../markup.js';
import { onRender } from '../router.js';
import { b64urlEncode, b64urlDecode } from '../hmac.js';
import { setTapBanner } from './common.js';

function renderHelp() {
  $('#safeSpotsList').innerHTML = (ctx.bundle.safePlaces || []).map((s) => `<li><span class="hl-name">${esc(pick(s.name))}</span><span class="hl-detail">${esc(pick(s.detail))}</span></li>`).join('');
  $('#shareStatus').textContent = '';
}

export function planUrl() {
  const j = state.journey;
  const plan = { v: 1, l: getLang() };
  if (j && j.kind === 'trail') { plan.tr = j.trailId; plan.s = j.stopIdx; }
  if (j && j.kind === 'route' && j.then) { plan.tr = j.then.trailId; plan.s = j.then.stopIdx; }
  if (state.cruise) { plan.c = 1; if (state.shipTime) plan.t = state.shipTime; }
  return `${location.origin}/?plan=${b64urlEncode(JSON.stringify(plan))}`;
}

export function applyPlan(encoded) {
  try {
    const p = JSON.parse(b64urlDecode(encoded));
    if (p.l && !state.lang && p.l === getLang()) state.lang = p.l;
    if (p.c) { state.cruise = true; if (/^\d{2}:\d{2}$/.test(p.t || '')) state.shipTime = p.t; }
    if (p.tr && trailById(p.tr)) state.journey = { kind: 'trail', trailId: p.tr, stopIdx: Math.max(0, Number(p.s) || 0), stepIdx: 0 };
    state.setupComplete = true;
    state.sharedPlan = true;
    save();
    setTapBanner('good', t('buddy.opened'));
    return true;
  } catch { return false; }
}

export const actions = {
  'share-plan': async () => {
    const url = planUrl();
    const status = $('#shareStatus');
    try {
      if (navigator.share) { await navigator.share({ title: t('buddy.shareText'), url }); return; }
    } catch { /* cancelled or blocked: fall back to copying */ }
    try { await navigator.clipboard.writeText(url); status.textContent = t('buddy.copied'); } catch { status.textContent = url; }
  },
};

onRender('help', renderHelp);
