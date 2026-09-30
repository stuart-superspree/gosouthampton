// Safe rendering helpers. All content is escaped first; authored step text may
// use **bold** and _emphasis_, which are the only markup turned into HTML.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

export function md(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_(.+?)_(?=$|[\s.,;:!?)])/g, '$1<em>$2</em>');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function setHidden(el, hidden) { if (el) el.classList.toggle('hidden', !!hidden); }
