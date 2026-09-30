// What's on (Today, This week) and Things to do, from the registers. Each event
// shows its source and a link out for details and booking.
import { state } from '../state.js';
import { ctx, tagById, setting } from '../ctx.js';
import { t, pick, getLang } from '../i18n.js';
import { esc, $ } from '../markup.js';
import { onRender, go } from '../router.js';
import { now } from '../clock.js';
import { hhmm, dayKey, formatDay } from '../time.js';
import { eventsToday, eventsThisWeek, nearYou, filterEvents, groupPlaces, isOnNow, isMultiDay } from '../registers.js';
import { neighbours } from '../graph.js';
import { liveSources } from '../import-job.js';

const view = { tab: 'today', category: 'all', zone: 'all', near: false };
export function openEventsTab(tab) { view.tab = tab; }

const sourceName = (id) => (id === 'manual' ? 'Go! Southampton' : (liveSources(ctx.bundle).find((s) => s.id === id)?.name || id));
const catLabel = (c) => t(`cat.${c}`);
const PLACE_IMAGES = { 'ocean village': '/img/photos/ocean-village-harbour.webp', "st mary's stadium": '/img/photos/stadium-aerial.webp' };

function whenText(ev, n) {
  const s = new Date(ev.start); const e = new Date(ev.end);
  if (isMultiDay(ev)) return isOnNow(ev, n) ? `${t('events.onNow')} · ${t('events.until', { date: formatDay(new Date(e.getTime() - 1), getLang()) })}` : `${formatDay(s, getLang())} · ${t('events.until', { date: formatDay(new Date(e.getTime() - 1), getLang()) })}`;
  const prefix = view.tab === 'week' ? '' : isOnNow(ev, n) ? `${t('events.onNow')} · ` : '';
  return `${prefix}${t('events.timeRange', { from: hhmm(s), to: hhmm(e) })}`;
}

// Today lists cards straight under the screen heading (h2); This week puts them under day headings (h3).
function eventCard(ev, n, level = 3) {
  const tag = ev.venueTag ? tagById(ev.venueTag) : null;
  const img = tag?.image;
  const zone = ev.zone ? pick(setting('zones')[ev.zone]) : '';
  const chips = [catLabel(ev.category), ...(ev.access || [])].map((c) => `<li>${esc(c)}</li>`).join('');
  const also = ev.alsoFrom && ev.alsoFrom.length ? ` · ${t('events.alsoOn', { names: ev.alsoFrom.map((a) => sourceName(a.sourceId)).join(', ') })}` : '';
  const title = pick(ev.title);
  return `<article class="events-list-card" data-event-id="${esc(ev.id)}" data-source="${esc(ev.sourceId)}">`
    + (img ? `<img class="el-img" src="${esc(img)}" alt="" loading="lazy" decoding="async" />` : '<div class="el-img" aria-hidden="true"></div>')
    + `<div class="el-body"><p class="el-when">${esc(whenText(ev, n))}</p><h${level} class="el-title">${esc(title)}</h${level}>`
    + `<p class="el-venue">${esc(ev.venueText)}${zone ? ` · ${esc(zone)}` : ''}</p><ul class="el-chips">${chips}</ul>`
    + `<p class="el-meta">${esc(t('events.source', { name: sourceName(ev.sourceId) }))}${esc(also)}</p>`
    + `<a class="el-link" href="${esc(ev.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('events.details'))}<span class="visually-hidden"> ${esc(title)} ${esc(t('events.newTab'))}</span></a></div></article>`;
}

function chip(group, value, label, pressed) {
  return `<button class="chip" data-action="ev-filter" data-group="${group}" data-value="${esc(value)}" aria-pressed="${pressed}">${esc(label)}</button>`;
}

function filtersHtml(events) {
  const cats = setting('eventCategories').filter((c) => events.some((e) => e.category === c));
  const zones = Object.keys(setting('zones')).filter((z) => events.some((e) => e.zone === z));
  const near = state.currentPlace ? chip('near', view.near ? '0' : '1', t('events.nearYou'), view.near) : '';
  return `<div class="filter-group"><span class="fg-label" id="fgCat">${esc(t('events.filterCategory'))}</span><div class="chip-row" role="group" aria-labelledby="fgCat">${chip('category', 'all', t('events.all'), view.category === 'all')}${cats.map((c) => chip('category', c, catLabel(c), view.category === c)).join('')}</div></div>`
    + `<div class="filter-group"><span class="fg-label" id="fgZone">${esc(t('events.filterZone'))}</span><div class="chip-row" role="group" aria-labelledby="fgZone">${near}${chip('zone', 'all', t('events.all'), view.zone === 'all' && !view.near)}${zones.map((z) => chip('zone', z, pick(setting('zones')[z]), view.zone === z && !view.near)).join('')}</div></div>`;
}

function renderEvents() {
  const n = now();
  document.querySelectorAll('.tabs .tab').forEach((b) => {
    const on = b.dataset.tab === view.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  $('#eventsPanel').setAttribute('aria-labelledby', `tab-${view.tab}`);
  const list = $('#eventsListHost');
  if (view.tab === 'places') {
    $('#eventsFilters').innerHTML = '';
    $('#eventsDemoNote').textContent = t('places.demoNote');
    $('#eventsTimesNote').classList.add('hidden');
    const groups = groupPlaces(ctx.register.places || []);
    list.innerHTML = [...groups.entries()].map(([cat, items]) => `<h2 class="day-heading">${esc(t(`pcat.${cat}`))}</h2>` + items.map((p) => {
      const tag = p.venueTag ? tagById(p.venueTag) : null;
      const img = tag?.image || PLACE_IMAGES[p.name.toLowerCase()];
      return `<div class="place-card">${img ? `<img class="pc-img" src="${esc(img)}" alt="" loading="lazy" decoding="async" />` : '<div class="pc-img" aria-hidden="true"></div>'}<div><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p>${tag ? `<p>${esc(t('events.loopNearby', { place: pick(tag.name) }))}</p>` : ''}<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('places.readMore'))}<span class="visually-hidden"> ${esc(p.name)} ${esc(t('events.newTab'))}</span></a></div></div>`;
    }).join('')).join('') || `<p class="empty-note">${esc(t('events.none'))}</p>`;
    return;
  }
  $('#eventsTimesNote').classList.remove('hidden');
  $('#eventsDemoNote').textContent = t('events.demoNote');
  const base = view.tab === 'today' ? eventsToday(ctx.register.events || [], n) : eventsThisWeek(ctx.register.events || [], n);
  $('#eventsFilters').innerHTML = filtersHtml(base);
  let shown = view.near ? nearYou(base, state.currentPlace, neighbours(ctx.bundle.legs, state.currentPlace)) : base;
  shown = filterEvents(shown, { category: view.category, zone: view.near ? 'all' : view.zone });
  shown.sort((a, b) => a.start.localeCompare(b.start));
  if (!shown.length) { list.innerHTML = `<p class="empty-note">${esc(t('events.none'))}</p>`; return; }
  if (view.tab === 'week') {
    const byDay = new Map();
    for (const ev of shown) {
      const k = new Date(ev.start) < n ? dayKey(n) : dayKey(new Date(ev.start));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(ev);
    }
    list.innerHTML = [...byDay.entries()].sort().map(([k, evs]) => `<h2 class="day-heading">${esc(formatDay(new Date(`${k}T12:00:00Z`), getLang()))}</h2>${evs.map((e) => eventCard(e, n)).join('')}`).join('');
  } else list.innerHTML = shown.map((e) => eventCard(e, n, 2)).join('');
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tabs .tab');
  if (tab) { view.tab = tab.dataset.tab; renderEvents(); tab.focus(); }
});
document.addEventListener('keydown', (e) => {
  const tab = e.target.closest && e.target.closest('.tabs .tab');
  if (!tab || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...document.querySelectorAll('.tabs .tab')];
  let i = tabs.indexOf(tab);
  if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
  if (e.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
  if (e.key === 'Home') i = 0;
  if (e.key === 'End') i = tabs.length - 1;
  e.preventDefault();
  view.tab = tabs[i].dataset.tab;
  renderEvents();
  tabs[i].focus();
});

export const actions = {
  'open-events': () => go('events'),
  'ev-filter': (el) => {
    const { group, value } = el.dataset;
    if (group === 'near') { view.near = value === '1'; if (view.near) view.zone = 'all'; }
    else if (group === 'zone') { view.zone = value; view.near = false; }
    else view.category = value;
    renderEvents();
    const again = document.querySelector(`.chip[data-group="${group}"][data-value="${CSS.escape(group === 'near' ? (view.near ? '0' : '1') : value)}"]`);
    if (again) again.focus();
  },
};

onRender('events', renderEvents);
