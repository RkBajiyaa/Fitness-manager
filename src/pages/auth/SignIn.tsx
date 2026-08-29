import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon, Logo } from '../../components/ui/Icon';
import { Button } from '../../components/ui/primitives';
import { TextField } from '../../components/ui/forms';
import { useApp } from '../../state/app';
import { AuthError, DEMO_CREDENTIALS, IS_DEMO_AUTH } from '../../lib/auth';

type Mode = 'signin' | 'create' | 'reset';

/**
 * One calm screen. No marketing panel, no statistics, no charts —
 * sign-in should feel trustworthy, not busy.
 */
export default function SignIn() {
  const { role: roleParam } = useParams();
  const role: 'owner' | 'member' = roleParam === 'owner' ? 'owner' : 'member';
  const { signIn, createAccount, resetPassword, toast, theme, toggleTheme } = useApp();
  const nav = useNavigate();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const demo = DEMO_CREDENTIALS.find((c) => c.role === role);

  const go = (session: { role: string }) => {
    nav(session.role === 'owner' ? '/owner' : '/member', { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setFieldError({});
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setSent(true);
      } else if (mode === 'create') {
        go(await createAccount(email, password, name));
      } else {
        const session = await signIn(email, password);
        toast('success', `Welcome back, ${session.name.split(' ')[0]}`);
        go(session);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === 'invalid_email') setFieldError({ email: err.message });
        else if (err.code === 'weak_password') setFieldError({ password: err.message });
        else setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError(''); setFieldError({});
  };

  const title = mode === 'create' ? 'Create your account'
    : mode === 'reset' ? 'Reset your password'
    : role === 'owner' ? 'Owner sign in' : 'Member sign in';

  return (
    <div className="auth">
      <div className="auth__top">
        <button
          className="u-row u-gap-3"
          style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'inherit' }}
          onClick={() => nav('/')}
        >
          <Logo size={30} />
          <span className="t-sm" style={{ fontWeight: 620, letterSpacing: '-0.012em' }}>
            Fitness Manager
          </span>
        </button>
        <Button variant="ghost" size="sm" icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={toggleTheme} aria-label="Toggle colour theme" />
      </div>

      <div className="auth__main">
        <div className="auth__card">
          <div className="u-between u-mb-5">
            <div>
              <h1 className="t-h2" style={{ letterSpacing: '-0.018em' }}>{title}</h1>
              <p className="t-sm t-muted u-mt-2">
                {mode === 'reset'
                  ? 'We will send a reset link to your email.'
                  : mode === 'create'
                    ? 'Set up access to your gym.'
                    : role === 'owner'
                      ? 'Sign in to manage your studio.'
                      : 'Sign in to see today’s training.'}
              </p>
            </div>
            <span
              style={{
                width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
                borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
              }}
            >
              <Icon name={role === 'owner' ? 'building' : 'dumbbell'} size={18} />
            </span>
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
              {mode === 'create' && (
                <TextField
                  label="Full name" required autoComplete="name" value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Your name"
                />
              )}

              <TextField
                label="Email" type="email" required autoFocus
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

              <Button type="submit" variant="primary" size="lg" block loading={busy}>
                {mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
              </Button>

              <div className="u-center t-sm t-muted">
                {mode === 'signin' ? (
                  <>
                    New here?{' '}
                    <button type="button" className="auth__link" onClick={() => { setMode('create'); setError(''); }}>
                      Create account
                    </button>
                  </>
                ) : (
                  <button type="button" className="auth__link" onClick={() => { setMode('signin'); setError(''); }}>
                    Back to sign in
                  </button>
                )}
              </div>
            </form>
          )}

          {IS_DEMO_AUTH && demo && mode === 'signin' && !sent && (
            <div className="auth__demo">
              <div className="u-between u-gap-3">
                <span>
                  <strong>Demo access</strong> — development credentials, not production security.
                  <br />
                  <code>{demo.email}</code> · <code>{demo.password}</code>
                </span>
                <Button size="sm" onClick={fillDemo}>Use</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="auth__foot">
        <button className="auth__link" onClick={() => nav('/')} style={{ color: 'var(--text-3)' }}>
          Choose a different role
        </button>
      </div>
    </div>
  );
}
