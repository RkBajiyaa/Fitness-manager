import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Logo, type IconName } from '../components/ui/Icon';
import { Button } from '../components/ui/primitives';
import { useApp, useData } from '../state/app';
import * as api from '../lib/api';
import { moneyCompact } from '../lib/format';
import type { FeatureKey } from '../lib/platform/catalog';

/**
 * `feature` gates the entry. `anyOf` is for sections that more than one
 * entitlement can unlock (Communication needs WhatsApp *or* Email).
 *
 * Navigation is built from what the gym ACTUALLY HAS. A simple studio on
 * Basic sees four sections and no dead buttons; nobody has to scroll past
 * modules they were never sold. This is the visible half of the
 * entitlement model — the API enforces the same rule independently.
 */
interface NavEntry {
  to: string; label: string; icon: IconName; end?: boolean;
  feature?: FeatureKey;
  anyOf?: FeatureKey[];
}

const GROUPS: Array<{ label: string; items: NavEntry[] }> = [
  { label: 'Studio', items: [
    { to: '/owner', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/owner/attention', label: 'Needs attention', icon: 'bell', feature: 'member_management' },
  ] },
  { label: 'Members', items: [
    { to: '/owner/members', label: 'Members', icon: 'users', feature: 'member_management' },
    { to: '/owner/memberships', label: 'Memberships', icon: 'card', feature: 'memberships' },
    { to: '/owner/attendance', label: 'Attendance', icon: 'calendarCheck', feature: 'attendance' },
    { to: '/owner/messages', label: 'Communication', icon: 'message', anyOf: ['whatsapp', 'email'] },
  ] },
  { label: 'Coaching', items: [
    { to: '/owner/programs', label: 'Programs', icon: 'route', feature: 'workout_programs' },
    { to: '/owner/exercises', label: 'Exercises', icon: 'library', feature: 'exercise_library' },
  ] },
  { label: 'Money', items: [
    { to: '/owner/payments', label: 'Payments', icon: 'wallet', feature: 'payments' },
    { to: '/owner/expenses', label: 'Expenses', icon: 'receipt', feature: 'expenses' },
    { to: '/owner/revenue', label: 'Revenue', icon: 'trendingUp', feature: 'revenue' },
    { to: '/owner/profit-loss', label: 'Profit & Loss', icon: 'chart', feature: 'revenue' },
  ] },
  { label: 'Business', items: [
    { to: '/owner/reports', label: 'Reports', icon: 'pie', feature: 'reports' },
    { to: '/owner/plans', label: 'Plans', icon: 'layers', feature: 'membership_plans' },
    { to: '/owner/features', label: 'Features', icon: 'sparkles' },
    { to: '/owner/settings', label: 'Settings', icon: 'settings' },
  ] },
];

const BOTTOM: NavEntry[] = [
  { to: '/owner', label: 'Home', icon: 'dashboard', end: true },
  { to: '/owner/attention', label: 'Attention', icon: 'bell', feature: 'member_management' },
  { to: '/owner/members', label: 'Members', icon: 'users', feature: 'member_management' },
  { to: '/owner/payments', label: 'Payments', icon: 'wallet', feature: 'payments' },
];

export function OwnerLayout() {
  const { session, signOut, theme, toggleTheme, storageDegraded, confirm, has } = useApp();
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

  // Defensive: the dashboard summary reads across modules, and a gym can
  // legitimately have some of them switched off.
  const kpis = useData(() => {
    if (!session) return null;
    try { return api.dashboard.get(session); } catch { return null; }
  }, [session?.gymId]);
  const gym = useData(() => (session ? api.gyms.current(session) : null), [session?.gymId]);

  const allowed = (item: NavEntry) =>
    (!item.feature || has(item.feature))
    && (!item.anyOf || item.anyOf.some((f) => has(f)));

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter(allowed) }))
    .filter((g) => g.items.length > 0);
  const bottom = BOTTOM.filter(allowed);

  const signOutNow = async () => {
    const ok = await confirm({ title: 'Sign out?', message: 'You will need to sign in again.', confirmLabel: 'Sign out' });
    if (ok) { signOut(); nav('/', { replace: true }); }
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo size={30} />
          <div className="u-grow" style={{ minWidth: 0 }}>
            <div className="t-sm u-truncate" style={{ fontWeight: 640, letterSpacing: '-0.012em' }}>
              Fitness Manager
            </div>
            <div className="t-xs t-faint u-truncate">{gym?.name}</div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {groups.map((g) => (
            <div className="sidebar__group" key={g.label}>
              <div className="sidebar__grouplabel">{g.label}</div>
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="navitem">
                  <Icon name={item.icon} size={17} />
                  {item.label}
                  {item.to === '/owner/attention' && kpis && kpis.needsAttention > 0 && (
                    <span className="navitem__badge">{kpis.needsAttention}</span>
                  )}
                  {item.to === '/owner/payments' && kpis && kpis.pendingCount > 0 && (
                    <span className="navitem__badge">{kpis.pendingCount}</span>
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
            <span className="t-sm u-truncate" style={{ fontWeight: 640, maxWidth: '38vw' }}>
              Fitness Manager
            </span>
          </span>

          {has('member_management') && (
            <span className="hide-mobile u-grow" style={{ maxWidth: 380 }}>
              <OwnerQuickSearch />
            </span>
          )}

          <span className="u-grow" />

          {kpis && (
            <span className="hide-mobile u-row u-gap-4 t-xs t-muted u-nowrap" style={{ marginRight: 4 }}>
              <span>Today <strong className="u-num" style={{ color: 'var(--text-1)' }}>{moneyCompact(kpis.revenueToday)}</strong></span>
              <span className="t-faint">·</span>
              <span>Sessions <strong className="u-num" style={{ color: 'var(--text-1)' }}>{kpis.sessionsToday}</strong></span>
              <span className="t-faint">·</span>
              <span>Inside <strong className="u-num" style={{ color: 'var(--text-1)' }}>
                {kpis.insideNow == null ? '—' : kpis.insideNow}
              </strong></span>
            </span>
          )}

          {has('member_management') && (
            <>
              <Button className="only-mobile" size="sm" variant="ghost" icon="search"
                onClick={() => nav('/owner/members')} aria-label="Search members" />
              <Button size="sm" variant="primary" icon="plus" onClick={() => nav('/owner/members/new')}>
                <span className="hide-mobile">Add member</span>
              </Button>
            </>
          )}
        </header>

        {storageDegraded && (
          <div style={{ background: 'var(--warning-soft)', padding: 'var(--s-2) var(--s-6)' }}>
            <span className="t-xs" style={{ color: 'var(--warning)' }}>
              Local storage is full — changes made now will not survive a refresh.
            </span>
          </div>
        )}

        <main className="content">
          <div className="content__inner"><Outlet /></div>
        </main>
      </div>

      <nav className="bottomnav" aria-label="Primary">
        {bottom.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="bottomnav__item">
            <span className="bottomnav__icon">
              <Icon name={item.icon} size={20} />
              {item.to === '/owner/attention' && kpis && kpis.needsAttention > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -8, minWidth: 15, height: 15,
                  borderRadius: 999, background: 'var(--critical)', color: '#fff',
                  fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 3px',
                }}>{kpis.needsAttention}</span>
              )}
            </span>
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
          <div className="drawer" role="dialog" aria-modal="true" aria-label="All sections">
            <div className="modal__grabber" />
            <div className="u-between u-mt-3 u-mb-3">
              <h2 className="t-h2">All sections</h2>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setMore(false)} aria-label="Close" />
            </div>
            {groups.map((g) => (
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

/** Type-ahead over members — the fastest path to one person. */
function OwnerQuickSearch() {
  const { session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const results = useData(
    () => (session && q.trim().length >= 2 ? api.members.list(session, { q, limit: 6 }).data : []),
    [session?.gymId, q],
  );

  return (
    <div style={{ position: 'relative' }}>
      <span className="field__wrap">
        <span className="field__prefix" aria-hidden="true"><Icon name="search" size={16} /></span>
        <input
          className="input input--prefix"
          style={{ minHeight: 36 }}
          placeholder="Search members"
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
        <div className="card" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          zIndex: 40, boxShadow: 'var(--shadow-3)', overflow: 'hidden',
        }}>
          {results.length === 0 ? (
            <div className="t-sm t-faint" style={{ padding: 'var(--s-4)' }}>No member matches “{q}”.</div>
          ) : results.map((r) => (
            <button key={r.member.id} className="cardlist__item"
              onMouseDown={() => nav(`/owner/members/${r.member.id}`)}>
              <span className="u-grow u-truncate">
                <span className="t-sm" style={{ fontWeight: 560 }}>{r.member.name}</span>
                <span className="t-xs t-faint" style={{ marginLeft: 8 }}>{r.member.memberCode}</span>
              </span>
              {r.engagement.level !== 'healthy' && (
                <span className={`levelchip levelchip--${r.engagement.level}`}>
                  {r.engagement.level === 'attention' ? 'Attention' : 'Watch'}
                </span>
              )}
              <Icon name="chevronRight" size={15} className="t-faint" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
