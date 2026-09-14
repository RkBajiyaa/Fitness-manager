/* ============================================================
   PERMISSIONS (docs/ARCHITECTURE.md §M.4).

   A permission answers "may THIS ROLE do this?" — nothing else.
   It is deliberately independent of entitlement:

     entitlement  gym-level   "is Payments available here at all?"
     permission   role-level  "may a Receptionist record one?"

   Both must pass. A gym on a package without Payments has no
   payment screens for anyone; a gym that has Payments still does
   not let a Trainer touch them.

   All six roles are defined here even though only three are
   exposed as products today. Adding Manager / Trainer / Reception
   later is then a routing and screens job, not a security
   redesign.
   ============================================================ */
import type { Role } from '../types';

/** `area:action`. `*` and `area:*` wildcards are supported. */
export type Capability = string;

export interface RoleDef {
  role: Role;
  name: string;
  description: string;
  /** Exposed as a sign-in destination in this build. */
  exposed: boolean;
  capabilities: Capability[];
}

export const ROLE_DEFS: RoleDef[] = [
  {
    role: 'platform_admin', name: 'Platform Admin', exposed: true,
    description: 'Us. Manages customers, packages and feature entitlements. Sees no gym’s member data.',
    capabilities: ['platform:*'],
  },
  {
    role: 'owner', name: 'Gym Owner', exposed: true,
    description: 'Full control of their own gym, limited only by what the platform has entitled.',
    capabilities: ['*'],
  },
  {
    role: 'manager', name: 'Manager', exposed: false,
    description: 'Runs the floor day to day. Everything operational, but not gym settings or entitlements.',
    capabilities: [
      'members:*', 'memberships:*', 'payments:*', 'attendance:*', 'programs:*',
      'exercises:*', 'notes:*', 'messages:send', 'reports:read', 'revenue:read',
      'expenses:read', 'diet:*', 'measurements:*', 'workouts:read',
    ],
  },
  {
    role: 'trainer', name: 'Trainer', exposed: false,
    description: 'Coaches assigned members. Training and diet, never money.',
    capabilities: [
      'members:read', 'attendance:*', 'programs:*', 'exercises:write', 'workouts:read',
      'diet:*', 'measurements:*', 'notes:*',
    ],
  },
  {
    role: 'reception', name: 'Reception', exposed: false,
    description: 'Front desk. Sells and renews memberships, records payments, marks attendance.',
    capabilities: [
      'members:read', 'members:write', 'memberships:*', 'payments:write', 'payments:read',
      'attendance:*',
    ],
  },
  {
    role: 'member', name: 'Member', exposed: true,
    description: 'Their own training, progress, diet and profile. Nothing of anyone else’s.',
    capabilities: ['self:*'],
  },
];

const BY_ROLE = new Map(ROLE_DEFS.map((r) => [r.role, r]));

export function roleDef(role: Role): RoleDef | undefined {
  return BY_ROLE.get(role);
}

export function roleName(role: Role): string {
  return BY_ROLE.get(role)?.name ?? role;
}

export function capabilitiesFor(role: Role): Capability[] {
  return BY_ROLE.get(role)?.capabilities ?? [];
}

/** Wildcard-aware capability match. `members:*` covers `members:read`. */
export function roleCan(role: Role, capability: Capability): boolean {
  return capabilitiesFor(role).some((granted) =>
    granted === '*'
    || granted === capability
    || (granted.endsWith(':*') && capability.startsWith(granted.slice(0, -1))));
}

/** Roles with full control of a gym's own configuration. */
export const GYM_ADMIN_ROLES: Role[] = ['owner', 'manager'];
