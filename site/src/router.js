// Screen switching with a simple stack, mirrored into browser history so the
// phone's back gesture works. All history calls are guarded (see storage.js).
import { pushHistory } from './storage.js';

const screens = {};
const renderers = {};
const listeners = [];
let stack = ['welcome'];
let historyOk = true;
// Inside another page (the admin's phone preview is an iframe), never pull
// focus away from the parent: it would steal the cursor from whoever is typing.
const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

export function initRouter() {
  document.querySelectorAll('.screen').forEach((s) => { screens[s.dataset.screen] = s; });
  window.addEventListener('popstate', (e) => {
    const depth = e.state && e.state.rlDepth ? e.state.rlDepth : 1;
    while (stack.length > depth) stack.pop();
    if (!stack.length) stack = ['home'];
    show(stack[stack.length - 1]);
  });
  try { history.replaceState({ rlDepth: 1 }, ''); } catch { historyOk = false; }
}

export function onRender(name, fn) { renderers[name] = fn; }
export function onShow(fn) { listeners.push(fn); }
export const current = () => stack[stack.length - 1];

export function show(name, { focus = true } = {}) {
  const target = screens[name];
  if (!target) return;
  if (renderers[name]) renderers[name]();
  Object.values(screens).forEach((s) => s.classList.toggle('active', s === target));
  try { window.scrollTo(0, 0); } catch { /* ignore */ }
  if (focus && (!embedded || document.hasFocus())) {
    const f = target.querySelector('.screen-focus');
    if (f) f.focus({ preventScroll: true });
  }
  listeners.forEach((fn) => fn(name));
}

export function go(name) {
  stack.push(name);
  show(name);
  try { history.pushState({ rlDepth: stack.length }, ''); } catch { historyOk = false; pushHistory(null); }
}

export function back() {
  if (stack.length <= 1) { resetTo('home'); return; }
  if (historyOk && history.state && history.state.rlDepth === stack.length) { history.back(); return; }
  stack.pop();
  show(stack[stack.length - 1]);
}

export function resetTo(name, opts) {
  stack = [name];
  try { history.replaceState({ rlDepth: 1 }, ''); } catch { historyOk = false; }
  show(name, opts);
}

// Pop back to a screen already in the stack (used by the Snow Trail screens).
export function backTo(name) {
  while (stack.length > 1 && stack[stack.length - 1] !== name) stack.pop();
  try { history.replaceState({ rlDepth: stack.length }, ''); } catch { /* ignore */ }
  show(name);
}

export function refresh() { const c = current(); if (renderers[c]) renderers[c](); }
