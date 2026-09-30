// Anonymous daily session key. A random value, created on first visit and
// replaced every 24 hours. It is never linked to a name, account or device ID.
// It lets the server count unique visits per day without following anyone across days.
import { local } from './storage.js';

const KEY = 'rl-session';
const DAY_MS = 24 * 60 * 60 * 1000;

function randomKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function sessionKey() {
  const nowMs = Date.now();
  let s = local.get(KEY, null);
  if (!s || typeof s.key !== 'string' || !(nowMs - s.created < DAY_MS) || s.created > nowMs) {
    s = { key: randomKey(), created: nowMs };
    local.set(KEY, s);
  }
  return s.key;
}

export function rotateSession() {
  const s = { key: randomKey(), created: Date.now() };
  local.set(KEY, s);
  return s.key;
}
