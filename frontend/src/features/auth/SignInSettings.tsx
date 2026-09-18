import { useEffect, useState } from 'react';
import { Mail, KeyRound } from 'lucide-react';
import type { LinkedMethods, SignInMethods } from '../../../../shared/auth';
import { Button, SectionTitle } from '../../components/ui';
import { api } from '../../lib';
import { EmailCodeForm } from './EmailCodeForm';
import { ProviderButtons, ProviderIcon } from './ProviderButtons';

export function SignInSettings() {
  const [available, setAvailable] = useState<SignInMethods | null>(null);
  const [linked, setLinked] = useState<LinkedMethods | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([
      api<SignInMethods>('/auth/methods'),
      api<LinkedMethods>('/auth/connections'),
    ]).then(([a, l]) => {
      setAvailable(a);
      setLinked(l);
    });
  useEffect(() => {
    void load().catch((e) => setError((e as Error).message));
  }, []);
  const disconnect = async (method: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setLinked(await api<LinkedMethods>(`/auth/connections/${method}`, 'DELETE'));
      setMessage('Sign-in method disconnected.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card settings-section">
      <SectionTitle
        title="Your ways in"
        subtitle="Connect the sign-in methods that feel right for you. Your saved plan stays in one place."
      />
      <p className="field-note">
        For your security, connect or remove a method within five minutes of signing in. Otherwise,
        log out and sign in again first.
      </p>
      <div className="auth-connections">
        {linked?.password && (
          <div className="auth-connection-row">
            <KeyRound size={19} />
            <span>
              <strong>Username & password</strong>
              <small>Your password sign-in is ready.</small>
            </span>
          </div>
        )}
        {linked?.identities.map((i) => (
          <div className="auth-connection-row" key={i.provider}>
            <ProviderIcon provider={i.provider} />
            <span>
              <strong>{i.provider[0].toUpperCase() + i.provider.slice(1)}</strong>
              <small>{i.label}</small>
            </span>
            <Button variant="ghost" disabled={busy} onClick={() => void disconnect(i.provider)}>
              Disconnect
            </Button>
          </div>
        ))}
        {linked?.email && (
          <div className="auth-connection-row">
            <Mail size={19} />
            <span>
              <strong>Email code</strong>
              <small>{linked.email}</small>
            </span>
            <Button variant="ghost" disabled={busy} onClick={() => void disconnect('email')}>
              Disconnect
            </Button>
          </div>
        )}
        <ProviderButtons methods={available} intent="link" onError={setError} />
        <Button
          variant="secondary"
          disabled={!available?.email}
          onClick={() => setEmailOpen(!emailOpen)}
        >
          <Mail size={16} />
          {emailOpen
            ? 'Cancel email setup'
            : linked?.email
              ? 'Change sign-in email'
              : 'Connect an email address'}
        </Button>
        {!available?.email && <p className="field-note">Email sign-in is not enabled yet.</p>}
        {emailOpen && (
          <EmailCodeForm
            intent="link"
            onComplete={() => {
              setEmailOpen(false);
              setMessage('Email verified and connected. You can now sign in with a code.');
              void load();
            }}
          />
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="inline-notice" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
