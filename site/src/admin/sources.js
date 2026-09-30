// Source registry. Staff can add a source, preview its records as visitors
// would see them, correct the field and venue mapping, and approve it. The
// demo cannot fetch other websites from a browser, so each source is backed by
// a bundled sample file; the importer, mapping, de-duplication and health are real.
import { can } from './store.js';
import { esc, en, options, field, pill, gate, toast, fmtTime } from './ui.js';
import { loadBundle } from '../bundle.js';
import { liveSources, saveLiveSources, ensureRegister, cachedRegister } from '../import-job.js';
import { extractRows, importSource, parseCsv, parseIcs } from '../importer.js';
import { resolveDemoDates, hhmm, formatDay } from '../time.js';
import { now } from '../clock.js';

let fixtures = null;
let wizard = null; // { form, fixture, text, mapping, recipe, venueMap, preview }

const TIER = { csv: 'Tier 1 · CSV feed', json: 'Tier 1 · JSON feed', ical: 'Tier 1 · iCal feed', recipe: 'Tier 2 · page recipe', curated: 'Tier 3 · curated by hand', none: 'Not imported' };
const methodFor = (file) => (file.endsWith('.ics') ? 'ical' : file.endsWith('.json') ? 'json' : file.endsWith('.csv') ? 'csv' : 'recipe');

async function getFixtures() {
  if (!fixtures) fixtures = (await (await fetch('/data/fixtures/index.json')).json()).fixtures;
  return fixtures;
}

function sourceRows(sources, reg) {
  return sources.map((s) => {
    const h = (reg && reg.health && reg.health[s.id]) || s.health || {};
    const healthCell = s.paused ? pill('Paused', 'warn')
      : h.lastError ? `${pill('Failing', 'bad')}<br><small>${esc(h.lastError)}${h.usingLastGood ? '. Showing last good records until they expire.' : ''}</small>`
      : h.skipped ? pill(h.skipped === 'curated' ? 'Curated, link out' : 'Not imported')
      : h.lastOk ? `${pill('OK', 'good')}<br><small>${fmtTime(h.lastOk)} · ${h.records} records</small>` : pill('Not run yet', 'warn');
    const importable = ['csv', 'json', 'ical', 'recipe'].includes(s.method);
    return `<tr data-source-row="${esc(s.id)}"><td><b>${esc(s.name)}</b><br><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url.replace(/^https:\/\//, ''))}</a>${s.demo ? `<br>${pill('Demo fixture')}` : ''}</td>
      <td>${esc(s.register)}<br><small>${esc(TIER[s.method] || s.method)}</small></td><td>${esc(s.refresh)}</td><td>${esc(s.owner)}<br><small>Permission: ${esc(s.permission)}</small></td><td>${esc(s.trust)}</td><td>${healthCell}</td>
      <td>${importable ? `<label class="check"><input type="checkbox" data-pause="${esc(s.id)}" ${s.paused ? 'checked' : ''}${gate('sources')} /> Pause</label><label class="check"><input type="checkbox" data-fail="${esc(s.id)}" ${s.simulateFailure ? 'checked' : ''}${gate('sources')} /> Simulate failure</label>` : ''}</td></tr>`;
  }).join('');
}

function mappingEditor() {
  const w = wizard;
  if (w.method === 'recipe') {
    const f = w.recipe.fields;
    return `<div class="f-inline">${field('Item selector', `<input data-recipe="item" value="${esc(w.recipe.item)}" />`)}${Object.keys(f).map((k) => field(`${k} selector`, `<input data-recipe-field="${esc(k)}" value="${esc(f[k])}" />`)).join('')}${field('Default venue', `<input data-recipe-default="venue" value="${esc(w.recipe.defaults?.venue || '')}" />`)}</div>`;
  }
  let cols = [];
  if (w.method === 'csv') cols = Object.keys(parseCsv(w.text)[0] || {});
  if (w.method === 'json') { try { const j = JSON.parse(w.text); const items = w.mapping.items ? j[w.mapping.items] : j; cols = Object.keys((items || [])[0] || {}); } catch { cols = []; } }
  if (w.method === 'ical') cols = Object.keys(parseIcs(w.text)[0] || {});
  const fields = ['title', 'start', 'end', 'venue', 'category', 'url', ...(w.method === 'json' ? ['title_de'] : [])];
  return `<div class="f-inline">${fields.map((k) => field(`${k} comes from`, `<select data-map="${k}">${options([['', '(none)'], ...cols.map((c) => [c, c])], w.mapping[k] || '')}</select>`)).join('')}</div>`;
}

function previewHtml(tags) {
  const w = wizard;
  if (!w.preview) return '';
  const { res } = w.preview;
  const loops = tags.filter((t) => t.kind === 'loop');
  const items = res.records.slice(0, 6).map((r) => {
    if (res.kind === 'places') return `<div class="pv"><b>${esc(r.name)}</b> · ${esc(r.category)}<br><small>${esc(r.summary)}</small> ${r.venueTag ? pill('Matched to a Loop point', 'good') : pill('No Loop point')}</div>`;
    const st = new Date(r.start);
    const venueCtl = r.venueTag
      ? `${pill(`Venue matched: ${en(tags.find((t) => t.id === r.venueTag)?.name)}`, 'good')}`
      : `${pill(`Venue "${r.venueText}" not matched`, 'warn')} <label class="f">Map to <select data-venue-fix="${esc(r.venueText)}"><option value="">Leave unmatched</option>${options(loops.map((t) => [t.id, en(t.name)]), w.venueMap[r.venueText] || '')}</select></label>`;
    return `<div class="pv"><b>${esc(r.title.en)}</b><br><small>${esc(formatDay(st))} ${esc(hhmm(st))} · ${esc(r.category)} · ${esc(r.venueText)}</small><br>${venueCtl}</div>`;
  }).join('');
  const probs = res.problems.length ? `<p class="a-note">${res.problems.length} rows could not be read: ${esc(res.problems.map((p) => p.reason).join('; '))}</p>` : '';
  return `<div class="a-card preview-list" id="sourcePreview"><h3 class="a-h3">Preview: first records as visitors would see them</h3><p class="a-note">${res.rows} rows read · ${res.records.length} current records (past ones dropped)</p>${probs}${items}</div>`;
}

export async function render(root, { refresh }) {
  const bundle = await loadBundle();
  const sources = liveSources(bundle);
  const reg = cachedRegister() || await ensureRegister(bundle, now());
  const fx = await getFixtures();
  const w = wizard;
  root.innerHTML = `<h1 class="a-h1">Sources</h1>
    <p class="a-lead">Every outside source, and the two registers they feed: Events (what's on today and this week) and Places (venues and things to do). Visitors see the registers, never the source pages. Each source needs the owner's permission.</p>
    <p class="a-note sim-note"><b>Simulation: sources are bundled sample files.</b> A browser cannot fetch other websites, so each source here reads a sample file we wrote. The importer, field mapping, de-duplication, expiry and health are the real logic.</p>
    <div class="a-card a-table-wrap" tabindex="0"><h2 class="a-h2">Source registry and health</h2>
      <p class="a-note">Register: ${reg.events.length} events and ${reg.places.length} places, rebuilt ${fmtTime(reg.generatedAt)}.</p>
      <table class="a-table"><tr><th>Source</th><th>Register · method</th><th>Refresh</th><th>Owner</th><th>Trust</th><th>Health</th><th>Controls</th></tr>${sourceRows(sources, reg)}</table>
      <div class="a-row"><button class="a-btn" id="runImport">Run import now</button></div></div>
    <div class="a-card" id="addSource"><h2 class="a-h2">Add a source</h2>
      ${!w ? `<div class="f-inline">
        ${field('Name', '<input id="sName" placeholder="For example: Museums and galleries feed" />')}
        ${field('Link', '<input id="sUrl" type="url" placeholder="https://" />', 'Must be a public https address')}
        ${field('Register it feeds', `<select id="sRegister">${options([['events', 'Events'], ['places', 'Places']])}</select>`)}
        ${field('Refresh', `<select id="sRefresh">${options([['6h', 'Every 6 hours'], ['24h', 'Daily'], ['7d', 'Weekly']])}</select>`)}
        ${field('Owner', '<input id="sOwner" value="Go! Southampton" />')}
        ${field('Permission', `<select id="sPerm">${options([['not-yet-requested', 'Not yet requested'], ['requested', 'Requested'], ['granted', 'Granted in writing'], ['refused', 'Refused']])}</select>`)}
        ${field('Trust setting', `<select id="sTrust">${options([['auto', 'Publish new records automatically'], ['review', 'New records wait for a reviewer']])}</select>`)}
        ${field('Bundled sample file (stands in for the link)', `<select id="sFixture">${options(fx.map((f) => [f.file, `${f.file.split('/').pop()} (${TIER[f.method]})`]))}</select>`)}
      </div><div class="a-row"><button class="a-btn primary" id="inspect">Inspect and preview</button></div>`
      : `<p class="a-note">Adding <b>${esc(w.form.name)}</b> · suggested method: <b>${esc(TIER[w.method])}</b> · sample file ${esc(w.fixture.split('/').pop())}</p>
      <h3 class="a-h3">Field mapping (correct it if the preview looks wrong)</h3>${mappingEditor()}
      <div class="a-row"><button class="a-btn" id="updatePreview">Update preview</button></div>
      ${previewHtml(bundle.tags)}
      <div class="a-row"><button class="a-btn primary" id="approve"${gate('sources')}>Approve and add to the register</button><button class="a-btn" id="cancelWizard">Cancel</button></div>`}
    </div>`;

  const q = (s) => root.querySelector(s);
  const runPreview = async () => {
    const x = wizard;
    const src = { id: 'src-preview', name: x.form.name, url: x.form.url, register: x.form.register, method: x.method, mapping: x.mapping, recipe: x.recipe, venueMap: x.venueMap, demo: true };
    x.preview = { res: importSource(src, resolveDemoDates(x.text, now()), { tags: bundle.tags, now: now() }) };
  };
  q('#runImport').addEventListener('click', async () => { await ensureRegister(bundle, now(), { force: true }); toast('Import finished'); refresh(); });
  root.querySelectorAll('[data-pause],[data-fail]').forEach((cb) => cb.addEventListener('change', async () => {
    if (!can('sources')) return;
    const list = liveSources(bundle).map((s) => ({ ...s }));
    const s = list.find((x) => x.id === (cb.dataset.pause || cb.dataset.fail));
    if (cb.dataset.pause) s.paused = cb.checked; else s.simulateFailure = cb.checked;
    saveLiveSources(list);
    await ensureRegister(bundle, now(), { force: true });
    toast(cb.dataset.pause ? (cb.checked ? 'Source paused: its records are hidden' : 'Source resumed') : (cb.checked ? 'Next import will fail (simulated)' : 'Failure simulation off'));
    refresh();
  }));
  if (!w) {
    q('#inspect').addEventListener('click', async () => {
      const file = q('#sFixture').value;
      const meta = fx.find((f) => f.file === file);
      const url = q('#sUrl').value.trim();
      if (url && !/^https:\/\/[^/]+\.[a-z]{2,}/i.test(url)) { toast('The link must be a public https address'); return; }
      wizard = {
        form: { name: q('#sName').value.trim() || meta.suggestName, url: url || meta.suggestUrl, register: meta.register || q('#sRegister').value, refresh: q('#sRefresh').value, owner: q('#sOwner').value.trim() || 'Go! Southampton', permission: q('#sPerm').value, trust: q('#sTrust').value },
        fixture: file, method: methodFor(file), text: await (await fetch(file)).text(),
        mapping: { ...(meta.mapping || {}) }, recipe: meta.recipe ? structuredClone(meta.recipe) : null, venueMap: {},
      };
      await runPreview();
      refresh();
    });
    return;
  }
  const readMapping = () => {
    root.querySelectorAll('[data-map]').forEach((s) => { w.mapping[s.dataset.map] = s.value || undefined; });
    root.querySelectorAll('[data-recipe]').forEach((i) => { w.recipe.item = i.value.trim(); });
    root.querySelectorAll('[data-recipe-field]').forEach((i) => { w.recipe.fields[i.dataset.recipeField] = i.value.trim(); });
    root.querySelectorAll('[data-recipe-default]').forEach((i) => { w.recipe.defaults = { ...(w.recipe.defaults || {}), venue: i.value.trim() || undefined }; });
    root.querySelectorAll('[data-venue-fix]').forEach((s) => { if (s.value) w.venueMap[s.dataset.venueFix] = s.value; else delete w.venueMap[s.dataset.venueFix]; });
  };
  q('#updatePreview').addEventListener('click', async () => { readMapping(); await runPreview(); refresh(); });
  q('#cancelWizard').addEventListener('click', () => { wizard = null; refresh(); });
  q('#approve').addEventListener('click', async () => {
    if (!can('sources')) return;
    readMapping();
    const list = liveSources(bundle).map((s) => ({ ...s }));
    const base = `src-${w.form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)}`;
    let id = base; let n = 2; while (list.some((s) => s.id === id)) id = `${base}-${n++}`;
    list.push({ id, name: w.form.name, url: w.form.url, register: w.form.register, method: w.method, tier: w.method === 'recipe' ? 2 : 1, refresh: w.form.refresh, owner: w.form.owner, permission: w.form.permission, trust: w.form.trust, paused: false, priority: 2, fixture: w.fixture, mapping: w.mapping, recipe: w.recipe, venueMap: w.venueMap, notes: 'Added in the demo admin.', health: { lastOk: null, records: 0, lastError: null }, demo: true });
    const before = (cachedRegister() || { events: [] }).events.length;
    saveLiveSources(list);
    const reg2 = await ensureRegister(bundle, now(), { force: true });
    const h = reg2.health[id] || {};
    const added = reg2.events.length - before;
    toast(`Approved: ${h.records || 0} records read, ${added} new in the register, ${(h.records || 0) - added} merged as duplicates`);
    const { audit } = await import('./store.js');
    audit(`Source added and approved: ${w.form.name} (${w.method})`);
    wizard = null;
    refresh();
  });
}

export { extractRows };
