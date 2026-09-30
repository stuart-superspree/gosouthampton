// One-tap feedback at a Loop point: three faces and an optional short comment.
// Stored anonymously (place, time, language and the daily session key only),
// queued in the outbox and sent in small batches when there is signal.
// Offered only after a verified tap here, so feedback is tied to a real visit.
import { state, save } from '../state.js';
import { ctx, validToken, placeName, setting } from '../ctx.js';
import { t, getLang } from '../i18n.js';
import { esc, $ } from '../markup.js';
import { queueFeedback, flush } from '../outbox.js';
import { isOnline } from '../api.js';
import { now } from '../clock.js';
import { dayKey } from '../time.js';

let rating = null;
let status = '';
const givenKey = () => `${state.currentPlace}|${dayKey(now())}`;

export function feedbackCardHtml() {
  const place = state.currentPlace;
  if (!place || !validToken(place)) return '';
  if (state.feedbackGiven[givenKey()]) return status ? `<div class="home-card feedback-card"><p class="fb-status" role="status">${esc(status)}</p></div>` : '';
  const max = setting('feedbackMaxChars') || 140;
  const face = (v, emoji, key) => `<button type="button" class="face-btn" data-action="fb-rate" data-rating="${v}" aria-pressed="${rating === v}"><b aria-hidden="true">${emoji}</b><span>${esc(t(key))}</span></button>`;
  return `<div class="home-card feedback-card" id="feedbackCard"><h2>${esc(t('feedback.title', { place: placeName(place) }))}</h2>`
    + `<div class="face-row" role="group" aria-label="${esc(t('feedback.title', { place: placeName(place) }))}">${face(3, '😀', 'feedback.good')}${face(2, '😐', 'feedback.ok')}${face(1, '😞', 'feedback.poor')}</div>`
    + `<label for="fbComment">${esc(t('feedback.commentLabel'))}</label><textarea id="fbComment" maxlength="${max}" rows="2"></textarea>`
    + `<div class="fb-meta"><span>${esc(t('feedback.anon'))}</span><span id="fbCount" aria-live="polite">${esc(t('feedback.charsLeft', { n: max }))}</span></div>`
    + `<button class="btn btn-primary btn-small" data-action="fb-send">${esc(t('feedback.send'))}</button><p class="fb-status" id="fbStatus" role="status">${esc(status)}</p></div>`;
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'fbComment') {
    const max = setting('feedbackMaxChars') || 140;
    const c = document.getElementById('fbCount');
    if (c) c.textContent = t('feedback.charsLeft', { n: max - e.target.value.length });
  }
});

export const actions = {
  'fb-rate': (el) => {
    rating = Number(el.dataset.rating);
    document.querySelectorAll('.face-btn').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.rating) === rating)));
  },
  'fb-send': () => {
    const tok = validToken(state.currentPlace);
    if (!tok) return;
    if (!rating) { const s = $('#fbStatus'); if (s) s.textContent = t('feedback.pickRating'); return; }
    const comment = ($('#fbComment')?.value || '').trim().slice(0, setting('feedbackMaxChars') || 140);
    queueFeedback({ tag: state.currentPlace, rating, comment, ts: Date.now(), lang: getLang(), sid: ctx.sid, token: tok.token });
    status = isOnline() ? t('feedback.thanks') : t('feedback.queued');
    state.feedbackGiven[givenKey()] = true;
    rating = null;
    save();
    document.getElementById('feedbackHost').innerHTML = feedbackCardHtml();
    flush({ batchSize: setting('feedbackBatchSize') || 5 });
  },
};
