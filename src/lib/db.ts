/* ============================================================
   Data-access layer. The ONLY module that touches storage.
   Every read and write is scoped by session.gymId — a screen
   cannot ask for another gym's rows because it never supplies
   the tenant key itself.
   Swap the body of load/persist for fetch + Postgres later;
   nothing above this layer changes.
   ============================================================ */
import type { AuditLog, Database, Role, Session } from './types';
import { buildSeed, DEMO_GYM_SLUG } from './seed';

const STORAGE_KEY = 'gss.db.v1';
const SESSION_KEY = 'gss.session.v1';
const SCHEMA_VERSION = 1;

let state: Database | null = null;
let revision = 0;
const listeners = new Set<() => void>();

/* ---------------- persistence ---------------- */

function readStorage(): Database | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Database;
    if (parsed.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;                     // corrupt or unavailable storage ⇒ reseed
  }
}

let saveTimer: number | undefined;
function persist(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota or private mode — the session still works in memory */
    }
  }, 250);
}

export function initDb(): Database {
  if (state) return state;
  state = readStorage() ?? buildSeed();
  persist();
  return state;
}

export function getDb(): Database {
  if (!state) return initDb();
  return state;
}

export function getRevision(): number {
  return revision;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The single write path. Mutate in place, bump the revision, notify, persist. */
export function commit(mutator: (db: Database) => void): void {
  const db = getDb();
  mutator(db);
  revision++;
  persist();
  listeners.forEach((l) => l());
}

export function resetDatabase(): void {
  state = buildSeed();
  revision++;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/* ---------------- session ---------------- */

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

/**
 * Fabricates what a JWT will carry later: { gymId, role, userId, memberId }.
 * Replacing the landing screen with a login means replacing this function only.
 */
export function makeSession(role: Extract<Role, 'owner' | 'member'>): Session {
  const db = getDb();
  const gym = db.gyms.find((g) => g.slug === DEMO_GYM_SLUG) ?? db.gyms[0];
  const user =
    db.users.find((u) => u.gymId === gym.id && u.role === role) ??
    db.users.find((u) => u.gymId === gym.id)!;
  return {
    gymId: gym.id,
    role,
    userId: user.id,
    memberId: role === 'member' ? (user.memberId ?? null) : null,
    name: user.name,
  };
}

/* ---------------- the three gates (§E) ---------------- */

export class Forbidden extends Error {
  code = 'forbidden' as const;
  constructor(message = 'You do not have access to this resource.') {
    super(message);
  }
}
export class NotFound extends Error {
  code = 'not_found' as const;
  constructor(message = 'Not found.') {
    super(message);
  }
}

/** Gate 1 — tenant. Filters any gym-owned collection to the session's gym. */
export function tenant<T extends { gymId: string }>(rows: T[], session: Session): T[] {
  return rows.filter((r) => r.gymId === session.gymId);
}

/** Gate 2 — role. */
const ALLOW: Record<Role, string[]> = {
  platform_admin: ['gyms:*'],
  owner: ['*'],
  trainer: ['members:read', 'attendance:*', 'workouts:*', 'diet:*', 'measurements:read', 'notes:*'],
  member: ['self:*'],
};

export function can(session: Session, capability: string): boolean {
  const allowed = ALLOW[session.role] ?? [];
  return allowed.some((a) => a === '*' || a === capability || (a.endsWith(':*') && capability.startsWith(a.slice(0, -1))));
}

export function requireOwner(session: Session): void {
  if (session.role !== 'owner' && session.role !== 'platform_admin') {
    throw new Forbidden('This area is available to gym owners only.');
  }
}

/** Gate 3 — ownership. A member may only ever touch their own rows. */
export function requireOwnership(session: Session, memberId: string | null | undefined): void {
  if (session.role === 'member' && session.memberId !== memberId) {
    // 404, not 403 — never confirm that someone else's record exists.
    throw new NotFound('Not found.');
  }
}

/* ---------------- audit ---------------- */

export function audit(
  db: Database, session: Session, action: string, entity: string, entityId: string,
  meta?: Record<string, unknown>,
): void {
  const row: AuditLog = {
    id: `aud_${Math.random().toString(36).slice(2, 10)}`,
    gymId: session.gymId, actorRole: session.role, action, entity, entityId,
    at: new Date().toISOString(), meta,
  };
  db.audit.unshift(row);
  if (db.audit.length > 500) db.audit.length = 500;
}

/* ---------------- ids ---------------- */

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
