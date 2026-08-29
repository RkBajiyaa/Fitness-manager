import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type { Role, Session } from '../lib/types';
import { getRevision, initDb, loadSession, makeSession, resetDatabase, saveSession, subscribe } from '../lib/db';
import { Icon } from '../components/ui/Icon';

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
   Toasts
   ============================================================ */
export type ToastTone = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; tone: ToastTone; title: string; message?: string }

/* ============================================================
   Confirmation
   ============================================================ */
interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

type Theme = 'light' | 'dark';

interface AppValue {
  session: Session | null;
  signIn: (role: Extract<Role, 'owner' | 'member'>) => void;
  signOut: () => void;
  toast: (tone: ToastTone, title: string, message?: string) => void;
  confirm: (req: ConfirmRequest) => Promise<boolean>;
  theme: Theme;
  toggleTheme: () => void;
  reseed: () => void;
}

const Ctx = createContext<AppValue | null>(null);

const THEME_KEY = 'gss.theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Seed + session resolve synchronously so the first paint is already correct
  // (no flash of the landing screen for someone who is mid-session).
  const [session, setSession] = useState<Session | null>(() => {
    initDb();
    return loadSession();
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const nextId = useRef(1);

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

  const value = useMemo<AppValue>(() => ({
    session,
    signIn: (role) => {
      const s = makeSession(role);
      saveSession(s);
      setSession(s);
    },
    signOut: () => { saveSession(null); setSession(null); },
    toast,
    confirm,
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    reseed: () => { resetDatabase(); toast('success', 'Demo data rebuilt', 'Every screen now reads from a fresh dataset.'); },
  }), [session, toast, confirm, theme]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {confirmReq && <ConfirmDialog req={confirmReq} onClose={closeConfirm} />}
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
                : t.tone === 'warning' ? 'var(--warning)' : 'var(--brand)',
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

/* ---------------- Confirmation dialog ---------------- */

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
                background: req.tone === 'danger' ? 'var(--critical-soft)' : 'var(--brand-soft)',
                color: req.tone === 'danger' ? 'var(--critical)' : 'var(--brand)',
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
