import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, type IconName } from '../components/ui/Icon';
import { Button } from '../components/ui/primitives';
import { useApp, useData } from '../state/app';
import * as api from '../lib/api';
import { moneyCompact } from '../lib/format';

interface NavEntry { to: string; label: string; icon: IconName; end?: boolean }

const GROUPS: Array<{ label: string; items: NavEntry[] }> = [
  { label: 'Overview', items: [
    { to: '/owner', label: 'Dashboard', icon: 'dashboard', end: true },
  ] },
  { label: 'People', items: [
    { to: '/owner/members', label: 'Members', icon: 'users' },
    { to: '/owner/memberships', label: 'Memberships', icon: 'card' },
    { to: '/owner/attendance', label: 'Attendance', icon: 'calendarCheck' },
  ] },
  { label: 'Money', items: [
    { to: '/owner/payments', label: 'Payments', icon: 'wallet' },
    { to: '/owner/expenses', label: 'Expenses', icon: 'receipt' },
    { to: '/owner/revenue', label: 'Revenue', icon: 'trendingUp' },
    { to: '/owner/profit-loss', label: 'Profit & Loss', icon: 'chart' },
  ] },
  { label: 'Business', items: [
    { to: '/owner/reports', label: 'Reports', icon: 'pie' },
    { to: '/owner/plans', label: 'Plans', icon: 'layers' },
    { to: '/owner/settings', label: 'Settings', icon: 'settings' },
  ] },
];

const BOTTOM: NavEntry[] = [
  { to: '/owner', label: 'Home', icon: 'dashboard', end: true },
  { to: '/owner/members', label: 'Members', icon: 'users' },
  { to: '/owner/payments', label: 'Payments', icon: 'wallet' },
  { to: '/owner/attendance', label: 'Attendance', icon: 'calendarCheck' },
];

export function OwnerLayout() {
  const { session, signOut, theme, toggleTheme } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [more, setMore] = useState(false);

  useEffect(() => { setMore(false); }, [loc.pathname]);

  const kpis = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);

  const dueBadge = kpis && kpis.pendingCount > 0 ? kpis.pendingCount : undefined;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo size={30} />
          <div className="u-grow" style={{ minWidth: 0 }}>
            <div className="t-sm u-truncate" style={{ fontWeight: 620 }}>{gym?.name}</div>
            <div className="t-xs t-faint">Owner workspace</div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {GROUPS.map((g) => (
            <div className="sidebar__group" key={g.label}>
              <div className="sidebar__grouplabel">{g.label}</div>
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="navitem">
                  <Icon name={item.icon} size={17} />
                  {item.label}
                  {item.to === '/owner/payments' && dueBadge && (
                    <span className="navitem__badge">{dueBadge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="u-row u-gap-2">
            <Button size="sm" variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon'}
              onClick={toggleTheme} aria-label="Toggle colour theme" />
            <Button size="sm" variant="ghost" icon="logout" className="u-grow"
              onClick={() => { signOut(); nav('/'); }} style={{ justifyContent: 'flex-start' }}>
              Switch role
            </Button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="only-mobile u-row u-gap-2">
            <Logo size={26} />
            <span className="t-sm u-truncate" style={{ fontWeight: 620, maxWidth: '42vw' }}>{gym?.name}</span>
          </span>

          <span className="hide-mobile u-grow" style={{ maxWidth: 380 }}>
            <OwnerQuickSearch />
          </span>

          <span className="u-grow" />

          {kpis && (
            <span className="hide-mobile u-row u-gap-4 t-xs t-muted u-nowrap" style={{ marginRight: 4 }}>
              <span>Today <strong className="u-num" style={{ color: 'var(--text-1)' }}>{moneyCompact(kpis.revenueToday)}</strong></span>
              <span className="t-faint">·</span>
              <span>Inside <strong className="u-num" style={{ color: 'var(--text-1)' }}>
                {kpis.insideNow == null ? '—' : kpis.insideNow}
              </strong></span>
            </span>
          )}

          <Button className="only-mobile" size="sm" variant="ghost" icon="search"
            onClick={() => nav('/owner/members')} aria-label="Search members" />
          <Button size="sm" variant="primary" icon="plus" onClick={() => nav('/owner/members/new')}>
            <span className="hide-mobile">Add member</span>
          </Button>
        </header>

        <main className="content">
          <div className="content__inner"><Outlet /></div>
        </main>
      </div>

      <nav className="bottomnav" aria-label="Primary">
        {BOTTOM.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="bottomnav__item">
            <span className="bottomnav__icon"><Icon name={item.icon} size={20} /></span>
            {item.label}
          </NavLink>
        ))}
        <button className="bottomnav__item" onClick={() => setMore(true)} aria-expanded={more}>
          <span className="bottomnav__icon"><Icon name="more" size={20} /></span>
          More
        </button>
      </nav>

      {more && (
        <>
          <div className="drawer-scrim" onClick={() => setMore(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="More sections">
            <div className="modal__grabber" />
            <div className="u-between u-mt-3 u-mb-3">
              <h2 className="t-h2">All sections</h2>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setMore(false)} aria-label="Close" />
            </div>
            {GROUPS.map((g) => (
              <div key={g.label} className="u-mb-4">
                <div className="sidebar__grouplabel">{g.label}</div>
                {g.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className="navitem">
                    <Icon name={item.icon} size={17} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <hr className="divider u-mb-3" />
            <div className="u-row u-gap-2">
              <Button variant="secondary" icon={theme === 'dark' ? 'sun' : 'moon'} onClick={toggleTheme} className="u-grow">
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </Button>
              <Button variant="secondary" icon="logout" className="u-grow"
                onClick={() => { signOut(); nav('/'); }}>
                Switch role
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Type-ahead over members — the desktop owner's fastest path to one person. */
function OwnerQuickSearch() {
  const { session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const results = useData(
    () => (session && q.trim().length >= 2
      ? api.members.list(session, { q, limit: 6 }).data
      : []),
    [session?.gymId, q],
  );

  return (
    <div style={{ position: 'relative' }}>
      <span className="field__wrap">
        <span className="field__prefix" aria-hidden="true"><Icon name="search" size={16} /></span>
        <input
          className="input input--prefix"
          style={{ minHeight: 36 }}
          placeholder="Search members by name, phone or ID"
          aria-label="Search members"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) nav(`/owner/members/${results[0].member.id}`);
            if (e.key === 'Escape') setOpen(false);
          }}
        />
      </span>
      {open && q.trim().length >= 2 && (
        <div
          className="card"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, boxShadow: 'var(--shadow-3)', overflow: 'hidden' }}
        >
          {results.length === 0 ? (
            <div className="t-sm t-faint" style={{ padding: 'var(--s-4)' }}>No member matches “{q}”.</div>
          ) : results.map((r) => (
            <button
              key={r.member.id}
              className="cardlist__item"
              onMouseDown={() => nav(`/owner/members/${r.member.id}`)}
            >
              <span className="u-grow u-truncate">
                <span className="t-sm" style={{ fontWeight: 560 }}>{r.member.name}</span>
                <span className="t-xs t-faint" style={{ marginLeft: 8 }}>{r.member.memberCode}</span>
              </span>
              <Icon name="chevronRight" size={15} className="t-faint" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
