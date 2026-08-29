/* ============================================================
   Data-access layer. The ONLY module that touches storage.

   Every read and write is scoped by session.gymId — a screen
   cannot ask for another gym's rows because it never supplies
   the tenant key itself.

   Swap the body of load/persist for fetch + Postgres later;
   nothing above this layer changes.
   ============================================================ */
import type { AuditLog, Database, Role, Session } from './types';
import type { AuthIdentity } from './auth';
import { buildSeed } from './seed';

const STORAGE_KEY = 'fm.db.v2';
const SESSION_KEY = 'fm.session.v2';
const SCHEMA_VERSION = 2;

let state: Database | null = null;
let revision = 0;
const listeners = new Set<() => void>();

/* ---------------- persistence ---------------- */

function readStorage(): Database | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Database;
    if (parsed.version !== SCHEMA_VERSION) return null;   // older shape ⇒ reseed
    return parsed;
  } catch {
    return null;                     // corrupt or unavailable storage ⇒ reseed
  }
}

let saveTimer: number | undefined;
let persistFailed = false;

/** True once a write to localStorage has failed (quota, private mode). */
export function isPersistenceDegraded(): boolean {
  return persistFailed;
}

function persist(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistFailed = false;
    } catch {
      // Quota exceeded or private mode. The session keeps working from memory,
      // but the user must be told rather than silently losing their changes.
      if (!persistFailed) {
        persistFailed = true;
        console.warn(
          '[Fitness Manager] Could not save to local storage — changes will be lost on refresh.',
        );
        listeners.forEach((l) => l());
      }
    }
  }, 300);
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
  memoStore.clear();                 // derived caches belong to one revision
  persist();
  listeners.forEach((l) => l());
}

export function resetDatabase(): void {
  state = buildSeed();
  revision++;
  memoStore.clear();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/* ---------------- derived-value cache ----------------
   Expensive owner-wide derivations (engagement across the whole
   roster, personal records across all sessions) are computed once
   per revision and reused by every screen that asks. Cleared on
   every write, so it can never serve stale data.
   ---------------------------------------------------- */

const memoStore = new Map<string, unknown>();

export function memo<T>(key: string, compute: () => T): T {
  if (memoStore.has(key)) return memoStore.get(key) as T;
  const value = compute();
  memoStore.set(key, value);
  return value;
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
 * Identity → authorisation (docs/ARCHITECTURE.md §I.2).
 *
 * The caller supplies a verified identity and NOTHING ELSE. Role, gym and
 * member linkage are resolved here, from stored data. In production this
 * function moves server-side and the identity arrives as a verified Firebase
 * token — the shape it returns is unchanged, which is why no screen cares.
 */
export function resolveSession(identity: AuthIdentity): Session | null {
  const db = getDb();
  const email = identity.email.trim().toLowerCase();
  const user =
    db.users.find((u) => u.authUid === identity.uid) ??
    db.users.find((u) => u.email.trim().toLowerCase() === email);
  if (!user || !user.gymId) return null;

  return {
    gymId: user.gymId,
    role: user.role,
    userId: user.id,
    memberId: user.role === 'member' ? (user.memberId ?? null) : null,
    name: user.name,
    email: user.email,
  };
}

/** Which roles a verified identity can actually sign in as. */
export function rolesFor(identity: AuthIdentity): Role[] {
  const db = getDb();
  const email = identity.email.trim().toLowerCase();
  return db.users
    .filter((u) => u.authUid === identity.uid || u.email.trim().toLowerCase() === email)
    .map((u) => u.role);
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
