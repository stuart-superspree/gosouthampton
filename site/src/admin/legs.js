// Leg editor: step cards per language, images, access notes, who walked and
// verified it, and a Closed switch. Closing a leg shows the detour the app
// will use (the shortest chain of other authored legs), or that there is none.
import { getDraft, saveDraft, can } from './store.js';
import { esc, en, options, field, pill, gate, toast } from './ui.js';
import { buildGraph, shortestChain, closedLegIds } from '../graph.js';
import { resolveDemoDates } from '../time.js';
import { now } from '../clock.js';

let selected = 'L010';

function detourInfo(d, leg) {
  // Same closures the visitor app uses today: closed legs plus legs closed by live notices.
  const notices = JSON.parse(resolveDemoDates(JSON.stringify(d.notices || []), now()));
  const closed = closedLegIds(d.legs, notices, now());
  closed.add(leg.id);
  const chain = shortestChain(buildGraph(d.legs, { closed, stepFree: false }), leg.from, leg.to);
  const name = (id) => en(d.tags.find((t) => t.id === id)?.name) || id;
  if (!chain) return `<p class="a-note">${pill('No route', 'bad')} With this leg closed there is no chain of other legs from ${esc(name(leg.from))} to ${esc(name(leg.to))}. The app will say so and offer the help screen.</p>`;
  return `<p class="a-note">${pill('Detour', 'warn')} With this leg closed the app routes ${chain.legs.map((l) => `${esc(l.id)} (${l.walkMin} min)`).join(' then ')}: <b>${chain.total} min</b> instead of ${leg.walkMin}.</p>`;
}

export function render(root, { refresh }) {
  const d = getDraft().data;
  if (!d.legs.some((l) => l.id === selected)) selected = d.legs[0].id;
  const leg = d.legs.find((l) => l.id === selected);
  const name = (id) => en(d.tags.find((t) => t.id === id)?.name) || id;
  const imgs = [...new Set([...(d.images || []).map((i) => i.file), ...d.tags.map((t) => t.image)])].filter(Boolean).sort();
  const usedBy = d.trails.filter((t) => (t.legs || []).includes(leg.id)).map((t) => en(t.title));
  const steps = leg.steps.map((s, i) => `<div class="step-edit" data-step="${i}"><h3 class="a-h3">Step card ${i + 1}</h3><div class="f-inline">
      ${field('Heading (English, optional)', `<input data-k="title.en" value="${esc(s.title?.en || '')}"${gate('edit')} />`)}
      ${field('Heading (German)', `<input data-k="title.de" value="${esc(s.title?.de || '')}"${gate('edit')} />`)}</div>
      ${field('Step text (English)', `<textarea data-k="text.en"${gate('edit')}>${esc(s.text?.en || '')}</textarea>`, 'Use **bold** for the key instruction. Walk minutes only, no distances.')}
      ${field('Step text (German)', `<textarea data-k="text.de"${gate('edit')}>${esc(s.text?.de || '')}</textarea>`)}
      <div class="f-inline">${field('Access note (English)', `<input data-k="access.en" value="${esc(s.access?.en || '')}"${gate('edit')} />`)}${field('Access note (German)', `<input data-k="access.de" value="${esc(s.access?.de || '')}"${gate('edit')} />`)}</div>
      ${field('Image', `<select data-k="image"${gate('edit')}>${options(imgs.map((f) => [f, f.replace('/img/', '')]), s.image)}</select>`, 'Upload is simulated: choose a bundled photo or drawn placeholder')}
      <button class="a-btn small danger" data-remove-step="${i}"${gate('edit')}${leg.steps.length === 1 ? ' disabled' : ''}>Remove step card</button></div>`).join('');
  root.innerHTML = `<h1 class="a-h1">Leg editor</h1>
    <p class="a-lead">A leg is one walk-checked route between neighbouring Loop points. Every trail and every rejoin or return route is a chain of these.</p>
    ${field('Leg', `<select id="legPick">${options(d.legs.map((l) => [l.id, `${l.id}: ${name(l.from)} to ${name(l.to)}${l.closed ? ' (closed)' : ''}`]), selected)}</select>`)}
    <div class="a-two"><div>
      <div class="a-card"><h2 class="a-h2">${esc(name(leg.from))} to ${esc(name(leg.to))}</h2>
        <p class="a-note">Used by: ${usedBy.length ? esc(usedBy.join(', ')) : 'no trail (used for rejoin and return routes)'}${leg.demo ? ` · ${pill('Demo content')}` : ''}</p>
        <label class="check"><input type="checkbox" id="legClosed" ${leg.closed ? 'checked' : ''}${gate('edit')} /> Closed (roadworks or an event)</label>
        ${leg.closed ? detourInfo(d, leg) : ''}
        <div class="f-inline">
          ${field('Walk minutes', `<input type="number" min="1" id="legMin" value="${leg.walkMin}"${gate('edit')} />`)}
          ${field('Step-free', `<select id="legSF"${gate('edit')}>${options([['true', 'Yes'], ['false', 'No, has steps']], String(leg.stepFree))}</select>`)}
          ${field('Verified by', `<input id="legBy" value="${esc(leg.verifiedBy || '')}"${gate('edit')} />`)}
          ${field('Verified on', `<input type="date" id="legOn" value="${esc(leg.verifiedOn || '')}"${gate('edit')} />`)}
          ${field('Review by', `<input type="date" id="legReview" value="${esc(leg.reviewBy || '')}"${gate('edit')} />`)}
        </div>
      </div>
      ${steps}
      <div class="a-row"><button class="a-btn" id="addStep"${gate('edit')}>Add step card</button><button class="a-btn primary" id="saveLeg"${gate('edit')}>Save to draft</button></div>
    </div>
    <div class="a-card"><h2 class="a-h2">Preview</h2>${leg.steps.map((s, i) => `<p><b>${i + 1}. ${esc(s.title?.en || name(leg.to))}</b><br>${esc(s.text?.en || '')}</p>`).join('')}<p class="a-note">Changes reach visitors after Publish.</p></div></div>`;
  const q = (s) => root.querySelector(s);
  q('#legPick').addEventListener('change', (e) => { selected = e.target.value; refresh(); });
  q('#legClosed').addEventListener('change', (e) => {
    if (!can('edit')) return;
    leg.closed = e.target.checked;
    saveDraft(`Leg ${leg.id} ${leg.closed ? 'closed' : 'reopened'}`);
    toast(leg.closed ? 'Leg closed in the draft. Publish to reroute visitors.' : 'Leg reopened in the draft.');
    refresh();
  });
  const collect = () => {
    leg.walkMin = Math.max(1, Number(q('#legMin').value) || leg.walkMin);
    leg.stepFree = q('#legSF').value === 'true';
    leg.verifiedBy = q('#legBy').value.trim() || null;
    leg.verifiedOn = q('#legOn').value || null;
    leg.reviewBy = q('#legReview').value || null;
    root.querySelectorAll('[data-step]').forEach((box) => {
      const s = leg.steps[Number(box.dataset.step)];
      box.querySelectorAll('[data-k]').forEach((inp) => {
        const [k, lang] = inp.dataset.k.split('.');
        if (!lang) { s[k] = inp.value; return; }
        const v = inp.value.trim();
        if (k === 'title' && !v && !(s.title && (s.title.en || s.title.de))) return;
        s[k] = { ...(s[k] || {}), [lang]: v };
      });
      if (s.title && !s.title.en && !s.title.de) delete s.title;
    });
  };
  q('#saveLeg').addEventListener('click', () => { if (!can('edit')) return; collect(); saveDraft(`Leg ${leg.id} edited`); toast('Saved to draft. Publish to make it live.'); refresh(); });
  q('#addStep').addEventListener('click', () => { collect(); leg.steps.push({ text: { en: '', de: '' }, image: leg.steps[leg.steps.length - 1].image, access: { en: '', de: '' } }); saveDraft(`Leg ${leg.id}: step card added`); refresh(); });
  root.querySelectorAll('[data-remove-step]').forEach((b) => b.addEventListener('click', () => { collect(); leg.steps.splice(Number(b.dataset.removeStep), 1); saveDraft(`Leg ${leg.id}: step card removed`); refresh(); }));
}
