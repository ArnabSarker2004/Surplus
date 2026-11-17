import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CircleHelp,
  CreditCard,
  LayoutGrid,
  RefreshCw,
  Target,
  Wallet,
  BriefcaseBusiness,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';
import {
  defaultForecastOptions,
  type ForecastOptions,
  type ForecastReport,
} from '../../../../shared/intelligence';
import { prettyDate } from '../../../../shared/finance';
import { Badge, Button, Modal, PageHead, SectionTitle } from '../../components/ui';
import { api, useApp } from '../../lib';
import { CreditCardMatches } from './CreditCardMatches';
import { ForecastInsights, ModelStatus } from './ForecastInsights';
import { ForecastChart, money } from './ForecastCharts';
import { ForecastControls } from './ForecastControls';
import { GoalTimelines } from './GoalTimelines';
import { BehaviorPanel } from './BehaviorPanel';
import { EconomyPanel } from './EconomyPanel';
import { LiquidityPanel } from './LiquidityPanel';
import { WeeklyActionPlan } from './WeeklyActionPlan';
import { QuickReview } from './QuickReview';
import { WorkSchedule } from './WorkSchedule';
import { StudentSnapshot } from './StudentSnapshot';
import { ForecastAccuracy, AccountForecasts } from './ForecastAccuracy';
import { CashReserveCard, CashWeekCard, SpendingMix } from './OutlookStats';
import { reviewQueue } from '../../../../shared/transaction-review';
import { MerchantEnrichment } from '../transactions/MerchantEnrichment';
import { StudentMoney } from '../../components/StudentMoney';
import './intelligence.css';

const tabs = [
  ['outlook', 'My semester', LayoutGrid],
  ['work', 'Work & study', BriefcaseBusiness],
  ['cash', 'Cash flow', Wallet],
  ['goals', 'My goals', Target],
  ['habits', 'Spending habits', BarChart3],
  ['cards', 'Card options', CreditCard],
  ['week', 'This week', CalendarDays],
] as const;
type Tab = (typeof tabs)[number][0] | 'details';
export function IntelligencePage({ initialTab = 'outlook' }: { initialTab?: Tab }) {
  const { w, state, navigate, demo } = useApp();
  const [options, setOptions] = useState<ForecastOptions>(defaultForecastOptions);
  const [report, setReport] = useState<ForecastReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [changed, setChanged] = useState(false);
  const [topic, setTopic] = useState('tuition');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [cashView, setCashView] = useState('balance');
  const [reviewOpen, setReviewOpen] = useState(false);
  const generation = useRef(0);
  const forecastFlight = useRef<Promise<void> | null>(null);
  const reportSource = useRef(w.source);
  const appliedOptions = useRef(defaultForecastOptions);
  const draftOptions = useRef(defaultForecastOptions);
  const navigation = useRef<HTMLElement>(null);
  const show = (next: Tab) => {
    setTab(next);
    navigation.current?.scrollIntoView({ block: 'nearest' });
  };
  const openReview = () => {
    setReviewOpen(true);
  };
  const run = useCallback(
    async (input: ForecastOptions) => {
      const current = ++generation.current;
      setBusy(true);
      setError('');
      const previous = forecastFlight.current;
      const task = (async () => {
        // Cleanup and quick edits can change state together. Finish the current request,
        // then calculate only the newest waiting state instead of saturating Python.
        if (previous) await previous;
        if (generation.current !== current) return;
        try {
          const next = demo
            ? ((await import('./demo-forecast.json')).default as ForecastReport)
            : await api<ForecastReport>('/intelligence/forecast', 'POST', input);
          if (generation.current === current) {
            setReport(next);
            appliedOptions.current = input;
            setChanged(JSON.stringify(draftOptions.current) !== JSON.stringify(input));
          }
        } catch (e) {
          if (generation.current === current) setError((e as Error).message);
        } finally {
          if (generation.current === current) setBusy(false);
        }
      })();
      forecastFlight.current = task;
      await task;
      if (forecastFlight.current === task) forecastFlight.current = null;
    },
    [demo],
  );
  useEffect(() => {
    if (reportSource.current !== w.source) setReport(null);
    reportSource.current = w.source;
    void run(appliedOptions.current);
    return () => {
      generation.current += 1;
    };
  }, [run, state.transactions, state.accounts, w]);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const update = (patch: Partial<ForecastOptions>) => {
    const next = { ...draftOptions.current, ...patch };
    draftOptions.current = next;
    setOptions(next);
    setChanged(true);
  };
  const tryHabit = (habitAdjustment: ForecastOptions['habitAdjustment']) => {
    const next = { ...appliedOptions.current, habitAdjustment };
    draftOptions.current = next;
    setOptions(next);
    show('goals');
    void run(next);
  };
  const explanation = report?.assistant.find((item) => item.id === topic);
  const reviewRows = reviewQueue(state.transactions, report?.asOf);
  const reviewCount = reviewRows.length;
  return (
    <div className="forecast-workspace">
      <PageHead
        eyebrow="YOUR MONEY, THROUGH EVERY TERM"
        title="Money outlook"
        description="From co-op paydays to tuition deadlines. See what carries you through."
        action={
          <div className="button-row">
            <Button variant="secondary" onClick={() => setControlsOpen(true)}>
              <SlidersHorizontal size={15} /> Try a change
            </Button>
            <Button
              variant="secondary"
              onClick={() => void run(appliedOptions.current)}
              disabled={busy}
            >
              <RefreshCw size={15} className={busy ? 'spin' : ''} aria-hidden="true" />
              Refresh outlook
            </Button>
          </div>
        }
      />
      {demo && (
        <p className="inline-notice">
          This is a fixed sample outlook with fictional data. Reviews update your demo money
          breakdown; sign in for an outlook that recalculates with your plan.
        </p>
      )}
      <div className="forecast-toolbar">
        <nav className="forecast-tabs" aria-label="Money outlook sections" ref={navigation}>
          {tabs.map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              aria-controls="outlook-content"
              onClick={() => show(id)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      {controlsOpen && (
        <Modal title="Try a change" onClose={() => setControlsOpen(false)}>
          <ForecastControls
            options={options}
            update={update}
            run={() => {
              void run(options);
              setControlsOpen(false);
              show('cash');
            }}
            busy={busy}
            demo={!!demo}
            endDate={w.semester.end}
            reset={() => {
              draftOptions.current = defaultForecastOptions;
              setOptions(defaultForecastOptions);
              void run(defaultForecastOptions);
            }}
          />
        </Modal>
      )}
      {changed && (
        <p role="status" className="inline-notice">
          Your changes aren’t applied yet. Open “Try a change” to update your outlook.
        </p>
      )}
      {busy && (
        <p role="status" className="forecast-loading">
          <RefreshCw size={18} className="spin" />
          {report ? 'Updating your outlook…' : 'Looking at your spending and upcoming bills…'}
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
          {report ? ' The displayed report is the previous successful snapshot.' : ''}{' '}
          <Button variant="secondary" onClick={() => void run(options)} disabled={busy}>
            Try again
          </Button>
        </div>
      )}
      {report && (
        <div className={`intelligence-results ${busy ? 'updating' : ''}`} aria-busy={busy}>
          <div className="intelligence-quality outlook-freshness">
            <Badge tone={report.quality.level === 'limited' ? 'amber' : 'green'}>
              {report.source === 'demo'
                ? 'Sample data'
                : report.quality.level === 'limited'
                  ? 'Building your picture'
                  : 'Based on your history'}
            </Badge>
            <span>Updated for {prettyDate(report.asOf)}</span>
            <span>
              {demo
                ? 'Fixed sample outlook'
                : report.syncedAt
                  ? `Bank snapshot ${new Date(report.syncedAt).toLocaleDateString()}`
                  : 'Using your saved plan'}
            </span>
            <Button variant="ghost" onClick={() => navigate('settings')}>
              Bank connections <ArrowUpRight size={14} />
            </Button>
          </div>
          <div id="outlook-content">
            {tab === 'outlook' && (
              <StudentSnapshot
                report={report}
                onWork={() => show('work')}
                onCash={() => show('cash')}
                onTuition={() => navigate('semester')}
              />
            )}
            {tab === 'work' && <WorkSchedule asOf={report.asOf} />}
            {tab === 'week' && (
              <div className="forecast-stack outlook-home">
                <WeeklyActionPlan report={report} onReview={openReview} />
                {reviewCount > 0 && (
                  <button
                    type="button"
                    className="outlook-review student-review-button"
                    id="outlook-review"
                    onClick={openReview}
                  >
                    <span>
                      <strong>
                        {reviewCount}{' '}
                        {reviewCount === 1 ? 'transaction needs' : 'transactions need'} your input
                      </strong>
                      <small>
                        Missing category or changed split ·{' '}
                        {money(reviewRows.reduce((total, t) => total + Math.abs(t.cashFlow), 0))} in
                        total
                      </small>
                    </span>
                    <span className="review-link">
                      Review <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </button>
                )}
              </div>
            )}
            {tab === 'cash' && (
              <div className="forecast-stack">
                <div
                  className="forecast-segment student-subnav"
                  role="group"
                  aria-label="Cash flow views"
                >
                  {[
                    ['balance', 'Balance'],
                    ['bills', 'Next two weeks'],
                    ['accounts', 'Bank accounts'],
                    ['prices', 'Rising prices'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={cashView === id}
                      onClick={() => setCashView(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {cashView === 'balance' && (
                  <>
                    <section className="card intelligence-chart">
                      <SectionTitle
                        title="How your balance could change"
                        subtitle="After expected income and spending · CAD"
                      />
                      {report.quality.cashKnown ? (
                        <ForecastChart
                          data={report.timeline}
                          events={report.upcoming}
                          threshold={report.liquidity.protectedBalance}
                          label="Estimated cash balance over time, in Canadian dollars."
                        />
                      ) : (
                        <p>Add your current cash under “Try a change” to see this chart.</p>
                      )}
                    </section>
                  </>
                )}
                {cashView === 'bills' && (
                  <>
                    <LiquidityPanel report={report.liquidity} />
                    <CashWeekCard report={report} />
                  </>
                )}
                {cashView === 'accounts' && (
                  <>
                    <StudentMoney />
                    <AccountForecasts report={report} />
                    <CashReserveCard report={report} />
                  </>
                )}
                {cashView === 'prices' && <EconomyPanel report={report.economy} />}
              </div>
            )}
            {tab === 'goals' && <GoalTimelines report={report} />}
            {tab === 'habits' && (
              <div className="forecast-stack">
                <SectionTitle title="Spending habits" />
                <SpendingMix report={report} />
                <BehaviorPanel report={report} onTry={tryHabit} busy={busy} />
                <details className="outlook-expand forecast-details">
                  <summary>Compare recent spending & upcoming bills</summary>
                  <ForecastInsights report={report} />
                </details>
              </div>
            )}
            {tab === 'cards' && (
              <>
                <SectionTitle
                  title="Card options"
                  subtitle="Rewards after fees · based on your spending"
                />
                <p className="field-note">
                  Estimates assume repayment in full. Compare affordability in Cash flow.
                </p>
                <CreditCardMatches report={report.creditCards} />
              </>
            )}
            {tab === 'details' && (
              <div className="forecast-stack">
                <div>
                  <Button variant="ghost" onClick={() => show('outlook')}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back to my semester
                  </Button>
                </div>
                <SectionTitle
                  title="How your outlook works"
                  subtitle="Understand where the numbers come from, what they assume, and how much to rely on them."
                />
                {report.quality.warnings.length > 0 && (
                  <details className="forecast-details card intelligence-warnings">
                    <summary>Data & assumptions</summary>
                    <ul>
                      {report.quality.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <ModelStatus report={report} />
                <ForecastAccuracy report={report} />
                <section className="card intelligence-assistant">
                  <SectionTitle
                    title="Your questions, explained"
                    subtitle="Plain-language answers based on your current outlook."
                  />
                  <div className="intelligence-topics">
                    {report.assistant.map((item) => (
                      <Button
                        key={item.id}
                        variant={topic === item.id ? 'primary' : 'secondary'}
                        onClick={() => setTopic(item.id)}
                      >
                        {item.question}
                      </Button>
                    ))}
                  </div>
                  {explanation && (
                    <div className="intelligence-answer" aria-live="polite">
                      <div>
                        <h3>{explanation.question}</h3>
                        {explanation.answers.map((text) => (
                          <p key={text}>{text}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                <section className="card">
                  <SectionTitle title="How this forecast was built" />
                  {report.models.map((model) => (
                    <article key={model.series}>
                      <h3>{model.series}</h3>
                      <p>{model.reason}</p>
                    </article>
                  ))}
                  <ul>
                    {report.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    Model version: {report.version}. Forecast dates refresh when you sync
                    transactions or change your saved plan.
                  </p>
                </section>
              </div>
            )}
          </div>
          {tab === 'details' && (
            <section className="card outlook-cleanup">
              <SectionTitle title="Transaction cleanup settings" />
              <MerchantEnrichment />
            </section>
          )}
          {reviewOpen && (
            <Modal title="Review transactions" onClose={() => setReviewOpen(false)}>
              <QuickReview asOf={report.asOf} />
            </Modal>
          )}
          <div className="outlook-footer">
            <p>Estimates in CAD · not guaranteed</p>
            <Button variant="ghost" onClick={() => show(tab === 'details' ? 'outlook' : 'details')}>
              <CircleHelp size={16} aria-hidden="true" />
              {tab === 'details' ? 'Back to my semester' : 'About these estimates'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
