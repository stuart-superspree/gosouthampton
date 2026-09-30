// Trails and routes from authored legs. A trail is an ordered list of legs,
// so its stops are the first leg's start plus each leg's end. If a trail leg
// is closed (or has steps while step-free is on) the segment is replaced by
// the shortest chain of other authored legs. If there is none, we say so.
import { buildGraph, closedLegIds, shortestChain, nearestOf, usable } from './graph.js';
import { dayKey } from './time.js';

export function routingContext(bundle, now, stepFree) {
  const closed = closedLegIds(bundle.legs, bundle.notices, now);
  const opts = { closed, stepFree: !!stepFree };
  return { ...opts, graph: buildGraph(bundle.legs, opts), legsById: new Map(bundle.legs.map((l) => [l.id, l])) };
}

export function isActiveOn(item, now) {
  const today = dayKey(now);
  return (!item.activeFrom || item.activeFrom <= today) && (!item.activeTo || item.activeTo >= today);
}

export function trailStops(trail, legsById) {
  if (!trail.legs || !trail.legs.length) return [];
  const first = legsById.get(trail.legs[0]);
  if (!first) return [];
  return [first.from, ...trail.legs.map((id) => legsById.get(id)?.to)];
}

export function resolveSegments(trail, ctx) {
  const stops = trailStops(trail, ctx.legsById);
  return trail.legs.map((id, i) => {
    const leg = ctx.legsById.get(id);
    const from = stops[i]; const to = stops[i + 1];
    if (leg && usable(leg, ctx)) return { from, to, legs: [leg], total: leg.walkMin, detour: null };
    const reason = !leg || ctx.closed.has(leg.id) ? 'closed' : 'step-free';
    const chain = shortestChain(ctx.graph, from, to);
    if (chain) return { from, to, legs: chain.legs, total: chain.total, detour: reason };
    return { from, to, legs: [], total: null, detour: reason, noRoute: true };
  });
}

export const trailIsStepFree = (trail, legsById) => trail.legs.every((id) => legsById.get(id)?.stepFree);
export const legsTotal = (legs) => legs.reduce((s, l) => s + l.walkMin, 0);

export function walkInRoute(walkIn, ctx) {
  const legs = walkIn.legs.map((id) => ctx.legsById.get(id));
  if (legs.every((l) => l && usable(l, ctx))) return { legs, total: legsTotal(legs), detour: null };
  const chain = shortestChain(ctx.graph, walkIn.from, walkIn.to);
  return chain ? { ...chain, detour: 'closed' } : null;
}

export function returnRoute(from, terminal, ctx) {
  return from ? shortestChain(ctx.graph, from, terminal) : null;
}

// Options when a visitor taps a Loop point that is not on their trail.
export function rejoinOptions(trail, headingIdx, current, ctx) {
  const stops = trailStops(trail, ctx.legsById);
  const k = Math.max(0, Math.min(headingIdx, stops.length - 1));
  const rejoin = { stopIdx: k, place: stops[k], chain: shortestChain(ctx.graph, current, stops[k]) };
  const near = nearestOf(ctx.graph, current, stops);
  const carryOn = near ? { stopIdx: stops.indexOf(near.target), place: near.target, chain: near.chain } : null;
  return { stops, rejoin, carryOn };
}

// Flatten legs into step cards, remembering which leg each card belongs to.
export function stepCards(legs) {
  return legs.flatMap((l) => l.steps.map((s, i) => ({ ...s, legId: l.id, from: l.from, to: l.to, walkMin: l.walkMin, stepFree: l.stepFree, i, n: l.steps.length })));
}
