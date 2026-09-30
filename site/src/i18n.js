// Strings live in /strings/<lang>.json. English and German are built; the other
// four languages are shown but disabled until their strings are reviewed.
export const BUILT = ['en', 'de'];
export const PLANNED = ['it', 'nl', 'es', 'fr'];

const strings = { en: {}, de: {} };
let lang = 'en';

// Only the visitor's language is fetched; a build check guarantees every
// English key exists in German, so no fallback file is needed.
export async function loadStrings(langs = BUILT) {
  await Promise.all(langs.filter((l) => !Object.keys(strings[l] || {}).length).map(async (l) => {
    const res = await fetch(`/strings/${l}.json`);
    if (!res.ok) throw new Error(`strings ${l}: HTTP ${res.status}`);
    strings[l] = await res.json();
  }));
}

export function detectLanguage() {
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return BUILT.includes(nav) ? nav : 'en';
}

export function setLang(l) { lang = BUILT.includes(l) ? l : 'en'; document.documentElement.lang = lang; }
export function getLang() { return lang; }

export function t(key, vars) {
  let s = strings[lang]?.[key] ?? strings.en?.[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// Pick the visitor's language from a {en, de} content object.
export function pick(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? '';
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.dataset.i18nTitle)); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.dataset.i18nPh)); });
  document.documentElement.lang = lang;
}
