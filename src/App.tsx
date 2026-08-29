import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppProvider, useApp } from './state/app';
import { Landing } from './pages/Landing';
import { OwnerLayout } from './layouts/OwnerLayout';
import { MemberLayout } from './layouts/MemberLayout';
import { SkeletonRows } from './components/ui/primitives';

/* Route-level code splitting: the landing screen and the shell are all the
   first paint needs; every section arrives on demand. */
const Dashboard      = lazy(() => import('./pages/owner/Dashboard'));
const Members        = lazy(() => import('./pages/owner/Members'));
const AddMember      = lazy(() => import('./pages/owner/AddMember'));
const MemberProfile  = lazy(() => import('./pages/owner/MemberProfile'));
const Memberships    = lazy(() => import('./pages/owner/Memberships'));
const Plans          = lazy(() => import('./pages/owner/Plans'));
const Payments       = lazy(() => import('./pages/owner/Payments'));
const Attendance     = lazy(() => import('./pages/owner/Attendance'));
const Expenses       = lazy(() => import('./pages/owner/Expenses'));
const Revenue        = lazy(() => import('./pages/owner/Revenue'));
const ProfitLoss     = lazy(() => import('./pages/owner/ProfitLoss'));
const Reports        = lazy(() => import('./pages/owner/Reports'));
const Settings       = lazy(() => import('./pages/owner/Settings'));

const MemberHome       = lazy(() => import('./pages/member/Home'));
const MemberWorkout    = lazy(() => import('./pages/member/Workout'));
const MemberLogWorkout = lazy(() => import('./pages/member/LogWorkout'));
const MemberProgress   = lazy(() => import('./pages/member/Progress'));
const MemberDiet       = lazy(() => import('./pages/member/Diet'));
const MemberAttendance = lazy(() => import('./pages/member/Attendance'));
const MemberProfilePg  = lazy(() => import('./pages/member/Profile'));

function RequireRole({ role, children }: { role: 'owner' | 'member'; children: ReactNode }) {
  const { session } = useApp();
  const loc = useLocation();
  if (!session) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  if (session.role !== role) return <Navigate to={session.role === 'owner' ? '/owner' : '/member'} replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}><SkeletonRows rows={5} /></div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route path="/owner" element={<RequireRole role="owner"><OwnerLayout /></RequireRole>}>
            <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
            <Route path="members" element={<Suspense fallback={<PageFallback />}><Members /></Suspense>} />
            <Route path="members/new" element={<Suspense fallback={<PageFallback />}><AddMember /></Suspense>} />
            <Route path="members/:id" element={<Suspense fallback={<PageFallback />}><MemberProfile /></Suspense>} />
            <Route path="memberships" element={<Suspense fallback={<PageFallback />}><Memberships /></Suspense>} />
            <Route path="plans" element={<Suspense fallback={<PageFallback />}><Plans /></Suspense>} />
            <Route path="payments" element={<Suspense fallback={<PageFallback />}><Payments /></Suspense>} />
            <Route path="attendance" element={<Suspense fallback={<PageFallback />}><Attendance /></Suspense>} />
            <Route path="expenses" element={<Suspense fallback={<PageFallback />}><Expenses /></Suspense>} />
            <Route path="revenue" element={<Suspense fallback={<PageFallback />}><Revenue /></Suspense>} />
            <Route path="profit-loss" element={<Suspense fallback={<PageFallback />}><ProfitLoss /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          </Route>

          <Route path="/member" element={<RequireRole role="member"><MemberLayout /></RequireRole>}>
            <Route index element={<Suspense fallback={<PageFallback />}><MemberHome /></Suspense>} />
            <Route path="workout" element={<Suspense fallback={<PageFallback />}><MemberWorkout /></Suspense>} />
            <Route path="workout/log" element={<Suspense fallback={<PageFallback />}><MemberLogWorkout /></Suspense>} />
            <Route path="progress" element={<Suspense fallback={<PageFallback />}><MemberProgress /></Suspense>} />
            <Route path="diet" element={<Suspense fallback={<PageFallback />}><MemberDiet /></Suspense>} />
            <Route path="attendance" element={<Suspense fallback={<PageFallback />}><MemberAttendance /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<PageFallback />}><MemberProfilePg /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
