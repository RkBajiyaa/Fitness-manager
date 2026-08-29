import { Component, lazy, Suspense, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate,
} from 'react-router-dom';
import { AppProvider, useApp } from './state/app';
import Landing from './pages/auth/Landing';
import SignIn from './pages/auth/SignIn';
import { OwnerLayout } from './layouts/OwnerLayout';
import { MemberLayout } from './layouts/MemberLayout';
import { Button, SkeletonRows } from './components/ui/primitives';
import { Icon } from './components/ui/Icon';

/* Route-level code splitting. */
const Dashboard      = lazy(() => import('./pages/owner/Dashboard'));
const Attention      = lazy(() => import('./pages/owner/Attention'));
const Members        = lazy(() => import('./pages/owner/Members'));
const AddMember      = lazy(() => import('./pages/owner/AddMember'));
const MemberProfile  = lazy(() => import('./pages/owner/MemberProfile'));
const Memberships    = lazy(() => import('./pages/owner/Memberships'));
const Plans          = lazy(() => import('./pages/owner/Plans'));
const Programs       = lazy(() => import('./pages/owner/Programs'));
const OwnerExercises = lazy(() => import('./pages/owner/Exercises'));
const Payments       = lazy(() => import('./pages/owner/Payments'));
const Attendance     = lazy(() => import('./pages/owner/Attendance'));
const Expenses       = lazy(() => import('./pages/owner/Expenses'));
const Revenue        = lazy(() => import('./pages/owner/Revenue'));
const ProfitLoss     = lazy(() => import('./pages/owner/ProfitLoss'));
const Reports        = lazy(() => import('./pages/owner/Reports'));
const Messages       = lazy(() => import('./pages/owner/Messages'));
const Settings       = lazy(() => import('./pages/owner/Settings'));

const MemberHome       = lazy(() => import('./pages/member/Home'));
const MemberWorkout    = lazy(() => import('./pages/member/Workout'));
const SessionPlayer    = lazy(() => import('./pages/member/SessionPlayer'));
const ExerciseLibrary  = lazy(() => import('./pages/member/ExerciseLibrary'));
const MemberProgress   = lazy(() => import('./pages/member/Progress'));
const MemberRecords    = lazy(() => import('./pages/member/Records'));
const MemberDiet       = lazy(() => import('./pages/member/Diet'));
const MemberAttendance = lazy(() => import('./pages/member/Attendance'));
const MemberProfilePg  = lazy(() => import('./pages/member/Profile'));

/* ============================================================
   Error boundary.

   A lazily-loaded route chunk can fail to arrive — a dev-server
   restart, a redeploy that invalidates hashed filenames, or a
   dropped connection mid-navigation. Without a boundary that
   kills the subtree and leaves a blank screen. With one, the
   user gets an explanation and a working recovery.
   ============================================================ */
interface BoundaryState { error: Error | null }

class RouteErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Fitness Manager] Route failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    // A failed dynamic import means the chunk is stale or unreachable.
    const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i
      .test(this.state.error.message);

    return (
      <div className="card" style={{ padding: 'var(--s-8)', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <span
          style={{
            width: 48, height: 48, margin: '0 auto var(--s-4)', display: 'grid', placeItems: 'center',
            borderRadius: 'var(--r-lg)', background: 'var(--surface-3)', color: 'var(--text-2)',
          }}
        >
          <Icon name="alert" size={22} />
        </span>
        <h2 className="t-h2">
          {isChunkError ? 'This section could not load' : 'Something went wrong'}
        </h2>
        <p className="t-sm t-muted u-mt-3" style={{ maxWidth: '44ch', margin: 'var(--s-3) auto 0' }}>
          {isChunkError
            ? 'The app was updated while you were using it, so part of it is out of date. Reloading picks up the new version.'
            : 'That screen hit an unexpected error. Your data is safe — nothing was lost.'}
        </p>
        <div className="u-row u-gap-3 u-mt-6" style={{ justifyContent: 'center' }}>
          <Button onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Try again
          </Button>
          <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}

/** Resets the boundary whenever the route changes. */
function RouteShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <RouteErrorBoundary key={loc.pathname} onReset={() => nav(loc.pathname, { replace: true })}>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

/** Navigating should land you at the top, as a page load would. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    document.querySelector('.content')?.scrollTo?.({ top: 0 });
  }, [pathname]);
  return null;
}

function RequireRole({ role, children }: { role: 'owner' | 'member'; children: ReactNode }) {
  const { session } = useApp();
  const loc = useLocation();
  if (!session) return <Navigate to={`/signin/${role}`} replace state={{ from: loc.pathname }} />;
  if (session.role !== role) return <Navigate to={session.role === 'owner' ? '/owner' : '/member'} replace />;
  return <>{children}</>;
}

/** Already signed in? Skip the sign-in screen. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session } = useApp();
  if (session) return <Navigate to={session.role === 'owner' ? '/owner' : '/member'} replace />;
  return <>{children}</>;
}

function PageFallback() {
  return <div className="card" style={{ overflow: 'hidden' }}><SkeletonRows rows={5} /></div>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
          <Route path="/signin/:role" element={<RedirectIfAuthed><SignIn /></RedirectIfAuthed>} />
          <Route path="/signin" element={<Navigate to="/signin/member" replace />} />

          <Route path="/owner" element={<RequireRole role="owner"><OwnerLayout /></RequireRole>}>
            <Route index element={<RouteShell><Dashboard /></RouteShell>} />
            <Route path="attention" element={<RouteShell><Attention /></RouteShell>} />
            <Route path="members" element={<RouteShell><Members /></RouteShell>} />
            <Route path="members/new" element={<RouteShell><AddMember /></RouteShell>} />
            <Route path="members/:id" element={<RouteShell><MemberProfile /></RouteShell>} />
            <Route path="memberships" element={<RouteShell><Memberships /></RouteShell>} />
            <Route path="plans" element={<RouteShell><Plans /></RouteShell>} />
            <Route path="programs" element={<RouteShell><Programs /></RouteShell>} />
            <Route path="exercises" element={<RouteShell><OwnerExercises /></RouteShell>} />
            <Route path="payments" element={<RouteShell><Payments /></RouteShell>} />
            <Route path="attendance" element={<RouteShell><Attendance /></RouteShell>} />
            <Route path="expenses" element={<RouteShell><Expenses /></RouteShell>} />
            <Route path="revenue" element={<RouteShell><Revenue /></RouteShell>} />
            <Route path="profit-loss" element={<RouteShell><ProfitLoss /></RouteShell>} />
            <Route path="reports" element={<RouteShell><Reports /></RouteShell>} />
            <Route path="messages" element={<RouteShell><Messages /></RouteShell>} />
            <Route path="settings" element={<RouteShell><Settings /></RouteShell>} />
            <Route path="*" element={<UnknownRoute to="/owner" />} />
          </Route>

          <Route path="/member" element={<RequireRole role="member"><MemberLayout /></RequireRole>}>
            <Route index element={<RouteShell><MemberHome /></RouteShell>} />
            <Route path="workout" element={<RouteShell><MemberWorkout /></RouteShell>} />
            <Route path="exercises" element={<RouteShell><ExerciseLibrary /></RouteShell>} />
            <Route path="progress" element={<RouteShell><MemberProgress /></RouteShell>} />
            <Route path="records" element={<RouteShell><MemberRecords /></RouteShell>} />
            <Route path="diet" element={<RouteShell><MemberDiet /></RouteShell>} />
            <Route path="attendance" element={<RouteShell><MemberAttendance /></RouteShell>} />
            <Route path="profile" element={<RouteShell><MemberProfilePg /></RouteShell>} />
            <Route path="*" element={<UnknownRoute to="/member" />} />
          </Route>

          {/* The session player is full-screen — outside the member shell. */}
          <Route
            path="/member/session"
            element={<RequireRole role="member"><RouteShell><SessionPlayer /></RouteShell></RequireRole>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

/** An unknown path inside a shell explains itself rather than dumping the user out. */
function UnknownRoute({ to }: { to: string }) {
  const nav = useNavigate();
  return (
    <div className="card" style={{ padding: 'var(--s-8)', textAlign: 'center' }}>
      <h2 className="t-h2">Page not found</h2>
      <p className="t-sm t-muted u-mt-3">That link does not point anywhere in Fitness Manager.</p>
      <Button className="u-mt-5" variant="primary" onClick={() => nav(to, { replace: true })}>
        Go back
      </Button>
    </div>
  );
}
