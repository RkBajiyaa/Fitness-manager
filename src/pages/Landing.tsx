import { useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../components/ui/Icon';
import { Button } from '../components/ui/primitives';
import { useApp, useData } from '../state/app';
import * as api from '../lib/api';
import { count, moneyCompact } from '../lib/format';
import { getDb } from '../lib/db';

/**
 * Role selection stands in for authentication. When login arrives it
 * produces the same Session object this screen fabricates — which is
 * why no other screen has to change.
 */
export function Landing() {
  const { signIn, theme, toggleTheme } = useApp();
  const nav = useNavigate();

  const stats = useData(() => {
    const db = getDb();
    const gym = db.gyms[0];
    if (!gym) return null;
    const session = { gymId: gym.id, role: 'owner' as const, userId: '', memberId: null, name: '' };
    const k = api.dashboard.get(session);
    return { gym, k, gyms: db.gyms.length };
  });

  const go = (role: 'owner' | 'member') => {
    signIn(role);
    nav(role === 'owner' ? '/owner' : '/member');
  };

  return (
    <div className="landing">
      <div className="landing__top">
        <div className="u-row u-gap-3">
          <Logo size={32} />
          <div>
            <div className="t-sm" style={{ fontWeight: 640 }}>Gym Software Setup</div>
            <div className="t-xs t-faint">Management &amp; member fitness platform</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={toggleTheme} aria-label="Toggle colour theme" />
      </div>

      <div className="landing__main">
        <div className="landing__intro">
          <span className="landing__eyebrow">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--good)' }} />
            Prototype · demo data · no sign-in required
          </span>
          <h1 className="landing__title">Run the gym. Track the training.</h1>
          <p className="landing__sub">
            One platform for the two people who care most about a gym — the owner who runs it
            as a business, and the member who shows up to train. Choose a side to explore.
          </p>
        </div>

        <div className="landing__roles">
          <button className="role-card" onClick={() => go('owner')}>
            <span className="role-card__icon"><Icon name="building" size={22} /></span>
            <div>
              <div className="role-card__title">Continue as Owner</div>
              <p className="role-card__desc u-mt-2">
                The full business console — members, memberships, money and attendance,
                with the analytics to see whether the month actually worked.
              </p>
            </div>
            <ul className="role-card__list">
              {['Live dashboard of today’s gym', 'Members, renewals and pending dues',
                'Expenses, revenue and operating profit', 'Attendance and reports'].map((t) => (
                <li key={t}><Icon name="check" size={14} style={{ color: 'var(--good)' }} />{t}</li>
              ))}
            </ul>
            <span className="role-card__go">Open owner dashboard <Icon name="arrowRight" size={15} /></span>
          </button>

          <button className="role-card" onClick={() => go('member')}>
            <span className="role-card__icon"><Icon name="dumbbell" size={22} /></span>
            <div>
              <div className="role-card__title">Continue as Member</div>
              <p className="role-card__desc u-mt-2">
                A focused training app in the browser. Log a set in three taps, watch the
                numbers move, and know exactly when the membership runs out.
              </p>
            </div>
            <ul className="role-card__list">
              {['Membership status and days left', 'Today’s assigned workout',
                'Log sets, reps and weight fast', 'Weight, measurements and diet'].map((t) => (
                <li key={t}><Icon name="check" size={14} style={{ color: 'var(--good)' }} />{t}</li>
              ))}
            </ul>
            <span className="role-card__go">Open member app <Icon name="arrowRight" size={15} /></span>
          </button>
        </div>

        {stats && (
          <div className="u-row u-wrap u-gap-6 t-xs t-faint u-center" style={{ justifyContent: 'center' }}>
            <span><strong className="u-num" style={{ color: 'var(--text-2)' }}>{count(stats.k.totalMembers)}</strong> demo members</span>
            <span><strong className="u-num" style={{ color: 'var(--text-2)' }}>{moneyCompact(stats.k.revenueMonth)}</strong> revenue this month</span>
            <span><strong className="u-num" style={{ color: 'var(--text-2)' }}>{stats.gyms}</strong> tenants seeded</span>
          </div>
        )}
      </div>

      <div className="landing__foot">
        Authentication, biometric attendance and the native apps are designed for but
        deliberately not built in this phase.
      </div>
    </div>
  );
}
