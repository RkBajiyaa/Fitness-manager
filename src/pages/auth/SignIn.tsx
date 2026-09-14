import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon, Logo } from '../../components/ui/Icon';
import { Button } from '../../components/ui/primitives';
import { TextField } from '../../components/ui/forms';
import { useApp } from '../../state/app';
import { AuthError, DEMO_CREDENTIALS, IS_DEMO_AUTH } from '../../lib/auth';
import type { Session } from '../../lib/types';

type Role = 'owner' | 'member' | 'admin';
type Mode = 'choose' | 'signin' | 'create' | 'reset';

const COPY: Record<Role, { title: string; icon: 'building' | 'dumbbell' | 'shield'; blurb: string }> = {
  owner: {
    title: 'Owner', icon: 'building',
    blurb: 'Run the studio — members, coaching, and the business behind it.',
  },
  member: {
    title: 'Member', icon: 'dumbbell',
    blurb: 'Today’s session, your progress, and everything your coach has planned.',
  },
  admin: {
    title: 'Platform console', icon: 'shield',
    blurb: 'Internal control panel — customers, packages and feature entitlements.',
  },
};

/**
 * One calm screen with an important fork in it.
 *
 * A real customer signing in for the first time must NOT land in
 * someone else's demo data. So the first question is which of the two
 * they want, and "Start fresh" provisions a genuinely empty workspace.
 */
export default function SignIn() {
  const { role: roleParam } = useParams();
  const role: Role = roleParam === 'owner' ? 'owner' : roleParam === 'admin' ? 'admin' : 'member';
  const {
    signIn, signUpOwner, signUpMember, exploreDemo, resetPassword,
    toast, theme, toggleTheme,
  } = useApp();
  const nav = useNavigate();

  const [mode, setMode] = useState<Mode>(role === 'admin' ? 'signin' : 'choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gymName, setGymName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [sent, setSent] = useState(false);

  const demo = DEMO_CREDENTIALS.find(
    (c) => c.role === (role === 'admin' ? 'platform_admin' : role),
  );

  const go = (session: Session) => {
    nav(session.role === 'platform_admin' ? '/platform'
      : session.role === 'member' ? '/member' : '/owner', { replace: true });
  };

  const handle = (err: unknown) => {
    if (err instanceof AuthError) {
      if (err.code === 'invalid_email') setFieldError({ email: err.message });
      else if (err.code === 'weak_password') setFieldError({ password: err.message });
      else setError(err.message);
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  const startDemo = async () => {
    if (role === 'admin') return;
    setBusy('demo'); setError('');
    try {
      const session = await exploreDemo(role);
      toast('info', 'Demo data loaded', 'This is an example studio. It is kept apart from live gyms.');
      go(session);
    } catch (err) { handle(err); } finally { setBusy(''); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('form'); setError(''); setFieldError({});
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setSent(true);
      } else if (mode === 'create') {
        if (role === 'owner') {
          if (!gymName.trim()) { setFieldError({ gymName: 'What is your gym called?' }); return; }
          const session = await signUpOwner({ email, password, name, gymName });
          toast('success', 'Workspace created', `${gymName.trim()} is ready to set up.`);
          go(session);
        } else {
          const session = await signUpMember({ email, password, name });
          toast('success', 'You’re in', 'Let’s get your profile started.');
          go(session);
        }
      } else {
        const session = await signIn(
          email, password,
          role === 'admin' ? 'platform_admin' : role,
        );
        toast('success', `Welcome back, ${session.name.split(' ')[0]}`);
        go(session);
      }
    } catch (err) { handle(err); } finally { setBusy(''); }
  };

  const fillDemo = () => {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError(''); setFieldError({});
  };

  const copy = COPY[role];

  /* ---------------- the fork ---------------- */
  if (mode === 'choose') {
    return (
      <Shell role={role} theme={theme} toggleTheme={toggleTheme} onBrand={() => nav('/')}>
        <div className="auth__card">
          <div className="u-between u-mb-5">
            <div>
              <h1 className="t-h2" style={{ letterSpacing: '-0.018em' }}>{copy.title}</h1>
              <p className="t-sm t-muted u-mt-2">{copy.blurb}</p>
            </div>
            <span className="auth__roleicon"><Icon name={copy.icon} size={18} /></span>
          </div>

          <div className="u-col u-gap-3">
            <button className="startcard" onClick={() => { setMode('create'); setError(''); }}>
              <span className="startcard__icon startcard__icon--brand">
                <Icon name="sparkles" size={18} />
              </span>
              <span className="u-grow">
                <span className="startcard__title">Start fresh</span>
                <span className="startcard__desc">
                  {role === 'owner'
                    ? 'An empty workspace with your gym’s name on it. No members, no revenue, nothing invented — you add the first plan and the first member.'
                    : 'A clean profile. No workouts, no streak, no history until you create it.'}
                </span>
              </span>
              <Icon name="chevronRight" size={16} className="t-faint" />
            </button>

            <button className="startcard" onClick={startDemo} disabled={busy === 'demo'}>
              <span className="startcard__icon"><Icon name="compass" size={18} /></span>
              <span className="u-grow">
                <span className="startcard__title">
                  {busy === 'demo' ? 'Loading demo…' : 'Explore with demo data'}
                </span>
                <span className="startcard__desc">
                  {role === 'owner'
                    ? 'A fully populated example studio — 52 members, a year of payments and real training history to look through.'
                    : 'An example member with months of logged training, records and a live streak.'}
                </span>
              </span>
              <Icon name="chevronRight" size={16} className="t-faint" />
            </button>
          </div>

          {error && (
            <div className="inline-alert inline-alert--critical u-mt-4">
              <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--critical)' }} />
              <span className="t-sm" style={{ color: 'var(--critical)' }}>{error}</span>
            </div>
          )}

          <hr className="divider u-mt-5 u-mb-4" />
          <div className="u-center t-sm t-muted">
            Already have an account?{' '}
            <button type="button" className="auth__link" onClick={() => { setMode('signin'); setError(''); }}>
              Sign in
            </button>
          </div>

          <p className="quiet-note u-mt-4 u-center">
            Demo data lives in its own workspace and never mixes with a real gym’s records.
          </p>
        </div>
      </Shell>
    );
  }

  /* ---------------- forms ---------------- */
  const title = mode === 'create'
    ? (role === 'owner' ? 'Set up your gym' : 'Create your profile')
    : mode === 'reset' ? 'Reset your password'
      : `${copy.title} sign in`;

  return (
    <Shell role={role} theme={theme} toggleTheme={toggleTheme} onBrand={() => nav('/')}>
      <div className="auth__card">
        <div className="u-between u-mb-5">
          <div>
            <h1 className="t-h2" style={{ letterSpacing: '-0.018em' }}>{title}</h1>
            <p className="t-sm t-muted u-mt-2">
              {mode === 'reset' ? 'We will send a reset link to your email.'
                : mode === 'create'
                  ? (role === 'owner'
                    ? 'Your workspace starts empty. Setup takes about two minutes and every step can be skipped.'
                    : 'Just enough to get started. You can fill in the rest later.')
                  : role === 'admin' ? 'Internal access only.'
                    : role === 'owner' ? 'Sign in to manage your studio.'
                      : 'Sign in to see today’s training.'}
            </p>
          </div>
          <span className="auth__roleicon"><Icon name={copy.icon} size={18} /></span>
        </div>

        {sent ? (
          <div className="u-col u-gap-4">
            <div className="inline-alert">
              <Icon name="mail" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
              <span className="t-sm t-muted">
                If an account exists for <strong>{email}</strong>, a reset link is on its way.
                {IS_DEMO_AUTH && ' In this build no email is actually sent.'}
              </span>
            </div>
            <Button variant="primary" block onClick={() => { setSent(false); setMode('signin'); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form className="u-col u-gap-4" onSubmit={submit}>
            {mode === 'create' && role === 'owner' && (
              <TextField
                label="Gym name" required autoFocus value={gymName} error={fieldError.gymName}
                onChange={(e) => setGymName(e.target.value)} placeholder="e.g. Iron Yard Strength"
                hint="You can change this later in Settings."
              />
            )}
            {mode === 'create' && (
              <TextField
                label="Your name" required autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Your full name"
              />
            )}

            <TextField
              label="Email" type="email" required autoFocus={mode !== 'create'}
              autoComplete="email" value={email} error={fieldError.email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            {mode !== 'reset' && (
              <div>
                <div className="field__wrap">
                  <TextField
                    label="Password" required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                    value={password} error={fieldError.password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'create' ? 'At least 8 characters' : '••••••••'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 10, top: 30, background: 'none',
                      border: 0, cursor: 'pointer', color: 'var(--text-3)', padding: 4,
                    }}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                  </button>
                </div>
                {mode === 'signin' && (
                  <div className="u-right u-mt-2">
                    <button type="button" className="auth__link" onClick={() => { setMode('reset'); setError(''); }}>
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="inline-alert inline-alert--critical">
                <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--critical)' }} />
                <span className="t-sm" style={{ color: 'var(--critical)' }}>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" block loading={busy === 'form'}>
              {mode === 'create'
                ? (role === 'owner' ? 'Create my gym' : 'Create profile')
                : mode === 'reset' ? 'Send reset link' : 'Sign in'}
            </Button>

            {role !== 'admin' && (
              <div className="u-center t-sm t-muted">
                <button type="button" className="auth__link"
                  onClick={() => { setMode('choose'); setError(''); setFieldError({}); }}>
                  Back
                </button>
              </div>
            )}
          </form>
        )}

        {IS_DEMO_AUTH && demo && mode === 'signin' && !sent && (
          <div className="auth__demo">
            <div className="u-between u-gap-3">
              <span>
                <strong>Development credentials</strong> — not production security.
                <br />
                <code>{demo.email}</code> · <code>{demo.password}</code>
              </span>
              <Button size="sm" onClick={fillDemo}>Use</Button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ role, theme, toggleTheme, onBrand, children }: {
  role: Role;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onBrand: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="auth">
      <div className="auth__top">
        <button
          className="u-row u-gap-3"
          style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'inherit' }}
          onClick={onBrand}
        >
          <Logo size={30} />
          <span className="t-sm" style={{ fontWeight: 620, letterSpacing: '-0.012em' }}>
            Fitness Manager
          </span>
        </button>
        <Button variant="ghost" size="sm" icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={toggleTheme} aria-label="Toggle colour theme" />
      </div>

      <div className="auth__main">{children}</div>

      <div className="auth__foot">
        {role === 'admin' ? (
          <span className="t-xs t-faint">Fitness Manager · internal</span>
        ) : (
          <button className="auth__link" onClick={onBrand} style={{ color: 'var(--text-3)' }}>
            Choose a different role
          </button>
        )}
      </div>
    </div>
  );
}
