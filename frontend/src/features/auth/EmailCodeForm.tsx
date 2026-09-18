import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { useState } from 'react';
import type { AuthStatus } from '../../../../shared/auth';
import { Button, Field } from '../../components/ui';
import { api } from '../../lib';

export function EmailCodeForm({
  intent = 'login',
  onComplete,
}: {
  intent?: 'login' | 'link';
  onComplete: (status: AuthStatus) => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (!sent) {
            await api('/auth/email/request', 'POST', { email, intent });
            setSent(true);
          } else {
            const status = await api<AuthStatus>('/auth/email/verify', 'POST', { code });
            setCode('');
            onComplete(status);
          }
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {sent ? (
        <>
          <div className="auth-code-notice" role="status">
            <MailCheck size={24} />
            <p>
              If this address can sign in, a code is on its way to <strong>{email}</strong>. Check
              spam, too. Codes expire in 10 minutes.
            </p>
          </div>
          <Field label="Verification code">
            <input
              aria-label="Verification code"
              className="auth-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </Field>
          <button
            type="button"
            className="auth-text-button"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode('');
              setError('');
            }}
          >
            <ArrowLeft size={14} /> Change email or request another code
          </button>
        </>
      ) : (
        <>
          <Field label="Email address">
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <p className="auth-form-note">
            Gmail, Outlook, iCloud, Yahoo, or your school email. No password to remember.
          </p>
          {intent === 'login' && (
            <p className="auth-form-note">
              Already have a password account? Sign in with it first and connect your email in
              Settings.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? 'One moment…' : sent ? 'Verify & continue' : 'Email me a code'}
        <ArrowRight size={17} />
      </Button>
    </form>
  );
}
