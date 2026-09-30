// Demo admin shell: role switcher, navigation and the screen router.
import { loadDraft, getDraft, role, setRole } from './store.js';
import { $, $$ } from './ui.js';
import * as dashboard from './dashboard.js';
import * as tags from './tags.js';
import * as trails from './trails.js';
import * as legs from './legs.js';
import * as sources from './sources.js';
import * as content from './content.js';
import * as publish from './publish.js';

const SCREENS = { dashboard, tags, trails, legs, sources, content, publish, audit: { render: publish.renderAudit } };

function screen() { const h = location.hash.replace('#', '').split('/')[0]; return SCREENS[h] ? h : 'dashboard'; }

export async function render({ focus = false } = {}) {
  const name = screen();
  $$('.a-nav [data-nav]').forEach((a) => { if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const main = $('#adminMain');
  await SCREENS[name].render(main, { refresh: () => render() });
  $('#dirtyDot').classList.toggle('hidden', !getDraft().dirty);
  if (focus) main.focus({ preventScroll: true });
}

async function boot() {
  await loadDraft();
  const sel = $('#roleSelect');
  sel.value = role();
  sel.addEventListener('change', () => { setRole(sel.value); render(); });
  window.addEventListener('hashchange', () => render({ focus: true }));
  // Live counters refresh only on read-only screens, so nobody loses what they are typing.
  window.addEventListener('storage', (e) => { if ((e.key === 'rl-register' || e.key === 'rl-mock-server') && ['dashboard', 'tags'].includes(screen())) render(); });
  await render();
  document.documentElement.dataset.ready = '1';
}

boot().catch((err) => {
  console.error(err);
  $('#adminMain').innerHTML = `<p class="a-note">The demo admin could not start: ${String(err.message || err)}</p>`;
});
