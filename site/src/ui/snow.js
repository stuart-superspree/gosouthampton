// Seasonal Snow Windows Trail, switched on and off by dates in data. Each window
// has a Loop; a window's stamp needs a verified tap there. The prize code is
// issued by the (mock) server only when every window on the route was tapped,
// and only from a tap at SeaCity Museum. Prize-draw details go to a separate
// store with a stated deletion date; nothing personal is kept on the phone.
import { state, save } from '../state.js';
import { ctx, validToken } from '../ctx.js';
import { t, pick, getLang } from '../i18n.js';
import { esc, $ } from '../markup.js';
import { go, backTo, onRender } from '../router.js';
import { api } from '../api.js';
import { formatLongDate, addDays } from '../time.js';
import { setImage, toast } from './common.js';

const campaign = () => (ctx.bundle.campaigns || []).find((c) => c.id === 'snow');
const route = (id) => campaign()?.routes[id];
const found = (rid, stop) => (state.snow.stamps[rid] || []).includes(stop.tag);
const foundCount = (rid) => route(rid).stops.filter((s) => found(rid, s)).length;
const complete = (rid) => foundCount(rid) >= route(rid).stops.length;
let submitError = '';

export function openSnow() { go('snow-overview'); }

function renderOverview() {
  const c = campaign();
  setImage($('#snowOverviewImg'), null, c.heroImage, pick(c.title));
  $('#snowOverviewTitle').textContent = pick(c.title);
  $('#snowOverviewDates').textContent = pick(c.dates);
  $('#snowOverviewBlurb').textContent = pick(c.blurb);
  $('#snowOverviewPrize').textContent = pick(c.prizeBlurb);
  $('#snowRoutePickerHost').innerHTML = Object.values(c.routes).map((r) => {
    const count = foundCount(r.id); const total = r.stops.length;
    const submitted = state.snow.submitted[r.id];
    const progress = submitted ? t('snow.routeSubmitted') : count >= total ? t('snow.routeReady') : count > 0 ? `${count}/${total} ${t('snow.stampsLower')}` : '';
    return `<button class="snow-route-card${count >= total ? ' done' : ''}" data-action="pick-snow-route" data-route-id="${esc(r.id)}"><span class="snow-route-icon" aria-hidden="true">${esc(r.icon)}</span><span class="src-body"><span class="src-name">${esc(pick(r.name))}</span><span class="src-meta">${total} ${esc(t('snow.windowsLower'))} · ${r.duration} ${esc(t('snow.minsLower'))} · ${r.distance} ${esc(r.distanceUnit)}</span>${progress ? `<span class="src-progress">${esc(progress)}</span>` : ''}</span></button>`;
  }).join('');
}

function renderRoute() {
  const rid = state.snow.activeRoute; const r = route(rid);
  if (!r) return;
  $('#snowRouteIcon').textContent = r.icon;
  $('#snowRouteName').textContent = pick(r.name);
  $('#snowRouteMeta').textContent = `${r.duration} ${t('snow.mins')} · ${r.distance} ${r.distanceUnit}`;
  $('#snowRouteCount').textContent = `${foundCount(rid)} / ${r.stops.length}`;
  $('#snowStopGrid').innerHTML = r.stops.map((s) => {
    const f = found(rid, s);
    return `<button class="stamp-tile${f ? ' filled' : ''}${s.isFinal ? ' final' : ''}" data-action="open-snow-stop" data-stop-id="${s.n}"><div class="st-icon" aria-hidden="true">${f ? (s.isFinal ? '★' : '✓') : s.n}</div><div class="st-name">${esc(s.name)}</div><div class="st-status">${esc(f ? t('snow.tileFound') : t('snow.tileTap'))}</div></button>`;
  }).join('');
  let cta = '';
  if (complete(rid)) {
    const sub = state.snow.submitted[rid];
    cta = sub
      ? `<div class="snow-submit-cta"><h3>${esc(t('snow.alreadySubmittedTitle'))}</h3><p>${esc(t('snow.alreadySubmittedSub').replace('{code}', sub.code))}</p><button class="btn btn-secondary" data-action="open-snow-confirmation">${esc(t('snow.viewCode'))}</button></div>`
      : `<div class="snow-submit-cta"><h3>${esc(t('snow.readyTitle'))}</h3><p>${esc(t('snow.readySub'))}</p><button class="btn btn-primary btn-arrow" data-action="open-snow-submit">${esc(t('snow.submitCta'))}</button></div>`;
  }
  $('#snowSubmitCtaHost').innerHTML = cta;
}

function renderStop() {
  const rid = state.snow.activeRoute; const r = route(rid);
  const s = r && r.stops.find((x) => x.n === state.snow.activeStopId);
  if (!s) return;
  $('#snowStopNumber').textContent = `${t('snow.window')} ${s.n} ${t('snow.of')} ${r.stops.length}`;
  $('#snowStopName').textContent = s.name;
  $('#snowStopAddress').textContent = s.address;
  const f = found(rid, s);
  $('#snowStopFoundBanner').classList.toggle('hidden', !f);
  $('#snowStopNeedTap').classList.toggle('hidden', f || !!validToken(s.tag));
  $('#snowStopAnswer').value = (state.snow.answers[rid] && state.snow.answers[rid][s.n]) || '';
}

function renderSubmit() {
  const rid = state.snow.activeRoute;
  const sub = state.snow.submitted[rid];
  $('#snowSubmitFormHost').classList.toggle('hidden', !!sub);
  $('#snowConfirmationHost').classList.toggle('hidden', !sub);
  if (sub) { $('#snowSubmissionCode').textContent = sub.code; return; }
  const c = campaign();
  $('#snowRetention').textContent = t('snow.retention', { date: formatLongDate(addDays(c.activeTo, c.prizeRetentionDays || 90), getLang()) });
  document.querySelectorAll('.snow-rating-btn').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.rating) === state.snow.rating)));
  const err = $('#snowSubmitError');
  err.textContent = submitError;
  err.classList.toggle('hidden', !submitError);
}

// Called after a verified tap at a snow window (see tap.js).
export function openWindowForTag(tagId) {
  const c = campaign();
  if (!c) return false;
  for (const r of Object.values(c.routes)) {
    const s = r.stops.find((x) => x.tag === tagId);
    if (s && (state.snow.stamps[r.id] || []).includes(tagId)) {
      state.snow.activeRoute = r.id; state.snow.activeStopId = s.n; save();
      go('snow-stop');
      return true;
    }
  }
  return false;
}

async function claim(contact) {
  const rid = state.snow.activeRoute;
  const finalTag = route(rid).stops.find((s) => s.isFinal).tag;
  const tok = validToken(finalTag);
  if (!tok) { submitError = t('snow.claimNeedTap'); renderSubmit(); return; }
  try {
    const res = await api.claimPrize(tok.token, ctx.sid, rid, contact);
    if (!res.ok) { submitError = res.reason === 'not-all-found' ? t('snow.notAllFound') : t('snow.claimNeedTap'); renderSubmit(); return; }
    submitError = '';
    state.snow.submitted[rid] = { code: res.code, expires: res.expires };
    save();
    renderSubmit();
    $('#snowConfTitle').focus({ preventScroll: true });
  } catch (err) { submitError = err.offline ? t('offline.banner') : t('passport.claimFailed'); renderSubmit(); }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.snow-rating-btn[data-rating]');
  if (!btn) return;
  state.snow.rating = Number(btn.dataset.rating); save();
  document.querySelectorAll('.snow-rating-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
});

export const actions = {
  'pick-snow-route': (el) => { state.snow.activeRoute = el.dataset.routeId; save(); go('snow-route'); },
  'snow-back-to-overview': () => backTo('snow-overview'),
  'open-snow-stop': (el) => { state.snow.activeStopId = Number(el.dataset.stopId); save(); go('snow-stop'); },
  'mark-snow-found': () => {
    const rid = state.snow.activeRoute; const s = route(rid).stops.find((x) => x.n === state.snow.activeStopId);
    const answer = ($('#snowStopAnswer').value || '').trim().slice(0, 200);
    state.snow.answers[rid] = state.snow.answers[rid] || {};
    if (answer) state.snow.answers[rid][s.n] = answer;
    save();
    if (found(rid, s)) { toast(`${t('passport.stampedToast')} ${s.name}`); backTo('snow-route'); return; }
    $('#snowStopNeedTap').classList.remove('hidden');
    toast(t('snow.answerSaved'), '✎');
  },
  'open-snow-submit': () => { submitError = ''; go('snow-submit'); },
  'open-snow-confirmation': () => go('snow-submit'),
  'submit-snow': () => {
    const name = ($('#snowFieldName').value || '').trim();
    const email = ($('#snowFieldEmail').value || '').trim();
    if (!name) { submitError = t('snow.errName'); renderSubmit(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { submitError = t('snow.errEmail'); renderSubmit(); return; }
    claim({ name, email, postcode: ($('#snowFieldPostcode').value || '').trim(), adults: Number($('#snowFieldAdults').value || 0), children: Number($('#snowFieldChildren').value || 0), rating: state.snow.rating, comments: ($('#snowFieldComments').value || '').trim().slice(0, 500) });
  },
  'submit-snow-anon': () => claim(null),
};

onRender('snow-overview', renderOverview);
onRender('snow-route', renderRoute);
onRender('snow-stop', renderStop);
onRender('snow-submit', renderSubmit);
