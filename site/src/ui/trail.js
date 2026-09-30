// Trail overview and the step screen. A trail's guidance is its legs' step
// cards; a closed or stepped leg is swapped for a chain of other authored legs.
// Walk-in, rejoin and carry-on routes use the same step screen.
import { state, save } from '../state.js';
import { ctx, routing, tagById, placeName, trailById, setting } from '../ctx.js';
import { t, pick, getLang } from '../i18n.js';
import { esc, md, $ } from '../markup.js';
import { go, resetTo, onRender, current } from '../router.js';
import { trailStops, resolveSegments, stepCards, walkInRoute, rejoinOptions, trailIsStepFree, legsTotal } from '../journey.js';
import { setImage, toast, demoPill } from './common.js';

let overviewTrailId = null;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const fmtNum = (n) => new Intl.NumberFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 }).format(n);

export function stopInfo(trail, placeId) {
  const sc = (trail.stops && trail.stops[placeId]) || {};
  const tag = tagById(placeId);
  return { title: pick(sc.title) || pick(tag?.name), sub: pick(sc.sub), copy: pick(sc.copy) || pick(tag?.blurb), image: sc.image || tag?.image };
}

export function openOverview(trailId) { overviewTrailId = trailId; go('tour-overview'); }

function renderOverview() {
  const trail = trailById(overviewTrailId);
  if (!trail) return;
  const r = routing();
  const stops = trailStops(trail, r.legsById);
  const segs = resolveSegments(trail, r);
  setImage($('#overviewHeroImg'), $('#overviewCredit'), trail.heroImage, pick(trail.title));
  $('#overviewTheme').textContent = pick(trail.theme);
  $('#overviewTitle').textContent = pick(trail.title);
  $('#overviewMins').textContent = t('overview.minsLabel', { n: trail.walkMin });
  $('#overviewStopsLabel').textContent = t('overview.stopsLabel', { n: stops.length });
  $('#overviewLength').textContent = t('overview.kmLabel', { n: fmtNum(trail.km) });
  $('#overviewBlurb').textContent = pick(trail.blurb);
  $('#statStops').textContent = stops.length;
  $('#statMins').textContent = trail.walkMin;
  $('#statKm').textContent = fmtNum(trail.km);
  const sf = trailIsStepFree(trail, r.legsById);
  const pill = $('#overviewStepFree');
  pill.textContent = sf ? `♿ ${t('trail.stepFree')}` : t('trail.hasSteps');
  pill.classList.toggle('steps', !sf);
  const walking = segs.every((s) => !s.noRoute) ? segs.reduce((n, s) => n + s.total, 0) : null;
  $('#overviewWalking').textContent = walking == null ? '' : t('trail.walking', { n: walking });
  const notes = [];
  if (trail.demo) notes.push(`<p class="demo-note">${esc(t('demo.content'))}</p>`);
  if (segs.some((s) => s.noRoute)) notes.push(`<p class="detour-note bad">${esc(t('trail.noRoute'))}</p>`);
  else if (segs.some((s) => s.detour === 'closed')) notes.push(`<p class="detour-note">${esc(t('trail.detourClosed'))}</p>`);
  else if (segs.some((s) => s.detour === 'step-free')) notes.push(`<p class="detour-note">${esc(t('trail.detourStepFree'))}</p>`);
  $('#overviewNotes').innerHTML = notes.join('');
  $('#stepFreeToggle').checked = !!state.stepFree;
  $('#overviewStopList').innerHTML = stops.map((p) => {
    const info = stopInfo(trail, p);
    return `<li><span><span class="stop-name">${esc(info.title)}</span><span class="stop-sub">${esc(info.sub)}</span></span></li>`;
  }).join('');
}

// The current deck of step cards for the active journey.
export function deck() {
  const j = state.journey;
  if (!j) return null;
  const r = routing();
  if (j.kind === 'trail') {
    const trail = trailById(j.trailId);
    if (!trail) return null;
    const stops = trailStops(trail, r.legsById);
    const segs = resolveSegments(trail, r);
    const i = clamp(j.stopIdx, 0, stops.length - 1);
    const info = stopInfo(trail, stops[i]);
    let cards; let seg = null;
    if (i === 0) cards = [{ text: trail.startText, image: info.image }];
    else {
      seg = segs[i - 1];
      cards = seg.noRoute ? [{ text: t('trail.noRoute'), image: info.image, noRoute: true }] : stepCards(seg.legs);
    }
    const k = clamp(j.stepIdx || 0, 0, cards.length - 1);
    return {
      kind: 'trail', trail, stops, seg, i, cards, k, card: cards[k], target: stops[i],
      title: info.title, copy: info.copy, image: cards[k].image || info.image,
      eyebrow: t('step.stopOf', { i: i + 1, n: stops.length }), pips: { n: stops.length, idx: i },
      context: cards.length > 1 ? t('step.stepOf', { i: k + 1, n: cards.length }) : '', isLast: k === cards.length - 1,
    };
  }
  const legs = (j.legIds || []).map((id) => r.legsById.get(id)).filter(Boolean);
  const cards = stepCards(legs);
  if (!cards.length) return null;
  const k = clamp(j.stepIdx || 0, 0, cards.length - 1);
  const card = cards[k];
  const ctxLabel = j.purpose === 'walk-in' ? t('home.walkEyebrow') : j.purpose === 'rejoin' ? t('route.rejoinEyebrow') : t('route.carryOnEyebrow');
  return {
    kind: 'route', legs, cards, k, card, target: j.target,
    title: pick(card.title) || t('trail.heading', { place: placeName(card.to) }), copy: '', image: card.image,
    eyebrow: t('step.stepOf', { i: k + 1, n: cards.length }), pips: { n: cards.length, idx: k },
    context: ctxLabel, isLast: k === cards.length - 1, total: legsTotal(legs),
  };
}

function routeSummary(legs) {
  const total = legsTotal(legs);
  const items = legs.map((l) => `<li data-min="${l.walkMin}">${esc(t('route.leg', { from: placeName(l.from), to: placeName(l.to) }))} <span class="rs-min">· ${esc(t('route.legMins', { n: l.walkMin }))}</span></li>`).join('');
  return `<div class="route-summary" data-total="${total}"><h2>${esc(t('route.summary'))}</h2><ol>${items}</ol><p class="rs-total">${esc(t('route.total', { n: total }))}</p></div>`;
}

function drawMinimap(total, idx) {
  const svg = $('#minimapSvg');
  const w = 320; const padX = 24; const padY = 30; const usable = w - 2 * padX;
  const x = (i) => padX + (usable * i) / Math.max(total - 1, 1);
  const y = (i) => padY + (i % 2 === 0 ? 0 : 22);
  const path = (to) => Array.from({ length: to + 1 }, (_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(i)}`).join(' ');
  let out = `<path d="${path(total - 1)}" stroke="#c9bd9f" stroke-width="2" stroke-dasharray="3 4" fill="none"/>`;
  out += `<path d="${path(idx)}" stroke="#0f2a3a" stroke-width="2.5" fill="none"/>`;
  for (let i = 0; i < total; i++) {
    out += `<circle cx="${x(i)}" cy="${y(i)}" r="${i === idx ? 7 : 5}" fill="${i < idx ? '#2a6f8a' : i === idx ? '#d6a14a' : '#fff'}" stroke="#0f2a3a" stroke-width="${i === idx ? 2.5 : 1.5}"/>`;
    if (i === idx || i === 0 || i === total - 1) {
      const label = i === 0 ? t('minimap.start') : i === total - 1 ? t('minimap.end') : String(i + 1);
      out += `<text x="${x(i)}" y="${y(i) + (i % 2 === 0 ? -12 : 22)}" text-anchor="middle" font-size="10" font-family="Inter, sans-serif" font-weight="600" fill="#0f2a3a">${esc(label)}</text>`;
    }
  }
  svg.innerHTML = out;
}

function renderStep() {
  const d = deck();
  if (!d) { if (current() === 'step') resetTo('home'); return; }
  setImage($('#stepHeroImg'), $('#stepCredit'), d.image, d.title);
  $('#stepEyebrow').textContent = d.eyebrow;
  const ctxEl = $('#stepContext');
  ctxEl.textContent = d.context;
  ctxEl.classList.toggle('hidden', !d.context);
  $('#stepTitle').textContent = d.title;
  $('#stepCopy').textContent = d.copy || '';
  $('#stepCopy').classList.toggle('hidden', !d.copy);
  const cardTitle = d.kind === 'trail' && d.card.title ? `<span class="step-card-title">${esc(pick(d.card.title))}</span>` : '';
  $('#stepDirection').innerHTML = cardTitle + md(pick(d.card.text));
  $('#stepAccess').textContent = d.card.access ? `${t('trail.access')}: ${pick(d.card.access)}` : '';
  const notes = [];
  if (d.kind === 'trail' && d.seg) {
    if (d.seg.noRoute) notes.push(`<p class="detour-note bad">${esc(t('trail.noRoute'))} <button class="btn btn-secondary btn-small mt-12" data-action="open-help">${esc(t('return.openHelp'))}</button></p>`);
    else if (d.seg.detour === 'closed') notes.push(`<p class="detour-note">${esc(t('trail.detourClosed'))}</p>`);
    else if (d.seg.detour === 'step-free') notes.push(`<p class="detour-note">${esc(t('trail.detourStepFree'))}</p>`);
  }
  $('#stepNotes').innerHTML = notes.join('');
  const hint = $('#stepTapHint');
  hint.textContent = t(tagById(d.target)?.collectible ? 'trail.tapHint' : 'trail.tapHintArrive', { place: placeName(d.target) });
  hint.classList.toggle('hidden', !d.isLast || !!(d.card && d.card.noRoute));
  $('#stepProgress').innerHTML = Array.from({ length: d.pips.n }, (_, i) => `<span class="pip${i < d.pips.idx ? ' done' : i === d.pips.idx ? ' current' : ''}"></span>`).join('');
  $('#minimapProgress').textContent = `${d.pips.idx + 1} / ${d.pips.n}`;
  drawMinimap(d.pips.n, d.pips.idx);
  const showSummary = d.kind === 'route' || (d.seg && d.seg.detour && !d.seg.noRoute);
  $('#routeSummaryHost').innerHTML = showSummary ? routeSummary(d.kind === 'route' ? d.legs : d.seg.legs) : '';
  $('#stepNextBtn').textContent = d.isLast ? t('step.next') : t('trail.nextCard');
}

// Move the journey on when the visitor reaches a place (tap or "I'm here").
export function arrive(placeId, { verified = false } = {}) {
  const j = state.journey;
  state.currentPlace = placeId;
  if (!verified) state.placeVerified = false;
  if (!j) { save(); return 'none'; }
  const r = routing();
  if (j.kind === 'trail') {
    const trail = trailById(j.trailId);
    const stops = trailStops(trail, r.legsById);
    const idx = stops.indexOf(placeId);
    if (idx < 0) { save(); return 'off-trail'; }
    if (idx < j.stopIdx - 1) { save(); return 'behind'; }
    if (idx === stops.length - 1) { ctx.completedTrail = trail.id; state.journey = null; save(); return 'complete'; }
    j.stopIdx = idx + 1; j.stepIdx = 0; save();
    return 'advanced';
  }
  if (placeId === j.target) return finishRoute();
  const legs = (j.legIds || []).map((id) => r.legsById.get(id)).filter(Boolean);
  const at = legs.findIndex((l) => l.to === placeId);
  if (at >= 0 && at < legs.length - 1) {
    j.stepIdx = legs.slice(0, at + 1).reduce((n, l) => n + l.steps.length, 0);
    save();
    return 'advanced';
  }
  if (j.then) { save(); return 'off-trail'; }
  state.journey = null; save();
  return 'left-route';
}

function finishRoute() {
  const j = state.journey;
  if (j.then) {
    const trail = trailById(j.then.trailId);
    const stops = trailStops(trail, routing().legsById);
    if (j.then.stopIdx >= stops.length - 1) { ctx.completedTrail = trail.id; state.journey = null; save(); return 'complete'; }
    state.journey = { kind: 'trail', trailId: trail.id, stopIdx: j.then.stopIdx + 1, stepIdx: 0 };
    save();
    return 'advanced';
  }
  state.journey = null; save();
  return 'route-complete';
}

export function afterArrival(result) {
  if (result === 'complete') { renderArrived('tour'); go('arrived'); return; }
  if (result === 'route-complete') { resetTo('home'); return; }
  if (current() === 'step') { renderStep(); $('#stepTitle').focus({ preventScroll: true }); } else go('step');
}

export function renderArrived(kind) {
  const title = $('#arrivedTitle'); const sub = $('#arrivedSub');
  if (kind === 'tour') {
    const trail = trailById(ctx.completedTrail);
    title.textContent = t('arrived.tourTitle');
    sub.textContent = t('arrived.tourSub', { title: pick(trail?.title) });
  } else if (kind === 'returned') {
    title.textContent = t('arrived.returnedTitle');
    sub.textContent = t('arrived.returnedSub');
  } else {
    title.textContent = t('arrived.defaultTitle');
    sub.textContent = t('arrived.defaultSub');
  }
}

export function offTrail(placeId) {
  const j = state.journey;
  const trailId = j.kind === 'trail' ? j.trailId : j.then?.trailId;
  const heading = j.kind === 'trail' ? j.stopIdx : j.then.stopIdx;
  ctx.rejoin = { trailId, heading, place: placeId };
}

export function rejoinCard() {
  const rj = ctx.rejoin;
  if (!rj) return '';
  const trail = trailById(rj.trailId);
  if (!trail) return '';
  const opts = rejoinOptions(trail, rj.heading, rj.place, routing());
  const a = opts.rejoin.chain; const c = opts.carryOn && opts.carryOn.chain;
  const btn = (action, title, meta, total) => `<button class="choice-btn" data-action="${action}" data-total="${total}"><span class="cb-title">${esc(title)}</span><span class="cb-meta">${esc(meta)}</span></button>`;
  return `<div class="home-card rejoin-card" id="rejoinCard"><h2>${esc(t('rejoin.title'))}</h2><p>${esc(t('rejoin.sub', { place: placeName(rj.place), trail: pick(trail.title) }))}</p>`
    + (a ? btn('rejoin-trail', t('rejoin.rejoin'), t('rejoin.rejoinMeta', { n: a.total, place: placeName(opts.rejoin.place) }), a.total) : `<p class="detour-note bad">${esc(t('trail.noRoute'))}</p>`)
    + (c && opts.carryOn.place !== opts.rejoin.place ? btn('carry-on-trail', t('rejoin.carryOn'), t('rejoin.carryOnMeta', { place: placeName(opts.carryOn.place), n: c.total }), c.total) : '')
    + `<button class="btn btn-ghost" data-action="dismiss-rejoin">${esc(t('rejoin.dismiss'))}</button></div>`;
}

function startRoute(purpose, chain, target, then) {
  state.journey = { kind: 'route', purpose, legIds: chain.legs.map((l) => l.id), stepIdx: 0, target, ...(then ? { then } : {}) };
  ctx.rejoin = null;
  save();
  go('step');
}

export const actions = {
  'start-tour': () => { state.journey = { kind: 'trail', trailId: overviewTrailId, stopIdx: 0, stepIdx: 0 }; ctx.rejoin = null; save(); go('step'); },
  'start-walk-to-city': () => {
    const w = setting('walkIn');
    const route = walkInRoute(w, routing());
    if (!route) { toast(t('trail.noRoute'), '!'); return; }
    startRoute('walk-in', route, w.to, null);
  },
  'resume-journey': () => go('step'),
  'next-step': () => {
    const d = deck();
    if (!d) return;
    if (!d.isLast) { state.journey.stepIdx = d.k + 1; save(); renderStep(); $('#stepTitle').focus({ preventScroll: true }); return; }
    if (d.card && d.card.noRoute) return;
    afterArrival(arrive(d.target));
  },
  'prev-step': () => {
    const d = deck();
    if (!d) return;
    const j = state.journey;
    if (d.k > 0) j.stepIdx = d.k - 1;
    else if (d.kind === 'trail' && d.i > 0) {
      j.stopIdx = d.i - 1;
      j.stepIdx = 99;
      const prev = deck();
      j.stepIdx = prev.cards.length - 1;
    }
    save(); renderStep();
  },
  'exit-tour': () => { state.journey = null; ctx.rejoin = null; save(); resetTo('home'); },
  'toggle-step-free': (el) => { state.stepFree = !!el.checked; save(); renderOverview(); },
  'rejoin-trail': () => {
    const rj = ctx.rejoin; const trail = trailById(rj.trailId);
    const o = rejoinOptions(trail, rj.heading, rj.place, routing());
    if (o.rejoin.chain) startRoute('rejoin', o.rejoin.chain, o.rejoin.place, { trailId: trail.id, stopIdx: o.rejoin.stopIdx });
  },
  'carry-on-trail': () => {
    const rj = ctx.rejoin; const trail = trailById(rj.trailId);
    const o = rejoinOptions(trail, rj.heading, rj.place, routing());
    if (o.carryOn && o.carryOn.chain) startRoute('carry-on', o.carryOn.chain, o.carryOn.place, { trailId: trail.id, stopIdx: o.carryOn.stopIdx });
  },
  'dismiss-rejoin': () => { ctx.rejoin = null; document.getElementById('rejoinHost').innerHTML = ''; },
};

onRender('tour-overview', renderOverview);
onRender('step', renderStep);
