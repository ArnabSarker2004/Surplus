import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthStatus } from '../../../../shared/auth';
import { Brand, Button } from '../../components/ui';
import { api, setActiveAccount } from '../../lib';
import { AuthPage } from './AuthPage';
import { LandingPage } from '../landing/LandingPage';
import { DemoWorkspace } from '../landing/DemoWorkspace';

interface AuthContextValue {
  username: string;
  draftKey: string;
  logout: () => Promise<void>;
  loggingOut: boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Missing authenticated session');
  return context;
}
function clearPrivateDrafts() {
  // Remove only Surplus data. Never clear unrelated applications' browser storage.
  try {
    for (const key of Object.keys(localStorage))
      if (key === 'surplus-onboarding-v1' || key.startsWith('surplus-onboarding-v1:'))
        localStorage.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
  try {
    for (const key of Object.keys(sessionStorage))
      if (key === 'surplus-onboarding-v1' || key.startsWith('surplus-onboarding-v1:'))
        sessionStorage.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
}
export function AuthGate({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState(() =>
    new URLSearchParams(window.location.search).has('auth_error')
      ? 'login'
      : window.location.hash.slice(1),
  );
  useEffect(() => {
    const changed = () => {
      setEntry(window.location.hash.slice(1));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  useEffect(() => {
    if (status?.user && ['login', 'signup'].includes(entry)) window.location.hash = 'overview';
  }, [entry, status?.user]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_connected')) return 'Your sign-in method is connected.';
    const reason = params.get('auth_error');
    return reason === 'cancelled'
      ? 'Sign-in was cancelled. Choose a method to try again.'
      : reason === 'not_linked'
        ? 'This method is not linked, or your linking session expired. Sign in with your existing method, then connect it in Settings.'
        : reason
          ? 'Sign-in could not be completed. Please try again.'
          : '';
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const generation = useRef(0);
  const signingOut = useRef(false);
  const signedOut = useCallback((text: string) => {
    setActiveAccount();
    generation.current += 1;
    clearPrivateDrafts();
    setStatus((previous) => ({
      setupRequired: false,
      registrationOpen: previous?.registrationOpen,
      user: null,
    }));
    setMessage(text);
    setError('');
    setEntry('login');
    window.history.replaceState(null, '', window.location.pathname + '#login');
  }, []);
  const checkSession = useCallback(async () => {
    const current = generation.current;
    try {
      const next = await api<AuthStatus>('/auth/session');
      if (current !== generation.current || signingOut.current) return;
      setActiveAccount(next.user?.id);
      setStatus(next);
      setError('');
      if (!next.user && !next.setupRequired) clearPrivateDrafts();
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const clean = new URL(window.location.href);
    clean.searchParams.delete('auth_error');
    clean.searchParams.delete('auth_connected');
    window.history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
    void checkSession();
    const expired = () => signedOut('Your session ended. Sign in to continue.');
    const visible = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setStatus(null);
        void checkSession();
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === 'surplus-logout' && event.newValue) signedOut('You have been logged out.');
    };
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('surplus-auth');
      channel.current.onmessage = (event) => {
        if (event.data === 'logout') signedOut('You have been logged out.');
      };
    }
    window.addEventListener('surplus-session-expired', expired);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', visible);
    window.addEventListener('pageshow', restored);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkSession();
    }, 60_000);
    return () => {
      channel.current?.close();
      window.clearInterval(timer);
      window.removeEventListener('surplus-session-expired', expired);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', visible);
      window.removeEventListener('pageshow', restored);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [checkSession, signedOut]);
  const logout = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setLoggingOut(true);
    setError('');
    generation.current += 1;
    try {
      await api<AuthStatus>('/auth/logout', 'POST', {});
      signedOut('You’re logged out. Your saved plan is ready when you return.');
      channel.current?.postMessage('logout');
      try {
        localStorage.setItem('surplus-logout', crypto.randomUUID());
      } catch {
        /* BroadcastChannel still works. */
      }
    } catch {
      setError('Logout could not reach the server. You are still signed in. Please try again.');
    } finally {
      signingOut.current = false;
      setLoggingOut(false);
    }
  };
  if (entry === 'home' || (entry === '' && !status?.user)) return <LandingPage />;
  if (entry === 'demo') return <DemoWorkspace />;
  if (!status)
    return (
      <div className="loading-screen">
        <Brand />
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={() => void checkSession()}>Try again</Button>
          </>
        ) : (
          <p role="status">Opening your space…</p>
        )}
      </div>
    );
  if (!status.user)
    return (
      <AuthPage
        key={`${status.setupRequired ? 'setup' : 'login'}-${entry}`}
        setup={status.setupRequired || (entry === 'signup' && !!status.registrationOpen)}
        registrationOpen={status.registrationOpen}
        message={message}
        onAuthenticated={(next) => {
          clearPrivateDrafts();
          setActiveAccount(next.user?.id);
          generation.current += 1;
          setStatus(next);
          setMessage('');
          setError('');
          if (['login', 'signup', 'home', 'demo'].includes(entry)) {
            window.history.replaceState(null, '', window.location.pathname + '#overview');
            setEntry('overview');
          }
        }}
      />
    );
  return (
    <AuthContext.Provider
      key={status.user.id || status.user.username}
      value={{
        username: status.user.username,
        draftKey: status.user.id
          ? `surplus-onboarding-v1:${status.user.id}`
          : 'surplus-onboarding-v1',
        logout,
        loggingOut,
      }}
    >
      {children}
      {message && (
        <div className="auth-session-error" role="status">
          {message}
          <Button variant="secondary" onClick={() => setMessage('')}>
            Dismiss
          </Button>
        </div>
      )}
      {error && (
        <div className="auth-session-error" role="alert">
          {error}
          <Button variant="secondary" disabled={loggingOut} onClick={() => void logout()}>
            Retry logout
          </Button>
        </div>
      )}
    </AuthContext.Provider>
  );
}
