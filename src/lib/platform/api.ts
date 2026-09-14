/* ============================================================
   PLATFORM API (docs/ARCHITECTURE.md §M.6).

   Our internal control panel's seam. Every function here starts
   with requirePlatformAdmin() — a gym owner reaching this module
   gets a 404, never a 403, for the same reason cross-tenant
   misses do: a 403 would confirm the thing exists.

   The platform admin deliberately has NO tenant. It can see that
   a customer has 47 members and when they last trained; it does
   not get a session player, a member's measurements, or their
   internal notes. Administration is not surveillance.
   ============================================================ */
import type {
  FeaturePackage, Gym, ISODate, Member, PlatformAuditLog, PlatformSettings,
  PlatformUpdate, PlatformUpdateKind, Session, Subscription, SubscriptionStatus, User,
} from '../types';
import {
  commit, getDb, newId, NotFound, platformAudit, requirePlatformAdmin, entitlementsFor, memo,
} from '../db';
import {
  buildDemoWorkspace, clearDemoWorkspace, blankGym, DEMO_GYM_ID,
} from '../seed';
import {
  entitlementList, type Entitlement, type EntitlementMap,
} from './entitlements';
import { FEATURE_CATALOG, isFeatureKey, type FeatureKey } from './catalog';
import { todayISO, dayOf, addDays } from '../date';

const WRITE_LATENCY = 120;

function write<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(fn()); } catch (e) { reject(e); }
    }, WRITE_LATENCY);
  });
}

export class PlatformValidationError extends Error {
  code = 'validation_error' as const;
  fields: Record<string, string>;
  constructor(fields: Record<string, string>, message = 'Please correct the highlighted fields.') {
    super(message);
    this.fields = fields;
  }
}

/* ============================================================
   Customer rows
   ============================================================ */

export interface GymRow {
  gym: Gym;
  owner: User | null;
  subscription: Subscription | null;
  pkg: FeaturePackage | null;
  memberCount: number;
  activeMemberCount: number;
  overrideCount: number;
  featureCount: number;
  lastActivityAt: string | null;
}

function packageFor(gymId: string): { sub: Subscription | null; pkg: FeaturePackage | null } {
  const db = getDb();
  const sub = db.subscriptions.find((s) => s.gymId === gymId) ?? null;
  const pkg = sub ? db.packages.find((p) => p.id === sub.packageId) ?? null : null;
  return { sub, pkg };
}

function rowFor(gym: Gym): GymRow {
  const db = getDb();
  const { sub, pkg } = packageFor(gym.id);
  const members = db.members.filter((m) => m.gymId === gym.id);
  const ent = entitlementsFor(gym.id);
  const activity = [
    ...db.payments.filter((p) => p.gymId === gym.id).map((p) => p.paidAt),
    ...db.attendance.filter((a) => a.gymId === gym.id).map((a) => a.at),
    ...db.sessions.filter((s) => s.gymId === gym.id).map((s) => s.startedAt),
  ];
  return {
    gym,
    owner: db.users.find((u) => u.gymId === gym.id && u.role === 'owner') ?? null,
    subscription: sub,
    pkg,
    memberCount: members.length,
    activeMemberCount: members.filter((m) => m.lifecycle === 'active').length,
    overrideCount: db.overrides.filter((o) => o.gymId === gym.id).length,
    featureCount: entitlementList(ent).filter((e) => e.effective).length,
    lastActivityAt: activity.length ? activity.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

/* ============================================================
   Dashboard metrics — counted, never estimated
   ============================================================ */

export interface PlatformMetrics {
  totalGyms: number;
  activeGyms: number;
  suspendedGyms: number;
  demoGyms: number;
  liveGyms: number;
  totalOwners: number;
  totalMembers: number;
  activeMembers: number;
  newGyms30: number;
  newMembers30: number;
  packageMix: Array<{ pkg: FeaturePackage; gyms: number }>;
  unpackaged: number;
  /** How many customers have each feature effectively on. */
  adoption: Array<{ key: FeatureKey; name: string; category: string; delivery: 'live' | 'designed'; gyms: number; overrides: number }>;
  activity: {
    sessions7: number;
    checkIns7: number;
    payments7: number;
    activeGyms7: number;
  };
  totalOverrides: number;
}

export const metrics = {
  get(session: Session): PlatformMetrics {
    requirePlatformAdmin(session);
    return memo('platform:metrics', () => {
      const db = getDb();
      const today = todayISO();
      const cut30 = addDays(today, -29);
      const cut7 = addDays(today, -6);

      const gyms = db.gyms;
      const gymById = new Map(gyms.map((g) => [g.id, g]));
      const members = db.members;

      const packageMix = db.packages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((pkg) => ({
          pkg,
          gyms: db.subscriptions.filter((s) => s.packageId === pkg.id).length,
        }));

      const adoption = FEATURE_CATALOG.map((f) => ({
        key: f.key,
        name: f.name,
        category: f.category,
        delivery: f.delivery,
        gyms: gyms.filter((g) => entitlementsFor(g.id)[f.key]?.effective).length,
        overrides: db.overrides.filter((o) => o.feature === f.key).length,
      })).sort((a, b) => b.gyms - a.gyms || a.name.localeCompare(b.name));

      const recentSessions = db.sessions.filter((s) => s.date >= cut7);
      const recentCheckIns = db.attendance.filter((a) => a.type === 'check_in' && dayOf(a.at) >= cut7);
      const recentPayments = db.payments.filter((p) => dayOf(p.paidAt) >= cut7);
      const activeGymIds = new Set<string>([
        ...recentSessions.map((s) => s.gymId),
        ...recentCheckIns.map((a) => a.gymId),
        ...recentPayments.map((p) => p.gymId),
      ]);

      return {
        totalGyms: gyms.length,
        activeGyms: gyms.filter((g) => g.status === 'active').length,
        suspendedGyms: gyms.filter((g) => g.status === 'suspended').length,
        demoGyms: gyms.filter((g) => g.dataMode === 'demo').length,
        liveGyms: gyms.filter((g) => g.dataMode === 'live').length,
        totalOwners: db.users.filter((u) => u.role === 'owner').length,
        totalMembers: members.length,
        activeMembers: members.filter((m) => m.lifecycle === 'active').length,
        newGyms30: gyms.filter((g) => dayOf(g.createdAt) >= cut30).length,
        newMembers30: members.filter((m) => m.joinedAt >= cut30).length,
        packageMix,
        unpackaged: gyms.filter((g) => !db.subscriptions.some((s) => s.gymId === g.id)).length,
        adoption,
        activity: {
          sessions7: recentSessions.length,
          checkIns7: recentCheckIns.length,
          payments7: recentPayments.length,
          activeGyms7: [...activeGymIds].filter((id) => gymById.has(id)).length,
        },
        totalOverrides: db.overrides.length,
      };
    });
  },
};

/* ============================================================
   Gyms (customers)
   ============================================================ */

export interface GymDetail extends GymRow {
  members: Member[];
  users: User[];
  entitlements: Entitlement[];
  entitlementMap: EntitlementMap;
  usage: {
    plans: number;
    memberships: number;
    payments: number;
    revenueAllTime: number;
    attendanceEvents: number;
    sessions: number;
    programs: number;
    customExercises: number;
    memberWorkouts: number;
    dietPlans: number;
    expenses: number;
    messages: number;
    storageEstimateKb: number;
  };
  activity: PlatformAuditLog[];
}

export const gyms = {
  list(session: Session, filter: { q?: string; status?: 'all' | 'active' | 'suspended'; dataMode?: 'all' | 'live' | 'demo'; packageId?: string } = {}): GymRow[] {
    requirePlatformAdmin(session);
    const q = (filter.q ?? '').trim().toLowerCase();
    return getDb().gyms
      .map(rowFor)
      .filter((r) => {
        if (filter.status && filter.status !== 'all' && r.gym.status !== filter.status) return false;
        if (filter.dataMode && filter.dataMode !== 'all' && r.gym.dataMode !== filter.dataMode) return false;
        if (filter.packageId && r.subscription?.packageId !== filter.packageId) return false;
        if (!q) return true;
        return r.gym.name.toLowerCase().includes(q)
          || r.gym.email.toLowerCase().includes(q)
          || (r.owner?.name.toLowerCase().includes(q) ?? false);
      })
      .sort((a, b) => Number(b.gym.dataMode === 'live') - Number(a.gym.dataMode === 'live')
        || a.gym.name.localeCompare(b.gym.name));
  },

  get(session: Session, gymId: string): GymDetail {
    requirePlatformAdmin(session);
    const db = getDb();
    const gym = db.gyms.find((g) => g.id === gymId);
    if (!gym) throw new NotFound('Customer not found.');
    const ent = entitlementsFor(gymId);
    const members = db.members.filter((m) => m.gymId === gymId);
    const payments = db.payments.filter((p) => p.gymId === gymId);

    const of = <T extends { gymId: string }>(rows: T[]) => rows.filter((r) => r.gymId === gymId).length;
    const memberIds = new Set(members.map((m) => m.id));

    return {
      ...rowFor(gym),
      members: members.slice().sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)),
      users: db.users.filter((u) => u.gymId === gymId),
      entitlements: entitlementList(ent),
      entitlementMap: ent,
      usage: {
        plans: of(db.plans),
        memberships: of(db.memberships),
        payments: payments.length,
        revenueAllTime: payments.reduce((s, p) => s + p.amount, 0),
        attendanceEvents: of(db.attendance),
        sessions: of(db.sessions),
        programs: of(db.programs),
        customExercises: db.exercises.filter(
          (e) => (e.scope === 'gym' && e.ownerId === gymId)
            || (e.scope === 'member' && e.ownerId && memberIds.has(e.ownerId))).length,
        memberWorkouts: of(db.workouts),
        dietPlans: of(db.dietPlans),
        expenses: of(db.expenses),
        messages: of(db.messages),
        storageEstimateKb: Math.round(estimateBytes(gymId) / 1024),
      },
      activity: db.platformAudit.filter((a) => a.gymId === gymId).slice(0, 40),
    };
  },

  create(session: Session, input: {
    name: string; ownerName: string; ownerEmail: string; phone?: string;
    address?: string; packageId?: string; status?: SubscriptionStatus;
  }) {
    requirePlatformAdmin(session);
    const db = getDb();
    const fields: Record<string, string> = {};
    if (!input.name?.trim()) fields.name = 'Give the gym a name.';
    if (!input.ownerName?.trim()) fields.ownerName = 'Who owns it?';
    const email = (input.ownerEmail ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.ownerEmail = 'Enter a valid email address.';
    else if (db.users.some((u) => u.email.trim().toLowerCase() === email)) {
      fields.ownerEmail = 'An account already uses that email.';
    }
    if (Object.keys(fields).length) throw new PlatformValidationError(fields);

    return write(() => {
      const gym = blankGym({
        name: input.name, email, phone: input.phone, address: input.address,
      });
      const pkgId = input.packageId
        ?? db.packages.find((p) => p.isDefault)?.id
        ?? db.packages[0]?.id;
      let owner!: User;
      commit((d) => {
        d.gyms.push(gym);
        owner = {
          id: newId('user'), gymId: gym.id, role: 'owner', name: input.ownerName.trim(),
          phone: input.phone?.trim() ?? '', email,
          authProvider: 'demo', authUid: `demo-${gym.slug}`,
        };
        d.users.push(owner);
        if (pkgId) {
          d.subscriptions.push({
            id: newId('sub'), gymId: gym.id, packageId: pkgId,
            status: input.status ?? 'trial', startedAt: todayISO(), renewsAt: null,
            notes: '', updatedAt: new Date().toISOString(),
          });
        }
        platformAudit(d, session, {
          action: 'gym.create', entity: 'Gym', entityId: gym.id,
          gymId: gym.id, gymName: gym.name,
          summary: `Created ${gym.name} for ${owner.name}`,
        });
      });
      return { gym, owner };
    });
  },

  update(session: Session, gymId: string, patch: Partial<Pick<Gym, 'name' | 'phone' | 'email' | 'address' | 'status'>>) {
    requirePlatformAdmin(session);
    return write(() => {
      let updated!: Gym;
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const before = gym.status;
        Object.assign(gym, {
          name: patch.name?.trim() || gym.name,
          phone: patch.phone ?? gym.phone,
          email: patch.email ?? gym.email,
          address: patch.address ?? gym.address,
          status: patch.status ?? gym.status,
        });
        platformAudit(d, session, {
          action: before !== gym.status ? `gym.${gym.status}` : 'gym.update',
          entity: 'Gym', entityId: gym.id, gymId: gym.id, gymName: gym.name,
          summary: before !== gym.status
            ? `${gym.status === 'suspended' ? 'Suspended' : 'Reactivated'} ${gym.name}`
            : `Updated ${gym.name} details`,
        });
        updated = gym;
      });
      return updated;
    });
  },

  remove(session: Session, gymId: string) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const memberIds = new Set(d.members.filter((m) => m.gymId === gymId).map((m) => m.id));
        const drop = <T extends { gymId: string }>(rows: T[]) => rows.filter((r) => r.gymId !== gymId);

        d.gyms = d.gyms.filter((g) => g.id !== gymId);
        d.users = d.users.filter((u) => u.gymId !== gymId);
        d.members = drop(d.members);
        d.plans = drop(d.plans);
        d.memberships = drop(d.memberships);
        d.payments = drop(d.payments);
        d.attendance = drop(d.attendance);
        d.programs = drop(d.programs);
        d.sessions = drop(d.sessions);
        d.measurements = drop(d.measurements);
        d.goals = drop(d.goals);
        d.water = drop(d.water);
        d.dietPlans = drop(d.dietPlans);
        d.mealCompletions = drop(d.mealCompletions);
        d.workouts = drop(d.workouts);
        d.expenses = drop(d.expenses);
        d.notes = drop(d.notes);
        d.messages = drop(d.messages);
        d.announcements = drop(d.announcements);
        d.audit = drop(d.audit);
        d.subscriptions = d.subscriptions.filter((s) => s.gymId !== gymId);
        d.overrides = d.overrides.filter((o) => o.gymId !== gymId);
        d.exercises = d.exercises.filter(
          (e) => !((e.scope === 'gym' && e.ownerId === gymId)
            || (e.scope === 'member' && e.ownerId && memberIds.has(e.ownerId))));

        platformAudit(d, session, {
          action: 'gym.delete', entity: 'Gym', entityId: gymId,
          gymId: null, gymName: gym.name,
          summary: `Deleted ${gym.name} and all of its data`,
        });
      });
    });
  },
};

function estimateBytes(gymId: string): number {
  const db = getDb();
  const of = <T extends { gymId: string }>(rows: T[]) => rows.filter((r) => r.gymId === gymId);
  const payload = {
    m: of(db.members), ms: of(db.memberships), p: of(db.payments),
    a: of(db.attendance), s: of(db.sessions), w: of(db.water),
    g: of(db.goals), e: of(db.expenses), pr: of(db.programs),
  };
  try { return JSON.stringify(payload).length; } catch { return 0; }
}

/* ============================================================
   Entitlements — the individual, per-customer control
   ============================================================ */

export const entitlements = {
  for(session: Session, gymId: string): Entitlement[] {
    requirePlatformAdmin(session);
    return entitlementList(entitlementsFor(gymId));
  },

  /**
   * Records an individual decision that beats the package.
   * Absence of a row means "inherit"; `enabled: false` means
   * "we decided against it". Those are different states and the
   * console shows both.
   */
  setOverride(session: Session, gymId: string, feature: string, enabled: boolean, reason = '') {
    requirePlatformAdmin(session);
    if (!isFeatureKey(feature)) throw new NotFound('Feature not found.');
    return write(() => {
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const now = new Date().toISOString();
        const existing = d.overrides.find((o) => o.gymId === gymId && o.feature === feature);
        if (existing) {
          existing.enabled = enabled;
          existing.reason = reason;
          existing.setAt = now;
          existing.setByUserId = session.userId;
        } else {
          d.overrides.push({
            id: newId('ovr'), gymId, feature, enabled, reason,
            setAt: now, setByUserId: session.userId,
          });
        }
        const def = FEATURE_CATALOG.find((f) => f.key === feature)!;
        platformAudit(d, session, {
          action: enabled ? 'feature.enable' : 'feature.disable',
          entity: 'FeatureOverride', entityId: `${gymId}:${feature}`,
          gymId, gymName: gym.name,
          summary: `${enabled ? 'Enabled' : 'Disabled'} ${def.name} for ${gym.name}`,
          meta: { feature, enabled, reason },
        });
      });
    });
  },

  /** Removes the individual decision so the package is followed again. */
  clearOverride(session: Session, gymId: string, feature: string) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const before = d.overrides.length;
        d.overrides = d.overrides.filter((o) => !(o.gymId === gymId && o.feature === feature));
        if (d.overrides.length === before) return;
        const def = FEATURE_CATALOG.find((f) => f.key === feature);
        platformAudit(d, session, {
          action: 'feature.inherit', entity: 'FeatureOverride', entityId: `${gymId}:${feature}`,
          gymId, gymName: gym.name,
          summary: `Removed the ${def?.name ?? feature} override for ${gym.name} — back to the package default`,
          meta: { feature },
        });
      });
    });
  },

  clearAll(session: Session, gymId: string) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const count = d.overrides.filter((o) => o.gymId === gymId).length;
        if (!count) return;
        d.overrides = d.overrides.filter((o) => o.gymId !== gymId);
        platformAudit(d, session, {
          action: 'feature.inherit_all', entity: 'FeatureOverride', entityId: gymId,
          gymId, gymName: gym.name,
          summary: `Cleared ${count} override${count === 1 ? '' : 's'} for ${gym.name}`,
        });
      });
    });
  },
};

/* ============================================================
   Subscriptions
   ============================================================ */

export const subscriptions = {
  setPackage(session: Session, gymId: string, packageId: string, status?: SubscriptionStatus) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const pkg = d.packages.find((p) => p.id === packageId);
        if (!pkg) throw new NotFound('Package not found.');
        const now = new Date().toISOString();
        const existing = d.subscriptions.find((s) => s.gymId === gymId);
        const fromName = existing
          ? d.packages.find((p) => p.id === existing.packageId)?.name ?? 'none'
          : 'none';
        if (existing) {
          existing.packageId = packageId;
          if (status) existing.status = status;
          existing.updatedAt = now;
        } else {
          d.subscriptions.push({
            id: newId('sub'), gymId, packageId, status: status ?? 'active',
            startedAt: todayISO(), renewsAt: null, notes: '', updatedAt: now,
          });
        }
        platformAudit(d, session, {
          action: 'subscription.package', entity: 'Subscription', entityId: gymId,
          gymId, gymName: gym.name,
          summary: `Moved ${gym.name} from ${fromName} to ${pkg.name}`,
          meta: { packageId, status },
        });
      });
    });
  },

  setStatus(session: Session, gymId: string, status: SubscriptionStatus) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const gym = d.gyms.find((g) => g.id === gymId);
        if (!gym) throw new NotFound('Customer not found.');
        const sub = d.subscriptions.find((s) => s.gymId === gymId);
        if (!sub) throw new NotFound('No subscription for that customer.');
        sub.status = status;
        sub.updatedAt = new Date().toISOString();
        platformAudit(d, session, {
          action: 'subscription.status', entity: 'Subscription', entityId: sub.id,
          gymId, gymName: gym.name,
          summary: `${gym.name} subscription set to ${status}`,
        });
      });
    });
  },

  setRenewal(session: Session, gymId: string, renewsAt: ISODate | null, notes?: string) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const sub = d.subscriptions.find((s) => s.gymId === gymId);
        if (!sub) throw new NotFound('No subscription for that customer.');
        sub.renewsAt = renewsAt;
        if (notes !== undefined) sub.notes = notes;
        sub.updatedAt = new Date().toISOString();
        const gym = d.gyms.find((g) => g.id === gymId);
        platformAudit(d, session, {
          action: 'subscription.renewal', entity: 'Subscription', entityId: sub.id,
          gymId, gymName: gym?.name ?? '',
          summary: `Renewal date for ${gym?.name ?? gymId} set to ${renewsAt ?? 'none'}`,
        });
      });
    });
  },
};

/* ============================================================
   Packages
   ============================================================ */

export const packages = {
  list(session: Session): Array<FeaturePackage & { gyms: number }> {
    requirePlatformAdmin(session);
    const db = getDb();
    return db.packages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ ...p, gyms: db.subscriptions.filter((s) => s.packageId === p.id).length }));
  },

  get(session: Session, id: string): FeaturePackage {
    requirePlatformAdmin(session);
    const pkg = getDb().packages.find((p) => p.id === id);
    if (!pkg) throw new NotFound('Package not found.');
    return pkg;
  },

  create(session: Session, input: { name: string; description?: string; features?: string[] }) {
    requirePlatformAdmin(session);
    const fields: Record<string, string> = {};
    if (!input.name?.trim()) fields.name = 'Give the package a name.';
    if (Object.keys(fields).length) throw new PlatformValidationError(fields);
    return write(() => {
      let pkg!: FeaturePackage;
      commit((d) => {
        const key = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        pkg = {
          id: newId('pkg'), key, name: input.name.trim(),
          description: input.description?.trim() ?? '',
          features: (input.features ?? []).filter(isFeatureKey),
          isDefault: false, isSystem: false,
          order: Math.max(0, ...d.packages.map((p) => p.order)) + 1,
          createdAt: new Date().toISOString(),
        };
        d.packages.push(pkg);
        platformAudit(d, session, {
          action: 'package.create', entity: 'FeaturePackage', entityId: pkg.id,
          summary: `Created the ${pkg.name} package`,
        });
      });
      return pkg;
    });
  },

  update(session: Session, id: string, patch: { name?: string; description?: string; features?: string[]; isDefault?: boolean }) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const pkg = d.packages.find((p) => p.id === id);
        if (!pkg) throw new NotFound('Package not found.');
        if (patch.name !== undefined) pkg.name = patch.name.trim() || pkg.name;
        if (patch.description !== undefined) pkg.description = patch.description;
        if (patch.features) pkg.features = patch.features.filter(isFeatureKey);
        if (patch.isDefault) {
          d.packages.forEach((p) => { p.isDefault = p.id === id; });
          d.settings.defaultPackageKey = pkg.key;
        }
        platformAudit(d, session, {
          action: 'package.update', entity: 'FeaturePackage', entityId: pkg.id,
          summary: `Updated the ${pkg.name} package`,
          meta: { features: pkg.features.length },
        });
      });
    });
  },

  /** Toggling one feature inside a package changes every customer inheriting it. */
  toggleFeature(session: Session, id: string, feature: string, on: boolean) {
    requirePlatformAdmin(session);
    if (!isFeatureKey(feature)) throw new NotFound('Feature not found.');
    return write(() => {
      commit((d) => {
        const pkg = d.packages.find((p) => p.id === id);
        if (!pkg) throw new NotFound('Package not found.');
        const has = pkg.features.includes(feature);
        if (on && !has) pkg.features.push(feature);
        if (!on && has) pkg.features = pkg.features.filter((f) => f !== feature);
        const def = FEATURE_CATALOG.find((f) => f.key === feature)!;
        const affected = d.subscriptions.filter((s) => s.packageId === id).length;
        platformAudit(d, session, {
          action: on ? 'package.feature_add' : 'package.feature_remove',
          entity: 'FeaturePackage', entityId: pkg.id,
          summary: `${on ? 'Added' : 'Removed'} ${def.name} ${on ? 'to' : 'from'} ${pkg.name} — ${affected} customer${affected === 1 ? '' : 's'} affected`,
          meta: { feature, on, affected },
        });
      });
    });
  },

  remove(session: Session, id: string) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const pkg = d.packages.find((p) => p.id === id);
        if (!pkg) throw new NotFound('Package not found.');
        if (d.subscriptions.some((s) => s.packageId === id)) {
          throw new PlatformValidationError({}, 'Move those customers to another package first.');
        }
        d.packages = d.packages.filter((p) => p.id !== id);
        platformAudit(d, session, {
          action: 'package.delete', entity: 'FeaturePackage', entityId: id,
          summary: `Deleted the ${pkg.name} package`,
        });
      });
    });
  },
};

/* ============================================================
   Feature catalog view
   ============================================================ */

export const features = {
  list(session: Session) {
    requirePlatformAdmin(session);
    const db = getDb();
    return FEATURE_CATALOG.map((def) => ({
      def,
      packages: db.packages.filter((p) => p.features.includes(def.key)).map((p) => p.name),
      gyms: db.gyms.filter((g) => entitlementsFor(g.id)[def.key]?.effective).length,
      overrides: db.overrides.filter((o) => o.feature === def.key),
    }));
  },
};

/* ============================================================
   Platform updates / announcements
   ============================================================ */

export const updates = {
  list(session: Session): PlatformUpdate[] {
    requirePlatformAdmin(session);
    return getDb().platformUpdates
      .slice()
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  },

  create(session: Session, input: { title: string; body: string; kind: PlatformUpdateKind; audience: PlatformUpdate['audience']; publish?: boolean }) {
    requirePlatformAdmin(session);
    const fields: Record<string, string> = {};
    if (!input.title?.trim()) fields.title = 'Give the update a title.';
    if (!input.body?.trim()) fields.body = 'Write the update.';
    if (Object.keys(fields).length) throw new PlatformValidationError(fields);
    return write(() => {
      let row!: PlatformUpdate;
      commit((d) => {
        const now = new Date().toISOString();
        row = {
          id: newId('pupd'), kind: input.kind, title: input.title.trim(),
          body: input.body.trim(), audience: input.audience,
          createdAt: now, publishedAt: input.publish ? now : null,
        };
        d.platformUpdates.unshift(row);
        platformAudit(d, session, {
          action: input.publish ? 'update.publish' : 'update.draft',
          entity: 'PlatformUpdate', entityId: row.id,
          summary: `${input.publish ? 'Published' : 'Drafted'} “${row.title}”`,
        });
      });
      return row;
    });
  },

  publish(session: Session, id: string, published: boolean) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const row = d.platformUpdates.find((u) => u.id === id);
        if (!row) throw new NotFound('Update not found.');
        row.publishedAt = published ? new Date().toISOString() : null;
        platformAudit(d, session, {
          action: published ? 'update.publish' : 'update.unpublish',
          entity: 'PlatformUpdate', entityId: id,
          summary: `${published ? 'Published' : 'Unpublished'} “${row.title}”`,
        });
      });
    });
  },

  remove(session: Session, id: string) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        const row = d.platformUpdates.find((u) => u.id === id);
        if (!row) throw new NotFound('Update not found.');
        d.platformUpdates = d.platformUpdates.filter((u) => u.id !== id);
        platformAudit(d, session, {
          action: 'update.delete', entity: 'PlatformUpdate', entityId: id,
          summary: `Deleted “${row.title}”`,
        });
      });
    });
  },
};

/** What an owner or member is allowed to see. No gate — it is published content. */
export function publishedUpdates(audience: 'owners' | 'members'): PlatformUpdate[] {
  return getDb().platformUpdates
    .filter((u) => u.publishedAt && (u.audience === 'everyone' || u.audience === audience))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

/* ============================================================
   Platform settings
   ============================================================ */

export const settings = {
  get(session: Session): PlatformSettings {
    requirePlatformAdmin(session);
    return getDb().settings;
  },
  update(session: Session, patch: Partial<PlatformSettings>) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        Object.assign(d.settings, patch);
        if (patch.defaultPackageKey) {
          d.packages.forEach((p) => { p.isDefault = p.key === patch.defaultPackageKey; });
        }
        platformAudit(d, session, {
          action: 'settings.update', entity: 'PlatformSettings', entityId: 'settings',
          summary: 'Updated platform settings',
          meta: patch as Record<string, unknown>,
        });
      });
    });
  },
};

/* ============================================================
   Audit
   ============================================================ */

export const audit = {
  list(session: Session, filter: { gymId?: string; q?: string; limit?: number } = {}): PlatformAuditLog[] {
    requirePlatformAdmin(session);
    const q = (filter.q ?? '').trim().toLowerCase();
    return getDb().platformAudit
      .filter((a) => (filter.gymId ? a.gymId === filter.gymId : true))
      .filter((a) => (q ? `${a.summary} ${a.action} ${a.gymName}`.toLowerCase().includes(q) : true))
      .slice(0, filter.limit ?? 200);
  },
};

/* ============================================================
   Demo data control
   ============================================================ */

export const demo = {
  status(session: Session) {
    requirePlatformAdmin(session);
    const db = getDb();
    const demoGyms = db.gyms.filter((g) => g.dataMode === 'demo');
    return {
      loaded: demoGyms.length > 0,
      gyms: demoGyms.length,
      members: db.members.filter((m) => demoGyms.some((g) => g.id === m.gymId)).length,
    };
  },
  load(session: Session) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        buildDemoWorkspace(d);
        platformAudit(d, session, {
          action: 'demo.load', entity: 'Demo', entityId: DEMO_GYM_ID,
          summary: 'Loaded the demonstration dataset',
        });
      });
    });
  },
  clear(session: Session) {
    requirePlatformAdmin(session);
    return write(() => {
      commit((d) => {
        clearDemoWorkspace(d);
        platformAudit(d, session, {
          action: 'demo.clear', entity: 'Demo', entityId: DEMO_GYM_ID,
          summary: 'Removed the demonstration dataset',
        });
      });
    });
  },
};
