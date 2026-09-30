// Visitor state kept on the phone. Nothing here identifies a person: stamps,
// progress and settings only. Prize-draw details are never kept here; they go
// to the separate (mock) prize store with a stated deletion date.
import { local } from './storage.js';

const KEY = 'rl-city-v2';

export function defaults() {
  return {
    v: 2,
    lang: null,
    setupComplete: false,
    cruise: null,
    shipTime: null,
    currentPlace: null,
    placeVerified: false,
    stepFree: false,
    journey: null,
    passport: [],
    rewards: {},
    snow: { activeRoute: null, activeStopId: null, answers: { snowflake: {}, star: {} }, stamps: { snowflake: [], star: [] }, submitted: { snowflake: null, star: null }, rating: null },
    nudgeDismissed: {},
    feedbackGiven: {},
    sharedPlan: false,
  };
}

function merge(base, saved) {
  const out = { ...base, ...saved };
  out.snow = { ...base.snow, ...(saved.snow || {}) };
  for (const k of ['answers', 'stamps', 'submitted']) out.snow[k] = { ...base.snow[k], ...((saved.snow || {})[k] || {}) };
  return out;
}

export const state = merge(defaults(), local.get(KEY, {}) || {});

let persist = true;
// The admin's phone preview must not change the visitor's saved progress.
export function setPersist(v) { persist = !!v; }
export function save() { if (persist) local.set(KEY, state); }

export function resetState() {
  const fresh = defaults();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  local.remove(KEY);
}
