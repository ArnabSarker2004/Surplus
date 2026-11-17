import { lazy, Suspense, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import {
  demoAccounts,
  demoTransactions,
  demoWorkspace,
  opportunities,
} from '../../../../shared/demo';
import type { AppState } from '../../../../shared/schema';
import { AppContext } from '../../lib';
import { Brand, Button, PageHead } from '../../components/ui';
import { Overview } from '../../pages/Overview';
import { SemesterPage } from '../../pages/SemesterPage';
import { TransactionsPage } from '../../pages/TransactionsPage';
import { BudgetsPage } from '../../pages/BudgetsPage';
import { ScenarioPage } from '../../pages/ScenarioPage';
import { GoalsPage } from '../../pages/GoalsPage';
import { LearnPage } from '../../pages/LearnPage';
import { DemoOpportunitiesPage } from '../../pages/DemoOpportunitiesPage';
import './demo.css';
const IntelligencePage = lazy(() =>
  import('../intelligence/IntelligencePage').then((module) => ({
    default: module.IntelligencePage,
  })),
);

const pages = [
  ['overview', 'Overview'],
  ['semester', 'Semester plan'],
  ['transactions', 'Transactions'],
  ['budgets', 'Budgets & insights'],
  ['intelligence', 'Money outlook'],
  ['scenario', 'What-if planner'],
  ['goals', 'Savings goals'],
  ['opportunities', 'Opportunities'],
  ['learn', 'Learn & grow'],
  ['settings', 'Bank connection'],
] as const;
function sample(): AppState {
  return structuredClone({
    workspace: demoWorkspace(),
    accounts: demoAccounts,
    transactions: demoTransactions(),
    opportunities,
    rules: [],
  });
}

/** A disposable, in-memory workspace. It never requests or mutates an account's private API. */
export function DemoWorkspace() {
  const [state, setState] = useState(sample);
  const [page, setPage] = useState('overview');
  const [message, setMessage] = useState('');
  const [generation, setGeneration] = useState(0);
  const navigate = (next: string) => {
    setPage(next);
    setMessage('');
    window.scrollTo(0, 0);
  };
  return (
    <AppContext.Provider
      value={{
        state,
        w: state.workspace!,
        demo: true,
        busy: false,
        refresh: setState,
        notify: setMessage,
        navigate,
        edit: () => {
          window.location.hash = 'signup';
        },
        save: async (workspace, text) => {
          setState((current) => ({ ...current, workspace }));
          setMessage(text || 'Sample updated. Changes last until you reset or leave the demo.');
        },
      }}
    >
      <div className="demo-workspace">
        <header className="demo-header">
          <Brand />
          <div>
            <strong>Alex’s demo workspace</strong>
            <span>Fictional data · No account needed</span>
          </div>
          <a href="#home" className="button ghost">
            <ArrowLeft size={16} /> Back to home
          </a>
          <a href="#signup" className="button">
            Create my account
          </a>
        </header>
        <div className="demo-notice">
          <p>
            Explore the actual app with sample accounts and transactions. Try a budget, edit a
            category, or save a scenario. Changes stay in this demo.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setState(sample());
              setGeneration((value) => value + 1);
              setMessage('Demo reset to Alex’s sample semester.');
            }}
          >
            <RotateCcw size={15} /> Reset demo
          </Button>
        </div>
        <nav className="demo-navigation" aria-label="Demo navigation">
          {pages.map(([id, label]) => (
            <button
              key={id}
              aria-current={
                (page === 'intelligence-goals' ? 'intelligence' : page) === id ? 'page' : undefined
              }
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {message && (
          <div className="demo-feedback" role="status">
            {message}
            <button onClick={() => setMessage('')} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}
        <main id="main-content" className="demo-content" key={`${page}-${generation}`}>
          {page === 'overview' ? (
            <Overview />
          ) : page === 'semester' ? (
            <SemesterPage />
          ) : page === 'transactions' ? (
            <TransactionsPage />
          ) : page === 'budgets' ? (
            <BudgetsPage />
          ) : page === 'intelligence' || page === 'intelligence-goals' ? (
            <Suspense fallback={<p role="status">Opening your sample outlook...</p>}>
              <IntelligencePage initialTab={page === 'intelligence-goals' ? 'goals' : 'outlook'} />
            </Suspense>
          ) : page === 'scenario' ? (
            <ScenarioPage />
          ) : page === 'goals' ? (
            <GoalsPage />
          ) : page === 'opportunities' ? (
            <>
              <PageHead
                eyebrow="SAMPLE OPPORTUNITIES"
                title="Your skills can open doors."
                description="Explore fictional opportunities and see how an award could change your plan."
              />
              <DemoOpportunitiesPage />
            </>
          ) : page === 'learn' ? (
            <LearnPage />
          ) : (
            <section className="card demo-bank-preview">
              <span className="eyebrow">A PREVIEW OF CONNECTED BANKING</span>
              <h1>Your accounts, in one place.</h1>
              <p>
                Alex’s sample chequing, savings, and credit card activity power this demo’s spending
                insights. These are fictional accounts.
              </p>
              <ol>
                <li>Choose your Canadian bank in Plaid.</li>
                <li>Sign in securely and approve the accounts to share.</li>
                <li>Sync transactions to see spending categories and budget insights.</li>
              </ol>
              <p>
                To connect your own bank, create an account and choose Connect my bank during setup.
                Surplus does not collect your card number, PIN, or banking password.
              </p>
              <a className="button" href="#signup">
                Create my account
              </a>
            </section>
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}
