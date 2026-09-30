// Events and notices. Manual events join the Events register and expire on
// their own. Notices show on the visitor home screen for their dates and can
// close legs, which reroutes visitors through the leg graph.
import { getDraft, saveDraft, can } from './store.js';
import { esc, en, options, field, pill, gate, toast } from './ui.js';
import { isoLondon, zoned, dayKey, addDays, startOfDay, resolveDemoDates } from '../time.js';
import { now } from '../clock.js';

const CATS = ['theatre', 'music', 'exhibition', 'family', 'talk', 'tour', 'market', 'food'];
const fromLocal = (v) => { const [d, t] = v.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = (t || '00:00').split(':').map(Number); return zoned(y, m, dd, h, mi); };

export function render(root, { refresh }) {
  const d = getDraft().data;
  const today = dayKey(now());
  const loops = d.tags.filter((t) => t.kind === 'loop');
  const zones = Object.keys(d.settings.zones);
  const resolved = JSON.parse(resolveDemoDates(JSON.stringify(d.notices), now()));
  const noticeRows = d.notices.map((n, i) => {
    const r = resolved[i];
    const state = r.end < today ? pill('Ended', 'warn') : r.start > today ? pill('Scheduled') : pill('Live', 'good');
    return `<tr><td>${esc(n.text.en)}${n.demo ? ` ${pill('Demo content')}` : ''}</td><td>${esc(n.severity)}</td><td>${esc(r.start)} to ${esc(r.end)}<br>${state}</td><td>${esc((n.closesLegs || []).join(', ') || 'none')}</td><td><button class="a-btn small danger" data-del-notice="${i}"${gate('edit')}>Delete</button></td></tr>`;
  }).join('');
  const eventRows = d.manualEvents.map((e, i) => `<tr><td>${esc(e.title.en)}</td><td>${esc(e.start.replace('T', ' ').slice(0, 16))}</td><td>${esc(e.venueText)}</td><td>${new Date(e.expires) <= now() ? pill('Expired, hidden', 'warn') : pill('Listed', 'good')}</td><td><button class="a-btn small danger" data-del-event="${i}"${gate('edit')}>Delete</button></td></tr>`).join('');
  const dt = (days, h) => `${addDays(today, days)}T${h}`;
  root.innerHTML = `<h1 class="a-h1">Events and notices</h1>
    <p class="a-lead">Add a one-off event or a notice. Both expire automatically on their end date. A notice can close legs: the app then routes around them.</p>
    <div class="a-two"><div>
    <div class="a-card a-table-wrap" tabindex="0"><h2 class="a-h2">Notices</h2><table class="a-table"><tr><th>Text</th><th>Type</th><th>Dates</th><th>Closes legs</th><th><span class="visually-hidden">Actions</span></th></tr>${noticeRows || '<tr><td colspan="5">None</td></tr>'}</table></div>
    <div class="a-card a-table-wrap" tabindex="0"><h2 class="a-h2">Manual events</h2><table class="a-table"><tr><th>Title</th><th>Starts</th><th>Venue</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr>${eventRows || '<tr><td colspan="5">None yet</td></tr>'}</table></div>
    </div><div>
    <form class="a-card" id="noticeForm"><h2 class="a-h2">Add a notice</h2>
      ${field('Text (English)', '<textarea id="nEn" required></textarea>')}${field('Text (German)', '<textarea id="nDe" required></textarea>')}
      <div class="f-inline">${field('Type', `<select id="nSev">${options([['info', 'Information'], ['warn', 'Take care'], ['closure', 'Closure']])}</select>`)}${field('Starts', `<input type="date" id="nStart" value="${today}" />`)}${field('Ends', `<input type="date" id="nEnd" value="${addDays(today, 3)}" />`)}</div>
      ${field('Zones', `<select id="nZones" multiple size="4">${options(zones.map((z) => [z, en(d.settings.zones[z])]))}</select>`)}
      ${field('Close these legs', `<select id="nLegs" multiple size="5">${options(d.legs.map((l) => [l.id, `${l.id}: ${en(d.tags.find((t) => t.id === l.from)?.name)} to ${en(d.tags.find((t) => t.id === l.to)?.name)}`]))}</select>`, 'Hold Ctrl or Cmd to pick several')}
      <button class="a-btn primary" type="submit"${gate('edit')}>Add notice to draft</button></form>
    <form class="a-card" id="eventForm"><h2 class="a-h2">Add an event</h2>
      ${field('Title (English)', '<input id="eEn" required />')}${field('Title (German, optional)', '<input id="eDe" />')}
      <div class="f-inline">${field('Starts', `<input type="datetime-local" id="eStart" value="${dt(0, '18:00')}" required />`)}${field('Ends', `<input type="datetime-local" id="eEnd" value="${dt(0, '20:00')}" required />`)}
      ${field('Venue (Loop point)', `<select id="eVenue">${options(loops.map((t) => [t.id, en(t.name)]))}</select>`)}${field('Type', `<select id="eCat">${options(CATS)}</select>`)}</div>
      ${field('Link for details', '<input id="eUrl" type="url" value="https://gosouthampton.co.uk/" />', 'Must be https')}
      <button class="a-btn primary" type="submit"${gate('edit')}>Add event to draft</button></form>
    </div></div>`;
  const q = (s) => root.querySelector(s);
  q('#noticeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!can('edit')) return;
    const text = { en: q('#nEn').value.trim(), de: q('#nDe').value.trim() };
    if (!text.en || !text.de) { toast('Add the notice in English and German'); return; }
    const id = `n-${Date.now().toString(36)}`;
    d.notices.push({ id, severity: q('#nSev').value, text, zones: [...q('#nZones').selectedOptions].map((o) => o.value), closesLegs: [...q('#nLegs').selectedOptions].map((o) => o.value), start: q('#nStart').value, end: q('#nEnd').value, demo: false });
    saveDraft(`Notice ${id} added`);
    toast('Notice added to the draft. Publish to make it live.');
    refresh();
  });
  q('#eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!can('edit')) return;
    const start = fromLocal(q('#eStart').value); const end = fromLocal(q('#eEnd').value);
    const url = q('#eUrl').value.trim();
    if (!(end > start)) { toast('The end must be after the start'); return; }
    if (!/^https:\/\//.test(url)) { toast('The link must start with https://'); return; }
    const venue = d.tags.find((t) => t.id === q('#eVenue').value);
    const title = { en: q('#eEn').value.trim(), ...(q('#eDe').value.trim() ? { de: q('#eDe').value.trim() } : {}) };
    const id = `ev-m${Date.now().toString(36)}`;
    d.manualEvents.push({ id, title, start: isoLondon(start), end: isoLondon(end), allDay: false, venueText: en(venue.name), venueTag: venue.id, zone: venue.zone, category: q('#eCat').value, categoryRaw: q('#eCat').value, access: [], sourceId: 'manual', sourceUrl: url, alsoFrom: [], expires: isoLondon(startOfDay(addDays(dayKey(end), 1))), dedupeKey: `${venue.id}|${dayKey(start)}|${title.en.toLowerCase().replace(/[^a-z0-9]/g, '')}`, demo: false });
    saveDraft(`Manual event ${id} added: ${title.en}`);
    toast('Event added to the draft. Publish to make it live.');
    refresh();
  });
  root.querySelectorAll('[data-del-notice]').forEach((b) => b.addEventListener('click', () => { const [n] = d.notices.splice(Number(b.dataset.delNotice), 1); saveDraft(`Notice ${n.id} deleted`); refresh(); }));
  root.querySelectorAll('[data-del-event]').forEach((b) => b.addEventListener('click', () => { const [ev] = d.manualEvents.splice(Number(b.dataset.delEvent), 1); saveDraft(`Manual event ${ev.id} deleted`); refresh(); }));
}
