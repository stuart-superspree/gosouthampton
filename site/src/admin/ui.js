// Small helpers for the demo admin screens.
import { esc } from '../markup.js';
import { can } from './store.js';

export { esc };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const en = (o) => (o && typeof o === 'object' ? o.en || '' : o || '');

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('aToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// Disabled attribute plus a reason, when the current role lacks a permission.
export function gate(perm) {
  return can(perm) ? '' : ` disabled aria-disabled="true" title="Your role cannot do this"`;
}

export function options(list, value) {
  return list.map((o) => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

export function field(label, control, hint = '') {
  return `<label class="f"><span>${esc(label)}</span>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</label>`;
}

export function pill(text, kind = '') { return `<span class="pill ${kind}">${esc(text)}</span>`; }

export function fmtTime(iso) {
  if (!iso) return 'never';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}
