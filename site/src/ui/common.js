// Small shared UI pieces: toasts, banners, image credits, brand lockup, and the
// visibility of cruise-only features.
import { t, pick } from '../i18n.js';
import { esc } from '../markup.js';
import { ctx, isCruise } from '../ctx.js';
import { isOnline } from '../api.js';

let toastTimer = null;
export function toast(text, icon = '✓', ms = 2800) {
  const el = document.getElementById('stampToast');
  if (!el) return;
  el.innerHTML = `<span class="st-toast-icon" aria-hidden="true">${esc(icon)}</span><span>${esc(text)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ } }

export function setTapBanner(kind, text) { ctx.tapBanner = text ? { kind, text } : null; renderTapBanner(); }
export function renderTapBanner() {
  const host = document.getElementById('tapBannerHost');
  if (!host) return;
  const b = ctx.tapBanner;
  host.innerHTML = b ? `<p class="tap-banner ${esc(b.kind)}">${esc(b.text)}</p>` : '';
}

// Image source, alt text and credit from the image register.
export function imageInfo(file, fallbackAlt = '') {
  const meta = ctx.bundle?.imageByFile.get(file);
  return { src: file, alt: meta ? pick(meta.alt) : fallbackAlt, credit: meta && meta.credit ? t('photo.credit', { name: meta.credit.replace(/ \(.*\)$/, '') }) : '' };
}

export function setImage(imgEl, creditEl, file, fallbackAlt) {
  const info = imageInfo(file, fallbackAlt);
  if (imgEl) { imgEl.src = info.src; imgEl.alt = info.alt; imgEl.decoding = 'async'; }
  if (creditEl) creditEl.textContent = info.credit;
}

export function applyBrand() {
  const sub = isCruise() ? t('brand.subCruise') : t('brand.subCity');
  document.querySelectorAll('[data-brand-sub]').forEach((el) => { el.textContent = sub; });
  document.querySelectorAll('.cruise-only').forEach((el) => el.classList.toggle('hidden', !isCruise()));
}

export function renderOffline() {
  const el = document.getElementById('offlineBanner');
  if (el) el.classList.toggle('hidden', isOnline());
}

export function demoPill() { return `<span class="tour-demo">${esc(t('demo.content'))}</span>`; }
