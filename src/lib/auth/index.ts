/* ============================================================
   The app talks to this module, never to an adapter directly.

   Production (docs/ARCHITECTURE.md §I.2):
     Firebase issues a token → the BACKEND verifies it → the uid
     maps to an internal User row → role and gymId are resolved
     FROM THE DATABASE → the three gates run.

   The browser never supplies role or gymId. It supplies an
   identity; the server decides everything else. That is why the
   demo adapter is safe to swap out — it produces the same
   identity shape a verified token will.
   ============================================================ */
import type { AuthAdapter } from './types';
import { demoAuthAdapter } from './demoAdapter';

export const authAdapter: AuthAdapter = demoAuthAdapter;

/** True while sign-in is backed by the development adapter. */
export const IS_DEMO_AUTH = authAdapter.id === 'demo';

export { AuthError } from './types';
export type { AuthIdentity, AuthAdapter, AuthErrorCode } from './types';
export { DEMO_CREDENTIALS } from './demoAdapter';
