// Acceptance tests for the Southampton RouteLoop demo (tests 1 to 17 from the brief).
// Run: npm test   (starts its own server; uses the Playwright Chromium).
// Output: tests/out/results.json, tests/out/results.md, screenshots in tests/out/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'tests/out');
fs.mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.TEST_PORT) || 8139;
// BASE_URL runs the suite against an already running server (for example Caddy).
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/strings/en.json'), 'utf8'));
const de = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/strings/de.json'), 'utf8'));
const only = process.argv.slice(2).map(Number).filter(Boolean);

const server = process.env.BASE_URL ? { kill() {} } : spawn(process.execPath, [path.join(ROOT, 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch();
const results = [];

async function newPage({ sw = false, viewport = { width: 390, height: 844 }, bypassCSP = false } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, serviceWorkers: sw ? 'allow' : 'block', locale: 'en-GB', timezoneId: 'Europe/London', bypassCSP });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  return { context, page };
}
const ready = (page) => page.waitForSelector('html[data-ready="1"]', { timeout: 10000 });
const active = (page) => page.evaluate(() => document.querySelector('.screen.active')?.dataset.screen);
const vstate = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rl-city-v2') || '{}'));
async function open(page, url = '/?demo=1') { await page.goto(BASE + url); await ready(page); }
async function skipSetup(page) { await open(page); await page.click('[data-action="skip-to-home"]'); }
async function tap(page, tagId) {
  const url = await page.evaluate(async (id) => (await import('/src/demo/chip-sim.js')).nextTapUrl(id), tagId);
  await page.goto(BASE + url); await ready(page); await page.waitForTimeout(700);
  return url;
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function shot(page, name, full = false) { await page.waitForTimeout(450); await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full }); }

async function run(n, name, fn) {
  if (only.length && !only.includes(n)) return;
  const t0 = Date.now();
  const notes = [];
  try {
    await fn(notes);
    results.push({ n, name, pass: true, notes, ms: Date.now() - t0 });
    console.log(`PASS ${n}. ${name}`);
  } catch (err) {
    results.push({ n, name, pass: false, notes: [...notes, `ERROR: ${err.message}`], ms: Date.now() - t0 });
    console.log(`FAIL ${n}. ${name}: ${err.message}`);
  }
}

// ---------- 1, 2, 3 ----------
let shared = null;
await run(1, 'Valid tap', async (notes) => {
  shared = await newPage();
  const { page } = shared;
  await skipSetup(page);
  await page.click('.demo-fab');
  await page.click('button[data-demo="tap"][data-tag="k7Qx2"]');
  await ready(page);
  await page.waitForSelector('.stamp-toast.show', { timeout: 3000 });
  const toast = await page.textContent('#stampToast');
  const s = await vstate(page);
  notes.push(`screen=${await active(page)}, place=${await page.textContent('#currentHubName')}, stamps=${JSON.stringify(s.passport)}, toast="${toast}"`);
  assert(await active(page) === 'home', 'not on home');
  assert((await page.textContent('#currentHubName')).trim() === 'Bargate', 'not on Bargate');
  assert(s.passport.length === 1 && s.passport[0] === 'k7Qx2', 'expected exactly one Bargate stamp');
  assert(/Bargate/.test(toast), 'toast does not mention Bargate');
});

await run(2, 'Replay', async (notes) => {
  const { page } = shared;
  await page.click('.demo-fab');
  await page.click('button[data-demo="replay"]');
  await ready(page); await page.waitForTimeout(600);
  const banner = (await page.textContent('#tapBannerHost')).trim();
  const s = await vstate(page);
  notes.push(`banner="${banner}", stamps=${JSON.stringify(s.passport)}`);
  assert(banner.includes('This tap has already been used. Tap the Loop again'), 'no already-used message');
  assert(s.passport.length === 1, 'stamp count changed');
  const log = await page.evaluate(async () => (await import('/src/mock-server.js')).readDbForAdmin().taps.map((t) => t.result));
  assert(log.at(-1) === 'replay', 'server did not log a replay');
});

await run(3, 'Plain link (browse mode)', async (notes) => {
  const { page } = shared;
  await open(page, '/t/m3Rt9');
  const banner = (await page.textContent('#tapBannerHost')).trim();
  const s = await vstate(page);
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('rl-token') || 'null'));
  notes.push(`place=${await page.textContent('#currentHubName')}, banner="${banner}", stamps=${JSON.stringify(s.passport)}, token tag=${token && token.tag}`);
  assert((await page.textContent('#currentHubName')).trim() === 'SeaCity Museum', 'content for the place not shown');
  assert(/browsing/.test(banner), 'no browse-mode note');
  assert(!s.passport.includes('m3Rt9'), 'a stamp was granted');
  assert(!token || token.tag !== 'm3Rt9', 'a token was issued for the plain link');
  // A reward claim without a fresh verified tap must fail
  const res = await page.evaluate(async () => { const api = (await import('/src/api.js')).api; return api.claimReward('forged.token', 'x', 'tier1'); });
  notes.push(`forged reward claim -> ${JSON.stringify(res)}`);
  assert(res.ok === false, 'forged claim succeeded');
  await shared.context.close();
});

// ---------- 4 ----------
await run(4, 'Trail run (Titanic to Tudor)', async (notes) => {
  const { page, context } = await newPage();
  await skipSetup(page);
  await page.click('[data-tour-id="history"]');
  await page.click('[data-action="start-tour"]');
  const legs = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/legs.json'), 'utf8'));
  const trail = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/trails.json'), 'utf8')).find((t) => t.id === 'history');
  const byId = new Map(legs.map((l) => [l.id, l]));
  const stops = [byId.get(trail.legs[0]).from, ...trail.legs.map((id) => byId.get(id).to)];
  assert(await active(page) === 'step', 'did not open the step screen');
  for (let i = 0; i < stops.length; i++) {
    if (i > 0) {
      const leg = byId.get(trail.legs[i - 1]);
      const ctxText = (await page.textContent('#stepContext')).trim();
      const expected = leg.steps.length > 1 ? `Step 1 of ${leg.steps.length}` : '';
      assert(ctxText === expected, `leg ${leg.id}: expected "${expected}" got "${ctxText}"`);
      for (let k = 0; k < leg.steps.length; k++) {
        const dir = (await page.textContent('#stepDirection')).trim();
        assert(dir.length > 5, `leg ${leg.id} card ${k + 1} is empty`);
        if (k < leg.steps.length - 1) await page.click('#stepNextBtn');
      }
      notes.push(`${leg.id}: ${leg.steps.length} card(s) shown`);
    }
    await tap(page, stops[i]);
    const s = await vstate(page);
    if (i < stops.length - 1) {
      assert(await active(page) === 'step', `after tapping stop ${i + 1} not on the step screen`);
      assert(s.journey.stopIdx === i + 1, `stopIdx ${s.journey && s.journey.stopIdx} after stop ${i + 1}`);
    }
  }
  assert(await active(page) === 'arrived', 'end screen not shown');
  notes.push(`end: "${await page.textContent('#arrivedTitle')}" / "${await page.textContent('#arrivedSub')}"`);
  assert(/Tour complete/.test(await page.textContent('#arrivedTitle')), 'wrong end title');
  await context.close();
});

// ---------- 5 ----------
await run(5, 'Rejoin', async (notes) => {
  const { page, context } = await newPage();
  await skipSetup(page);
  await page.click('[data-tour-id="history"]');
  await page.click('[data-action="start-tour"]');
  await tap(page, 'e2Tk5');
  await tap(page, 'm3Rt9');
  await tap(page, 'x8Fs4'); // Oxford Street is not on this trail
  assert(await active(page) === 'home', 'not back on home');
  assert(await page.isVisible('#rejoinCard'), 'no rejoin card');
  const choices = await page.$$eval('#rejoinCard .choice-btn', (bs) => bs.map((b) => ({ action: b.dataset.action, total: Number(b.dataset.total), text: b.textContent })));
  notes.push(choices.map((c) => `${c.text} [total ${c.total}]`).join(' | '));
  assert(choices.some((c) => c.action === 'rejoin-trail' && /Rejoin your trail/.test(c.text)), 'no "Rejoin your trail"');
  assert(choices.some((c) => c.action === 'carry-on-trail' && /Carry on from here/.test(c.text)), 'no "Carry on from here"');
  await shot(page, 'evidence-rejoin', true);
  const rj = choices.find((c) => c.action === 'rejoin-trail');
  await page.click('[data-action="rejoin-trail"]');
  const sum = await page.$eval('.route-summary', (el) => ({ total: Number(el.dataset.total), mins: [...el.querySelectorAll('li')].map((l) => Number(l.dataset.min)) }));
  const add = sum.mins.reduce((a, b) => a + b, 0);
  notes.push(`rejoin chain: ${sum.mins.join(' + ')} = ${add}; route total ${sum.total}; card said ${rj.total}`);
  assert(add === sum.total && sum.total === rj.total, 'leg minutes do not add up to the route total');
  await context.close();
});

// ---------- 6 ----------
async function adminPublish(page, note) {
  await page.goto(`${BASE}/admin/#publish`); await ready(page);
  await page.waitForSelector('#publishBtn');
  await page.fill('#pubNote', note);
  assert(!(await page.isDisabled('#publishBtn')), 'publish button disabled (checks failing?)');
  await page.click('#publishBtn');
  await page.waitForFunction(() => /Published v/.test(document.getElementById('aToast').textContent), null, { timeout: 5000 });
}
async function adminCloseLeg(page, id) {
  await page.goto(`${BASE}/admin/#legs`); await ready(page);
  await page.selectOption('#legPick', id);
  await page.waitForTimeout(150);
  if (!(await page.isChecked('#legClosed'))) await page.check('#legClosed');
  await page.waitForTimeout(150);
}
await run(6, 'Closed leg', async (notes) => {
  const { page, context } = await newPage({ viewport: { width: 1200, height: 900 } });
  await adminCloseLeg(page, 'L010');
  notes.push(`admin detour preview: ${(await page.textContent('.a-note .pill') || '').trim()} ${await page.$eval('#legClosed', (el) => el.closest('.a-card').querySelector('.a-note:last-of-type')?.textContent || '')}`);
  await adminPublish(page, 'Close L010 for the test');
  const app = await context.newPage();
  await app.setViewportSize({ width: 390, height: 844 });
  await app.goto(`${BASE}/?demo=1`); await ready(app);
  await app.click('[data-action="skip-to-home"]').catch(() => {});
  await app.click('[data-tour-id="history"]');
  await app.click('[data-action="start-tour"]');
  for (const id of ['e2Tk5', 'm3Rt9', 'k7Qx2']) await tap(app, id);
  const note = (await app.textContent('#stepNotes')).trim();
  const legIds = await app.evaluate(async () => { const m = await import('/src/ui/trail.js'); return m.deck().seg.legs.map((l) => l.id); });
  notes.push(`Bargate to Old Town now: ${legIds.join(' then ')}; note: "${note}"`);
  assert(!legIds.includes('L010') && legIds.length > 1, 'route still uses the closed leg');
  assert(/closed/.test(note), 'no closure note');
  await shot(app, 'evidence-closed-leg-detour', true);
  // Close every other way into the Old Town: now there is no route.
  await adminCloseLeg(page, 'L012'); await adminCloseLeg(page, 'L008');
  await adminPublish(page, 'Close all legs into the Old Town');
  await app.goto(`${BASE}/?demo=1`); await ready(app);
  await app.click('[data-action="resume-journey"]');
  const noRoute = (await app.textContent('#stepNotes')).trim();
  notes.push(`with no alternative: "${noRoute}"`);
  assert(/no checked route/i.test(noRoute), 'no-route message missing');
  // put things back for later tests
  await page.goto(`${BASE}/admin/#publish`); await ready(page);
  await page.click('[data-pointer="base"]');
  await page.waitForTimeout(500);
  await context.close();
});

// ---------- 7 ----------
await run(7, 'Return to ship', async (notes) => {
  const { page, context } = await newPage();
  await open(page);
  await page.click('[data-action="go-language"]');
  await page.click('[data-action="go-ship-time"]');
  const soon = await page.evaluate(() => { const d = new Date(Date.now() + 20 * 60000); return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); });
  await page.fill('#shipTimeInput', soon);
  await page.click('[data-action="confirm-ship-time"]');
  await tap(page, 'k7Qx2');
  assert(await page.isVisible('#floatingReturn button'), 'no Back to ship button');
  const cls = await page.$eval('.screen.active .countdown', (el) => el.className);
  await page.click('#floatingReturn button');
  const total = Number(await page.$eval('#returnLead', (el) => el.dataset.total));
  const warning = await page.isVisible('#returnWarning');
  notes.push(`all aboard ${soon}; countdown class "${cls}"; walk back ${total} min; warning shown=${warning}`);
  assert(total > 0 && warning, 'warning should show when minutes left <= walk + 15');
  assert(/red/.test(cls), 'countdown not in warning state');
  assert((await page.$$('#returnSteps li')).length > 0, 'no return steps');
  await shot(page, 'evidence-return-warning', true);
  // A later time: no warning, a leave-by time instead
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rl-city-v2')); s.shipTime = '23:59'; localStorage.setItem('rl-city-v2', JSON.stringify(s)); });
  await open(page, '/');
  await page.click('#floatingReturn button');
  const leaveBy = await page.isVisible('#returnLeaveBy');
  const fromNow = await page.evaluate(() => new Date().getHours());
  notes.push(`with 23:59: leave-by shown=${leaveBy}`);
  if (fromNow < 23) assert(leaveBy && !(await page.isVisible('#returnWarning')), 'expected leave-by, not a warning');
  // Every Loop point has a route to the terminal
  const routes = await page.evaluate(async () => {
    const { walkBack } = await import('/src/ui/return.js'); const { ctx } = await import('/src/ctx.js');
    return ctx.bundle.tags.filter((t) => t.kind === 'loop').map((t) => [t.slug, walkBack(t.id)?.total ?? null]);
  });
  notes.push(`walk back from each place: ${routes.map(([s, m]) => `${s} ${m}`).join(', ')}`);
  assert(routes.every(([, m]) => m !== null), 'a place has no route to the terminal');
  await context.close();
  // Non-cruise visitor never sees ship features
  const b = await newPage();
  await open(b.page);
  await b.page.click('[data-action="go-language"]');
  await b.page.click('[data-action="go-ship-time"]');
  await b.page.click('[data-action="not-cruise"]');
  await tap(b.page, 'k7Qx2');
  const vis = await b.page.evaluate(() => ({
    countdown: [...document.querySelectorAll('.countdown')].some((c) => c.offsetParent !== null),
    floating: !document.getElementById('floatingReturn').classList.contains('hidden'),
    lost: [...document.querySelectorAll('.cruise-only')].some((c) => !c.classList.contains('hidden')),
  }));
  await b.page.evaluate(async () => (await import('/src/ui/return.js')).actions['go-return']());
  notes.push(`non-cruise: countdown=${vis.countdown}, floating=${vis.floating}, cruise-only sections visible=${vis.lost}, go-return lands on ${await active(b.page)}`);
  assert(!vis.countdown && !vis.floating && !vis.lost && (await active(b.page)) !== 'return-to-ship', 'a ship feature is visible to a non-cruise visitor');
  await b.context.close();
});

// ---------- 8 ----------
await run(8, 'Registers', async (notes) => {
  const { page, context } = await newPage();
  await skipSetup(page);
  await page.click('#eventsPillHost');
  await page.waitForSelector('.events-list-card');
  const cards = await page.$$eval('.events-list-card', (els) => els.map((e) => ({ id: e.dataset.eventId, src: e.querySelector('.el-meta').textContent, href: e.querySelector('a.el-link').href })));
  const check = await page.evaluate(async (ids) => {
    const { ctx } = await import('/src/ctx.js'); const { now } = await import('/src/clock.js'); const time = await import('/src/time.js'); const reg = await import('/src/registers.js');
    const n = now(); const today = time.dayKey(n); const from = time.startOfDay(today); const to = time.startOfDay(time.addDays(today, 1));
    const byId = new Map(ctx.register.events.map((e) => [e.id, e]));
    const bad = ids.filter((id) => { const e = byId.get(id); return !e || !(new Date(e.start) < to && new Date(e.end) > from && new Date(e.end) > n); });
    return { today, expected: reg.eventsToday(ctx.register.events, n).length, bad, expiredListed: ctx.register.events.some((e) => new Date(e.expires) <= n), pastTitle: ctx.register.events.some((e) => e.title.en === 'Past Event Test Listing') };
  }, cards.map((c) => c.id));
  notes.push(`London date ${check.today}: ${cards.length} cards in Today (register says ${check.expected}); not-today cards: ${check.bad.length}; expired in register: ${check.expiredListed}; past fixture row imported: ${check.pastTitle}`);
  assert(cards.length === check.expected && cards.length > 0, 'Today count mismatch');
  assert(check.bad.length === 0, 'a card in Today is not on today');
  assert(!check.pastTitle && !check.expiredListed, 'expired events are present');
  assert(cards.every((c) => /Source: /.test(c.src) && c.href.startsWith('https://')), 'an event lacks a source or an https link');
  await shot(page, 'evidence-whats-on-today', true);
  await page.click('#tab-week');
  const week = await page.$$eval('.events-list-card', (els) => els.length);
  const days = await page.$$eval('.day-heading', (els) => els.map((e) => e.textContent));
  notes.push(`This week: ${week} events over ${days.length} days (${days.join(', ')})`);
  assert(week > cards.length && days.length >= 5, 'This week looks wrong');
  await page.click('#tab-places');
  const places = await page.$$eval('.place-card', (els) => els.length);
  notes.push(`Things to do: ${places} places`);
  assert(places === 16, 'places register not shown');
  await context.close();
});

// ---------- 9 ----------
await run(9, 'Source registry: add iCal fixture', async (notes) => {
  const { page, context } = await newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`${BASE}/admin/#sources`); await ready(page);
  await page.fill('#sName', 'Southampton museums and galleries (demo iCal feed)');
  await page.selectOption('#sFixture', '/data/fixtures/museums-galleries.ics');
  await page.click('#inspect');
  await page.waitForSelector('#sourcePreview');
  const pv = await page.$$eval('#sourcePreview .pv b', (els) => els.map((e) => e.textContent));
  notes.push(`preview: ${pv.join('; ')}`);
  assert(pv.length >= 5, 'preview did not show records');
  await page.click('#approve');
  await page.waitForFunction(() => /Approved/.test(document.getElementById('aToast').textContent));
  const toast = await page.textContent('#aToast');
  notes.push(toast);
  await shot(page, 'evidence-admin-source-approved', true);
  const app = await context.newPage();
  await app.setViewportSize({ width: 390, height: 844 });
  await app.goto(`${BASE}/?demo=1`); await ready(app);
  await app.click('[data-action="skip-to-home"]').catch(() => {});
  await app.waitForTimeout(500);
  await app.click('#eventsPillHost');
  await app.waitForSelector('.events-list-card');
  const titles = await app.$$eval('.events-list-card .el-title', (els) => els.map((e) => e.textContent));
  notes.push(`Today: ${titles.join('; ')}`);
  // The family trail runs all week, so it is in Today at any hour. The talk is
  // 14:00 to 15:00 London time, so it is only expected before it has finished.
  const londonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  assert(titles.includes("Family Trail: Find the Ship's Cat"), 'new iCal event missing from Today');
  if (londonHour < 15) assert(titles.includes('Titanic Crew Stories Talk'), 'iCal talk missing from Today');
  else assert(!titles.includes('Titanic Crew Stories Talk'), 'finished iCal talk still shown in Today');
  await app.click('#tab-week');
  const week = await app.$$eval('.events-list-card', (els) => els.map((e) => ({ t: e.querySelector('.el-title').textContent, m: e.querySelector('.el-meta').textContent })));
  const talks = week.filter((w) => w.t === "Curator's Lunchtime Talk");
  const tours = week.filter((w) => w.t === 'Tudor Kitchen Garden Tour');
  notes.push(`duplicates: Curator's talk x${talks.length} (${talks[0]?.m}); Tudor tour x${tours.length} (${tours[0]?.m})`);
  assert(talks.length === 1 && /museums and galleries/.test(talks[0].m), 'talk not de-duplicated with the iCal source');
  assert(tours.length === 1, 'Tudor tour duplicated');
  await context.close();
});

// ---------- 10 ----------
await run(10, 'Quiet nudge', async (notes) => {
  const { page, context } = await newPage();
  await skipSetup(page);
  await tap(page, 'k7Qx2');
  assert(await page.isVisible('#nudgeCard'), 'no nudge on a busy day in a busy zone');
  const text = (await page.textContent('#nudgeCard')).replace(/\s+/g, ' ');
  notes.push(`nudge: "${text.trim()}"`);
  assert(/The Old Town is busy today. This route is quieter./.test(text), 'nudge reason missing');
  await shot(page, 'evidence-nudge', true);
  await page.click('[data-action="nudge-no"]');
  assert(!(await page.isVisible('#nudgeCard')), 'No thanks did not hide it');
  await open(page, '/');
  assert(!(await page.isVisible('#nudgeCard')), 'nudge came back the same day');
  notes.push('hidden after No thanks, and still hidden after reload');
  await context.close();
});

// ---------- 11 ----------
await run(11, 'Feedback queued offline', async (notes) => {
  const { page, context } = await newPage();
  await skipSetup(page);
  await tap(page, 'k7Qx2');
  await page.waitForSelector('#feedbackCard');
  await context.setOffline(true);
  await page.waitForTimeout(200);
  await page.click('.face-btn[data-rating="3"]');
  await page.fill('#fbComment', 'Lovely gate');
  await page.click('[data-action="fb-send"]');
  const status = (await page.textContent('#feedbackHost')).trim();
  await page.click('.demo-fab');
  const q1 = await page.textContent('[data-queue="feedback"]');
  notes.push(`offline: "${status}", demo panel queue=${q1}`);
  assert(q1 === '1' && /when you're back online/.test(status), 'feedback was not queued');
  await context.setOffline(false);
  await page.waitForFunction(() => document.querySelector('[data-queue="feedback"]').textContent === '0', null, { timeout: 5000 });
  const stored = await page.evaluate(async () => (await import('/src/mock-server.js')).readDbForAdmin().feedback);
  notes.push(`back online: queue=0; server has ${stored.length} item(s): ${JSON.stringify(stored[0])}`);
  assert(stored.length === 1 && stored[0].comment === 'Lovely gate' && !('token' in stored[0]), 'server did not receive the anonymous item');
  assert(Object.keys(stored[0]).sort().join(',') === 'comment,day,lang,rating,sid,tag,ts', 'stored fields are not the anonymous set');
  await context.close();
});

// ---------- 12 ----------
await run(12, 'Offline after one online visit', async (notes) => {
  const { page, context } = await newPage({ sw: true });
  await skipSetup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await tap(page, 'k7Qx2');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 });
  await page.click('[data-tour-id="history"]');
  await page.click('[data-action="start-tour"]');
  await page.waitForTimeout(1500); // allow the zone precache to finish
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); let n = 0; for (const k of keys) n += (await (await caches.open(k)).keys()).length; return { keys, n }; });
  notes.push(`caches: ${cached.keys.map((k) => k.split('|')[0]).join(', ')} (${cached.n} entries, names include the scope)`);
  await context.setOffline(true);
  await page.goto(`${BASE}/`); await ready(page);
  const banner = await page.isVisible('#offlineBanner');
  const place = (await page.textContent('#currentHubName')).trim();
  await page.click('[data-action="resume-journey"]');
  const step = await active(page);
  const img = await page.$eval('#stepHeroImg', (i) => ({ ok: i.complete && i.naturalWidth > 0, src: i.getAttribute('src') }));
  await page.click('#stepNextBtn');
  notes.push(`offline reload: banner=${banner}, place=${place}, trail step screen=${step}, hero image loaded=${img.ok} (${img.src})`);
  assert(banner && place === 'Bargate' && step === 'step' && img.ok, 'offline shell, zone or trail did not work');
  await page.click('[data-action="exit-tour"]');
  await page.click('[data-tour-id="history"]');
  assert(await active(page) === 'tour-overview', 'trail overview failed offline');
  await context.setOffline(false);
  await context.close();
});

// ---------- 13 ----------
await run(13, 'Languages', async (notes) => {
  const missing = Object.keys(en).filter((k) => !(k in de));
  assert(missing.length === 0, `missing German keys: ${missing.join(', ')}`);
  const { page, context } = await newPage();
  await open(page, '/');
  await page.click('[data-action="go-language"]');
  const disabled = await page.$$eval('.lang-card[disabled]', (els) => els.map((e) => e.dataset.lang));
  await page.click('.lang-card[data-lang="de"]');
  await page.click('[data-action="go-ship-time"]');
  await page.click('[data-action="confirm-ship-time"]');
  await tap(page, 'k7Qx2');
  const englishOnly = new Set(Object.keys(en).filter((k) => en[k] !== de[k] && en[k].length > 3).map((k) => en[k]));
  const screens = [['home', null], ['events', '#eventsPillHost'], ['passport', '[data-action="open-passport"]'], ['help', '[data-action="open-help"]'], ['return-to-ship', '#floatingReturn button']];
  const leaks = [];
  for (const [name, sel] of screens) {
    if (sel) { await open(page, '/'); await page.click(sel); }
    const texts = await page.evaluate(() => {
      const out = []; const w = document.createTreeWalker(document.querySelector('.screen.active'), NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; const t = n.textContent.trim(); if (t && n.parentElement.offsetParent !== null) out.push(t); }
      document.querySelectorAll('.screen.active [aria-label]').forEach((el) => out.push(el.getAttribute('aria-label')));
      return out;
    });
    for (const t of texts) if (englishOnly.has(t)) leaks.push(`${name}: "${t}"`);
  }
  await page.click('[data-action="back"]').catch(() => {});
  await open(page, '/');
  await shot(page, 'evidence-german-home', true);
  notes.push(`German keys missing: 0 of ${Object.keys(en).length}; disabled languages: ${disabled.join(', ')}; untranslated visible strings: ${leaks.length ? leaks.join('; ') : 'none'}`);
  assert(disabled.join(',') === 'it,nl,es,fr', 'the other four languages are not disabled');
  assert(leaks.length === 0, 'English text visible in German mode');
  await page.click('[data-action="open-language"]');
  await page.click('.lang-card[data-lang="en"]');
  await page.click('[data-action="back"]');
  assert((await page.textContent('.yah-eyebrow')).trim() === 'You are here', 'switching back to English failed');
  await context.close();
});

// ---------- 14 ----------
const axeSource = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes.slice(0, 3).map((x) => `${x.target.join(' ')}${x.any && x.any[0] && x.any[0].data && x.any[0].data.contrastRatio ? ` [${x.any[0].data.fgColor} on ${x.any[0].data.bgColor} = ${x.any[0].data.contrastRatio}]` : ''}`) }));
  });
}
await run(14, 'Accessibility (axe-core and keyboard)', async (notes) => {
  // bypassCSP only lets the test inject axe-core; the app itself runs under its normal CSP elsewhere.
  const { page, context } = await newPage({ bypassCSP: true });
  const found = [];
  // Let the 220 ms screen fade finish first: mid-fade text is semi-transparent and would read as low contrast.
  const check = async (label) => { await page.waitForTimeout(450); const v = await axe(page); const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical'); found.push(...bad.map((b) => `${label}: ${b.id} (${b.impact}) ${b.target.join(', ')}`)); notes.push(`${label}: ${v.length ? v.map((x) => `${x.id}/${x.impact}`).join(', ') : 'no violations'}`); };
  await open(page, '/'); await check('welcome');
  await page.click('[data-action="go-language"]'); await check('language');
  await page.click('[data-action="go-ship-time"]'); await check('ship time');
  await page.click('[data-action="confirm-ship-time"]');
  await tap(page, 'k7Qx2'); await check('home (after tap)');
  await page.click('[data-tour-id="history"]'); await check('trail overview');
  await page.click('[data-action="start-tour"]'); await check('trail step');
  await open(page, '/'); await page.click('#floatingReturn button'); await check('return to ship');
  await open(page, '/'); await page.click('#eventsPillHost'); await check('what\'s on');
  await page.click('#tab-places'); await check('things to do');
  await open(page, '/'); await page.click('[data-action="open-passport"]'); await check('passport');
  await open(page, '/'); await page.click('[data-action="open-help"]'); await check('help');
  await open(page, '/?demo=1&date=2026-12-05'); await page.click('[data-tour-id="snow"]'); await check('snow overview');
  await page.click('[data-route-id="snowflake"]'); await check('snow route');
  await page.goto(`${BASE}/admin/#sources`); await ready(page); await check('admin sources');
  await page.goto(`${BASE}/admin/#publish`); await ready(page); await check('admin publish');
  await context.close();
  // Keyboard-only journey
  const k = await newPage();
  const p = k.page;
  await open(p, '/');
  const tabTo = async (sel, max = 80) => { for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if (await p.evaluate((s) => document.activeElement && document.activeElement.matches(s), sel)) return; } throw new Error(`could not reach ${sel} by Tab`); };
  await tabTo('[data-action="skip-to-home"]'); await p.keyboard.press('Enter');
  await tabTo('[data-tour-id="history"]'); await p.keyboard.press('Enter');
  await tabTo('#stepFreeToggle'); await p.keyboard.press('Space');
  const sf = await p.isChecked('#stepFreeToggle');
  await tabTo('[data-action="start-tour"]'); await p.keyboard.press('Enter');
  await tabTo('#stepNextBtn'); await p.keyboard.press('Enter');
  const onStep = await active(p);
  const focusVisible = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${document.activeElement.id || document.activeElement.className}: outline ${s.outlineStyle} ${s.outlineWidth}`; });
  await tabTo('[data-action="exit-tour"]'); await p.keyboard.press('Enter');
  await tabTo('#eventsPillHost'); await p.keyboard.press('Enter');
  await tabTo('#tab-today'); await p.keyboard.press('ArrowRight');
  const tabSel = await p.getAttribute('#tab-week', 'aria-selected');
  notes.push(`keyboard: skip setup, open trail, toggle step-free (${sf}), start, next (${onStep}), exit, What's on, arrow to This week (${tabSel}); focus ring on ${focusVisible}`);
  assert(onStep === 'step' && sf && tabSel === 'true', 'keyboard journey failed');
  await k.context.close();
  // Touch targets on the home screen
  const tt = await newPage();
  await skipSetup(tt.page);
  const small = await tt.page.evaluate(() => [...document.querySelectorAll('.screen.active button, .screen.active a, .screen.active input, .screen.active select')].filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { el: el.className || el.tagName, w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44));
  notes.push(`home touch targets under 44 px: ${small.length ? JSON.stringify(small) : 'none'}`);
  await tt.context.close();
  assert(found.length === 0, `serious or critical findings: ${found.join(' | ')}`);
  assert(small.length === 0, 'touch targets under 44 px');
});

// ---------- 15 ----------
await run(15, 'Speed and size', async (notes) => {
  const { page, context } = await newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // "Slow 4G" as used by Lighthouse: 150 ms RTT, 1.6 Mbps down, 750 kbps up; CPU slowed 4x.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const bytes = { total: 0, images: 0, fonts: 0, byType: {} };
  const types = new Map();
  const urls = new Map();
  cdp.on('Network.responseReceived', (e) => { types.set(e.requestId, e.type); urls.set(e.requestId, e.response.url); });
  cdp.on('Network.loadingFinished', (e) => { const t = types.get(e.requestId) || 'Other'; bytes.total += e.encodedDataLength; bytes.byType[t] = (bytes.byType[t] || 0) + e.encodedDataLength; if (t === 'Image') bytes.images += e.encodedDataLength; if (t === 'Font') bytes.fonts += e.encodedDataLength; });
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: 'commit' });
  await page.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
  await page.waitForSelector('.welcome-title', { state: 'visible' });
  const firstUseful = Date.now() - t0;
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { fcp: fcp ? Math.round(fcp.startTime) : null, dcl: Math.round(n.domContentLoadedEventEnd) }; });
  await page.waitForLoadState('networkidle');
  const kb = (b) => Math.round(b / 102.4) / 10;
  notes.push(`throttled (150 ms RTT, 1.6 Mbps, 4x CPU), cold cache: first useful screen (welcome ready) ${firstUseful} ms from navigation; FCP ${nav.fcp} ms; DOMContentLoaded ${nav.dcl} ms`);
  notes.push(`bytes over the wire (compressed as served, headers included): total ${kb(bytes.total)} KB; excluding images ${kb(bytes.total - bytes.images)} KB (fonts ${kb(bytes.fonts)} KB); images ${kb(bytes.images)} KB; by type ${Object.entries(bytes.byType).map(([k, v]) => `${k} ${kb(v)}`).join(', ')}`);
  // Body-only sizes (gzip level 6, as served) for exactly the files requested, so
  // HTTP/1.1 header overhead in the wire figure can be separated out.
  const zlib = await import('node:zlib');
  const files = [...new Set([...urls.values()].map((u) => new URL(u).pathname))];
  const body = { shell: 0, data: 0, strings: 0, fixtures: 0, fonts: 0, images: 0 };
  const rows = [];
  for (const f of files) {
    let fp = f === '/' ? '/index.html' : f;
    const abs = path.join(ROOT, 'site', fp);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    const raw = fs.readFileSync(abs);
    const gz = /\.(woff2|webp|png|jpg)$/.test(fp) ? raw.length : zlib.gzipSync(raw, { level: 6 }).length;
    const k = /\/fonts\//.test(fp) ? 'fonts' : /\/img\//.test(fp) ? 'images' : /\/fixtures\//.test(fp) ? 'fixtures' : /\/data\//.test(fp) ? 'data' : /\/strings\//.test(fp) ? 'strings' : 'shell';
    body[k] += gz; rows.push([fp, raw.length, gz]);
  }
  notes.push(`bodies only (gzip), ${files.length} requests: shell ${kb(body.shell)} KB, data ${kb(body.data)} KB, strings ${kb(body.strings)} KB, fonts ${kb(body.fonts)} KB, demo fixtures ${kb(body.fixtures)} KB, images ${kb(body.images)} KB; shell + data + strings = ${kb(body.shell + body.data + body.strings)} KB, plus fonts = ${kb(body.shell + body.data + body.strings + body.fonts)} KB`);
  fs.writeFileSync(path.join(OUT, 'speed.json'), JSON.stringify({ firstUseful, ...nav, bytes, body, files: rows }, null, 2));
  assert(firstUseful < 3000, `first useful screen took ${firstUseful} ms`);
  assert(bytes.total - bytes.images < 200 * 1024, 'over 200 KB excluding images');
  await context.close();
});

// ---------- 16 ----------
await run(16, 'Shared phone reset', async (notes) => {
  const { page, context } = await newPage();
  await open(page, '/');
  await page.click('[data-action="go-language"]');
  await page.click('.lang-card[data-lang="de"]');
  await page.click('[data-action="go-ship-time"]');
  await page.click('[data-action="confirm-ship-time"]');
  await tap(page, 'k7Qx2');
  await page.click('[data-tour-id="history"]');
  await page.click('[data-action="start-tour"]');
  const before = await vstate(page);
  const sidBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('rl-session')).key);
  await page.click('.screen.active [data-action="open-language"]');
  await page.click('[data-action="reset-app"]');
  await page.waitForFunction(() => document.querySelector('.screen.active')?.dataset.screen === 'welcome', null, { timeout: 5000 });
  const after = await vstate(page);
  const sidAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('rl-session')).key);
  notes.push(`before: lang=${before.lang}, ship=${before.shipTime}, stamps=${before.passport.length}, trail=${before.journey && before.journey.trailId}; after: screen=${await active(page)}, saved state keys=${Object.keys(after).length}, html lang=${await page.getAttribute('html', 'lang')}, new session key=${sidBefore !== sidAfter}`);
  assert(before.lang === 'de' && before.shipTime && before.passport.length === 1 && before.journey, 'setup did not take');
  assert(await active(page) === 'welcome', 'not back at welcome');
  assert(!after.lang && !after.shipTime && !(after.passport || []).length && !after.journey, 'reset left data behind');
  assert(sidBefore !== sidAfter, 'session key not replaced');
  await context.close();
});

// ---------- 17 ----------
await run(17, 'Publish and rollback', async (notes) => {
  const { page, context } = await newPage({ viewport: { width: 1200, height: 900 } });
  const app = await context.newPage();
  const appLog = [];
  app.on('console', (m) => appLog.push(`${m.type()}: ${m.text()}`));
  app.on('pageerror', (e) => appLog.push(`pageerror: ${e.message}`));
  app.on('framenavigated', (f) => { if (f === app.mainFrame()) appLog.push(`navigated ${f.url()}`); });
  await app.setViewportSize({ width: 390, height: 844 });
  await app.goto(`${BASE}/?demo=1`); await ready(app);
  await app.click('[data-action="skip-to-home"]');
  await app.evaluate(() => { window.__storageKeys = []; addEventListener('storage', (e) => window.__storageKeys.push(e.key)); });
  const title0 = await app.textContent('[data-tour-id="history"] .tour-title');
  await page.goto(`${BASE}/admin/#trails`); await ready(page);
  // Type like a person while the phone preview loads: the preview must never steal the cursor.
  await page.click('#tTitleEn', { clickCount: 3 });
  await page.keyboard.type('Titanic to Tudor: Autumn Edition', { delay: 25 });
  await page.waitForTimeout(800);
  assert((await page.inputValue('#tTitleEn')) === 'Titanic to Tudor: Autumn Edition', 'typing in the trail builder was interrupted');
  await page.click('#saveTrail');
  await adminPublish(page, 'Rename the history trail');
  await app.waitForSelector('#updateBar:not(.hidden)', { timeout: 4000 });
  const bar = (await app.textContent('#updateBar')).replace(/\s+/g, ' ').trim();
  await app.click('[data-action="apply-update"]');
  await app.waitForFunction(() => /Autumn/.test(document.querySelector('[data-tour-id="history"] .tour-title')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const title1 = await app.textContent('[data-tour-id="history"] .tour-title');
  if (!/Autumn/.test(title1)) {
    const diag = await app.evaluate(() => ({ screen: document.querySelector('.screen.active')?.dataset.screen, bar: document.getElementById('updateBar').className, current: JSON.parse(localStorage.getItem('rl-bundles') || '{}').current, storage: window.__storageKeys }));
    notes.push(`diagnostics: ${JSON.stringify(diag)}; log: ${appLog.filter((l) => !/navigated/.test(l)).slice(-12).join(' / ')}`);
  }
  await page.goto(`${BASE}/admin/#publish`); await ready(page);
  const pointerAfterPublish = await page.textContent('#pointer');
  await page.click('[data-pointer="base"]');
  await page.waitForFunction(() => document.getElementById('pointer').textContent === 'base');
  await app.goto(`${BASE}/`); await ready(app);
  const title2 = await app.textContent('[data-tour-id="history"] .tour-title');
  notes.push(`before "${title0}"; published ${pointerAfterPublish}; open app showed "${bar}" and then "${title1}"; after rollback "${title2}"`);
  assert(title1 === 'Titanic to Tudor: Autumn Edition', 'published title not shown');
  assert(title2 === title0, 'rollback did not restore the title');
  await context.close();
});

// ---------- screenshots (390 x 844) ----------
if (!only.length || only.includes(99)) {
  const { page, context } = await newPage();
  await open(page, '/'); await shot(page, 'screen-welcome');
  await page.click('[data-action="go-language"]'); await page.click('[data-action="go-ship-time"]');
  const later = await page.evaluate(() => { const d = new Date(Date.now() + 150 * 60000); return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); });
  await page.fill('#shipTimeInput', later);
  await page.click('[data-action="confirm-ship-time"]');
  await tap(page, 'tR4mQ'); await tap(page, 'k7Qx2');
  await page.waitForTimeout(3500);
  await shot(page, 'screen-home');
  await shot(page, 'screen-home-full', true);
  await page.click('[data-tour-id="history"]'); await page.click('[data-action="start-tour"]');
  await tap(page, 'e2Tk5');
  await page.waitForTimeout(3000);
  await shot(page, 'screen-trail-step');
  await open(page, '/'); await page.click('#floatingReturn button'); await shot(page, 'screen-return-to-ship');
  await open(page, '/'); await page.click('#eventsPillHost'); await shot(page, 'screen-whats-on');
  await open(page, '/'); await page.click('[data-action="open-passport"]'); await page.click('[data-action="claim-reward"]').catch(() => {});
  await page.waitForTimeout(600); await shot(page, 'screen-passport'); await shot(page, 'screen-passport-full', true);
  await page.goto(`${BASE}/admin/#trails`); await ready(page); await page.waitForTimeout(1500); await shot(page, 'screen-admin-trail-builder');
  await page.goto(`${BASE}/admin/#sources`); await ready(page); await shot(page, 'screen-admin-source-registry');
  await open(page, '/?demo=1&date=2026-12-05'); await page.click('[data-tour-id="snow"]'); await shot(page, 'screen-snow-overview');
  await context.close();
}

await browser.close();
server.kill();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const md = ['# Acceptance test results', '', `Run: ${new Date().toISOString()}  ·  Chromium (Playwright) at 390 × 844, en-GB, Europe/London  ·  Server: ${process.env.TARGET_NAME || (process.env.BASE_URL ? process.env.BASE_URL : 'local Node server (serve.mjs)')}`, '', '| # | Test | Result | Evidence |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.n} | ${r.name} | ${r.pass ? 'PASS' : '**FAIL**'} | ${r.notes.join('<br>').replace(/\|/g, '/')} |`)].join('\n');
fs.writeFileSync(path.join(OUT, 'results.md'), md + '\n');
console.log(`\n${results.filter((r) => r.pass).length} of ${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
