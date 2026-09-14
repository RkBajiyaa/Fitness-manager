/* ============================================================
   ⚠️  DEVELOPMENT ONLY — THIS IS NOT SECURITY.  ⚠️

   There is no hashing, no token, no signature and no expiry.
   This file exists so the sign-in flow can be demonstrated
   before Firebase Authentication is wired up, and it is built
   to be DELETED IN ONE COMMIT.

   Do not copy this pattern near production. Do not add real
   accounts here. See docs/ARCHITECTURE.md §I.3.
   ============================================================ */
import { AuthError, type AuthAdapter, type AuthIdentity } from './types';

const IDENTITY_KEY = 'fm.auth.identity.dev';

/** Development credentials. Replaced wholesale by Firebase. */
export const DEMO_CREDENTIALS = [
  {
    uid: 'demo-admin',
    email: 'admin@fitnessmanager.demo',
    password: 'DemoAdmin123!',
    displayName: 'Platform Admin',
    role: 'platform_admin' as const,
  },
  {
    uid: 'demo-owner',
    email: 'owner@fitnessmanager.demo',
    password: 'DemoOwner123!',
    displayName: 'Owner',
    role: 'owner' as const,
  },
  {
    uid: 'demo-member',
    email: 'member@fitnessmanager.demo',
    password: 'DemoMember123!',
    displayName: 'Member',
    role: 'member' as const,
  },
];

/** Accounts created during the session — in memory only. */
const created = new Map<string, { uid: string; email: string; password: string; displayName: string }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const delay = <T,>(value: T, ms = 240): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function read(): AuthIdentity | null {
  try {
    const raw = sessionStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as AuthIdentity) : null;
  } catch { return null; }
}

function persist(identity: AuthIdentity | null): void {
  try {
    if (identity) sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    else sessionStorage.removeItem(IDENTITY_KEY);
  } catch { /* private mode — the session still works in memory */ }
}

export const demoAuthAdapter: AuthAdapter = {
  id: 'demo',

  async signIn(email, password) {
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) {
      throw new AuthError('invalid_email', 'Enter a valid email address.');
    }
    const demo = DEMO_CREDENTIALS.find((c) => c.email === normalised);
    const custom = created.get(normalised);

    let match: AuthIdentity | null = null;
    if (demo && demo.password === password) {
      match = { uid: demo.uid, email: demo.email, displayName: demo.displayName };
    } else if (custom && custom.password === password) {
      match = { uid: custom.uid, email: custom.email, displayName: custom.displayName };
    }
    if (!match) throw new AuthError('invalid_credentials', 'That email and password do not match.');

    const identity = await delay(match);
    persist(identity);
    return identity;
  },

  async signOut() {
    persist(null);
    await delay(undefined, 60);
  },

  async createAccount(email, password, displayName) {
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) {
      throw new AuthError('invalid_email', 'Enter a valid email address.');
    }
    if (password.length < 8) {
      throw new AuthError('weak_password', 'Use at least 8 characters.');
    }
    if (DEMO_CREDENTIALS.some((c) => c.email === normalised) || created.has(normalised)) {
      throw new AuthError('email_in_use', 'An account already exists for that email.');
    }
    const identity: AuthIdentity = {
      uid: `demo-${Date.now().toString(36)}`,
      email: normalised,
      displayName: displayName.trim() || normalised.split('@')[0],
    };
    created.set(normalised, { ...identity, password });
    persist(identity);
    return delay(identity);
  },

  async sendPasswordReset(email) {
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) {
      throw new AuthError('invalid_email', 'Enter a valid email address.');
    }
    // Deliberately does not reveal whether the account exists.
    await delay(undefined, 400);
  },

  current: read,
};
