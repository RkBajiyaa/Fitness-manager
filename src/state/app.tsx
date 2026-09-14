import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type { Role, Session } from '../lib/types';
import {
  featuresFor, getRevision, gymStatusFor, initDb, isPersistenceDegraded, loadSession,
  resetDatabase, resolveSession, saveSession, subscribe,
} from '../lib/db';
import { authAdapter, AuthError, DEMO_CREDENTIALS, type AuthIdentity } from '../lib/auth';
import {
  ensureDemoWorkspace, provisionMemberWorkspace, provisionOwnerWorkspace,
  ProvisionError,
} from '../lib/platform/provision';
import type { FeatureKey } from '../lib/platform/catalog';
import { Icon, type IconName } from '../components/ui/Icon';

/* ============================================================
   Reactive glue: any component reading through lib/api re-runs
   when the store's revision changes. One subscription, no
   per-entity cache to invalidate.
   ============================================================ */
export function useData<T>(compute: () => T, deps: unknown[] = []): T {
  const rev = useSyncExternalStore(subscribe, getRevision, getRevision);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(compute, [rev, ...deps]);
}

/* ============================================================
   Toasts & confirmation
   ============================================================ */
export type ToastTone = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; tone: ToastTone; title: string; message?: string }

interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

/* ============================================================
   Achievement moments (§50) — driven by real events only
   ============================================================ */
export interface CelebrationRequest {
  icon?: IconName;
  title: string;
  message?: string;
  stats?: Array<{ value: string; label: string }>;
  actionLabel?: string;
  onAction?: () => void;
}

type Theme = 'light' | 'dark';

export type SignInRole = 'owner' | 'member' | 'admin';

interface AppValue {
  session: Session | null;
  identity: AuthIdentity | null;
  authReady: boolean;
  signIn: (email: string, password: string, preferRole?: Role) => Promise<Session>;
  /** Materialises the demo workspace, then signs in as its owner or member. */
  exploreDemo: (role: 'owner' | 'member') => Promise<Session>;
  /** Start fresh: a brand-new, EMPTY gym owned by this person. */
  signUpOwner: (input: { email: string; password: string; name: string; gymName: string }) => Promise<Session>;
  /** Start fresh: an independent member with no history. */
  signUpMember: (input: { email: string; password: string; name: string }) => Promise<Session>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => void;
  toast: (tone: ToastTone, title: string, message?: string) => void;
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  celebrate: (req: CelebrationRequest) => void;
  theme: Theme;
  toggleTheme: () => void;
  storageDegraded: boolean;
  /* ---- entitlements, read straight from the store ---- */
  features: Set<FeatureKey>;
  has: (feature: FeatureKey) => boolean;
  gymSuspended: boolean;
  /** Wipes the store back to a bare platform. Development only. */
  hardReset: () => void;
}

const Ctx = createContext<AppValue | null>(null);

const THEME_KEY = 'fm.theme';

/** Light is the primary design (§7). Dark is opt-in, never inferred from the OS. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') return 'dark';
  } catch { /* ignore */ }
  return 'light';
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Seed + session resolve synchronously so the first paint is already correct.
  const [session, setSession] = useState<Session | null>(() => {
    initDb();
    return loadSession();
  });
  const [identity, setIdentity] = useState<AuthIdentity | null>(() => authAdapter.current());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [celebration, setCelebration] = useState<CelebrationRequest | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const nextId = useRef(1);

  // Re-reads on every store revision, like any other derived value.
  const storageDegraded = useData(() => isPersistenceDegraded());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toast = useCallback((tone: ToastTone, title: string, message?: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, tone, title, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback((req: ConfirmRequest) => {
    setConfirmReq(req);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const closeConfirm = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setConfirmReq(null);
  }, []);

  /**
   * Identity → session. The screen supplies credentials and nothing else;
   * role and gym are resolved from stored data (docs/ARCHITECTURE.md §I.2).
   */
  const adopt = useCallback((id: AuthIdentity, preferRole?: Role): Session => {
    const resolved = resolveSession(id, preferRole);
    if (!resolved) {
      throw new AuthError(
        'user_not_found',
        'That account is not linked to a gym yet. Ask your gym to add you as a member, or start fresh with your own workspace.',
      );
    }
    saveSession(resolved);
    setIdentity(id);
    setSession(resolved);
    return resolved;
  }, []);

  /**
   * Entitlements re-read on every store revision, exactly like any other
   * derived value. A feature switched off in the platform console reaches
   * the owner's navigation on their next render — no cache to invalidate.
   */
  const features = useData(
    () => (session && session.role !== 'platform_admin' ? featuresFor(session.gymId) : new Set<FeatureKey>()),
    [session?.gymId, session?.role],
  );
  const gymSuspended = useData(
    () => (session ? gymStatusFor(session) === 'suspended' : false),
    [session?.gymId, session?.role],
  );

  const has = useCallback(
    (feature: FeatureKey) => features.has(feature),
    [features],
  );

  const value = useMemo<AppValue>(() => ({
    session,
    identity,
    authReady: true,
    signIn: async (email, password, preferRole) =>
      adopt(await authAdapter.signIn(email, password), preferRole),

    exploreDemo: async (role) => {
      // Build the demonstration studios on first request, then sign in with
      // the documented development credentials.
      ensureDemoWorkspace();
      const cred = DEMO_CREDENTIALS.find((c) => c.role === role);
      if (!cred) throw new AuthError('user_not_found', 'No demo account for that role.');
      const id = await authAdapter.signIn(cred.email, cred.password);
      return adopt(id, role);
    },

    signUpOwner: async ({ email, password, name, gymName }) => {
      const id = await authAdapter.createAccount(email, password, name);
      try {
        provisionOwnerWorkspace(id, { gymName, ownerName: name });
      } catch (e) {
        if (e instanceof ProvisionError) throw new AuthError('email_in_use', e.message);
        throw e;
      }
      return adopt(id, 'owner');
    },

    signUpMember: async ({ email, password, name }) => {
      const id = await authAdapter.createAccount(email, password, name);
      try {
        provisionMemberWorkspace(id, { name });
      } catch (e) {
        if (e instanceof ProvisionError) throw new AuthError('email_in_use', e.message);
        throw e;
      }
      return adopt(id, 'member');
    },

    resetPassword: (email) => authAdapter.sendPasswordReset(email),
    signOut: () => {
      void authAdapter.signOut();
      saveSession(null);
      setIdentity(null);
      setSession(null);
    },
    toast,
    confirm,
    celebrate: setCelebration,
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    storageDegraded,
    features,
    has,
    gymSuspended,
    hardReset: () => {
      resetDatabase();
      saveSession(null);
      setIdentity(null);
      setSession(null);
      toast('success', 'Everything cleared', 'The store is back to a bare platform.');
    },
  }), [session, identity, toast, confirm, theme, adopt, storageDegraded, features, has, gymSuspended]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {confirmReq && <ConfirmDialog req={confirmReq} onClose={closeConfirm} />}
      {celebration && <Celebration req={celebration} onClose={() => setCelebration(null)} />}
    </Ctx.Provider>
  );
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}

/* ---------------- Toast region ---------------- */

const TOAST_ICON = {
  success: 'checkCircle', error: 'alert', warning: 'alert', info: 'info',
} as const;

function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <span
            className="toast__icon"
            style={{
              color: t.tone === 'success' ? 'var(--good)'
                : t.tone === 'error' ? 'var(--critical)'
                : t.tone === 'warning' ? 'var(--warning)' : 'var(--text-2)',
            }}
          >
            <Icon name={TOAST_ICON[t.tone]} size={17} />
          </span>
          <span className="u-grow">
            <span className="toast__title">{t.title}</span>
            {t.message && <div className="toast__msg">{t.message}</div>}
          </span>
          <button className="toast__close" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Confirmation ---------------- */

function ConfirmDialog({ req, onClose }: { req: ConfirmRequest; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="modal__grabber" />
        <div className="modal__head">
          <div className="u-row u-gap-3">
            <span
              style={{
                width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
                borderRadius: 'var(--r-md)',
                background: req.tone === 'danger' ? 'var(--critical-soft)' : 'var(--surface-3)',
                color: req.tone === 'danger' ? 'var(--critical)' : 'var(--text-2)',
              }}
            >
              <Icon name={req.tone === 'danger' ? 'alert' : 'info'} size={18} />
            </span>
            <h2 id="confirm-title" className="t-h2">{req.title}</h2>
          </div>
        </div>
        <div className="modal__body">
          <div className="t-body t-muted">{req.message}</div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--secondary" onClick={() => onClose(false)}>
            {req.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={ref}
            className={`btn ${req.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => onClose(true)}
          >
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Achievement moment ---------------- */

function Celebration({ req, onClose }: { req: CelebrationRequest; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="celebrate__card">
        <div className="celebrate__badge">
          <Icon name={req.icon ?? 'trophy'} size={34} strokeWidth={1.6} />
        </div>
        <h2 id="celebrate-title" className="celebrate__title">{req.title}</h2>
        {req.message && <p className="celebrate__sub">{req.message}</p>}

        {req.stats && req.stats.length > 0 && (
          <div className="celebrate__stats">
            {req.stats.map((s) => (
              <div key={s.label}>
                <div className="celebrate__stat-value u-num">{s.value}</div>
                <div className="celebrate__stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <button
          ref={ref}
          className="btn btn--primary btn--block btn--lg"
          onClick={() => { req.onAction?.(); onClose(); }}
        >
          {req.actionLabel ?? 'Done'}
        </button>
      </div>
    </div>
  );
}
