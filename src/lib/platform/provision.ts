/* ============================================================
   PROVISIONING (docs/ARCHITECTURE.md §M.8).

   Turning a verified identity into a workspace. This is the only
   path that creates a tenant outside the platform console, and it
   is what makes "Start fresh" mean something: a real, empty gym
   with the customer's own name on it — not a copy of somebody
   else's demo data.

   In production this runs SERVER-SIDE after the Firebase token is
   verified. The shape does not change; only where it executes.
   ============================================================ */
import type { AuthIdentity } from '../auth/types';
import type { Database, Gym, Member, PlatformAuditLog, User } from '../types';
import { commit, getDb, newId } from '../db';
import {
  blankGym, buildDemoWorkspace, clearDemoWorkspace, DEMO_GYM_ID,
} from '../seed';
import { PERSONAL_PACKAGE_KEY } from './packages';
import { todayISO } from '../date';

function systemAudit(db: Database, entry: {
  action: string; entity: string; entityId: string; summary: string;
  gymId?: string | null; gymName?: string;
}): void {
  const row: PlatformAuditLog = {
    id: `pau_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actorUserId: 'system',
    actorName: 'Self-serve sign-up',
    action: entry.action,
    gymId: entry.gymId ?? null,
    gymName: entry.gymName ?? '',
    entity: entry.entity,
    entityId: entry.entityId,
    summary: entry.summary,
  };
  db.platformAudit.unshift(row);
  if (db.platformAudit.length > 1000) db.platformAudit.length = 1000;
}

function packageIdFor(db: Database, key?: string): string | null {
  if (key) {
    const byKey = db.packages.find((p) => p.key === key);
    if (byKey) return byKey.id;
  }
  return db.packages.find((p) => p.isDefault)?.id ?? db.packages[0]?.id ?? null;
}

function attachSubscription(db: Database, gymId: string, packageKey?: string): void {
  const packageId = packageIdFor(db, packageKey);
  if (!packageId) return;
  db.subscriptions.push({
    id: newId('sub'), gymId, packageId,
    status: 'trial', startedAt: todayISO(), renewsAt: null,
    notes: 'Provisioned at sign-up.', updatedAt: new Date().toISOString(),
  });
}

/** True when the demonstration studios exist in the store. */
export function isDemoLoaded(): boolean {
  return getDb().gyms.some((g) => g.dataMode === 'demo');
}

export function demoModeEnabled(): boolean {
  return getDb().settings.demoModeEnabled;
}

export function selfServeEnabled(): boolean {
  return getDb().settings.selfServeSignupEnabled;
}

/**
 * Builds the demonstration workspace on first request, then returns.
 * Idempotent — "Explore with demo data" can be pressed any number of
 * times and no second copy appears.
 */
export function ensureDemoWorkspace(): void {
  if (isDemoLoaded()) return;
  commit((db) => {
    buildDemoWorkspace(db);
    systemAudit(db, {
      action: 'demo.load', entity: 'Demo', entityId: DEMO_GYM_ID,
      summary: 'Demonstration dataset loaded from the sign-in screen',
    });
  });
}

export function removeDemoWorkspace(): void {
  commit((db) => {
    clearDemoWorkspace(db);
    systemAudit(db, {
      action: 'demo.clear', entity: 'Demo', entityId: DEMO_GYM_ID,
      summary: 'Demonstration dataset removed',
    });
  });
}

export class ProvisionError extends Error {
  code = 'provision_failed' as const;
}

/** A brand-new studio with a brand-new owner. Nothing inside it yet. */
export function provisionOwnerWorkspace(
  identity: AuthIdentity,
  input: { gymName: string; ownerName?: string },
): { gym: Gym; user: User } {
  if (!selfServeEnabled()) {
    throw new ProvisionError('Self-serve sign-up is switched off for this platform.');
  }
  const email = identity.email.trim().toLowerCase();
  const db = getDb();
  if (db.users.some((u) => u.email.trim().toLowerCase() === email)) {
    throw new ProvisionError('An account already exists for that email.');
  }

  const gym = blankGym({ name: input.gymName, email });
  let user!: User;
  commit((d) => {
    d.gyms.push(gym);
    user = {
      id: newId('user'), gymId: gym.id, role: 'owner',
      name: (input.ownerName ?? identity.displayName ?? '').trim() || email.split('@')[0],
      phone: '', email,
      authProvider: 'demo', authUid: identity.uid,
    };
    d.users.push(user);
    attachSubscription(d, gym.id);
    systemAudit(d, {
      action: 'gym.signup', entity: 'Gym', entityId: gym.id,
      gymId: gym.id, gymName: gym.name,
      summary: `${user.name} signed up and created ${gym.name}`,
    });
  });
  return { gym, user };
}

/**
 * A member with no gym behind them.
 *
 * Every row in this product carries a gymId — that invariant is what
 * makes the tenant gate total. Rather than weaken it with a nullable
 * tenant, an independent member gets a `kind: 'personal'` workspace:
 * a real tenant containing exactly one person, entitled to the
 * fitness features and nothing else. If a studio adopts them later,
 * that is a migration, not a special case in every query.
 */
export function provisionMemberWorkspace(
  identity: AuthIdentity,
  input: { name: string },
): { gym: Gym; user: User; member: Member } {
  if (!selfServeEnabled()) {
    throw new ProvisionError('Self-serve sign-up is switched off for this platform.');
  }
  const email = identity.email.trim().toLowerCase();
  const db = getDb();
  if (db.users.some((u) => u.email.trim().toLowerCase() === email)) {
    throw new ProvisionError('An account already exists for that email.');
  }

  const name = input.name.trim() || identity.displayName || email.split('@')[0];
  const gym = blankGym({ name: `${name} — personal`, email, kind: 'personal' });
  let user!: User;
  let member!: Member;

  commit((d) => {
    d.gyms.push(gym);
    member = {
      id: newId('mem'), gymId: gym.id, memberCode: 'ME-0001',
      name, phone: '', email, dob: '', gender: 'other', address: '',
      emergencyContact: { name: '', phone: '', relation: '' },
      photoUrl: '', joinedAt: todayISO(), lifecycle: 'active',
      fitness: {
        goal: 'general_fitness', experience: 'beginner',
        preferredDays: [], waterTargetMl: 2500, weeklySessionTarget: 3, notes: '',
      },
      onboardedAt: null,
    };
    d.members.push(member);
    user = {
      id: newId('user'), gymId: gym.id, role: 'member', name,
      phone: '', email, memberId: member.id,
      authProvider: 'demo', authUid: identity.uid,
    };
    d.users.push(user);
    attachSubscription(d, gym.id, PERSONAL_PACKAGE_KEY);
    systemAudit(d, {
      action: 'member.signup', entity: 'Member', entityId: member.id,
      gymId: gym.id, gymName: gym.name,
      summary: `${name} signed up as an independent member`,
    });
  });

  return { gym, user, member };
}
