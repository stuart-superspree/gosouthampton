// Dashboard. The charts use generated SAMPLE DATA (labelled as such) to show
// what the BID would see. The small "this browser" panel shows real counts from
// the demo server, so taps made during the demo appear here.
import { getDraft } from './store.js';
import { readDbForAdmin } from '../mock-server.js';
import { esc, pill, en } from './ui.js';

const S1 = '#1a8aad'; const S2 = '#c9771a'; // validated with the dataviz palette checker

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function sample(data) {
  const r = rng(20260930);
  const loops = data.tags.filter((t) => t.kind === 'loop');
  const weight = { port: 3.2, 'old-town': 2.2, westquay: 2, cultural: 1.6, waterfront: 1.4, oxford: 1.1, parks: 0.8, bedford: 0.7 };
  const byPlace = loops.map((t) => ({ label: en(t.name), value: Math.round((weight[t.zone] || 1) * (380 + r() * 260)) })).sort((a, b) => b.value - a.value);
  const hours = Array.from({ length: 13 }, (_, i) => 8 + i);
  const byHour = hours.map((h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: Math.round(900 * Math.exp(-((h - 12.5) ** 2) / 10) + 60 + r() * 80) }));
  const trails = data.trails.filter((t) => t.type === 'trail').map((t) => { const starts = Math.round(420 + r() * 520); return { label: en(t.title), value: starts, value2: Math.round(starts * (0.38 + r() * 0.3)) }; });
  const ratings = loops.slice(0, 8).map((t) => { const n = Math.round(20 + r() * 60); const good = Math.round(n * (0.55 + r() * 0.3)); const poor = Math.round((n - good) * r() * 0.5); return { place: en(t.name), good, ok: n - good - poor, poor }; });
  return { byPlace, byHour, trails, ratings };
}

// Bar chart with rounded data-ends, value labels at the tips, hover and focus
// tooltips, and a table view. One series needs no legend; two get one.
function bars({ id, title, data, series, horizontal = true }) {
  const two = series.length === 2;
  const max = Math.max(...data.map((d) => Math.max(d.value, d.value2 || 0))) * 1.12;
  const W = 560; const labelW = horizontal ? 170 : 0; const band = horizontal ? (two ? 34 : 24) : 40;
  const H = horizontal ? data.length * band + 24 : 230; const plotW = W - labelW - 40;
  let marks = ''; let axis = '';
  const r = 4;
  const hbar = (x0, y, len, h) => `M${x0},${y} H${x0 + Math.max(len - r, 0)} Q${x0 + len},${y} ${x0 + len},${y + r} V${y + h - r} Q${x0 + len},${y + h} ${x0 + Math.max(len - r, 0)},${y + h} H${x0} Z`;
  const vbar = (x, y0, len, w) => `M${x},${y0} V${y0 - Math.max(len - r, 0)} Q${x},${y0 - len} ${x + r},${y0 - len} H${x + w - r} Q${x + w},${y0 - len} ${x + w},${y0 - len + r} V${y0} Z`;
  data.forEach((d, i) => {
    const vals = [d.value, ...(two ? [d.value2] : [])];
    vals.forEach((v, k) => {
      const tip = `${d.label}: ${v.toLocaleString('en-GB')}${two ? ` ${series[k].name.toLowerCase()}` : ''}`;
      if (horizontal) {
        const h = 12; const y = i * band + 6 + k * (h + 2); const len = (v / max) * plotW;
        marks += `<path class="bar" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}" d="${hbar(labelW, y, len, h)}" fill="${series[k].color}"/>`;
        if (!two || k === 0) marks += `<text class="val" x="${labelW + len + 6}" y="${y + 10}">${v.toLocaleString('en-GB')}</text>`;
        else marks += `<text class="val" x="${labelW + len + 6}" y="${y + 10}">${v.toLocaleString('en-GB')}</text>`;
      } else {
        const bw = 20; const x = 30 + i * band + (band - bw) / 2; const y0 = H - 24; const len = (v / max) * (H - 50);
        marks += `<path class="bar" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}" d="${vbar(x, y0, len, bw)}" fill="${series[k].color}"/>`;
        if (i % 3 === 0 || v === Math.max(...data.map((x2) => x2.value))) marks += `<text class="val" x="${x + bw / 2}" y="${y0 - len - 5}" text-anchor="middle">${v.toLocaleString('en-GB')}</text>`;
      }
    });
    axis += horizontal
      ? `<text x="${labelW - 8}" y="${i * band + (two ? 20 : 16)}" text-anchor="end">${esc(d.label.length > 28 ? d.label.slice(0, 27) + '...' : d.label)}</text>`
      : `<text x="${30 + i * band + band / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  const base = horizontal ? `<line x1="${labelW}" y1="0" x2="${labelW}" y2="${H - 18}" stroke="var(--grid)"/>` : `<line x1="24" y1="${H - 24}" x2="${W}" y2="${H - 24}" stroke="var(--grid)"/>`;
  const legend = two ? `<div class="legend">${series.map((s) => `<span><i class="sw-${s.color === S1 ? 1 : 2}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  const head = `<tr><th>${horizontal ? 'Item' : 'Hour'}</th>${series.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr>`;
  const rows = data.map((d) => `<tr><td>${esc(d.label)}</td><td>${d.value}</td>${two ? `<td>${d.value2}</td>` : ''}</tr>`).join('');
  return `<figure class="a-card" aria-labelledby="${id}-t"><h3 class="a-h3" id="${id}-t">${esc(title)} ${pill('Sample data', 'warn')}</h3>${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(title)}">${base}${axis}${marks}</svg><details class="table-view"><summary>Show as a table</summary><div class="a-table-wrap" tabindex="0"><table class="a-table">${head}${rows}</table></div></details></figure>`;
}

function wireTips(root) {
  const tip = document.getElementById('chartTip');
  const showTip = (el, x, y) => { tip.textContent = el.dataset.tip; tip.classList.remove('hidden'); tip.style.left = `${Math.min(x + 12, window.innerWidth - 220)}px`; tip.style.top = `${y - 36}px`; };
  root.querySelectorAll('.bar').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(el, e.clientX, e.clientY));
    el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    el.addEventListener('focus', () => { const b = el.getBoundingClientRect(); showTip(el, b.right, b.top); });
    el.addEventListener('blur', () => tip.classList.add('hidden'));
  });
}

export function render(root) {
  const data = getDraft().data;
  const s = sample(data);
  const db = readDbForAdmin();
  const verified = db.taps.filter((x) => x.result === 'valid').length;
  const rejected = db.taps.filter((x) => x.result === 'replay' || x.result === 'invalid').length;
  const codes = Object.values(db.codes || {});
  const totalTaps = s.byPlace.reduce((n, d) => n + d.value, 0);
  const completions = s.trails.reduce((n, d) => n + d.value2, 0);
  const comments = (db.feedback || []).filter((f) => f.comment).slice(-3).reverse();
  const tagName = (id) => en(data.tags.find((t) => t.id === id)?.name) || id;
  root.innerHTML = `<h1 class="a-h1">Dashboard</h1>
    <p class="a-lead">Anonymous counts only: taps by place and hour, trail starts and completions, and feedback. No names or personal profiles are needed for any of this.</p>
    <div class="a-card"><h2 class="a-h2">From this browser's demo server ${pill('Simulation', 'warn')}</h2>
      <div class="stat-tiles">
        <div class="stat-tile"><b data-live="verified">${verified}</b><span>verified taps</span></div>
        <div class="stat-tile"><b data-live="rejected">${rejected}</b><span>taps rejected (replayed or forged)</span></div>
        <div class="stat-tile"><b data-live="feedback">${(db.feedback || []).length}</b><span>feedback responses received</span></div>
        <div class="stat-tile"><b data-live="codes">${codes.length}</b><span>single-use codes issued (${codes.filter((c) => c.used).length} redeemed)</span></div>
      </div>
      ${comments.length ? `<h3 class="a-h3">Latest comments (moderated before any display)</h3>${comments.map((c) => `<p class="quote">${esc(c.comment)} <small>· ${esc(tagName(c.tag))}</small></p>`).join('')}` : ''}
    </div>
    <h2 class="a-h2">Last 7 days ${pill('Sample data', 'warn')}</h2>
    <div class="stat-tiles"><div class="stat-tile"><b>${totalTaps.toLocaleString('en-GB')}</b><span>taps (sample)</span></div><div class="stat-tile"><b>${completions.toLocaleString('en-GB')}</b><span>trail completions (sample)</span></div><div class="stat-tile"><b>${Math.round(totalTaps / 3.1).toLocaleString('en-GB')}</b><span>daily visitor keys (sample)</span></div></div>
    <div class="a-grid charts">
      ${bars({ id: 'c1', title: 'Taps by place', data: s.byPlace, series: [{ name: 'Taps', color: S1 }] })}
      ${bars({ id: 'c2', title: 'Taps by hour of day', data: s.byHour, series: [{ name: 'Taps', color: S1 }], horizontal: false })}
      ${bars({ id: 'c3', title: 'Trail starts and completions', data: s.trails, series: [{ name: 'Starts', color: S1 }, { name: 'Completions', color: S2 }] })}
      <div class="a-card"><h3 class="a-h3">Feedback by place ${pill('Sample data', 'warn')}</h3><div class="a-table-wrap" tabindex="0"><table class="a-table"><tr><th>Place</th><th>Good</th><th>OK</th><th>Not good</th></tr>${s.ratings.map((x) => `<tr><td>${esc(x.place)}</td><td>${x.good}</td><td>${x.ok}</td><td>${x.poor}</td></tr>`).join('')}</table></div>
      <p class="quote">"The step cards were easy to follow." <small>· sample comment</small></p><p class="quote">"More benches near the walls, please." <small>· sample comment</small></p></div>
    </div>`;
  wireTips(root);
}
