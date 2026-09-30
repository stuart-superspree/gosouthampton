// SIMULATION of the edge function that verifies a secured NFC tap.
// A real NTAG 424 DNA chip returns an encrypted message (with a counter that
// rises on every tap) and a check value made with a key only the chip and the
// server know. The server checks both, rejects replays, and issues a short-lived
// signed token. Here the "server" runs in the browser, so the key below is
// visible: that is acceptable only because this is a labelled demo. In the live
// build this file is replaced by a real edge function and the key never ships.
import { hmacHex, b64urlEncode, b64urlDecode } from './hmac.js';

const DEMO_ONLY_SECRET = 'routeloop-demo-only-key: not for production';
const TOKEN_KEY = DEMO_ONLY_SECRET + ':token';

// Used by the demo chip simulator (the chip holds the same key).
export function chipCheck(tagId, e) { return hmacHex(DEMO_ONLY_SECRET, `${tagId}|${e}`).slice(0, 16); }
export function chipMessage(ctr) { return b64urlEncode(JSON.stringify({ ctr })); }

function readCounter(e) {
  try { const v = JSON.parse(b64urlDecode(e)); return Number.isInteger(v.ctr) ? v.ctr : null; } catch { return null; }
}

export function verifyTap({ tagId, e, c, tag, counters }) {
  if (!tag || tag.status === 'retired') return { status: 'unknown' };
  if (!e || !c || c !== chipCheck(tagId, e)) return { status: 'invalid' };
  const ctr = readCounter(e);
  if (ctr === null) return { status: 'invalid' };
  if (!(ctr > (counters[tagId] || 0))) return { status: 'replay', ctr };
  return { status: 'valid', ctr };
}

export function issueToken(payload) {
  const body = b64urlEncode(JSON.stringify(payload));
  return `${body}.${hmacHex(TOKEN_KEY, body).slice(0, 32)}`;
}

// Returns the payload if the signature is good and it had not expired at `at`.
export function verifyToken(token, at) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (hmacHex(TOKEN_KEY, body).slice(0, 32) !== sig) return null;
  try {
    const p = JSON.parse(b64urlDecode(body));
    if (typeof p.exp !== 'number' || at > p.exp) return null;
    return p;
  } catch { return null; }
}
