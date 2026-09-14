import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, type IconName } from '../components/ui/Icon';
import { Button } from '../components/ui/primitives';
import { useApp, useData } from '../state/app';
import * as api from '../lib/api';
import { count } from '../lib/format';

interface NavEntry { to: string; label: string; icon: IconName; end?: boolean }

const NAV: Array<{ label: string; items: NavEntry[] }> = [
  { label: 'Platform', items: [
    { to: '/platform', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/platform/gyms', label: 'Customers', icon: 'building' },
  ] },
  { label: 'Configuration', items: [
    { to: '/platform/features', label: 'Feature catalog', icon: 'layers' },
    { to: '/platform/packages', label: 'Packages', icon: 'card' },
    { to: '/platform/settings', label: 'Settings', icon: 'settings' },
  ] },
  { label: 'Operations', items: [
    { to: '/platform/updates', label: 'Updates', icon: 'bell' },
    { to: '/platform/audit', label: 'Change history', icon: 'note' },
  ] },
];

/**
 * The internal console. Desktop-first but responsive, and visually
 * distinct from the studio app so there is never a moment's doubt
 * about which product you are looking at.
 */
export function PlatformLayout() {
  const { session, signOut, theme, toggleTheme, confirm } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  /*
    The drawer belongs to the route it was opened on. Deriving that from the
    pathname closes it on navigation without an effect, which means no second
    render pass on every single navigation.
  */
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === loc.pathname;
  const setMore = (open: boolean) => setMoreAt(open ? loc.pathname : null);

  const metrics = useData(() => (session ? api.platform.metrics.get(session) : null), [session?.userId]);

  const signOutNow = async () => {
    const ok = await confirm({
      title: 'Sign out of the console?',
      message: 'You will need the platform credentials to get back in.',
      confirmLabel: 'Sign out',
    });
    if (ok) { signOut(); nav('/', { replace: true }); }
  };

  return (
    <div className="shell shell--platform">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo size={30} />
          <div className="u-grow" style={{ minWidth: 0 }}>
            <div className="t-sm u-truncate" style={{ fontWeight: 640, letterSpacing: '-0.012em' }}>
              Fitness Manager
            </div>
            <div className="t-xs u-truncate" style={{ color: 'var(--brand)', fontWeight: 560 }}>
              Platform console
            </div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Platform">
          {NAV.map((group) => (
            <div className="sidebar__group" key={group.label}>
              <div className="sidebar__grouplabel">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="navitem">
                  <Icon name={item.icon} size={17} />
                  {item.label}
                  {item.to === '/platform/gyms' && metrics && metrics.totalGyms > 0 && (
                    <span className="navitem__badge navitem__badge--quiet">{metrics.totalGyms}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="t-xs t-faint u-mb-3" style={{ lineHeight: 1.5 }}>
            Signed in as<br />
            <strong style={{ color: 'var(--text-2)' }}>{session?.name}</strong>
          </div>
          <div className="u-row u-gap-2">
            <Button size="sm" variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon'}
              onClick={toggleTheme} aria-label="Toggle colour theme" />
            <Button size="sm" variant="ghost" icon="logout" className="u-grow"
              onClick={signOutNow} style={{ justifyContent: 'flex-start' }}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="only-mobile u-row u-gap-2">
            <Logo size={26} />
            <span className="t-sm u-truncate" style={{ fontWeight: 640 }}>Console</span>
          </span>
          <span className="u-grow" />
          {metrics && (
            <span className="hide-mobile u-row u-gap-4 t-xs t-muted u-nowrap" style={{ marginRight: 4 }}>
              <span>Customers <strong className="u-num" style={{ color: 'var(--text-1)' }}>{metrics.totalGyms}</strong></span>
              <span className="t-faint">·</span>
              <span>Members <strong className="u-num" style={{ color: 'var(--text-1)' }}>{count(metrics.totalMembers)}</strong></span>
              <span className="t-faint">·</span>
              <span>Overrides <strong className="u-num" style={{ color: 'var(--text-1)' }}>{metrics.totalOverrides}</strong></span>
            </span>
          )}
          <Button size="sm" variant="primary" icon="plus" onClick={() => nav('/platform/gyms?new=1')}>
            <span className="hide-mobile">Add customer</span>
          </Button>
        </header>

        <main className="content">
          <div className="content__inner"><Outlet /></div>
        </main>
      </div>

      <nav className="bottomnav" aria-label="Primary">
        <NavLink to="/platform" end className="bottomnav__item">
          <span className="bottomnav__icon"><Icon name="dashboard" size={20} /></span>
          Overview
        </NavLink>
        <NavLink to="/platform/gyms" className="bottomnav__item">
          <span className="bottomnav__icon"><Icon name="building" size={20} /></span>
          Customers
        </NavLink>
        <NavLink to="/platform/features" className="bottomnav__item">
          <span className="bottomnav__icon"><Icon name="layers" size={20} /></span>
          Features
        </NavLink>
        <NavLink to="/platform/packages" className="bottomnav__item">
          <span className="bottomnav__icon"><Icon name="card" size={20} /></span>
          Packages
        </NavLink>
        <button className="bottomnav__item" onClick={() => setMore(true)} aria-expanded={more}>
          <span className="bottomnav__icon"><Icon name="more" size={20} /></span>
          More
        </button>
      </nav>

      {more && (
        <>
          <div className="drawer-scrim" onClick={() => setMore(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="All sections">
            <div className="modal__grabber" />
            <div className="u-between u-mt-3 u-mb-3">
              <h2 className="t-h2">Console</h2>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setMore(false)} aria-label="Close" />
            </div>
            {NAV.map((g) => (
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
              <Button variant="secondary" icon="logout" className="u-grow" onClick={signOutNow}>
                Sign out
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
