// Unit tests for the pure modules: time zone, crypto, importer, graph, registers, nudge.
// Run: node --test tests/unit/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import * as T from '../../site/src/time.js';
import { sha256, hmacHex, toHex } from '../../site/src/hmac.js';
import { parseCsv, parseIcs, importSource, dedupe, cleanText, mapCategory, matchVenue } from '../../site/src/importer.js';
import { parseHtml, readField, selectAll } from '../../site/src/mini-html.js';
import { buildGraph, shortestChain, closedLegIds } from '../../site/src/graph.js';
import { eventsToday, eventsThisWeek } from '../../site/src/registers.js';
import { pickNudge } from '../../site/src/nudge.js';
import { routingContext, resolveSegments, rejoinOptions, trailStops } from '../../site/src/journey.js';
import { runImport } from '../../site/src/import-job.js';
import { verifyTap, chipCheck, chipMessage, issueToken, verifyToken } from '../../site/src/mock-edge.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../../site/data/${p}`, import.meta.url), 'utf8'));
const tags = read('tags.json'); const legs = read('legs.json'); const trails = read('trails.json');
const sources = read('sources.json'); const settings = read('settings.json');

test('London day boundaries handle the clocks going back (25 hour day)', () => {
  const s = T.startOfDay('2026-10-25'); const e = T.startOfDay('2026-10-26');
  assert.equal(s.toISOString(), '2026-10-24T23:00:00.000Z');
  assert.equal(e.toISOString(), '2026-10-26T00:00:00.000Z');
  assert.equal((e - s) / 3600000, 25);
});

test('London day boundaries handle the clocks going forward (23 hour day)', () => {
  const s = T.startOfDay('2027-03-28'); const e = T.startOfDay('2027-03-29');
  assert.equal((e - s) / 3600000, 23);
});

test('dayKey uses London, not UTC', () => {
  assert.equal(T.dayKey(new Date('2026-06-30T23:30:00Z')), '2026-07-01');
  assert.equal(T.dayKey(new Date('2026-12-31T23:30:00Z')), '2026-12-31');
  assert.equal(T.isoLondon(new Date('2026-07-01T18:30:00Z')), '2026-07-01T19:30:00+01:00');
  assert.equal(T.isoLondon(new Date('2026-12-01T19:30:00Z')), '2026-12-01T19:30:00+00:00');
});

test('demo date tokens resolve relative to today', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  assert.equal(T.resolveDemoDates('{{D+0}} {{D+2}} {{D-1}}', now), '2026-09-30 2026-10-02 2026-09-29');
  assert.equal(T.resolveDemoDates('{{iso:D+1 19:30}}', now), '2026-10-01T19:30:00+01:00');
  assert.equal(T.resolveDemoDates('{{ics:D+26 19:30}}', now), '20261026T193000');
});

test('SHA-256 and HMAC match Node crypto', () => {
  for (const msg of ['', 'abc', 'x'.repeat(200), 'Grüße aus Southampton']) {
    assert.equal(toHex(sha256(new TextEncoder().encode(msg))), createHash('sha256').update(msg).digest('hex'));
    assert.equal(hmacHex('key', msg), createHmac('sha256', 'key').update(msg).digest('hex'));
  }
  const longKey = 'k'.repeat(100);
  assert.equal(hmacHex(longKey, 'm'), createHmac('sha256', longKey).update('m').digest('hex'));
});

test('mock edge accepts a rising counter and rejects replays and bad checks', () => {
  const tag = tags.find((t) => t.slug === 'bargate');
  const counters = {};
  const e1 = chipMessage(1); const c1 = chipCheck(tag.id, e1);
  assert.equal(verifyTap({ tagId: tag.id, e: e1, c: c1, tag, counters }).status, 'valid');
  counters[tag.id] = 1;
  assert.equal(verifyTap({ tagId: tag.id, e: e1, c: c1, tag, counters }).status, 'replay');
  assert.equal(verifyTap({ tagId: tag.id, e: e1, c: 'deadbeefdeadbeef', tag, counters }).status, 'invalid');
  assert.equal(verifyTap({ tagId: 'nope1', e: e1, c: c1, tag: undefined, counters }).status, 'unknown');
  const tok = issueToken({ tag: tag.id, sid: 's', exp: 1000 });
  assert.equal(verifyToken(tok, 999).tag, tag.id);
  assert.equal(verifyToken(tok, 1001), null);
  assert.equal(verifyToken(tok.slice(0, -2) + 'aa', 999), null);
});

test('CSV parser handles quoted commas', () => {
  const rows = parseCsv('A,B\n"x, y",2\n');
  assert.deepEqual(rows, [{ A: 'x, y', B: '2' }]);
});

test('mini HTML reader ignores scripts and reads fields', () => {
  const root = parseHtml('<div class="a"><h3 class="t"><a href="https://x.test/">Hi &amp; bye</a></h3><script>alert(1)</script><ul class="acc"><li>One</li><li>Two</li></ul></div>');
  const [item] = selectAll(root, 'div.a');
  assert.equal(readField(item, '.t'), 'Hi & bye');
  assert.equal(readField(item, '.t a@href'), 'https://x.test/');
  assert.deepEqual(readField(item, 'ul.acc li*'), ['One', 'Two']);
  assert.ok(!JSON.stringify(item, (k, v) => (k === 'parent' ? undefined : v)).includes('alert'));
});

test('cleaning, categories and venue matching', () => {
  assert.equal(cleanText('MUSICAL THEATRE GALA'), 'Musical Theatre Gala');
  assert.equal(cleanText('<b>Hi</b>  there'), 'Hi there');
  assert.equal(mapCategory('Walks and tours'), 'tour');
  assert.equal(mapCategory('Concert'), 'music');
  assert.equal(mapCategory('Something odd'), 'other');
  const mf = tags.find((t) => t.slug === 'mayflower').id;
  assert.equal(matchVenue('Mayflower Theatre', tags), mf);
  assert.equal(matchVenue('Mayflower Park', tags), null);
  assert.equal(matchVenue('SeaCity Museum, Havelock Road', tags), tags.find((t) => t.slug === 'seacity').id);
  assert.equal(matchVenue('Town Quay', tags), null);
});

async function importAll(now, extra = []) {
  const fetchText = async (p) => fs.readFileSync(new URL(`../../site${p}`, import.meta.url), 'utf8');
  return runImport({ sources: [...sources, ...extra], tags, manualEvents: [], now, fetchText });
}

test('import job builds the events register, drops expired rows and merges duplicates', async () => {
  const now = new Date('2026-09-30T08:00:00Z');
  const reg = await importAll(now);
  const raw = reg.health['src-vs-events'].rows + reg.health['src-art-gallery'].rows + reg.health['src-mayflower'].rows;
  assert.equal(raw, 29);
  assert.ok(!reg.events.some((e) => e.title.en === 'Past Event Test Listing'), 'expired row dropped');
  const gala = reg.events.filter((e) => e.title.en === 'Musical Theatre Gala');
  assert.equal(gala.length, 1, 'gala merged across two sources');
  assert.equal(gala[0].sourceId, 'src-mayflower', "venue's own source leads");
  assert.equal(gala[0].alsoFrom[0].sourceId, 'src-vs-events');
  assert.ok(reg.events.length >= 25 && reg.events.length <= 40, `events ${reg.events.length}`);
  assert.equal(reg.places.length, 16);
});

test('adding the iCal source adds new events and de-duplicates the two repeats', async () => {
  const now = new Date('2026-09-30T08:00:00Z');
  const before = await importAll(now);
  const ical = { id: 'src-test-ical', name: 'iCal', url: 'https://seacitymuseum.co.uk/', register: 'events', method: 'ical', fixture: '/data/fixtures/museums-galleries.ics', mapping: {}, priority: 2, venueMap: {}, demo: true };
  const after = await importAll(now, [ical]);
  assert.equal(after.health['src-test-ical'].records, 6);
  assert.equal(after.events.length - before.events.length, 4);
  const talk = after.events.find((e) => e.title.en === "Curator's Lunchtime Talk");
  assert.ok(talk.alsoFrom.some((a) => a.sourceId === 'src-test-ical'));
});

test('a failed import keeps the last good records until they expire', async () => {
  const now = new Date('2026-09-30T08:00:00Z');
  const fetchText = async (p) => fs.readFileSync(new URL(`../../site${p}`, import.meta.url), 'utf8');
  const first = await runImport({ sources, tags, now, fetchText });
  const broken = sources.map((s) => (s.id === 'src-mayflower' ? { ...s, simulateFailure: true } : s));
  const second = await runImport({ sources: broken, tags, now, fetchText, previous: first });
  assert.match(second.health['src-mayflower'].lastError, /503/);
  assert.equal(second.health['src-mayflower'].records, 9);
  assert.equal(second.events.length, first.events.length);
});

test('today and this week use London days', async () => {
  const now = new Date('2026-09-30T08:00:00Z');
  const reg = await importAll(now);
  const today = eventsToday(reg.events, now);
  const week = eventsThisWeek(reg.events, now);
  assert.ok(today.length >= 5, `today ${today.length}`);
  assert.ok(week.length > today.length);
  const late = new Date('2026-09-30T20:45:00Z');
  assert.ok(eventsToday(reg.events, late).every((e) => new Date(e.end) > late));
});

test('graph: shortest chain, closures and step-free', () => {
  const id = (slug) => tags.find((t) => t.slug === slug).id;
  const open = buildGraph(legs, { closed: new Set(), stepFree: false });
  const r1 = shortestChain(open, id('bargate'), id('cruise-terminal'));
  assert.equal(r1.total, r1.legs.reduce((s, l) => s + l.walkMin, 0));
  assert.equal(r1.total, 12);
  const sf = buildGraph(legs, { closed: new Set(), stepFree: true });
  const r2 = shortestChain(sf, id('bargate'), id('cruise-terminal'));
  assert.ok(r2.legs.every((l) => l.stepFree));
  assert.ok(r2.total > r1.total);
  const closedAll = new Set(legs.filter((l) => l.to === id('cruise-terminal')).map((l) => l.id));
  assert.equal(shortestChain(buildGraph(legs, { closed: closedAll, stepFree: false }), id('bargate'), id('cruise-terminal')), null);
});

test('every trail resolves to connected legs, and a closed trail leg gets a detour', () => {
  const bundle = { legs, notices: [] };
  const ctx = routingContext(bundle, new Date('2026-09-30T08:00:00Z'), false);
  for (const tr of trails.filter((x) => x.type === 'trail')) {
    const stops = trailStops(tr, ctx.legsById);
    assert.equal(stops.length, tr.legs.length + 1);
    tr.legs.forEach((lid, i) => { assert.equal(ctx.legsById.get(lid).from, stops[i]); });
  }
  const hist = trails.find((x) => x.id === 'history');
  const ctx2 = routingContext({ legs, notices: [{ start: '2026-09-29', end: '2026-10-05', closesLegs: ['L010'] }] }, new Date('2026-09-30T08:00:00Z'), false);
  assert.ok(closedLegIds(legs, [{ start: '2026-09-29', end: '2026-10-05', closesLegs: ['L010'] }], new Date('2026-09-30T08:00:00Z')).has('L010'));
  const seg = resolveSegments(hist, ctx2)[2];
  assert.equal(seg.detour, 'closed');
  assert.ok(seg.legs.length >= 2 && !seg.legs.some((l) => l.id === 'L010'));
});

test('rejoin chain minutes add up to the route total', () => {
  const ctx = routingContext({ legs, notices: [] }, new Date('2026-09-30T08:00:00Z'), false);
  const hist = trails.find((x) => x.id === 'history');
  const wq = tags.find((t) => t.slug === 'westquay').id;
  const opt = rejoinOptions(hist, 3, wq, ctx);
  assert.equal(opt.rejoin.chain.total, opt.rejoin.chain.legs.reduce((s, l) => s + l.walkMin, 0));
  assert.ok(opt.carryOn.chain);
});

test('nudge appears on a busy day for a busy zone, and respects dismissal and share', () => {
  const now = new Date('2026-09-30T08:00:00Z');
  const cal = [{ date: '2026-09-30', busyZones: ['old-town'], suggestTrail: 'quiet', reason: { en: 'x' } }];
  const base = { calendar: cal, now, zones: ['old-town'], activeTrailId: 'history', dismissed: {}, sessionKey: 'abc', share: 1, trails };
  assert.ok(pickNudge(base));
  assert.equal(pickNudge({ ...base, zones: ['cultural'] }), null);
  assert.equal(pickNudge({ ...base, dismissed: { '2026-09-30': true } }), null);
  assert.equal(pickNudge({ ...base, share: 0 }), null);
  assert.equal(pickNudge({ ...base, activeTrailId: 'quiet' }), null);
});

test('walk-back times in tags.json match the leg graph', () => {
  const g = buildGraph(legs, { closed: new Set(), stepFree: false });
  for (const t of tags.filter((x) => x.kind === 'loop' && x.id !== settings.terminalTag)) {
    assert.equal(shortestChain(g, t.id, settings.terminalTag).total, t.walkBackMin, t.slug);
  }
});
