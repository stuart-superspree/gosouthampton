// Demo panel, shown only when the URL has ?demo=1. Everything here is a
// presenter tool and is labelled as a simulation: the Tap simulator stands in
// for physical Loops, and the other controls simulate signal, dates and staff checks.
import { ctx } from '../ctx.js';
import { pick } from '../i18n.js';
import { esc } from '../markup.js';
import { nextTapUrl, lastTapUrl } from './chip-sim.js';
import { counts } from '../outbox.js';
import { api, simulatedOffline, setSimulatedOffline } from '../api.js';
import { demoDate, setDemoDate } from '../clock.js';
import { readDbForAdmin } from '../mock-server.js';

export function mountDemoPanel({ refresh, flushOutbox }) {
  const fab = document.createElement('button');
  fab.className = 'demo-fab';
  fab.type = 'button';
  fab.textContent = 'Demo panel';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'demoPanel');
  const panel = document.createElement('section');
  panel.className = 'demo-panel hidden';
  panel.id = 'demoPanel';
  panel.setAttribute('aria-label', 'Demo panel');
  document.body.append(fab, panel);

  const loops = ctx.bundle.tags.filter((tg) => tg.kind === 'loop');
  const windows = ctx.bundle.tags.filter((tg) => tg.kind === 'snow-window');
  const row = (tg) => `<div class="dp-row"><span>${esc(pick(tg.name))} <small>(${esc(tg.id)})</small></span><span class="dp-flex"><button class="dp-btn primary" data-demo="tap" data-tag="${esc(tg.id)}" aria-label="Tap ${esc(pick(tg.name))}">Tap</button><a class="dp-btn" href="/t/${esc(tg.id)}" data-demo-browse aria-label="Open ${esc(pick(tg.name))} without a tap">Link</a></span></div>`;

  function render() {
    const c = counts();
    const db = readDbForAdmin();
    const last = db.taps[db.taps.length - 1];
    panel.innerHTML = `<div class="dp-head"><h2>Demo panel</h2><button class="dp-btn" data-demo="close">Close</button></div>
      <span class="sim-label">Simulation</span>
      <p class="dp-status">Taps, stamps, codes and feedback are checked by a demo server running in this browser. Real tags and a real server replace these in the live build.</p>
      <h3>Tap simulator</h3>
      <div class="dp-flex"><button class="dp-btn" data-demo="replay" ${lastTapUrl() ? '' : 'disabled'}>Replay last tap</button><span class="dp-status" id="dpLastTap">${last ? `Last check: ${esc(last.result)} at ${esc(pick(ctx.bundle.tagById.get(last.tag)?.name) || last.tag)}` : 'No taps yet'}</span></div>
      <div id="dpLoops">${loops.map(row).join('')}</div>
      <details><summary>Snow Windows Trail Loops (seasonal)</summary>${windows.map(row).join('')}</details>
      <h3>Signal and queue</h3>
      <label class="dp-row"><span>Simulate no signal</span><input type="checkbox" data-demo="offline" ${simulatedOffline() ? 'checked' : ''} /></label>
      <div class="dp-row"><span id="dpQueue">Feedback waiting: <b data-queue="feedback">${c.feedback}</b> · Taps waiting: <b data-queue="taps">${c.taps}</b></span><button class="dp-btn" data-demo="flush">Send now</button></div>
      <h3>Simulated date</h3>
      <div class="dp-flex"><label>Date <input type="date" data-demo="date" value="${esc((demoDate() || '').slice(0, 10))}" /></label><button class="dp-btn" data-demo="real-date">Use real date</button></div>
      <p class="dp-status">Try 5 December to see the seasonal Snow Windows Trail switch on.</p>
      <h3>Staff code check</h3>
      <div class="dp-flex"><label>Code <input type="text" data-demo="code" autocomplete="off" /></label><button class="dp-btn" data-demo="redeem">Check and redeem</button></div>
      <p class="dp-status" id="dpRedeem" role="status"></p>
      <h3>Links</h3>
      <div class="dp-flex"><a class="dp-btn" href="/admin/">Demo admin</a><a class="dp-btn" href="/?reset=1&amp;demo=1">Reset visitor</a></div>`;
  }

  const setOpen = (open) => { panel.classList.toggle('hidden', !open); fab.setAttribute('aria-expanded', String(open)); if (open) { render(); panel.querySelector('button')?.focus(); } };
  fab.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
  panel.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-demo]');
    if (!el) return;
    const act = el.dataset.demo;
    if (act === 'close') { setOpen(false); fab.focus(); }
    if (act === 'tap') location.assign(nextTapUrl(el.dataset.tag));
    if (act === 'replay' && lastTapUrl()) location.assign(lastTapUrl());
    if (act === 'flush') { await flushOutbox(); render(); }
    if (act === 'real-date') { setDemoDate(null); render(); }
    if (act === 'redeem') {
      const code = panel.querySelector('[data-demo="code"]').value;
      const out = panel.querySelector('#dpRedeem');
      try {
        const r = await api.redeemCode(code);
        out.textContent = r.status === 'ok' ? `Valid. Redeemed now (single use).` : r.status === 'used' ? `Already used at ${new Date(r.usedAt).toLocaleTimeString('en-GB')}.` : r.status === 'expired' ? 'Expired.' : 'Unknown code.';
      } catch { out.textContent = 'No signal (simulated).'; }
    }
  });
  panel.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.demo === 'offline') { setSimulatedOffline(el.checked); refresh(); }
    if (el.dataset.demo === 'date') { setDemoDate(el.value || null); }
  });
  window.addEventListener('rl-outbox', () => {
    const c = counts();
    panel.querySelectorAll('[data-queue]').forEach((b) => { b.textContent = c[b.dataset.queue]; });
  });
}
