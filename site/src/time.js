// Europe/London date helpers. "Today" and "this week" are always worked out in
// London time from the device clock, and day boundaries come from the calendar,
// not from adding 24 hours, so the days the clocks change (23 or 25 hours) are handled.
export const TZ = 'Europe/London';
const pad = (n) => String(n).padStart(2, '0');

let partsFmt = null;
function fmt() {
  if (!partsFmt) {
    partsFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  }
  return partsFmt;
}

export function londonParts(date) {
  const p = {};
  for (const { type, value } of fmt().formatToParts(date)) p[type] = value;
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute, s: +p.second };
}

// Minutes London is ahead of UTC at this instant (0 in winter, 60 in summer).
export function offsetMinutes(date) {
  const p = londonParts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  const whole = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / 60000);
}

// The instant that London wall-clock time y-m-d h:mi represents.
export function zoned(y, m, d, h = 0, mi = 0) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = offsetMinutes(new Date(guess));
  let t = guess - off1 * 60000;
  const off2 = offsetMinutes(new Date(t));
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

export function dayKey(date) {
  const p = londonParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function startOfDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return zoned(y, m, d, 0, 0);
}

// ISO 8601 with the London offset, e.g. 2026-10-02T19:30:00+01:00
export function isoLondon(date) {
  const p = londonParts(date);
  const off = offsetMinutes(date);
  const a = Math.abs(off);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${off >= 0 ? '+' : '-'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

// iCalendar local time for use with TZID=Europe/London, e.g. 20261002T193000
export function icsLocal(date) {
  const p = londonParts(date);
  return `${p.y}${pad(p.m)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}${pad(p.s)}`;
}

export function hhmm(date) {
  const p = londonParts(date);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

const locales = { en: 'en-GB', de: 'de-DE' };
export function formatDay(date, lang = 'en') {
  return new Intl.DateTimeFormat(locales[lang] || 'en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}
export function formatLongDate(key, lang = 'en') {
  return new Intl.DateTimeFormat(locales[lang] || 'en-GB', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(startOfDay(key));
}

// Minutes from `now` until London wall-clock time HH:MM today (or tomorrow if passed).
export function minutesUntil(hhmmStr, now) {
  const [h, m] = hhmmStr.split(':').map(Number);
  const key = dayKey(now);
  let target = zoned(...key.split('-').map(Number), h, m);
  if (target < now) {
    const k2 = addDays(key, 1);
    target = zoned(...k2.split('-').map(Number), h, m);
  }
  return Math.round((target - now) / 60000);
}

// Resolve demo date tokens such as {{D+2}}, {{iso:D+2 19:30}} or {{ics:D-1 10:00}}
// against today's London date. Only demo fixtures and demo records use these.
const TOKEN = /\{\{(?:(iso|ics|date):)?D([+-]\d+)(?: (\d{1,2}):(\d{2}))?\}\}/g;
export function resolveDemoDates(text, now) {
  const base = dayKey(now);
  return text.replace(TOKEN, (_, kind, n, h, mi) => {
    const key = addDays(base, Number(n));
    if (!kind || kind === 'date') return key;
    const [y, m, d] = key.split('-').map(Number);
    const dt = zoned(y, m, d, Number(h || 0), Number(mi || 0));
    return kind === 'ics' ? icsLocal(dt) : isoLondon(dt);
  });
}
export function hasDemoTokens(text) { TOKEN.lastIndex = 0; const r = TOKEN.test(text); TOKEN.lastIndex = 0; return r; }
