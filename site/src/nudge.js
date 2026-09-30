// Quiet-time nudging, level 0: a calendar of known busy days. If today is in
// the calendar and the visitor is in, or heading to, a busy zone, suggest an
// authored quieter trail with a reason. Always skippable, never blocks.
import { dayKey } from './time.js';

// Stable 0..1 number from the daily session key, so a visitor either sees the
// nudge all day or not at all when only a share of visitors are nudged.
export function shareBucket(sessionKey) {
  let h = 2166136261;
  for (let i = 0; i < sessionKey.length; i++) { h ^= sessionKey.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 0xffffffff;
}

export function pickNudge({ calendar, now, zones, activeTrailId, dismissed, sessionKey, share = 1, trails }) {
  const today = dayKey(now);
  if (dismissed && dismissed[today]) return null;
  if (shareBucket(sessionKey || '') >= share) return null;
  for (const entry of calendar || []) {
    if (entry.date !== today) continue;
    if (!zones.some((z) => z && entry.busyZones.includes(z))) continue;
    if (entry.suggestTrail === activeTrailId) continue;
    const trail = (trails || []).find((t) => t.id === entry.suggestTrail);
    if (!trail) continue;
    return { entry, trail };
  }
  return null;
}
