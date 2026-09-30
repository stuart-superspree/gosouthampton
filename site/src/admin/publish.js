// Publish: validate the draft, then save it as a new versioned bundle and move
// the "current" pointer to it. Rollback moves the pointer back. Visitor apps
// open in this browser see an "Update ready" prompt, or the change on next open.
import { getDraft, can, user, role, ROLES, markPublished, resetDraft, audit, auditLog } from './store.js';
import { registry, publishVersion, setPointer } from '../bundle.js';
import { validateBundle } from './validate.js';
import { ensureRegister } from '../import-job.js';
import { loadBundle } from '../bundle.js';
import { esc, pill, gate, toast, fmtTime } from './ui.js';
import { now } from '../clock.js';

const imageCache = new Map();
async function imageExists(path) {
  if (!imageCache.has(path)) imageCache.set(path, fetch(path, { method: 'HEAD' }).then((r) => r.ok).catch(() => false));
  return imageCache.get(path);
}

async function rebuildRegister() {
  const bundle = await loadBundle();
  await ensureRegister(bundle, now(), { force: true });
}

export async function render(root, { refresh }) {
  const draft = getDraft();
  const v = await validateBundle(draft.data, { now: now(), imageExists });
  const reg = registry();
  const lines = v.results.map((r) => {
    const kind = r.pass ? 'pass' : r.level === 'warn' ? 'warn' : 'fail';
    return `<div class="check-line ${kind}" data-check="${esc(r.id)}" data-pass="${r.pass}"><span class="mark">${r.pass ? 'PASS' : r.level === 'warn' ? 'WARN' : 'FAIL'}</span><div><b>${esc(r.label)}</b>${r.detail.length ? `<ul>${r.detail.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}${r.detail.length > 8 ? `<li>and ${r.detail.length - 8} more</li>` : ''}</ul>` : ''}</div></div>`;
  }).join('');
  const versions = [...reg.versions].reverse().map((x) => `<tr><td><b>${esc(x.id)}</b>${reg.current === x.id ? ` ${pill('Current', 'good')}` : ''}</td><td>${fmtTime(x.time)}</td><td>${esc(x.user)}<br><small>${esc(x.role)}</small></td><td>${esc(x.note)}</td><td>${reg.current === x.id ? '' : `<button class="a-btn small" data-pointer="${esc(x.id)}"${gate('rollback')}>${reg.versions.findIndex((y) => y.id === x.id) < reg.versions.findIndex((y) => y.id === reg.current) ? 'Roll back to this' : 'Make current'}</button>`}</td></tr>`).join('');
  const changes = draft.changes.slice(-8).reverse().map((c) => `<li>${esc(c.change)} <small>(${esc(c.user)}, ${fmtTime(c.time)})</small></li>`).join('');
  root.innerHTML = `<h1 class="a-h1">Publish</h1>
    <p class="a-lead">Publishing checks the draft, saves it as a new version and moves the pointer to it. Visitors pick it up without an app update. Rollback moves the pointer back.</p>
    <div class="a-two"><div>
      <div class="a-card"><h2 class="a-h2">Checks</h2>${lines}<p class="a-note" id="checkSummary">${v.ok ? 'All blocking checks pass.' : 'Fix the failed checks before publishing.'}</p></div>
      <div class="a-card"><h2 class="a-h2">Unpublished changes</h2>${draft.dirty ? `<ul>${changes}</ul>` : '<p class="a-note">None. The draft matches the published version.</p>'}
        <label class="f"><span>Note for the version history</span><input id="pubNote" placeholder="What changed and why" /></label>
        <div class="a-row"><button class="a-btn primary" id="publishBtn"${gate('publish')}${!v.ok || !draft.dirty ? ' disabled' : ''}>Publish</button><button class="a-btn" id="discardBtn"${gate('edit')}${!draft.dirty ? ' disabled' : ''}>Discard draft changes</button></div>
        ${!can('publish') ? `<p class="a-note">${esc(ROLES[role()].label)} cannot publish. A reviewer or BID admin publishes.</p>` : ''}</div>
    </div>
    <div class="a-card a-table-wrap" tabindex="0"><h2 class="a-h2">Versions</h2><p class="a-note">Pointer: <b id="pointer">${esc(reg.current)}</b> ${reg.current === 'base' ? '(the bundled content in /data)' : ''}</p>
      <table class="a-table"><tr><th>Version</th><th>Published</th><th>By</th><th>Note</th><th><span class="visually-hidden">Actions</span></th></tr>${versions}<tr><td><b>base</b>${reg.current === 'base' ? ` ${pill('Current', 'good')}` : ''}</td><td>bundled</td><td>Superspree</td><td>Demo content as shipped</td><td>${reg.current === 'base' ? '' : `<button class="a-btn small" data-pointer="base"${gate('rollback')}>Roll back to this</button>`}</td></tr></table></div></div>`;
  const q = (s) => root.querySelector(s);
  q('#publishBtn').addEventListener('click', async () => {
    if (!can('publish')) return;
    const check = await validateBundle(draft.data, { now: now(), imageExists });
    if (!check.ok) { toast('Publishing blocked: a check failed'); refresh(); return; }
    const note = q('#pubNote').value.trim() || draft.changes.map((c) => c.change).slice(-3).join('; ') || 'Published from the demo admin';
    const ver = publishVersion(structuredClone(draft.data), { user: user(), role: ROLES[role()].label, note });
    markPublished(ver.id);
    audit(`Published ${ver.id}: ${note}`);
    await rebuildRegister();
    toast(`Published ${ver.id}. Open visitor apps will offer "Update ready".`);
    refresh();
  });
  q('#discardBtn').addEventListener('click', async () => { await resetDraft(); audit('Draft changes discarded'); toast('Draft reset to the published version'); refresh(); });
  root.querySelectorAll('[data-pointer]').forEach((b) => b.addEventListener('click', async () => {
    if (!can('rollback')) return;
    const from = registry().current;
    setPointer(b.dataset.pointer);
    await resetDraft();
    audit(`Pointer moved from ${from} to ${b.dataset.pointer}`);
    await rebuildRegister();
    toast(`Now serving ${b.dataset.pointer}`);
    refresh();
  }));
}

export function renderAudit(root) {
  const log = auditLog();
  root.innerHTML = `<h1 class="a-h1">Audit log</h1><p class="a-lead">Every change, with who made it and when.</p>
    <div class="a-card a-table-wrap" tabindex="0"><table class="a-table"><tr><th>When</th><th>Who</th><th>What</th></tr>${log.map((x) => `<tr><td>${fmtTime(x.time)}</td><td>${esc(x.user)}<br><small>${esc(x.role)}</small></td><td>${esc(x.action)}</td></tr>`).join('') || '<tr><td colspan="3">No changes yet</td></tr>'}</table></div>`;
}
