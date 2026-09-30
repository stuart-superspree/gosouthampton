// The app's clock. In demo mode a date can be simulated (for example to show
// the seasonal Snow Windows Trail or a busy day). The time of day stays real.
import { sessionStore } from './storage.js';
import { londonParts, zoned } from './time.js';

const KEY = 'rl-demo-date';

export function demoDate() { return sessionStore.get(KEY, null); }
export function setDemoDate(value) {
  if (value && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) sessionStore.set(KEY, value);
  else sessionStore.remove(KEY);
  window.dispatchEvent(new CustomEvent('rl-clock'));
}

export function now() {
  const real = new Date();
  const o = demoDate();
  if (!o) return real;
  const [datePart, timePart] = o.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const p = londonParts(real);
  const [h, mi] = timePart ? timePart.split(':').map(Number) : [p.h, p.mi];
  return zoned(y, m, d, h, mi);
}
