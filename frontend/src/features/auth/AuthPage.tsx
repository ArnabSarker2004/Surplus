import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { AuthStatus, SignInMethods } from '../../../../shared/auth';
import { Button, Field } from '../../components/ui';
import { api } from '../../lib';
import { AuthShowcase } from './AuthShowcase';
import { ProviderButtons } from './ProviderButtons';
import { EmailCodeForm } from './EmailCodeForm';

export function AuthPage({
  setup: initialSetup,
  registrationOpen = false,
  message,
  onAuthenticated,
}: {
  setup: boolean;
  registrationOpen?: boolean;
  message: string;
  onAuthenticated: (status: AuthStatus) => void;
}) {
  const [setup, setSetup] = useState(initialSetup);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [mode, setMode] = useState<'password' | 'email'>('password');
  const reduced = useReducedMotion();
  useEffect(() => {
    let live = true;
    api<SignInMethods>('/auth/methods')
      .then((m) => {
        if (live) setMethods(m);
      })
      .catch(() => {
        if (live)
          setError(
            'Additional sign-in methods could not be loaded. You can still use your password.',
          );
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <main className="auth-page">
      <AuthShowcase />
      <section className="auth-form-side" aria-label="Your Surplus account">
        <div className="auth-form-top">
          <span>
            <LockKeyhole size={13} /> YOUR PERSONAL SPACE
          </span>
          <a href="#home">← Back to home</a>
        </div>
        <motion.div
          className="auth-card"
          initial={reduced ? false : { y: 12 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="auth-welcome-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="auth-form-eyebrow">
            {setup ? 'YOUR NEXT CHAPTER STARTS HERE' : 'PICK UP WHERE YOU LEFT OFF'}
          </span>
          <h1>{setup ? 'Make this space yours.' : 'Welcome back.'}</h1>
          <p>
            {setup
              ? 'A calmer relationship with money starts here. Create your account and make room for what’s next.'
              : 'Your plans, possibilities, and a little peace of mind. It’s good to have you back.'}
          </p>
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
          {registrationOpen && (
            <div className="auth-method-switch" aria-label="Account access">
              <button
                type="button"
                aria-pressed={!setup}
                disabled={busy}
                onClick={() => {
                  setSetup(false);
                  setError('');
                  setPassword('');
                  setConfirm('');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={setup}
                disabled={busy}
                onClick={() => {
                  setSetup(true);
                  setError('');
                  setPassword('');
                  setConfirm('');
                }}
              >
                Create account
              </button>
            </div>
          )}
          <ProviderButtons methods={methods} onError={setError} />
          {registrationOpen && (
            <p className="field-note">
              {setup
                ? 'Your first visit creates a private account. No separate password needed.'
                : 'Use the same provider to return to your saved plan. Your first visit creates an account.'}
            </p>
          )}
          <div className="auth-divider">
            <span />
            or make yourself at home with
            <span />
          </div>
          <div className="auth-method-switch" aria-label="Sign-in method">
            <button
              type="button"
              aria-pressed={mode === 'password'}
              onClick={() => {
                setMode('password');
                setError('');
              }}
            >
              Password
            </button>
            <button
              type="button"
              aria-pressed={mode === 'email'}
              disabled={!methods?.email}
              title={
                methods?.email
                  ? 'Sign in with a code sent to your email'
                  : 'Email delivery is not enabled yet'
              }
              onClick={() => {
                setMode('email');
                setError('');
              }}
            >
              Email code{!methods?.email && <small>Not enabled</small>}
            </button>
          </div>
          {mode === 'email' ? (
            <EmailCodeForm onComplete={onAuthenticated} />
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError('');
                if (setup && password !== confirm) {
                  setError('Your passwords do not match.');
                  return;
                }
                setBusy(true);
                try {
                  const status = await api<AuthStatus>(
                    `/auth/${setup ? (registrationOpen ? 'register' : 'setup') : 'login'}`,
                    'POST',
                    { username, password },
                  );
                  setPassword('');
                  setConfirm('');
                  onAuthenticated(status);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Username">
                <input
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={64}
                  pattern="[a-zA-Z0-9_.\-]+"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field
                label="Password"
                hint={
                  setup ? 'At least 12 characters. Make it memorable, make it yours.' : undefined
                }
              >
                <div className="auth-password-input">
                  <input
                    aria-label="Password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={setup ? 'new-password' : 'current-password'}
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={setup ? 'Create a password' : 'Enter your password'}
                  />
                  <button
                    type="button"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              {setup && (
                <Field label="Confirm password">
                  <input
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Once more, just to be sure"
                    required
                    minLength={12}
                    maxLength={128}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? 'One moment…' : setup ? 'Create account & continue' : 'Sign in'}
                <ArrowRight size={18} />
              </Button>
            </form>
          )}
          {mode === 'email' && error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-trust">
            <ShieldCheck size={17} />
            <p>
              Your space stays yours.{' '}
              {setup
                ? registrationOpen
                  ? 'Your plan is saved privately to your account.'
                  : 'Your existing plan and connections will be preserved.'
                : 'Signing in never gives us access to your email inbox.'}
            </p>
          </div>
          <details className="auth-help">
            <summary>Need a hand signing in?</summary>
            <p>
              Use the method you originally connected. You can add Google, Microsoft, or email in
              Settings after signing in. School accounts may require your institution’s approval.
            </p>
            <p>
              Buttons marked “Not enabled” are awaiting service setup. Your username and password
              work independently.{' '}
              {registrationOpen
                ? 'Each account has its own saved workspace.'
                : 'This workspace has one owner.'}
            </p>
          </details>
        </motion.div>
        <footer className="auth-form-footer">
          <span>Thoughtfully built. Privately yours.</span>
          <span>surplus © {new Date().getFullYear()}</span>
        </footer>
      </section>
    </main>
  );
}
