// Routing without a routing service. Legs are authored, walk-checked walks
// between neighbouring Loop points. They form a small directed graph, and
// longer routes are the shortest chain of legs (Dijkstra, weight = walk minutes).
// Closed legs, and legs with steps when step-free is on, are left out.
import { dayKey } from './time.js';

export function isNoticeActive(notice, now) {
  const today = dayKey(now);
  return (!notice.start || notice.start <= today) && (!notice.end || notice.end >= today);
}

export function closedLegIds(legs, notices, now) {
  const closed = new Set(legs.filter((l) => l.closed).map((l) => l.id));
  for (const n of notices || []) if (isNoticeActive(n, now)) for (const id of n.closesLegs || []) closed.add(id);
  return closed;
}

export function usable(leg, { closed, stepFree }) {
  return !closed.has(leg.id) && (!stepFree || leg.stepFree);
}

export function buildGraph(legs, opts) {
  const adj = new Map();
  for (const l of legs) {
    if (!usable(l, opts)) continue;
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push(l);
  }
  return adj;
}

// Dijkstra from one place. Ties prefer fewer legs, then the lower leg id, so
// results are stable between runs.
export function distancesFrom(graph, from) {
  const best = new Map([[from, { dist: 0, hops: 0, via: null }]]);
  const done = new Set();
  for (;;) {
    let u = null; let bu = null;
    for (const [k, v] of best) {
      if (done.has(k)) continue;
      if (!bu || v.dist < bu.dist || (v.dist === bu.dist && v.hops < bu.hops)) { u = k; bu = v; }
    }
    if (u === null) break;
    done.add(u);
    for (const leg of graph.get(u) || []) {
      const cand = { dist: bu.dist + leg.walkMin, hops: bu.hops + 1, via: leg };
      const cur = best.get(leg.to);
      if (!cur || cand.dist < cur.dist || (cand.dist === cur.dist && (cand.hops < cur.hops || (cand.hops === cur.hops && leg.id < cur.via.id)))) best.set(leg.to, cand);
    }
  }
  return best;
}

export function shortestChain(graph, from, to) {
  if (from === to) return { legs: [], total: 0 };
  const best = distancesFrom(graph, from);
  if (!best.has(to)) return null;
  const legs = [];
  let at = to;
  while (at !== from) { const { via } = best.get(at); legs.unshift(via); at = via.from; }
  return { legs, total: legs.reduce((s, l) => s + l.walkMin, 0) };
}

// The closest of several targets by walking time.
export function nearestOf(graph, from, targets) {
  const best = distancesFrom(graph, from);
  let pick = null;
  for (const t of targets) {
    const b = best.get(t);
    if (b && (!pick || b.dist < pick.dist)) pick = { target: t, dist: b.dist };
  }
  return pick ? { target: pick.target, chain: shortestChain(graph, from, pick.target) } : null;
}

// Places one authored leg away in either direction (used for "near you").
export function neighbours(legs, placeId) {
  const out = new Set();
  for (const l of legs) {
    if (l.from === placeId) out.add(l.to);
    if (l.to === placeId) out.add(l.from);
  }
  return out;
}

// Zones reachable by one leg from any place in the given zone (used for offline precache).
export function neighbourZones(legs, tags, zone) {
  const zoneOf = new Map(tags.map((t) => [t.id, t.zone]));
  const out = new Set([zone]);
  for (const l of legs) {
    if (zoneOf.get(l.from) === zone) out.add(zoneOf.get(l.to));
    if (zoneOf.get(l.to) === zone) out.add(zoneOf.get(l.from));
  }
  return out;
}
