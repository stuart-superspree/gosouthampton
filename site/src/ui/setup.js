// Welcome, language and all-aboard setup, and the shared-phone reset.
// A visitor who is not on a cruise taps "I'm not on a cruise today" and never
// sees the countdown, the return route or other ship features.
import { state, save, resetState } from '../state.js';
import { ctx, clearToken, setting } from '../ctx.js';
import { t, setLang, detectLanguage, applyI18n, loadStrings } from '../i18n.js';
import { $ } from '../markup.js';
import { go, resetTo, refresh, onRender } from '../router.js';
import { rotateSession } from '../session.js';
import { applyBrand, setTapBanner } from './common.js';

function markLang() {
  document.querySelectorAll('.lang-card[data-lang]').forEach((b) => {
    const on = b.dataset.lang === (state.lang || detectLanguage());
    b.classList.toggle('active', on);
    if (!b.disabled) b.setAttribute('aria-pressed', String(on));
  });
}

function finishSetup() {
  state.setupComplete = true;
  if (state.cruise && !state.currentPlace) state.currentPlace = setting('terminalTag');
  save();
  applyBrand();
  resetTo('home');
}

export async function resetApp() {
  resetState();
  clearToken();
  ctx.sid = rotateSession();
  ctx.rejoin = null;
  setTapBanner(null, null);
  await loadStrings([detectLanguage()]);
  setLang(detectLanguage());
  applyI18n();
  applyBrand();
  resetTo('welcome');
}

document.addEventListener('click', async (e) => {
  const langBtn = e.target.closest('.lang-card[data-lang]');
  if (langBtn && !langBtn.disabled) {
    await loadStrings([langBtn.dataset.lang]);
    state.lang = langBtn.dataset.lang;
    setLang(state.lang);
    save();
    applyI18n();
    applyBrand();
    markLang();
    refresh();
  }
  const quick = e.target.closest('[data-quick]');
  if (quick) $('#shipTimeInput').value = quick.dataset.quick;
});

export const actions = {
  'go-language': () => go('language'),
  'open-language': () => go('language'),
  'go-ship-time': () => go('ship-time'),
  'confirm-ship-time': () => { const v = $('#shipTimeInput').value; state.cruise = true; if (/^\d{2}:\d{2}$/.test(v)) state.shipTime = v; finishSetup(); },
  'skip-ship-time': () => { state.cruise = true; state.shipTime = null; finishSetup(); },
  'not-cruise': () => { state.cruise = false; state.shipTime = null; finishSetup(); },
  'skip-to-home': () => finishSetup(),
  'reset-app': () => resetApp(),
};

onRender('language', markLang);
onRender('ship-time', () => { if (state.shipTime) $('#shipTimeInput').value = state.shipTime; });
