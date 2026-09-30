// Home: where you are, notices, the quiet-time nudge, trail cards, the passport
// card, What's on, the walk-in route and one-tap feedback for this place.
import { state, save } from '../state.js';
import { ctx, routing, tagById, placeName, setting, isCruise, trailById } from '../ctx.js';
import { t, pick } from '../i18n.js';
import { esc, $ } from '../markup.js';
import { onRender, go } from '../router.js';
import { now } from '../clock.js';
import { dayKey } from '../time.js';
import { isNoticeActive } from '../graph.js';
import { trailStops, walkInRoute, isActiveOn } from '../journey.js';
import { pickNudge } from '../nudge.js';
import { eventsToday, eventsThisWeek } from '../registers.js';
import { renderTapBanner, applyBrand, demoPill, setImage } from './common.js';
import { rejoinCard, deck, openOverview } from './trail.js';
import { passportCardHtml } from './passport.js';
import { feedbackCardHtml } from './feedback.js';
import { tickCountdown } from './return.js';

function noticesHtml() {
  const n = now();
  return (ctx.bundle.notices || []).filter((x) => isNoticeActive(x, n)).map((x) => {
    const kind = x.severity === 'closure' ? 'closure' : x.severity === 'warn' ? 'warn' : 'info';
    const label = t(kind === 'closure' ? 'notices.closure' : kind === 'warn' ? 'notices.warn' : 'notices.info');
    return `<div class="notice-card ${kind}" role="note"><div><span class="notice-kind">${esc(label)}</span>${esc(pick(x.text))}</div></div>`;
  }).join('');
}

function nudgeHtml() {
  const d = deck();
  const zones = [tagById(state.currentPlace)?.zone, d ? tagById(d.target)?.zone : null];
  const activeTrailId = state.journey ? (state.journey.trailId || state.journey.then?.trailId) : null;
  const trails = ctx.bundle.trails.filter((x) => x.type === 'trail' && isActiveOn(x, now()));
  const nudge = pickNudge({ calendar: ctx.bundle.busy, now: now(), zones, activeTrailId, dismissed: state.nudgeDismissed, sessionKey: ctx.sid, share: setting('nudgeShare') ?? 1, trails });
  if (!nudge) return '';
  return `<div class="home-card nudge-card" id="nudgeCard"><p class="eyebrow">${esc(t('nudge.eyebrow'))}</p><h2>${esc(pick(nudge.trail.title))}</h2><p>${esc(pick(nudge.entry.reason))}</p>`
    + `<button class="btn btn-primary btn-small" data-action="nudge-try" data-trail-id="${esc(nudge.trail.id)}">${esc(t('nudge.try'))}</button>`
    + `<button class="btn btn-ghost btn-small" data-action="nudge-no">${esc(t('nudge.no'))}</button>`
    + (nudge.entry.demo ? `<p class="demo-note">${esc(pick(nudge.entry.label))}</p>` : '') + '</div>';
}

function continueHtml() {
  const d = deck();
  if (!d) return '';
  const j = state.journey;
  const trail = trailById(j.trailId || j.then?.trailId);
  const title = trail ? pick(trail.title) : t('home.walkTitle');
  return `<button class="continue-card" data-action="resume-journey"><span><span class="cc-title">${esc(t('trail.continue', { title }))}</span><span class="cc-sub">${esc(t('trail.continueSub', { place: placeName(d.target) }))}</span></span><span class="cc-arrow" aria-hidden="true">→</span></button>`;
}

function tourCard(trail) {
  const r = routing();
  const stops = trail.type === 'campaign'
    ? Object.values(ctx.bundle.campaigns.find((c) => c.id === trail.campaign)?.routes || {}).reduce((n, rt) => n + rt.stops.length, 0)
    : trailStops(trail, r.legsById).length;
  const stopsLabel = trail.type === 'campaign' ? `${stops} ${t('snow.windowsLower')}` : t('overview.stopsLabel', { n: stops });
  return `<button class="tour-card" data-action="open-tour" data-tour-id="${esc(trail.id)}"><div class="tour-img-wrap"><img src="${esc(trail.heroImage)}" alt="" loading="lazy" decoding="async" /><div class="tour-overlay"><span class="tour-badges"><span class="tour-theme">${esc(pick(trail.theme))}</span>${trail.demo ? demoPill() : ''}</span><div><h3 class="tour-title">${esc(pick(trail.title))}</h3><p class="tour-meta"><span>${esc(stopsLabel)}</span><span class="dot"></span><span>${esc(t('overview.minsLabel', { n: trail.walkMin }))}</span><span class="dot"></span><span>${esc(t('overview.kmLabel', { n: trail.km }))}</span></p></div></div></div></button>`;
}

function renderHome() {
  applyBrand();
  const place = state.currentPlace && tagById(state.currentPlace);
  $('#currentHubName').textContent = place ? pick(place.name) : t('home.noPlace');
  renderTapBanner();
  $('#noticesHost').innerHTML = noticesHtml();
  $('#nudgeHost').innerHTML = nudgeHtml();
  $('#rejoinHost').innerHTML = rejoinCard();
  $('#continueHost').innerHTML = continueHtml();
  $('#passportCardHost').innerHTML = passportCardHtml();

  const n = now();
  const today = eventsToday(ctx.register.events || [], n).length;
  const week = eventsThisWeek(ctx.register.events || [], n).length;
  const pill = $('#eventsPillHost');
  pill.classList.toggle('hidden', today === 0 && week === 0);
  $('#eventsPillText').textContent = today === 1 ? t('events.pillOne') : today > 1 ? t('events.pillMany').replace('{n}', today) : t('events.pillWeek', { n: week });

  const w = setting('walkIn');
  const showWalk = state.currentPlace === w.from || (!state.currentPlace && isCruise());
  $('#walkInSection').classList.toggle('hidden', !showWalk);
  if (showWalk) {
    const route = walkInRoute(w, routing());
    $('#walkHeroTitle').textContent = t('home.walkTo', { place: pick(w.label) });
    $('#walkHeroMins').textContent = route ? t('home.walkMins', { n: route.total }) : t('trail.noRoute');
    $('#walkHeroStops').textContent = route ? t('home.walkSteps', { n: route.legs.reduce((s, l) => s + l.steps.length, 0) }) : '';
    setImage(null, $('#walkHeroCredit'), w.image);
  }
  $('#cruisePromptHost').innerHTML = isCruise() ? '' : `<button class="cruise-prompt" data-action="open-ship-time">${esc(t('home.cruisePrompt'))}</button>`;

  const active = ctx.bundle.trails.filter((x) => isActiveOn(x, n));
  $('#tourCardsHost').innerHTML = active.filter((x) => x.type === 'trail').map(tourCard).join('');
  const seasonal = active.filter((x) => x.type === 'campaign');
  $('#seasonalSection').classList.toggle('hidden', seasonal.length === 0);
  $('#seasonalToursHost').innerHTML = seasonal.map(tourCard).join('');
  $('#feedbackHost').innerHTML = feedbackCardHtml();
  tickCountdown();
}

export const actions = {
  'nudge-try': (el) => openOverview(el.dataset.trailId),
  'nudge-no': () => { state.nudgeDismissed[dayKey(now())] = true; save(); $('#nudgeHost').innerHTML = ''; },
  'open-ship-time': () => go('ship-time'),
};

onRender('home', renderHome);
export { renderHome };
