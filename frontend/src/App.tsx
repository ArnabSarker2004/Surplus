import {
  AlertCircle,
  BrainCircuit,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PiggyBank,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { blankWorkspace } from '../../shared/demo';
import { asOf, prettyDate } from '../../shared/finance';
import type { AppState, Workspace } from '../../shared/schema';
import { Badge, Brand, Button } from './components/ui';
import { AppContext, api } from './lib';
import { BudgetsPage } from './pages/BudgetsPage';
import { GoalsPage } from './pages/GoalsPage';
import { LearnPage } from './pages/LearnPage';
import { Onboarding } from './pages/Onboarding';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { Overview } from './pages/Overview';
import { ScenarioPage } from './pages/ScenarioPage';
import { SemesterPage } from './pages/SemesterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { Welcome } from './pages/Welcome';
import { LogoutButton } from './features/auth/LogoutButton';
import { useAuth } from './features/auth/AuthGate';
const IntelligencePage = lazy(() =>
  import('./features/intelligence/IntelligencePage').then((module) => ({
    default: module.IntelligencePage,
  })),
);

const nav = [
  { id: 'overview', name: 'Overview', icon: LayoutDashboard },
  { id: 'semester', name: 'Semester plan', icon: CalendarDays },
  { id: 'transactions', name: 'Transactions', icon: ArrowLeftRight },
  { id: 'budgets', name: 'Budgets & insights', icon: Wallet },
  { id: 'intelligence', name: 'Forecasts & AI', icon: BrainCircuit },
  { id: 'opportunities', name: 'Opportunities', icon: Compass },
  { id: 'scenario', name: 'What-if planner', icon: SlidersHorizontal },
  { id: 'goals', name: 'Savings goals', icon: PiggyBank },
  { id: 'learn', name: 'Learn & grow', icon: BookOpen },
];
export default function App() {
  const { username, draftKey } = useAuth();
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(window.location.hash.slice(1) || 'overview');
  const [draft, setDraft] = useState<Workspace | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setState(await api<AppState>('/state'));
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const listener = () => setPage(window.location.hash.slice(1) || 'overview');
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  const navigate = (next: string) => {
    window.location.hash = next;
    setPage(next);
    setMenu(false);
    window.scrollTo({ top: 0 });
  };
  const save = async (workspace: Workspace, message = 'Your changes are saved.') => {
    setBusy(true);
    try {
      setState(await api<AppState>('/workspace', 'PUT', workspace));
      if (message) notify(message);
    } catch (e) {
      notify((e as Error).message, true);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const start = () => {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(draftKey) || 'null');
    } catch {
      /* A damaged draft starts fresh. */
    }
    setDraft(cached?.profile && cached?.semester ? cached : blankWorkspace());
    setEditing(true);
  };
  const demo = async () => {
    setBusy(true);
    try {
      const result = await api<AppState>('/demo', 'POST', {});
      setState(result);
      setEditing(false);
      setDraft(null);
      navigate('overview');
      notify('Welcome to your sample semester. Make it your own.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const edit = () => {
    setDraft(state!.workspace);
    setEditing(true);
  };
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="loader-ring" />
        <p>Making a little room for your future.</p>
      </div>
    );
  if (loadError)
    return (
      <div className="fatal">
        <Brand />
        <h1>We couldn’t reach your plan.</h1>
        <p>{loadError}</p>
        <Button onClick={() => void load()}>Try again</Button>
        <p className="small">
          Start both the app and API with <code>npm run dev</code>.
        </p>
      </div>
    );
  const w = state?.workspace;
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      {(editing || !w) && (
        <div className="session-toolbar">
          <span>Signed in as {username}</span>
          <LogoutButton />
        </div>
      )}
      {editing && draft ? (
        <Onboarding
          initial={draft}
          onCancel={() => setEditing(false)}
          onFinish={async (completed) => {
            await save({ ...completed, onboarded: true }, 'Your semester plan is ready.');
            setEditing(false);
            setDraft(null);
            localStorage.removeItem(draftKey);
            navigate('semester');
          }}
        />
      ) : !w ? (
        <Welcome onStart={start} onDemo={() => void demo()} busy={busy} />
      ) : (
        <AppContext.Provider
          value={{ state: state!, w, save, refresh: setState, notify, navigate, busy, edit }}
        >
          <div className="app-shell">
            {menu && (
              <button
                className="sidebar-backdrop"
                aria-label="Close navigation"
                onClick={() => setMenu(false)}
              />
            )}
            <aside className={`sidebar ${menu ? 'open' : ''}`}>
              <div className="sidebar-brand">
                <Brand light />
                <button
                  className="icon-button mobile-only"
                  aria-label="Close navigation"
                  onClick={() => setMenu(false)}
                >
                  <PanelLeftClose size={20} />
                </button>
              </div>
              <div className="workspace-label">
                <span className="school-icon">
                  <GraduationCap size={19} />
                </span>
                <div>
                  <strong>My student space</strong>
                  <small>{w.semester.name}</small>
                </div>
                <ChevronDown size={14} />
              </div>
              <div className="nav-label">YOUR MONEY, IN VIEW</div>
              <nav aria-label="Main navigation">
                {nav.map((item, i) => (
                  <div key={item.id}>
                    {i === 5 && <div className="nav-label second">A LITTLE FURTHER</div>}
                    <a
                      href={`#${item.id}`}
                      className={`nav-item ${page === item.id ? 'active' : ''}`}
                      aria-current={page === item.id ? 'page' : undefined}
                      onClick={() => {
                        setMenu(false);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      <item.icon size={19} />
                      <span>{item.name}</span>
                      {item.id === 'opportunities' && <span className="nav-new">NEW</span>}
                      {item.id === 'intelligence' && <span className="nav-new">NEW</span>}
                    </a>
                  </div>
                ))}
              </nav>
              <div className="sidebar-bottom">
                <div className="sidebar-note">
                  <Sparkles size={19} />
                  <p>
                    Big futures start
                    <br />
                    with small steps.
                  </p>
                  <button onClick={() => navigate('scenario')}>
                    Find your breathing room <ArrowUpRight size={14} />
                  </button>
                </div>
                <a className={`nav-item ${page === 'settings' ? 'active' : ''}`} href="#settings">
                  <Settings size={18} /> Settings & connections
                </a>
                <div className="user-profile">
                  <span className="avatar">{w.profile.name.slice(0, 1)}</span>
                  <div>
                    <strong>{w.profile.name}</strong>
                    <small>Student, future anything</small>
                  </div>
                  <span className="online-dot" />
                </div>
              </div>
            </aside>
            <div className="app-main">
              <header className="topbar">
                <div className="topbar-left">
                  <button
                    className="icon-button mobile-only"
                    aria-label="Open navigation"
                    onClick={() => setMenu(true)}
                  >
                    <Menu size={22} />
                  </button>
                  <span>My space</span>
                  <span className="slash">/</span>
                  <strong>{nav.find((n) => n.id === page)?.name ?? 'Settings'}</strong>
                </div>
                <div className="topbar-right">
                  <LogoutButton />
                  <Badge tone={w.source === 'demo' ? 'amber' : 'green'}>
                    <span className="status-dot" />
                    {w.source === 'demo'
                      ? 'Demo data'
                      : w.source === 'live'
                        ? 'Live bank'
                        : w.source === 'sandbox'
                          ? 'Plaid Sandbox'
                          : 'Your local plan'}
                  </Badge>
                  <span className="topbar-date">
                    {prettyDate(asOf(w))}, {asOf(w).slice(0, 4)}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Open help and settings"
                    onClick={() => navigate('settings')}
                  >
                    <CircleHelp size={19} />
                  </button>
                </div>
              </header>
              <main id="main-content" className="page-content" tabIndex={-1}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={page}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {page === 'overview' ? (
                      <Overview />
                    ) : page === 'semester' ? (
                      <SemesterPage />
                    ) : page === 'transactions' ? (
                      <TransactionsPage />
                    ) : page === 'budgets' ? (
                      <BudgetsPage />
                    ) : page === 'intelligence' ? (
                      <Suspense
                        fallback={
                          <p role="status">Opening your financial intelligence workspace...</p>
                        }
                      >
                        <IntelligencePage />
                      </Suspense>
                    ) : page === 'opportunities' ? (
                      <OpportunitiesPage />
                    ) : page === 'scenario' ? (
                      <ScenarioPage />
                    ) : page === 'goals' ? (
                      <GoalsPage />
                    ) : page === 'learn' ? (
                      <LearnPage />
                    ) : page === 'settings' ? (
                      <SettingsPage
                        onDemo={demo}
                        onNew={() => {
                          setDraft(blankWorkspace());
                          setEditing(true);
                        }}
                      />
                    ) : (
                      <div className="empty">
                        <Search />
                        <h1>Let’s get you back on track.</h1>
                        <Button onClick={() => navigate('overview')}>Back to overview</Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                <footer className="app-footer">
                  <span>
                    <span className="tiny-brand">✳</span> A little more clarity. A little more
                    surplus.
                  </span>
                  <span>All amounts in CAD · Estimates, not guarantees</span>
                </footer>
              </main>
            </div>
          </div>
        </AppContext.Provider>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.text}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}
