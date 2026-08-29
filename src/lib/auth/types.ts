/* ============================================================
   Authentication seam (docs/ARCHITECTURE.md §I).
   Screens depend on this interface only — never on an adapter.
   Swapping the demo adapter for Firebase changes no screen.
   ============================================================ */

export interface AuthIdentity {
  uid: string;
  email: string;
  displayName: string;
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_in_use'
  | 'weak_password'
  | 'invalid_email'
  | 'user_not_found'
  | 'unavailable';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface AuthAdapter {
  /** A label the UI can show, e.g. "Demo mode". */
  readonly id: 'demo' | 'firebase';
  signIn(email: string, password: string): Promise<AuthIdentity>;
  signOut(): Promise<void>;
  createAccount(email: string, password: string, displayName: string): Promise<AuthIdentity>;
  sendPasswordReset(email: string): Promise<void>;
  current(): AuthIdentity | null;
}
