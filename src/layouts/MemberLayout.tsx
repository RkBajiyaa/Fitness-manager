import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/ui/Icon';
import { Button, Avatar } from '../components/ui/primitives';
import { useApp, useData } from '../state/app';
import * as api from '../lib/api';
import type { FeatureKey } from '../lib/platform/catalog';

/**
 * The five tabs only exist if the gym has them. A member at a studio
 * without Diet gets four tabs, not a fifth that refuses to open.
 */
const TABS: Array<{ to: string; label: string; icon: IconName; end?: boolean; feature?: FeatureKey }> = [
  { to: '/member', label: 'Home', icon: 'home', end: true },
  { to: '/member/workout', label: 'Workout', icon: 'dumbbell', feature: 'workout_logging' },
  { to: '/member/progress', label: 'Progress', icon: 'activity', feature: 'progress_tracking' },
  { to: '/member/diet', label: 'Diet', icon: 'utensils', feature: 'diet_plans' },
  { to: '/member/profile', label: 'Profile', icon: 'user' },
];

/**
 * The member shell is an app, not a page: compact header, bottom tabs, and a
 * content column capped at 560px even on a 4K monitor — a training log does not
 * get better by being 1600px wide.
 */
export function MemberLayout() {
  const { session, storageDegraded, has } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const me = useData(() => {
    if (!session || !memberId) return null;
    try { return api.members.get(session, memberId); } catch { return null; }
  }, [memberId]);
  const gym = useData(() => {
    if (!session) return null;
    try { return api.gyms.current(session); } catch { return null; }
  }, [session?.gymId]);
  const active = useData(() => {
    if (!session || !memberId) return null;
    try { return api.sessions.active(session, memberId); } catch { return null; }
  }, [memberId]);

  const tabs = TABS.filter((t) => !t.feature || has(t.feature));

  return (
    <div className="mshell">
      <header className="mheader">
        <div className="mheader__inner">
          <Avatar name={me?.member.name ?? 'Member'} size="sm" />
          <div className="u-grow" style={{ minWidth: 0 }}>
            <div className="t-sm u-truncate" style={{ fontWeight: 620 }}>{me?.member.name}</div>
            <div className="t-xs t-faint u-truncate">{gym?.name}</div>
          </div>
          {has('personal_records') && (
            <Button size="sm" variant="ghost" icon="trophy"
              onClick={() => nav('/member/records')} aria-label="Personal records" />
          )}
        </div>
      </header>

      {storageDegraded && (
        <div style={{ background: 'var(--warning-soft)', padding: 'var(--s-2) var(--s-4)' }}>
          <div className="mcontent__inner t-xs" style={{ color: 'var(--warning)' }}>
            Local storage is full — changes made now will not survive a refresh.
          </div>
        </div>
      )}

      {active && (
        <button
          onClick={() => nav('/member/session')}
          style={{
            display: 'block', width: '100%', border: 0, cursor: 'pointer',
            background: 'var(--brand)', color: 'var(--brand-ink)',
            padding: 'var(--s-3) var(--s-4)',
          }}
        >
          <span className="mcontent__inner u-row u-gap-3" style={{ display: 'flex' }}>
            <Icon name="play" size={15} />
            <span className="t-sm u-grow" style={{ fontWeight: 560, textAlign: 'left' }}>
              Workout in progress — {active.title}
            </span>
            <Icon name="chevronRight" size={15} />
          </span>
        </button>
      )}

      <main className="mcontent">
        <div className="mcontent__inner"><Outlet /></div>
      </main>

      <nav className="bottomnav" aria-label="Primary">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="bottomnav__item">
            <span className="bottomnav__icon"><Icon name={t.icon} size={20} /></span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
