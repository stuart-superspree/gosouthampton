// The only way the visitor app reaches "the server". Today every call goes to
// the in-browser simulation (mock-server.js); a live build swaps these bodies
// for fetch() calls to the real API and nothing else in the app changes.
import * as server from './mock-server.js';
import { sessionStore } from './storage.js';

const OFFLINE_KEY = 'rl-demo-offline';
export function simulatedOffline() { return sessionStore.get(OFFLINE_KEY, false) === true; }
export function setSimulatedOffline(v) {
  sessionStore.set(OFFLINE_KEY, !!v);
  window.dispatchEvent(new CustomEvent('rl-connectivity'));
}
export function isOnline() { return navigator.onLine !== false && !simulatedOffline(); }

export class OfflineError extends Error { constructor() { super('offline'); this.offline = true; } }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(fn) {
  await wait(90 + Math.random() * 160);
  if (!isOnline()) throw new OfflineError();
  return fn();
}

export function init(bundle) { server.configure(bundle); }

export const api = {
  verifyTap: (tagId, e, c, sid) => call(() => server.tap({ tagId, e, c, sid, at: Date.now() })),
  stamp: (token, sid) => call(() => server.stamp({ token, sid, at: Date.now() })),
  claimReward: (token, sid, rewardId) => call(() => server.claimReward({ token, sid, rewardId, at: Date.now() })),
  redeemCode: (code) => call(() => server.redeemCode({ code, at: Date.now() })),
  claimPrize: (token, sid, routeId, contact) => call(() => server.claimPrize({ token, sid, routeId, contact, at: Date.now() })),
  sendFeedback: (items) => call(() => server.feedback({ items, at: Date.now() })),
};
