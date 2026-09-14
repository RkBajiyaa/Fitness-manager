import { Component, lazy, Suspense, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate,
} from 'react-router-dom';
import { AppProvider, useApp, useData } from './state/app';
import Landing from './pages/auth/Landing';
import SignIn from './pages/auth/SignIn';
import { OwnerLayout } from './layouts/OwnerLayout';
import { MemberLayout } from './layouts/MemberLayout';
import { PlatformLayout } from './layouts/PlatformLayout';
import { Button, SkeletonRows } from './components/ui/primitives';
import { Icon } from './components/ui/Icon';
import * as api from './lib/api';
import { featureDef, type FeatureKey } from './lib/platform/catalog';

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
const OwnerFeatures  = lazy(() => import('./pages/owner/Features'));
const OwnerSetup     = lazy(() => import('./pages/owner/Setup'));

const MemberHome       = lazy(() => import('./pages/member/Home'));
const MemberWorkout    = lazy(() => import('./pages/member/Workout'));
const MemberWorkouts   = lazy(() => import('./pages/member/Workouts'));
const WorkoutBuilder   = lazy(() => import('./pages/member/WorkoutBuilder'));
const SessionPlayer    = lazy(() => import('./pages/member/SessionPlayer'));
const ExerciseLibrary  = lazy(() => import('./pages/member/ExerciseLibrary'));
const MemberProgress   = lazy(() => import('./pages/member/Progress'));
const MemberRecords    = lazy(() => import('./pages/member/Records'));
const MemberDiet       = lazy(() => import('./pages/member/Diet'));
const MemberAttendance = lazy(() => import('./pages/member/Attendance'));
const MemberProfilePg  = lazy(() => import('./pages/member/Profile'));
const MemberWelcome    = lazy(() => import('./pages/member/Welcome'));

const PlatformDashboard = lazy(() => import('./pages/platform/Dashboard'));
const PlatformGyms      = lazy(() => import('./pages/platform/Gyms'));
const PlatformGymDetail = lazy(() => import('./pages/platform/GymDetail'));
const PlatformFeatures  = lazy(() => import('./pages/platform/Features'));
const PlatformPackages  = lazy(() => import('./pages/platform/Packages'));
const PlatformUpdates   = lazy(() => import('./pages/platform/Updates'));
const PlatformAudit     = lazy(() => import('./pages/platform/Audit'));
const PlatformSettings  = lazy(() => import('./pages/platform/Settings'));

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

function RequireRole({ role, children }: { role: 'owner' | 'member' | 'platform_admin'; children: ReactNode }) {
  const { session, gymSuspended } = useApp();
  const loc = useLocation();
  const signInPath = role === 'platform_admin' ? '/signin/admin' : `/signin/${role}`;

  if (!session) return <Navigate to={signInPath} replace state={{ from: loc.pathname }} />;
  if (session.role !== role) {
    return <Navigate to={homeFor(session.role)} replace />;
  }
  if (gymSuspended) return <Suspended />;
  return <>{children}</>;
}

function homeFor(role: string): string {
  return role === 'platform_admin' ? '/platform' : role === 'member' ? '/member' : '/owner';
}

/** Already signed in? Skip the sign-in screen. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session } = useApp();
  if (session) return <Navigate to={homeFor(session.role)} replace />;
  return <>{children}</>;
}

/* ============================================================
   Gate 2 at the routing layer.

   The navigation already hides what a gym is not entitled to;
   this stops a bookmarked or typed URL from reaching the screen
   anyway. The API enforces the same rule independently, so a
   screen that slipped through would still get nothing back.
   ============================================================ */
function RequireFeature({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { has } = useApp();
  if (!has(feature)) return <FeatureUnavailable feature={feature} />;
  return <>{children}</>;
}

/**
 * Some sections are unlocked by more than one entitlement — the
 * communication log opens for WhatsApp *or* Email. Without this the
 * route would be reachable by typing the URL even though the nav
 * hides it, which is exactly the hole the entitlement model exists
 * to close.
 */
function RequireAnyFeature({ features, label, children }: {
  features: FeatureKey[]; label?: string; children: ReactNode;
}) {
  const { has } = useApp();
  if (features.some((f) => has(f))) return <>{children}</>;
  return <FeatureUnavailable feature={features[0]} label={label} />;
}

function FeatureUnavailable({ feature, label }: { feature: FeatureKey; label?: string }) {
  const nav = useNavigate();
  const def = featureDef(feature);
  const name = label ?? def?.name ?? 'That module';
  return (
    <div className="card" style={{ padding: 'var(--s-8)', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <span style={{
        width: 48, height: 48, margin: '0 auto var(--s-4)', display: 'grid', placeItems: 'center',
        borderRadius: 'var(--r-lg)', background: 'var(--surface-3)', color: 'var(--text-2)',
      }}>
        <Icon name="lock" size={22} />
      </span>
      <h2 className="t-h2">{name} is not enabled</h2>
      <p className="t-sm t-muted u-mt-3" style={{ maxWidth: '44ch', margin: 'var(--s-3) auto 0' }}>
        This module is not part of your current plan, so it is not available in your
        workspace. Your Features page lists everything you do have.
      </p>
      <div className="u-row u-gap-3 u-mt-6" style={{ justifyContent: 'center' }}>
        <Button onClick={() => nav('/owner', { replace: true })}>Back to dashboard</Button>
        <Button variant="primary" icon="layers" onClick={() => nav('/owner/features')}>
          See my features
        </Button>
      </div>
    </div>
  );
}

function Suspended() {
  const { signOut } = useApp();
  return (
    <div className="auth">
      <div className="auth__main">
        <div className="auth__card u-center">
          <span style={{
            width: 48, height: 48, margin: '0 auto var(--s-4)', display: 'grid', placeItems: 'center',
            borderRadius: 'var(--r-lg)', background: 'var(--warning-soft)', color: 'var(--warning)',
          }}>
            <Icon name="ban" size={22} />
          </span>
          <h1 className="t-h2">This account is suspended</h1>
          <p className="t-sm t-muted u-mt-3">
            Your data is safe and nothing has been deleted. Contact Fitness Manager support
            to restore access.
          </p>
          <Button className="u-mt-6" variant="primary" block onClick={signOut}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Onboarding gates — redirect ONCE, never trap
   ============================================================ */

/** A brand-new gym lands in setup instead of an empty dashboard. */
function OwnerEntry() {
  const { session } = useApp();
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  if (gym && !gym.setup.completedAt && !gym.setup.dismissed) {
    return <Navigate to="/owner/setup" replace />;
  }
  return <RouteShell><Dashboard /></RouteShell>;
}

/** A member who has never been asked gets the welcome flow first. */
function MemberEntry() {
  const { session } = useApp();
  const me = useData(
    () => (session?.memberId ? api.members.get(session, session.memberId) : null),
    [session?.memberId],
  );
  if (me && !me.member.onboardedAt) return <Navigate to="/member/welcome" replace />;
  return <RouteShell><MemberHome /></RouteShell>;
}

function PageFallback() {
  return <div className="card" style={{ overflow: 'hidden' }}><SkeletonRows rows={5} /></div>;
}

/** Shorthand: a lazily-loaded owner route behind one entitlement. */
function Owned({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  return <RouteShell><RequireFeature feature={feature}>{children}</RequireFeature></RouteShell>;
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

          {/* ---------------- Platform console (internal) ---------------- */}
          <Route path="/platform" element={<RequireRole role="platform_admin"><PlatformLayout /></RequireRole>}>
            <Route index element={<RouteShell><PlatformDashboard /></RouteShell>} />
            <Route path="gyms" element={<RouteShell><PlatformGyms /></RouteShell>} />
            <Route path="gyms/:id" element={<RouteShell><PlatformGymDetail /></RouteShell>} />
            <Route path="features" element={<RouteShell><PlatformFeatures /></RouteShell>} />
            <Route path="packages" element={<RouteShell><PlatformPackages /></RouteShell>} />
            <Route path="updates" element={<RouteShell><PlatformUpdates /></RouteShell>} />
            <Route path="audit" element={<RouteShell><PlatformAudit /></RouteShell>} />
            <Route path="settings" element={<RouteShell><PlatformSettings /></RouteShell>} />
            <Route path="*" element={<UnknownRoute to="/platform" />} />
          </Route>

          {/* ---------------- Owner ---------------- */}
          {/* The setup wizard is full-screen — outside the studio shell. */}
          <Route
            path="/owner/setup"
            element={<RequireRole role="owner"><RouteShell><OwnerSetup /></RouteShell></RequireRole>}
          />

          <Route path="/owner" element={<RequireRole role="owner"><OwnerLayout /></RequireRole>}>
            <Route index element={<OwnerEntry />} />
            <Route path="attention" element={<Owned feature="member_management"><Attention /></Owned>} />
            <Route path="members" element={<Owned feature="member_management"><Members /></Owned>} />
            <Route path="members/new" element={<Owned feature="member_management"><AddMember /></Owned>} />
            <Route path="members/:id" element={<Owned feature="member_profiles"><MemberProfile /></Owned>} />
            <Route path="memberships" element={<Owned feature="memberships"><Memberships /></Owned>} />
            <Route path="plans" element={<Owned feature="membership_plans"><Plans /></Owned>} />
            <Route path="programs" element={<Owned feature="workout_programs"><Programs /></Owned>} />
            <Route path="exercises" element={<Owned feature="exercise_library"><OwnerExercises /></Owned>} />
            <Route path="payments" element={<Owned feature="payments"><Payments /></Owned>} />
            <Route path="attendance" element={<Owned feature="attendance"><Attendance /></Owned>} />
            <Route path="expenses" element={<Owned feature="expenses"><Expenses /></Owned>} />
            <Route path="revenue" element={<Owned feature="revenue"><Revenue /></Owned>} />
            <Route path="profit-loss" element={<Owned feature="revenue"><ProfitLoss /></Owned>} />
            <Route path="reports" element={<Owned feature="reports"><Reports /></Owned>} />
            <Route
              path="messages"
              element={(
                <RouteShell>
                  <RequireAnyFeature features={['whatsapp', 'email']} label="Communication">
                    <Messages />
                  </RequireAnyFeature>
                </RouteShell>
              )}
            />
            <Route path="features" element={<RouteShell><OwnerFeatures /></RouteShell>} />
            <Route path="settings" element={<RouteShell><Settings /></RouteShell>} />
            <Route path="*" element={<UnknownRoute to="/owner" />} />
          </Route>

          {/* ---------------- Member ---------------- */}
          <Route
            path="/member/welcome"
            element={<RequireRole role="member"><RouteShell><MemberWelcome /></RouteShell></RequireRole>}
          />

          <Route path="/member" element={<RequireRole role="member"><MemberLayout /></RequireRole>}>
            <Route index element={<MemberEntry />} />
            <Route path="workout" element={<Owned feature="workout_logging"><MemberWorkout /></Owned>} />
            <Route path="workouts" element={<Owned feature="workout_builder"><MemberWorkouts /></Owned>} />
            <Route path="workouts/new" element={<Owned feature="workout_builder"><WorkoutBuilder /></Owned>} />
            <Route path="workouts/:id" element={<Owned feature="workout_builder"><WorkoutBuilder /></Owned>} />
            <Route path="exercises" element={<Owned feature="exercise_library"><ExerciseLibrary /></Owned>} />
            <Route path="progress" element={<Owned feature="progress_tracking"><MemberProgress /></Owned>} />
            <Route path="records" element={<Owned feature="personal_records"><MemberRecords /></Owned>} />
            <Route path="diet" element={<Owned feature="diet_plans"><MemberDiet /></Owned>} />
            <Route path="attendance" element={<Owned feature="attendance"><MemberAttendance /></Owned>} />
            <Route path="profile" element={<RouteShell><MemberProfilePg /></RouteShell>} />
            <Route path="*" element={<UnknownRoute to="/member" />} />
          </Route>

          {/* The session player is full-screen — outside the member shell. */}
          <Route
            path="/member/session"
            element={(
              <RequireRole role="member">
                <RouteShell><RequireFeature feature="workout_logging"><SessionPlayer /></RequireFeature></RouteShell>
              </RequireRole>
            )}
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
