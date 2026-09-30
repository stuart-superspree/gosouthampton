// Return to ship (cruise visitors only). The route is the shortest chain of
// authored legs to the terminal. The warning rule is the prototype's: warn when
// minutes left are at or below the walk back plus a cautious margin. Wording
// never promises timings and always points to the cruise line.
import { state, save } from '../state.js';
import { ctx, routing, tagById, placeName, setting, isCruise } from '../ctx.js';
import { t, pick } from '../i18n.js';
import { esc, md, $ } from '../markup.js';
import { onRender, onShow, go, current } from '../router.js';
import { returnRoute, stepCards } from '../journey.js';
import { minutesUntil, zoned, dayKey, hhmm } from '../time.js';
import { now } from '../clock.js';
import { renderArrived } from './trail.js';

export function walkBack(from) {
  const terminal = setting('terminalTag');
  if (!from) return null;
  if (from === terminal) return { legs: [], total: 0 };
  return returnRoute(from, terminal, routing());
}

function fmtCountdown(mins) {
  if (mins < 0) return '··';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export function countdownState() {
  if (!isCruise() || !state.shipTime) return null;
  const mins = minutesUntil(state.shipTime, now());
  const route = walkBack(state.currentPlace);
  const walk = route ? route.total : (tagById(state.currentPlace)?.walkBackMin ?? 0);
  const margin = setting('returnMarginMin') ?? 15;
  const cls = mins <= walk + margin ? 'red' : mins <= (setting('amberThresholdMin') ?? 90) ? 'amber' : '';
  return { mins, walk, margin, cls, route };
}

export function tickCountdown() {
  const s = countdownState();
  document.querySelectorAll('.countdown').forEach((c) => {
    c.classList.toggle('hidden', !s);
    c.classList.remove('amber', 'red');
    if (s && s.cls) c.classList.add(s.cls);
    const txt = c.querySelector('.countdown-text');
    if (txt && s) txt.textContent = fmtCountdown(s.mins);
  });
  const fr = document.getElementById('floatingReturn');
  const scr = current();
  const showFloat = isCruise() && ['home', 'tour-overview', 'step'].includes(scr) && state.currentPlace && state.currentPlace !== setting('terminalTag');
  fr.classList.toggle('hidden', !showFloat);
  fr.classList.toggle('urgent', !!(s && s.cls === 'red'));
}

function renderReturn() {
  const from = state.currentPlace;
  const terminal = setting('terminalTag');
  const statusEl = $('#returnStatus'); const list = $('#returnSteps'); const lead = $('#returnLead');
  const card = $('#returnStepsCard');
  if (!from) {
    lead.textContent = t('return.unknownPlace'); statusEl.innerHTML = ''; card.classList.add('hidden'); return;
  }
  if (from === terminal) {
    lead.textContent = t('return.atTerminal'); statusEl.innerHTML = ''; card.classList.add('hidden'); return;
  }
  const route = walkBack(from);
  if (!route) {
    lead.textContent = placeName(from);
    statusEl.innerHTML = `<div class="return-status urgent" role="alert">${esc(t('return.noRoute'))}<button class="btn btn-secondary btn-small mt-12" data-action="open-help">${esc(t('return.openHelp'))}</button></div>`;
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  lead.innerHTML = esc(t('return.lead', { place: '\u0000', n: route.total })).replace('\u0000', `<strong>${esc(placeName(from))}</strong>`);
  lead.dataset.total = route.total;
  const s = countdownState();
  if (!state.shipTime) {
    statusEl.innerHTML = `<div class="return-status">${esc(t('return.noTime'))} <button class="btn btn-secondary btn-small mt-12" data-action="open-ship-time">${esc(t('return.setTime'))}</button></div>`;
  } else {
    const [h, m] = state.shipTime.split(':').map(Number);
    const [y, mo, d] = dayKey(now()).split('-').map(Number);
    const leaveBy = new Date(zoned(y, mo, d, h, m).getTime() - (route.total + s.margin) * 60000);
    statusEl.innerHTML = s.cls === 'red'
      ? `<div class="return-status urgent" role="alert" id="returnWarning">${esc(t('return.warning', { walk: route.total, margin: s.margin }))}</div>`
      : `<div class="return-status" id="returnLeaveBy"><span class="rs-big">${esc(hhmm(leaveBy))}</span>${esc(t('return.leaveBy', { margin: s.margin, time: hhmm(leaveBy) }))}</div>`;
  }
  list.innerHTML = stepCards(route.legs).map((c) => `<li><span><span class="stop-name">${esc(pick(c.title) || placeName(c.to))}</span><span class="stop-sub">${md(pick(c.text))}</span></span></li>`).join('');
}

export const actions = {
  'go-return': () => { if (isCruise()) go('return-to-ship'); },
  'confirm-returned': () => { state.currentPlace = setting('terminalTag'); state.placeVerified = false; state.journey = null; save(); renderArrived('returned'); go('arrived'); },
};

onRender('return-to-ship', renderReturn);
onShow(() => tickCountdown());
