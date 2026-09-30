// Shared runtime context for the visitor app: the loaded bundle, the registers,
// the current tap token and a few UI flags. Kept in one place to avoid import cycles.
import { sessionStore } from './storage.js';
import { routingContext } from './journey.js';
import { state } from './state.js';
import { now } from './clock.js';
import { pick } from './i18n.js';

export const ctx = {
  bundle: null,
  register: { events: [], places: [], health: {} },
  sid: null,
  demo: false,
  preview: false,
  tapBanner: null,
  rejoin: null,
  pendingUpdate: null,
};

const TOKEN_KEY = 'rl-token';
export function setToken(token, tag, exp) { sessionStore.set(TOKEN_KEY, { token, tag, exp }); }
export function clearToken() { sessionStore.remove(TOKEN_KEY); }
// A valid token from a verified tap in the last few minutes, optionally for one place.
export function validToken(forTag) {
  const t = sessionStore.get(TOKEN_KEY, null);
  if (!t || Date.now() > t.exp) return null;
  if (forTag && t.tag !== forTag) return null;
  return t;
}

export const routing = () => routingContext(ctx.bundle, now(), state.stepFree);
export const tagById = (id) => ctx.bundle?.tagById.get(id);
export const placeName = (id) => pick(tagById(id)?.name) || '';
export const trailById = (id) => ctx.bundle?.trailById.get(id);
export const setting = (k) => ctx.bundle?.settings?.[k];
export const isCruise = () => state.cruise === true;
