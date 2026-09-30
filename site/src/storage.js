// Every use of localStorage, sessionStorage and history is wrapped, because
// private windows, previews and blocked site data make them throw. If storage
// is unavailable the app keeps working from memory for the rest of the visit.
function makeStore(getArea) {
  const memory = new Map();
  let area = null;
  try { area = getArea(); const k = '__rl_probe__'; area.setItem(k, '1'); area.removeItem(k); } catch { area = null; }
  return {
    available: () => !!area,
    get(key, fallback = null) {
      try {
        const raw = area ? area.getItem(key) : memory.get(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try { if (area) { area.setItem(key, raw); return true; } } catch { /* quota or blocked: fall back */ }
      memory.set(key, raw);
      return false;
    },
    remove(key) {
      try { if (area) area.removeItem(key); } catch { /* ignore */ }
      memory.delete(key);
    },
  };
}

export const local = makeStore(() => window.localStorage);
export const sessionStore = makeStore(() => window.sessionStorage);

export function pushHistory(state) {
  try { history.pushState(state, '', location.pathname + location.search); } catch { /* blocked in some previews */ }
}
export function replaceUrl(url, state = null) {
  try { history.replaceState(state, '', url); } catch { /* ignore */ }
}
