// Writes that wait for signal. Feedback and taps made with no connection are
// queued here and sent in small batches when the phone is back online.
import { local } from './storage.js';
import { api, isOnline } from './api.js';

const KEY = 'rl-outbox';
const read = () => ({ feedback: [], taps: [], ...(local.get(KEY, null) || {}) });
const write = (o) => { local.set(KEY, o); window.dispatchEvent(new CustomEvent('rl-outbox')); };

export function queueFeedback(item) { const o = read(); o.feedback.push(item); write(o); }
export function queueTap(item) { const o = read(); if (!o.taps.some((t) => t.e === item.e && t.tagId === item.tagId)) o.taps.push(item); write(o); }
export function counts() { const o = read(); return { feedback: o.feedback.length, taps: o.taps.length }; }

let flushing = null;
// onTap(item) is called for each queued tap once online; it returns true when handled.
export function flush({ batchSize = 5, onTap } = {}) {
  if (flushing) return flushing;
  // Cleared in .finally (always asynchronous), so a run that finishes without
  // awaiting cannot leave a stale promise behind.
  flushing = (async () => {
    let sent = 0;
    try {
      while (isOnline()) {
        const o = read();
        if (o.taps.length && onTap) {
          const item = o.taps[0];
          await onTap(item);
          const o2 = read(); o2.taps = o2.taps.filter((t) => !(t.e === item.e && t.tagId === item.tagId)); write(o2);
          continue;
        }
        if (!o.feedback.length) break;
        const batch = o.feedback.slice(0, batchSize);
        await api.sendFeedback(batch);
        const o3 = read(); o3.feedback = o3.feedback.slice(batch.length); write(o3);
        sent += batch.length;
      }
    } catch (err) {
      if (!err.offline) console.warn('[outbox] send failed', err);
    }
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}
