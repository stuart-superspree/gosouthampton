// Visitor views of the What's on and Places registers. "Today" and "This week"
// use London calendar days from the device clock (see time.js).
import { dayKey, addDays, startOfDay } from './time.js';

const overlaps = (ev, from, to) => new Date(ev.start) < to && new Date(ev.end) > from;
const live = (ev, now) => new Date(ev.expires) > now && new Date(ev.end) > now;

export function eventsToday(events, now) {
  const today = dayKey(now);
  const from = startOfDay(today); const to = startOfDay(addDays(today, 1));
  return events.filter((ev) => live(ev, now) && overlaps(ev, from, to));
}

export function eventsThisWeek(events, now) {
  const today = dayKey(now);
  const to = startOfDay(addDays(today, 7));
  return events.filter((ev) => live(ev, now) && overlaps(ev, now, to));
}

export function isOnNow(ev, now) { return new Date(ev.start) <= now && new Date(ev.end) > now; }
export function isMultiDay(ev) { return dayKey(new Date(ev.start)) !== dayKey(new Date(new Date(ev.end).getTime() - 1)); }

export function nearYou(events, placeId, neighbourSet) {
  if (!placeId) return [];
  return events.filter((ev) => ev.venueTag && (ev.venueTag === placeId || neighbourSet.has(ev.venueTag)));
}

export function filterEvents(events, { category = 'all', zone = 'all' } = {}) {
  return events.filter((ev) => (category === 'all' || ev.category === category) && (zone === 'all' || (zone === 'other' ? !ev.zone : ev.zone === zone)));
}

export function groupPlaces(places) {
  const groups = new Map();
  for (const p of places) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category).push(p);
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}
