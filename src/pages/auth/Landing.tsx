import { useNavigate } from 'react-router-dom';
import { Icon, Logo } from '../../components/ui/Icon';
import { Button } from '../../components/ui/primitives';
import { useApp } from '../../state/app';

/**
 * Role selection. Brand, two choices, nothing else — no feature lists,
 * no statistics, no prototype language.
 */
export default function Landing() {
  const { theme, toggleTheme } = useApp();
  const nav = useNavigate();

  return (
    <div className="auth">
      <div className="auth__top">
        <div className="u-row u-gap-3">
          <Logo size={30} />
          <span className="t-sm" style={{ fontWeight: 620, letterSpacing: '-0.012em' }}>
            Fitness Manager
          </span>
        </div>
        <Button variant="ghost" size="sm" icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={toggleTheme} aria-label="Toggle colour theme" />
      </div>

      <div className="auth__main">
        <div className="auth__brand">
          <h1 className="auth__wordmark">Fitness Manager</h1>
          <p className="auth__tagline">Your fitness. Your progress. Your gym.</p>
        </div>

        <div style={{ width: '100%', maxWidth: 620 }}>
          <div className="auth__roles">
            <button className="rolecard" onClick={() => nav('/signin/owner')}>
              <span className="rolecard__icon"><Icon name="building" size={20} /></span>
              <span>
                <span className="rolecard__title">Owner</span>
                <span className="rolecard__desc">
                  Run the studio — members, coaching, and the business behind it.
                </span>
              </span>
              <span className="rolecard__go">Sign in <Icon name="arrowRight" size={14} /></span>
            </button>

            <button className="rolecard" onClick={() => nav('/signin/member')}>
              <span className="rolecard__icon"><Icon name="dumbbell" size={20} /></span>
              <span>
                <span className="rolecard__title">Member</span>
                <span className="rolecard__desc">
                  Today's session, your progress, and everything your coach has planned.
                </span>
              </span>
              <span className="rolecard__go">Sign in <Icon name="arrowRight" size={14} /></span>
            </button>
          </div>
        </div>
      </div>

      <div className="auth__foot">Fitness Manager</div>
    </div>
  );
}
