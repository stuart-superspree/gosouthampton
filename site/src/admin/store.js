// Demo admin state: the draft being edited, the demo user and role, and the
// audit log. All kept in this browser's storage (a real build uses the CMS database).
import { local } from '../storage.js';
import { registry, loadBase, DRAFT_KEY } from '../bundle.js';

const AUDIT_KEY = 'rl-admin-audit';
const ROLE_KEY = 'rl-admin-role';

export const ROLES = {
  admin: { label: 'BID admin', user: 'Demo BID admin', can: ['edit', 'publish', 'rollback', 'sources', 'tags'] },
  author: { label: 'Author', user: 'Demo author', can: ['edit'] },
  reviewer: { label: 'Reviewer', user: 'Demo reviewer', can: ['edit', 'publish', 'rollback', 'sources'] },
  council: { label: 'Council viewer', user: 'Demo council viewer', can: [] },
};

export function role() { const r = local.get(ROLE_KEY, 'admin'); return ROLES[r] ? r : 'admin'; }
export function setRole(r) { local.set(ROLE_KEY, r); }
export const can = (perm) => ROLES[role()].can.includes(perm);
export const user = () => ROLES[role()].user;

export async function publishedRaw() {
  const r = registry();
  if (r.current !== 'base') {
    const v = r.versions.find((x) => x.id === r.current);
    if (v) return { id: v.id, data: structuredClone(v.data) };
  }
  return { id: 'base', data: await loadBase() };
}

let draft = null;
export async function loadDraft() {
  const saved = local.get(DRAFT_KEY, null);
  const pub = await publishedRaw();
  if (saved && saved.data && (saved.dirty || saved.base === pub.id)) draft = saved;
  else draft = { base: pub.id, dirty: false, data: pub.data, changes: [] };
  draft.data.manualEvents = draft.data.manualEvents || [];
  local.set(DRAFT_KEY, draft);
  return draft;
}
export const getDraft = () => draft;
export function saveDraft(change) {
  draft.dirty = true;
  if (change) { draft.changes.push({ time: new Date().toISOString(), user: user(), change }); audit(change); }
  local.set(DRAFT_KEY, draft);
}
export async function resetDraft() {
  const pub = await publishedRaw();
  draft = { base: pub.id, dirty: false, data: pub.data, changes: [] };
  draft.data.manualEvents = draft.data.manualEvents || [];
  local.set(DRAFT_KEY, draft);
  return draft;
}
export function markPublished(id) { draft.base = id; draft.dirty = false; draft.changes = []; local.set(DRAFT_KEY, draft); }

export function audit(action) {
  const log = local.get(AUDIT_KEY, []) || [];
  log.push({ time: new Date().toISOString(), user: user(), role: ROLES[role()].label, action });
  local.set(AUDIT_KEY, log.slice(-300));
}
export const auditLog = () => (local.get(AUDIT_KEY, []) || []).slice().reverse();
