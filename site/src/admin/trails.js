// Trail builder: order legs into a trail, set theme, title and dates, and
// preview the draft on a phone-sized frame before publishing.
import { getDraft, saveDraft, can } from './store.js';
import { esc, en, options, field, pill, gate, toast } from './ui.js';

let selected = 'history';

function legLabel(l, tags) {
  const n = (id) => en(tags.find((t) => t.id === id)?.name) || id;
  return `${l.id}: ${n(l.from)} to ${n(l.to)} (${l.walkMin} min${l.stepFree ? '' : ', steps'}${l.closed ? ', CLOSED' : ''})`;
}

export function render(root, { refresh }) {
  const d = getDraft().data;
  const trails = d.trails;
  if (!trails.some((t) => t.id === selected)) selected = trails[0].id;
  const tr = trails.find((t) => t.id === selected);
  const legs = new Map(d.legs.map((l) => [l.id, l]));
  const isCampaign = tr.type === 'campaign';
  const list = (tr.legs || []).map((id, i) => {
    const l = legs.get(id); const prev = i > 0 ? legs.get(tr.legs[i - 1]) : null;
    const gap = !l || (prev && prev.to !== l.from);
    return `<li class="${gap ? 'gap' : ''}"><span class="ll-main">${l ? esc(legLabel(l, d.tags)) : `${esc(id)} (missing)`}${gap ? `<span class="ll-sub">Does not start where the previous leg ends</span>` : ''}</span>
      <span class="a-row"><button class="a-btn small" data-move="${i}" data-dir="-1" aria-label="Move ${esc(id)} up"${gate('edit')}${i === 0 ? ' disabled' : ''}>↑</button><button class="a-btn small" data-move="${i}" data-dir="1" aria-label="Move ${esc(id)} down"${gate('edit')}${i === tr.legs.length - 1 ? ' disabled' : ''}>↓</button><button class="a-btn small danger" data-remove="${i}" aria-label="Remove ${esc(id)}"${gate('edit')}>Remove</button></span></li>`;
  }).join('');
  const lastTo = tr.legs.length ? legs.get(tr.legs[tr.legs.length - 1])?.to : null;
  const nextLegs = d.legs.filter((l) => !lastTo || l.from === lastTo);
  const total = tr.legs.reduce((n, id) => n + (legs.get(id)?.walkMin || 0), 0);
  root.innerHTML = `<h1 class="a-h1">Trail builder</h1>
    <p class="a-lead">A trail is an ordered list of authored legs. Seasonal trails switch on and off by their dates, with no code change.</p>
    <div class="a-row">${field('Trail', `<select id="trailPick">${options(trails.map((t) => [t.id, `${en(t.title)}${t.type === 'campaign' ? ' (seasonal campaign)' : ''}`]), selected)}</select>`)}</div>
    <div class="a-two">
      <div>
        <div class="a-card">
          <div class="f-inline">
            ${field('Title (English)', `<input id="tTitleEn" value="${esc(tr.title.en)}"${gate('edit')} />`)}
            ${field('Title (German)', `<input id="tTitleDe" value="${esc(tr.title.de || '')}"${gate('edit')} />`)}
            ${field('Theme (English)', `<input id="tThemeEn" value="${esc(tr.theme.en)}"${gate('edit')} />`)}
            ${field('Theme (German)', `<input id="tThemeDe" value="${esc(tr.theme.de || '')}"${gate('edit')} />`)}
            ${field('Active from', `<input type="date" id="tFrom" value="${esc(tr.activeFrom || '')}"${gate('edit')} />`, 'Leave empty for always on')}
            ${field('Active to', `<input type="date" id="tTo" value="${esc(tr.activeTo || '')}"${gate('edit')} />`)}
            ${field('Total time shown (min)', `<input type="number" min="5" id="tMins" value="${tr.walkMin}"${gate('edit')} />`, 'Includes time at stops')}
            ${field('Distance shown (km)', `<input type="number" step="0.1" min="0" id="tKm" value="${tr.km}"${gate('edit')} />`)}
          </div>
          <div class="a-row"><button class="a-btn primary" id="saveTrail"${gate('edit')}>Save to draft</button>${tr.demo ? pill('Demo content') : ''}</div>
        </div>
        ${isCampaign ? '<p class="a-note">This seasonal campaign is a set of windows rather than a guided trail, so it has no legs. Its dates switch it on and off.</p>' : `
        <div class="a-card"><h2 class="a-h2">Legs in order</h2><p class="a-note">Walking time between stops: <b>${total} min</b></p><ol class="leg-list">${list}</ol>
          <div class="a-row">${field('Add a leg that starts at the last stop', `<select id="addLeg"${gate('edit')}>${options(nextLegs.map((l) => [l.id, legLabel(l, d.tags)]))}</select>`)}<button class="a-btn" id="addLegBtn"${gate('edit')}>Add leg</button></div>
        </div>`}
      </div>
      <div class="a-card"><h2 class="a-h2">Phone preview (draft)</h2><p class="a-note">Shows the unpublished draft. Visitors see it only after Publish.</p>
        <div class="phone-frame"><iframe id="previewFrame" title="Phone preview of ${esc(en(tr.title))}" src="/index.html?preview=1&amp;open=${encodeURIComponent(isCampaign ? '' : tr.id)}"></iframe></div>
        <div class="a-row"><button class="a-btn small" id="reloadPreview">Reload preview</button></div></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  $('#trailPick').addEventListener('change', (e) => { selected = e.target.value; refresh(); });
  $('#reloadPreview').addEventListener('click', () => { $('#previewFrame').src = $('#previewFrame').src; });
  $('#saveTrail').addEventListener('click', () => {
    if (!can('edit')) return;
    const before = en(tr.title);
    tr.title = { en: $('#tTitleEn').value.trim(), de: $('#tTitleDe').value.trim() };
    tr.theme = { en: $('#tThemeEn').value.trim(), de: $('#tThemeDe').value.trim() };
    tr.activeFrom = $('#tFrom').value || null; tr.activeTo = $('#tTo').value || null;
    tr.walkMin = Number($('#tMins').value) || tr.walkMin; tr.km = Number($('#tKm').value) || tr.km;
    saveDraft(`Trail ${tr.id} saved${before !== tr.title.en ? ` (title "${before}" to "${tr.title.en}")` : ''}`);
    toast('Saved to draft. Publish to make it live.');
    refresh();
  });
  root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.move); const j = i + Number(b.dataset.dir);
    [tr.legs[i], tr.legs[j]] = [tr.legs[j], tr.legs[i]];
    saveDraft(`Trail ${tr.id}: moved ${tr.legs[j]}`); refresh();
  }));
  root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    const [gone] = tr.legs.splice(Number(b.dataset.remove), 1);
    saveDraft(`Trail ${tr.id}: removed ${gone}`); refresh();
  }));
  const addBtn = $('#addLegBtn');
  if (addBtn) addBtn.addEventListener('click', () => { const id = $('#addLeg').value; if (!id) return; tr.legs.push(id); saveDraft(`Trail ${tr.id}: added ${id}`); refresh(); });
}
