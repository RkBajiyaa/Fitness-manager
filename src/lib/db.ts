/* ============================================================
   Data-access layer. The ONLY module that touches storage.

   Every read and write is scoped by session.gymId — a screen
   cannot ask for another gym's rows because it never supplies
   the tenant key itself.

   Swap the body of load/persist for fetch + Postgres later;
   nothing above this layer changes.
   ============================================================ */
import type {
  AuditLog, Database, PlatformAuditLog, Role, Session,
} from './types';
import type { AuthIdentity } from './auth';
import { buildPlatform } from './seed';
import type { FeatureKey } from './platform/catalog';
import {
  resolveEntitlements, effectiveFeatures, type EntitlementMap,
} from './platform/entitlements';
import { roleCan, type Capability } from './platform/permissions';

const STORAGE_KEY = 'fm.db.v4';
const SESSION_KEY = 'fm.session.v4';
const SCHEMA_VERSION = 4;

/**
 * The tenant id a platform_admin session carries. It can never
 * equal a real gym id, so every tenant filter returns nothing for
 * an admin even if one is reached by accident — and `tenant()`
 * throws rather than relying on that.
 */
export const PLATFORM_TENANT = '__platform__';

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

/**
 * First boot creates the PLATFORM only — the feature catalog,
 * the packages, the platform admin and the settings row. No gym,
 * no members, no revenue.
 *
 * This is the fix for the old prototype's biggest lie: a real
 * customer used to sign in and find 52 members and ₹4 lakh of
 * revenue they had never earned. Demo data now exists only when
 * somebody explicitly asks for it (see api.platform.demo).
 */
export function initDb(): Database {
  if (state) return state;
  state = readStorage() ?? buildPlatform();
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

/** Wipes everything, including any demo workspace, back to a bare platform. */
export function resetDatabase(): void {
  state = buildPlatform();
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
export function resolveSession(identity: AuthIdentity, preferRole?: Role): Session | null {
  const db = getDb();
  const email = identity.email.trim().toLowerCase();
  const matches = db.users.filter(
    (u) => u.authUid === identity.uid || u.email.trim().toLowerCase() === email,
  );
  if (!matches.length) return null;

  // One identity can legitimately map to more than one user (an owner who also
  // trains at their own studio). The CALLER may express a preference; it is
  // still resolved against stored rows, never trusted as an assertion.
  const user = (preferRole && matches.find((u) => u.role === preferRole)) ?? matches[0];

  if (user.role === 'platform_admin') {
    return {
      gymId: PLATFORM_TENANT,
      role: 'platform_admin',
      userId: user.id,
      memberId: null,
      name: user.name,
      email: user.email,
    };
  }

  if (!user.gymId) return null;

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

/** A suspended customer keeps their data but loses access to the app. */
export function gymStatusFor(session: Session): 'active' | 'suspended' | 'unknown' {
  if (session.role === 'platform_admin') return 'active';
  const gym = getDb().gyms.find((g) => g.id === session.gymId);
  return gym ? gym.status : 'unknown';
}

/* ---------------- the four gates (§E / §M.5) ----------------

   1. TENANT      scope by session.gymId, never a client id
   2. ENTITLEMENT is the feature available to this customer?
   3. ROLE        may this role use it?
   4. OWNERSHIP   role=member ⇒ the row must be theirs

   Gate 2 is new in v3 and sits deliberately BEFORE the role gate:
   "your gym does not have this module" and "your role may not do
   this" are different answers to different questions, and
   collapsing them is how `if (plan === 'premium')` ends up
   smeared through forty screens.
   ------------------------------------------------------------ */

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

/** Gate 2's error. Distinct from Forbidden so the UI can offer the right next step. */
export class FeatureDisabled extends Error {
  code = 'feature_disabled' as const;
  feature: FeatureKey;
  constructor(feature: FeatureKey, message: string) {
    super(message);
    this.feature = feature;
  }
}

/** Gate 1 — tenant. Filters any gym-owned collection to the session's gym. */
export function tenant<T extends { gymId: string }>(rows: T[], session: Session): T[] {
  if (!session.gymId || session.gymId === PLATFORM_TENANT) {
    // A platform admin has no tenant. Reading gym rows here would be a
    // cross-customer leak, so it is an error rather than an empty list.
    throw new Forbidden('This request has no gym context.');
  }
  return rows.filter((r) => r.gymId === session.gymId);
}

/* ---------------- entitlements (gate 2) ---------------- */

const NO_OVERRIDES: ReadonlyMap<FeatureKey, boolean> = new Map();

/**
 * Derived per revision, per gym. Never stored: a stored effective
 * flag drifts the instant a package is edited underneath it.
 */
export function entitlementsFor(gymId: string): EntitlementMap {
  return memo(`ent:${gymId}`, () => {
    const db = getDb();
    const sub = db.subscriptions.find((x) => x.gymId === gymId);
    const pkg = sub ? db.packages.find((p) => p.id === sub.packageId) : undefined;
    const overrides = new Map<FeatureKey, boolean>(
      db.overrides
        .filter((o) => o.gymId === gymId)
        .map((o) => [o.feature as FeatureKey, o.enabled]),
    );
    return resolveEntitlements({
      packageFeatures: (pkg?.features ?? []) as FeatureKey[],
      overrides: overrides.size ? overrides : NO_OVERRIDES,
      packageName: pkg?.name ?? 'no package',
    });
  });
}

export function featuresFor(gymId: string): Set<FeatureKey> {
  return memo(`feat:${gymId}`, () => effectiveFeatures(entitlementsFor(gymId)));
}

/** Gate 2 — is the capability available to this customer at all? */
export function hasFeature(session: Session, feature: FeatureKey): boolean {
  if (session.role === 'platform_admin') return true;   // the admin does not use gym screens
  if (!session.gymId || session.gymId === PLATFORM_TENANT) return false;
  return featuresFor(session.gymId).has(feature);
}

export function requireFeature(session: Session, feature: FeatureKey): void {
  if (hasFeature(session, feature)) return;
  const ent = session.gymId && session.gymId !== PLATFORM_TENANT
    ? entitlementsFor(session.gymId)[feature]
    : undefined;
  throw new FeatureDisabled(
    feature,
    ent ? `${ent.def.name} is not enabled for this gym. ${ent.reason}`
      : 'That module is not enabled for this gym.',
  );
}

/* ---------------- role (gate 3) ---------------- */

/** Wildcard capability check against lib/platform/permissions.ts. */
export function can(session: Session, capability: Capability): boolean {
  return roleCan(session.role, capability);
}

/** Roles that administer a gym. A platform admin is NOT one of them. */
export function requireOwner(session: Session): void {
  if (session.role !== 'owner' && session.role !== 'manager') {
    throw new Forbidden('This area is available to gym owners only.');
  }
  if (!session.gymId || session.gymId === PLATFORM_TENANT) {
    throw new Forbidden('This request has no gym context.');
  }
}

/**
 * The platform gate. Kept separate from requireOwner on purpose:
 * a gym owner must never reach platform configuration, and a
 * platform admin must never reach a customer's member data.
 */
export function requirePlatformAdmin(session: Session): void {
  if (session.role !== 'platform_admin') {
    throw new NotFound('Not found.');
  }
}

/* ---------------- ownership (gate 4) ---------------- */

/** A member may only ever touch their own rows. */
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

/**
 * Platform configuration changes live in their own log, with their
 * own gate. Mixing them into a gym's audit trail would either leak
 * platform activity to the customer or hide it from us.
 */
export function platformAudit(
  db: Database, session: Session,
  entry: {
    action: string; entity: string; entityId: string; summary: string;
    gymId?: string | null; gymName?: string; meta?: Record<string, unknown>;
  },
): void {
  const row: PlatformAuditLog = {
    id: `pau_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actorUserId: session.userId,
    actorName: session.name,
    action: entry.action,
    gymId: entry.gymId ?? null,
    gymName: entry.gymName ?? '',
    entity: entry.entity,
    entityId: entry.entityId,
    summary: entry.summary,
    meta: entry.meta,
  };
  db.platformAudit.unshift(row);
  if (db.platformAudit.length > 1000) db.platformAudit.length = 1000;
}

/* ---------------- ids ---------------- */

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
