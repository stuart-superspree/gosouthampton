// Passport and rewards. Stamps come from the (mock) server after a verified
// tap. Reward codes are issued by the server, single use, and expire at the end
// of the day. Claiming needs a recent verified tap, so codes cannot be made up.
import { state, save } from '../state.js';
import { ctx, validToken, tagById, setting } from '../ctx.js';
import { t, pick } from '../i18n.js';
import { esc, $ } from '../markup.js';
import { onRender } from '../router.js';
import { api } from '../api.js';
import { hhmm } from '../time.js';
import { counts } from '../outbox.js';

const collectible = () => (setting('passportOrder') || []).filter((id) => tagById(id)?.collectible);
export const stampCount = () => (state.passport || []).filter((id) => collectible().includes(id)).length;
const rewards = () => ctx.bundle.rewards || [];
const nextReward = () => rewards().find((r) => stampCount() < r.threshold);
function liveCode(r) { const c = state.rewards[r.id]; return c && c.expires > Date.now() ? c : null; }
const readyToClaim = () => rewards().filter((r) => stampCount() >= r.threshold && !liveCode(r));

export function passportCardHtml() {
  const count = stampCount();
  if (count === 0) return '';
  const total = collectible().length;
  const ready = readyToClaim();
  const next = nextReward();
  let sub;
  if (ready.length) sub = t('passport.cardSubReady').replace('{r}', pick(ready[0].title));
  else if (next) sub = t('passport.cardSubNext').replace('{n}', next.threshold - count).replace('{r}', pick(next.title));
  else sub = t('passport.cardSubFull');
  const cta = ready.length ? t('passport.cardCtaClaim') : t('passport.cardCtaView');
  const stamps = collectible().map((id) => `<span class="passport-stamp ${state.passport.includes(id) ? 'filled' : ''}" aria-hidden="true">${state.passport.includes(id) ? '✓' : ''}</span>`).join('');
  return `<button class="passport-card ${ready.length ? 'ready-claim' : ''}" data-action="open-passport"><p class="passport-card-title">${esc(t('passport.cardTitle'))}</p><p class="passport-card-sub"><span data-stamp-count="${count}">${count}/${total}</span> ${esc(t('passport.stamps'))} · ${esc(sub)}</p><div class="passport-stamps">${stamps}</div><p class="passport-card-cta">${esc(cta)}</p></button>`;
}

let claimMsg = {};
function renderPassport() {
  const count = stampCount();
  $('#passportCount').textContent = `${count} / ${collectible().length}`;
  const pending = counts().taps;
  const pendEl = $('#passportPending');
  pendEl.textContent = pending ? t('passport.pending', { n: pending }) : '';
  pendEl.classList.toggle('hidden', !pending);
  $('#passportStampGrid').innerHTML = collectible().map((id) => {
    const filled = state.passport.includes(id);
    return `<div class="stamp-tile${filled ? ' filled' : ''}"><div class="st-icon" aria-hidden="true">${filled ? '✓' : '·'}</div><div class="st-name">${esc(pick(tagById(id).name))}</div><div class="st-status">${esc(filled ? t('passport.stamped') : t('passport.notYet'))}</div></div>`;
  }).join('');
  $('#passportRewardsHost').innerHTML = rewards().map((r) => {
    const unlocked = count >= r.threshold;
    const code = liveCode(r);
    const badge = code ? (code.used ? t('passport.rewardClaimed') : t('passport.rewardReady')) : unlocked ? t('passport.rewardReady') : `${r.threshold - count} ${t('passport.rewardMore')}`;
    let bottom = '';
    if (unlocked && code) {
      bottom = `<div class="reward-code"><span class="reward-code-num" data-reward-code="${esc(r.id)}">${esc(code.code)}</span><div class="reward-code-instructions">${esc(pick(r.instructions))}</div><div class="reward-code-sim">${esc(t('passport.codeSim', { time: hhmm(new Date(code.expires - 60000)) }))}</div></div>`;
    } else if (unlocked) {
      bottom = `<button class="rw-claim" data-action="claim-reward" data-reward-id="${esc(r.id)}">${esc(t('passport.claimCta'))}</button>${claimMsg[r.id] ? `<p class="rw-msg" role="alert">${esc(claimMsg[r.id])}</p>` : ''}`;
    }
    return `<div class="reward-card${unlocked ? ' unlocked' : ' locked'}"><div class="rw-icon" aria-hidden="true">${esc(r.icon)}</div><p class="rw-badge">${esc(badge)}</p><h3 class="rw-title">${esc(pick(r.title))}</h3><p class="rw-sub">${esc(pick(r.sub))}</p><p class="rw-partner">${esc(pick(r.partner))}</p>${bottom}</div>`;
  }).join('');
}

export const actions = {
  'claim-reward': async (el) => {
    const id = el.dataset.rewardId;
    const tok = validToken();
    if (!tok) { claimMsg[id] = t('passport.claimNeedTap'); renderPassport(); return; }
    el.disabled = true;
    try {
      const res = await api.claimReward(tok.token, ctx.sid, id);
      if (res.ok) { state.rewards[id] = { code: res.code, expires: res.expires, used: res.used }; claimMsg[id] = ''; save(); }
      else claimMsg[id] = res.reason === 'token' ? t('passport.claimNeedTap') : t('passport.claimFailed');
    } catch (err) {
      claimMsg[id] = err.offline ? t('offline.banner') : t('passport.claimFailed');
    }
    renderPassport();
  },
};

onRender('passport', renderPassport);
