import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/ui/Icon';
import { Button, Avatar } from '../components/ui/primitives';
import { useApp, useData } from '../state/app';
import * as api from '../lib/api';

const TABS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/member', label: 'Home', icon: 'home', end: true },
  { to: '/member/workout', label: 'Workout', icon: 'dumbbell' },
  { to: '/member/progress', label: 'Progress', icon: 'activity' },
  { to: '/member/diet', label: 'Diet', icon: 'utensils' },
  { to: '/member/profile', label: 'Profile', icon: 'user' },
];

/**
 * The member shell is an app, not a page: compact header, bottom tabs, and a
 * content column capped at 560px even on a 4K monitor — a training log does not
 * get better by being 1600px wide.
 */
export function MemberLayout() {
  const { session, storageDegraded } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);
  const active = useData(() => (session && memberId ? api.sessions.active(session, memberId) : null), [memberId]);

  return (
    <div className="mshell">
      <header className="mheader">
        <div className="mheader__inner">
          <Avatar name={me?.member.name ?? 'Member'} size="sm" />
          <div className="u-grow" style={{ minWidth: 0 }}>
            <div className="t-sm u-truncate" style={{ fontWeight: 620 }}>{me?.member.name}</div>
            <div className="t-xs t-faint u-truncate">{gym?.name}</div>
          </div>
          <Button size="sm" variant="ghost" icon="trophy"
            onClick={() => nav('/member/records')} aria-label="Personal records" />
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
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="bottomnav__item">
            <span className="bottomnav__icon"><Icon name={t.icon} size={20} /></span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
