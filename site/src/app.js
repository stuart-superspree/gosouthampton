// Southampton RouteLoop demo: visitor app entry point.
import { state, save, resetState, setPersist } from './state.js';
import { ctx, tagById, setting } from './ctx.js';
import { local, sessionStore } from './storage.js';
import { loadStrings, setLang, detectLanguage, applyI18n, t } from './i18n.js';
import { loadBundle, BUNDLES_KEY } from './bundle.js';
import { init as initApi, isOnline } from './api.js';
import { sessionKey } from './session.js';
import { setDemoDate, now } from './clock.js';
import { initRouter, resetTo, back, refresh, current, go } from './router.js';
import { cachedRegister, ensureRegister, SOURCES_KEY } from './import-job.js';
import { flush, counts } from './outbox.js';
import { neighbourZones } from './graph.js';
import { parseTapLocation, cleanTapUrl, handleTap, processQueuedTap, startWebNfc } from './tap.js';
import { applyBrand, renderOffline, setTapBanner } from './ui/common.js';
import * as setup from './ui/setup.js';
import * as home from './ui/home.js';
import * as trail from './ui/trail.js';
import * as passport from './ui/passport.js';
import * as feedback from './ui/feedback.js';
import * as ret from './ui/return.js';
import * as events from './ui/events.js';
import * as help from './ui/help.js';
import * as snow from './ui/snow.js';

const actions = {
  ...setup.actions, ...home.actions, ...trail.actions, ...passport.actions, ...feedback.actions,
  ...ret.actions, ...events.actions, ...help.actions, ...snow.actions,
  back: () => back(),
  'go-home': () => resetTo('home'),
  'open-help': () => go('help'),
  'open-passport': () => go('passport'),
  'open-tour': (el) => {
    const tr = ctx.bundle.trailById.get(el.dataset.tourId);
    if (!tr) return;
    if (tr.type === 'campaign') snow.openSnow(); else trail.openOverview(tr.id);
  },
  'apply-update': () => applyUpdate(),
  'dismiss-update': () => { document.getElementById('updateBar').classList.add('hidden'); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.type === 'checkbox') return; // handled by the change listener
  fn(el);
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.dataset && e.target.dataset.action === 'toggle-step-free') actions['toggle-step-free'](e.target);
});

async function baseRegister() {
  try {
    const [ev, pl] = await Promise.all([fetch('/data/events.json').then((r) => r.json()), fetch('/data/places.json').then((r) => r.json())]);
    return { events: ev.events || [], places: pl.places || [], health: ev.health || {}, generatedAt: ev.generatedAt };
  } catch { return { events: [], places: [], health: {} }; }
}

async function refreshRegister(force = false) {
  try {
    ctx.register = await ensureRegister(ctx.bundle, now(), { force, persist: !ctx.preview });
  } catch (err) {
    console.warn('[register] import failed, using the published snapshot', err);
    if (!ctx.register.events.length) ctx.register = await baseRegister();
  }
  if (['home', 'events'].includes(current())) refresh();
}

async function reloadBundle() {
  ctx.bundle = await loadBundle({ preview: ctx.preview });
  initApi(ctx.bundle);
  // Show the new content straight away; What's on is then rebuilt in the
  // background (refreshRegister redraws home and What's on when it is done).
  refresh();
  await refreshRegister(true);
}

// ---------- updates: new app version (service worker) or new content bundle ----------
function showUpdate(kind) {
  ctx.pendingUpdate = kind;
  document.getElementById('updateDetail').textContent = kind === 'content' ? t('update.content') : '';
  document.getElementById('updateBar').classList.remove('hidden');
}
async function applyUpdate() {
  document.getElementById('updateBar').classList.add('hidden');
  if (ctx.pendingUpdate === 'content') { ctx.pendingUpdate = null; await reloadBundle(); return; }
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}
window.addEventListener('storage', (e) => {
  if (e.key === BUNDLES_KEY && !ctx.preview) showUpdate('content');
  if (e.key === SOURCES_KEY) refreshRegister(true);
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading && ctx.pendingUpdate === 'app') { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    if (!reg) return;
    const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate('app'); });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate('app');
    reg.addEventListener('updatefound', () => watch(reg.installing));
  }).catch((err) => console.warn('[sw] register failed', err));
}

// Precache images for the visitor's zone and its neighbours, so guidance keeps working offline.
function precacheZone() {
  const place = tagById(state.currentPlace);
  if (!place || !navigator.serviceWorker?.controller) return;
  const zones = neighbourZones(ctx.bundle.legs, ctx.bundle.tags, place.zone);
  const inZone = new Set(ctx.bundle.tags.filter((tg) => zones.has(tg.zone)).map((tg) => tg.id));
  const urls = new Set(ctx.bundle.tags.filter((tg) => inZone.has(tg.id) && tg.image).map((tg) => tg.image));
  for (const l of ctx.bundle.legs) if (inZone.has(l.from) || inZone.has(l.to)) l.steps.forEach((s) => s.image && urls.add(s.image));
  for (const tr of ctx.bundle.trails) if (tr.heroImage) urls.add(tr.heroImage);
  navigator.serviceWorker.controller.postMessage({ type: 'PRECACHE', urls: [...urls] });
}

function flushOutbox() { flush({ batchSize: setting('feedbackBatchSize') || 5, onTap: processQueuedTap }).then(() => { if (['home', 'passport'].includes(current())) refresh(); }); }

async function boot() {
  const q = new URLSearchParams(location.search);
  if (q.get('reset') === '1') {
    resetState();
    sessionStore.remove('rl-token');
  }
  if (q.get('demo') === '1') sessionStore.set('rl-demo', true);
  if (q.get('demo') === '0') sessionStore.remove('rl-demo');
  ctx.demo = sessionStore.get('rl-demo', false) === true;
  if (ctx.demo && q.get('date')) setDemoDate(q.get('date'));
  ctx.preview = q.get('preview') === '1';
  if (ctx.preview) setPersist(false);
  ctx.sid = sessionKey();

  const lang = state.lang || detectLanguage();
  await loadStrings([lang]);
  setLang(lang);
  ctx.bundle = await loadBundle({ preview: ctx.preview });
  initApi(ctx.bundle);
  // The register is rebuilt in the browser (standing in for the server's scheduled
  // import) because demo fixture dates are relative to today. The published
  // snapshot in /data is only the fallback if that fails.
  ctx.register = (!ctx.preview && cachedRegister()) || { events: [], places: [], health: {} };
  initRouter();
  applyI18n();
  applyBrand();
  if (ctx.preview) document.getElementById('previewBar').classList.remove('hidden');

  const plan = q.get('plan');
  if (plan) help.applyPlan(plan);
  const tap = parseTapLocation(location, setting('legacySlugs'));
  cleanTapUrl();
  const configured = ctx.preview || state.setupComplete === true || state.shipTime !== null;
  resetTo(configured ? 'home' : 'welcome', { focus: false });
  if (tap) await handleTap(tap, { configured }).then(() => { if (current() === 'home') refresh(); }).catch((err) => { console.error(err); setTapBanner('bad', t('tap.unknown')); });

  const openTrail = q.get('open');
  if (ctx.preview && openTrail && ctx.bundle.trailById.get(openTrail)) { state.setupComplete = true; trail.openOverview(openTrail); }

  renderOffline();
  window.addEventListener('online', () => { renderOffline(); flushOutbox(); });
  window.addEventListener('offline', renderOffline);
  window.addEventListener('rl-connectivity', () => { renderOffline(); if (isOnline()) flushOutbox(); });
  window.addEventListener('rl-clock', () => reloadBundle());
  setInterval(() => ret.tickCountdown(), 30000);
  // Retry queued writes regularly as well as on the online event (not every browser fires it reliably).
  let wasOnline = isOnline();
  setInterval(() => { const on = isOnline(); if (on !== wasOnline) renderOffline(); if (on && (!wasOnline || counts().feedback || counts().taps)) flushOutbox(); wasOnline = on; }, 2000);

  refreshRegister(false);
  if (isOnline()) flushOutbox();
  registerServiceWorker();
  document.body.addEventListener('click', () => startWebNfc(), { once: true });
  navigator.serviceWorker?.ready.then(() => precacheZone());
  if (ctx.demo) import('./demo/panel.js').then((m) => m.mountDemoPanel({ refresh, flushOutbox, reloadBundle, refreshRegister }));
  document.documentElement.dataset.ready = '1';
}

boot().catch((err) => {
  console.error('[boot]', err);
  document.getElementById('main').insertAdjacentHTML('afterbegin', '<p class="tap-banner bad" role="alert">Sorry, the app could not start. Please reload.</p>');
});

export { save };
