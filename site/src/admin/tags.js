// Tag registry: every physical Loop point, its status, last tap and health.
// Last tap and failed checks come from the demo server's tap log.
import { getDraft, saveDraft, can } from './store.js';
import { readDbForAdmin } from '../mock-server.js';
import { esc, en, options, pill, fmtTime, gate, toast } from './ui.js';

const STATUS = [['active', 'Active'], ['maintenance', 'Maintenance'], ['retired', 'Retired']];

function health(tagId, taps) {
  const mine = taps.filter((x) => x.tag === tagId);
  const last = mine.filter((x) => x.result === 'valid').pop();
  const fails = mine.filter((x) => (x.result === 'replay' || x.result === 'invalid') && Date.now() - x.at < 24 * 3600e3).length;
  if (fails >= 3) return { last, flag: pill(`${fails} failed checks today`, 'bad') };
  if (!last) return { last, flag: pill('No taps yet', 'warn') };
  return { last, flag: pill(fails ? `OK, ${fails} rejected` : 'OK', 'good') };
}

export function render(root, { refresh }) {
  const d = getDraft().data;
  const taps = readDbForAdmin().taps;
  const rows = (kind) => d.tags.filter((t) => t.kind === kind).map((t) => {
    const h = health(t.id, taps);
    return `<tr><td><b>${esc(en(t.name))}</b>${t.demo ? ` ${pill('Demo content')}` : ''}<br><small>${esc(t.id)} · ${esc(t.slug)}</small></td><td>${esc(t.zone)}<br><small>${esc(t.setting)}</small></td>
      <td><select data-status="${esc(t.id)}" aria-label="Status of ${esc(en(t.name))}"${gate('tags')}>${options(STATUS, t.status)}</select></td>
      <td>${h.last ? fmtTime(new Date(h.last.at).toISOString()) : 'never'}</td><td>${h.flag}</td><td>${t.collectible ? 'Stamp' : ''}</td><td>${t.walkBackMin ?? ''}</td></tr>`;
  }).join('');
  const head = '<tr><th>Loop point</th><th>Zone</th><th>Status</th><th>Last verified tap</th><th>Health</th><th>Passport</th><th>Walk back (min)</th></tr>';
  root.innerHTML = `<h1 class="a-h1">Tag registry</h1>
    <p class="a-lead">One record per physical Loop point. IDs are short, opaque and not sequential. A tag with no taps, or a run of failed checks, is flagged for a visit.</p>
    <p class="a-note sim-note">Simulation: last tap and health come from taps made with the demo Tap simulator in this browser.</p>
    <div class="a-card a-table-wrap" tabindex="0"><h2 class="a-h2">Loop points (${d.tags.filter((t) => t.kind === 'loop').length})</h2><table class="a-table">${head}${rows('loop')}</table></div>
    <details class="a-card"><summary class="a-h3">Snow Windows Trail Loops (${d.tags.filter((t) => t.kind === 'snow-window').length}, seasonal)</summary><div class="a-table-wrap" tabindex="0"><table class="a-table">${head}${rows('snow-window')}</table></div></details>`;
  root.querySelectorAll('[data-status]').forEach((sel) => sel.addEventListener('change', () => {
    if (!can('tags')) return;
    const tag = d.tags.find((t) => t.id === sel.dataset.status);
    tag.status = sel.value;
    saveDraft(`Tag ${tag.id} (${en(tag.name)}) status set to ${sel.value}`);
    toast('Saved to draft. Publish to make it live.');
    refresh();
  }));
}
