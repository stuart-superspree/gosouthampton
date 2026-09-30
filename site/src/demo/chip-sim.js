// SIMULATION of a secured NFC chip (NTAG 424 DNA style). Each tap raises the
// chip's counter and produces a new message and check value. Used only by the
// demo panel's Tap simulator; a real phone gets these from the physical tag.
import { local, sessionStore } from '../storage.js';
import { chipCheck, chipMessage } from '../mock-edge.js';
import { readDbForAdmin } from '../mock-server.js';

const KEY = 'rl-mock-chips';
const LAST = 'rl-demo-last-tap';

export function nextTapUrl(tagId) {
  const chips = local.get(KEY, {}) || {};
  const serverSeen = readDbForAdmin().counters[tagId] || 0;
  const ctr = Math.max(chips[tagId] || 0, serverSeen) + 1;
  chips[tagId] = ctr;
  local.set(KEY, chips);
  const e = chipMessage(ctr);
  const url = `/t/${tagId}?e=${e}&c=${chipCheck(tagId, e)}`;
  sessionStore.set(LAST, url);
  return url;
}

export const lastTapUrl = () => sessionStore.get(LAST, null);
