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
 * The member shell is an app, not a page: compact header, bottom tabs,
 * and a content column capped at 560px even on a 4K monitor — a training
 * log does not get better by being 1600px wide.
 */
export function MemberLayout() {
  const { session, theme, toggleTheme } = useApp();
  const nav = useNavigate();

  const me = useData(
    () => (session?.memberId ? api.members.get(session, session.memberId) : null),
    [session?.memberId],
  );
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);

  return (
    <div className="mshell">
      <header className="mheader">
        <div className="mheader__inner">
          <Avatar name={me?.member.name ?? 'Member'} size="sm" />
          <div className="u-grow" style={{ minWidth: 0 }}>
            <div className="t-sm u-truncate" style={{ fontWeight: 620 }}>{me?.member.name}</div>
            <div className="t-xs t-faint u-truncate">{gym?.name}</div>
          </div>
          <Button size="sm" variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon'}
            onClick={toggleTheme} aria-label="Toggle colour theme" />
          <Button size="sm" variant="ghost" icon="logout" onClick={() => nav('/')} aria-label="Switch role" />
        </div>
      </header>

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
