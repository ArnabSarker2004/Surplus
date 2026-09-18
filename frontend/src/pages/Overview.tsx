import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Compass,
  GraduationCap,
  Leaf,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { chartMoney } from '../components/chart-format';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  asOf,
  cad,
  categorySpending,
  insights,
  plan,
  prettyDate,
  readiness,
  safeToSave,
  sum,
  totals,
} from '../../../shared/finance';
import {
  Amount,
  Badge,
  Button,
  Empty,
  PageHead,
  Progress,
  SectionTitle,
  TextLink,
  TransactionIcon,
} from '../components/ui';
import { useApp } from '../lib';

const colors = ['#244f42', '#92a88b', '#e3bb78', '#b9c8b0', '#cfc9bd', '#a8b9bb'];
export function Overview() {
  const { w, state, navigate, edit } = useApp();
  const p = plan(w, state.opportunities);
  const safe = safeToSave(w, state.accounts, state.opportunities);
  const currentMonth = asOf(w).slice(0, 7);
  const tx = state.transactions.filter((t) => t.date.startsWith(currentMonth));
  const stats = totals(tx);
  const spending = categorySpending(tx);
  const suggestions = insights(w, state.transactions);
  const cash = sum(
    state.accounts
      .filter((a) => a.type === 'depository' && a.currency === 'CAD')
      .map((a) => a.balance),
  );
  const ready = readiness(w, state.opportunities);
  const upcoming = w.expenses
    .filter((e) => e.date >= asOf(w))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const emergency = w.goals.find((g) => /emergency/i.test(g.name));
  return (
    <>
      <PageHead
        eyebrow={`${w.semester.name} · YOUR SEMESTER AT A GLANCE`}
        title={`A little clarity, ${w.profile.name}.`}
        description="Your money today. Your possibilities tomorrow."
        action={
          <Button variant="secondary" onClick={edit}>
            <CalendarDays size={16} />
            {w.semester.name}
            <span className="button-plus">+</span>
          </Button>
        }
      />
      {w.source === 'demo' && (
        <div className="demo-ribbon">
          <Sparkles size={15} />
          <span>
            You’re exploring Alex’s sample semester. Every number tells part of the story.
          </span>
          <button onClick={edit}>
            Make it yours <ArrowRight size={14} />
          </button>
        </div>
      )}
      {w.source === 'manual' && (
        <div className="bank-dashboard-prompt">
          <div>
            <strong>Your plan is ready. Bring in your spending.</strong>
            <p>Connect your bank to see account balances, transactions, and spending insights.</p>
          </div>
          <Button onClick={() => navigate('settings')}>
            Connect my bank <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <div className="overview-hero-grid">
        <section className="semester-hero">
          <div className="hero-top">
            <span>
              <span className="hero-mini-icon">
                <Leaf size={17} />
              </span>{' '}
              Your semester outlook
            </span>
            <Badge tone={p.gap ? 'amber' : 'green'}>
              {p.gap ? 'A little room to find' : 'Looking good'}
            </Badge>
          </div>
          <div className="hero-middle">
            <div>
              <span className="hero-label">Projected end-of-semester balance</span>
              <div className="hero-number">
                {cad(p.ending, true).slice(0, -3)}
                <span>{cad(p.ending, true).slice(-3)}</span>
              </div>
              <p>
                {p.gap ? (
                  <>A {cad(p.gap)} gap. A few small changes can make a difference.</>
                ) : (
                  <>Your entered plan covers the semester. Let’s keep it that way.</>
                )}
              </p>
            </div>
            <div className="hero-sprout" aria-hidden="true">
              <span>✳</span>
            </div>
          </div>
          <div className="funding-progress">
            <div>
              <span>{cad(p.funding)} planned funding</span>
              <span>{cad(p.cost)} in costs</span>
            </div>
            <Progress
              value={p.cost ? (p.funding / p.cost) * 100 : 100}
              label="Semester costs covered"
            />
          </div>
          <div className="hero-footer">
            <span>
              <span className="light-dot" /> Pending applications aren’t counted.
            </span>
            <button onClick={() => navigate('semester')}>
              See your plan <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <section className="next-step-card">
          <div className="card-kicker">
            <span className="circle-icon sage">
              <Sparkles size={18} />
            </span>
            <span>YOUR NEXT SMALL STEP</span>
          </div>
          <h2>
            {suggestions[0]
              ? 'Your takeout could fund your future.'
              : 'Let’s find your breathing room.'}
          </h2>
          <p>
            {suggestions[0]
              ? `${suggestions[0].detail} A small adjustment could help your semester go further.`
              : 'Explore how one spending change or a new opportunity could change your semester.'}
          </p>
          <div className="next-step-impact">
            <span>Potential breathing room</span>
            <strong>
              {cad(suggestions[0]?.impact ?? p.monthlyAction)}
              <small> / month</small>
            </strong>
          </div>
          <TextLink onClick={() => navigate('budgets')}>Explore your insights</TextLink>
        </section>
      </div>
      <section className="bank-dashboard-prompt forecast-dashboard-prompt">
        <div>
          <strong>New: forecasts built from your spending patterns</strong>
          <p>
            Explore future cash flow, tuition funding dates, savings goals and credit-card reward
            matches.
          </p>
        </div>
        <Button onClick={() => navigate('intelligence')}>
          Open forecasts & AI <ArrowRight size={16} />
        </Button>
      </section>
      <div className="stat-grid">
        <div className="stat-card">
          <span>
            <Wallet size={17} /> Available cash
          </span>
          <strong>{cad(cash, true)}</strong>
          <small>
            {state.accounts.filter((a) => a.type === 'depository').length} cash accounts · credit
            excluded
          </small>
        </div>
        <div className="stat-card">
          <span>
            <ArrowDownLeft size={17} /> This month’s income
          </span>
          <strong>{cad(stats.income, true)}</strong>
          <small>Posted income · grants and loans included</small>
        </div>
        <div className="stat-card">
          <span>
            <ArrowUpRight size={17} /> This month’s spending
          </span>
          <strong>{cad(stats.spending, true)}</strong>
          <small>Transfers and pending purchases excluded</small>
        </div>
        <div className="stat-card safe-stat">
          <span>
            <ShieldCheck size={17} /> Safe to save, estimated
          </span>
          <strong>{cad(safe.amount)}</strong>
          <small>
            {safe.amount
              ? 'After near-term bills and your buffer'
              : 'Let’s cover your semester first'}
          </small>
        </div>
      </div>
      <div className="overview-middle">
        <section className="card chart-card">
          <SectionTitle
            title="The shape of your semester"
            subtitle="Planned balance, after each month’s costs"
            action={<Badge>Monthly forecast</Badge>}
          />
          <div
            className="chart-wrap"
            role="img"
            aria-label={`Monthly projected balances: ${p.timeline.map((t) => `${t.label} ${cad(t.balance)}`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height={232}>
              <AreaChart data={p.timeline} margin={{ top: 20, right: 18, left: 4, bottom: 12 }}>
                <defs>
                  <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7d9b7d" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7d9b7d" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eae9e1" strokeDasharray="3 5" />
                <XAxis
                  padding={{ left: 12, right: 12 }}
                  minTickGap={22}
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#777b73', fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  width={68}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#777b73', fontSize: 11 }}
                  tickFormatter={chartMoney}
                />
                <Tooltip
                  formatter={(value: number) => [cad(value, true), 'Planned balance']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e6dd', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#426c52"
                  strokeWidth={2.5}
                  fill="url(#balance-fill)"
                  dot={{ fill: '#426c52', r: 3, strokeWidth: 3, stroke: '#fff' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-caption">
            <span>
              <span className="legend-dot" /> Base semester plan
            </span>
            <button onClick={() => navigate('scenario')}>
              What if things changed? <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <section className="card spending-card">
          <SectionTitle
            title="Where it’s going"
            subtitle={`${new Date(currentMonth + '-01T12:00:00').toLocaleDateString('en', { month: 'long' })} spending, so far`}
            action={
              <button
                className="icon-button"
                aria-label="Explore spending"
                onClick={() => navigate('transactions')}
              >
                <ArrowUpRight size={18} />
              </button>
            }
          />
          {spending.length ? (
            <>
              <div className="spending-total">
                {cad(stats.spending)}
                <span>across {spending.length} categories</span>
              </div>
              <div className="stacked-bar" aria-label="Spending category breakdown">
                {spending.map((s, i) => (
                  <span
                    key={s.category}
                    style={{
                      width: `${(s.amount / sum(spending.map((c) => c.amount))) * 100}%`,
                      background: colors[i % colors.length],
                    }}
                    title={`${s.category}: ${cad(s.amount)}`}
                  />
                ))}
              </div>
              <div className="category-list">
                {spending.slice(0, 4).map((s, i) => (
                  <div key={s.category}>
                    <span>
                      <i style={{ background: colors[i] }} />
                      {s.category}
                    </span>
                    <strong>{cad(s.amount, true)}</strong>
                  </div>
                ))}
              </div>
              <TextLink onClick={() => navigate('transactions')}>See all transactions</TextLink>
            </>
          ) : (
            <Empty
              title="Your spending story starts here"
              detail="Connect your bank in Settings, or explore Demo Mode."
              action={<TextLink onClick={() => navigate('settings')}>View connections</TextLink>}
            />
          )}
        </section>
      </div>
      <div className="section-divider">
        <div>
          <span className="eyebrow">LOOKING A LITTLE FURTHER</span>
          <h2>Make space for what’s next.</h2>
        </div>
        <span>Small steps. Real possibilities.</span>
      </div>
      <div className="possibility-grid">
        <section className="opportunity-highlight">
          <div className="card-kicker">
            <Compass size={20} />
            <span>YOUR CAMPUS CONNECTIONS</span>
            <Badge>TMU resources</Badge>
          </div>
          <h2>Your next step could start on campus.</h2>
          <p>
            Explore paid placements, campus jobs, career events and people who can help you get
            started.
          </p>
          <div className="opportunity-highlight-bottom">
            <div>
              <strong>Find your way in</strong>
              <span>Official sources · direct contacts · your shortlist</span>
            </div>
            <button
              className="round-arrow"
              aria-label="Explore TMU resources"
              onClick={() => navigate('opportunities')}
            >
              <ArrowUpRight size={23} />
            </button>
          </div>
        </section>
        <section className="card goal-preview">
          <div className="card-kicker">
            <span className="circle-icon sage">
              <Leaf size={19} />
            </span>
            <span>YOUR RAINY-DAY FUND</span>
          </div>
          <h3>A little peace of mind.</h3>
          <p>
            {emergency
              ? 'You’re building something good. One contribution at a time.'
              : 'Start an emergency savings goal for the unexpected.'}
          </p>
          <div className="goal-preview-value">
            <strong>{cad(emergency?.current ?? 0)}</strong>
            <span>of {cad(emergency?.target ?? w.semester.emergencyTarget)}</span>
          </div>
          <Progress
            value={emergency ? (emergency.current / emergency.target) * 100 : 0}
            label="Emergency fund progress"
          />
          <TextLink onClick={() => navigate('goals')}>Keep growing</TextLink>
        </section>
      </div>
      <div className="overview-bottom">
        <section className="card recent-card">
          <SectionTitle
            title="The latest little things"
            subtitle="Recent account activity"
            action={<TextLink onClick={() => navigate('transactions')}>View all</TextLink>}
          />
          {state.transactions.length ? (
            <div className="recent-list">
              {state.transactions.slice(0, 4).map((t) => (
                <div className="recent-row" key={t.id}>
                  <TransactionIcon
                    income={t.classification === 'Income'}
                    transfer={t.classification === 'Transfer'}
                  />
                  <div>
                    <strong>{t.merchant}</strong>
                    <span>
                      {t.category}
                      {t.pending ? ' · Pending' : ''}
                    </span>
                  </div>
                  <div className="recent-amount">
                    <Amount value={t.cashFlow} flow />
                    <span>{prettyDate(t.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="A fresh start"
              detail="Your transactions will appear here when you connect an account."
            />
          )}
        </section>
        <section className="card next-dates">
          <SectionTitle title="Worth keeping in mind" />
          <div className="date-reminder">
            <span className="circle-icon sand">
              <GraduationCap size={21} />
            </span>
            <div>
              <strong>{upcoming?.name ?? 'Review your semester plan'}</strong>
              <p>
                {upcoming
                  ? `${cad(upcoming.amount)} · ${prettyDate(upcoming.date)}`
                  : 'A small weekly check-in goes a long way.'}
              </p>
              <button className="text-link" onClick={() => navigate('semester')}>
                Review your plan <ArrowRight size={13} />
              </button>
            </div>
          </div>
          <div className="readiness-reminder">
            <span className="circle-icon sage">
              <TrendingUp size={20} />
            </span>
            <div>
              <strong>{ready.status}</strong>
              <p>Learn at your pace. Your essentials come first.</p>
              <TextLink onClick={() => navigate('learn')}>Your learning path</TextLink>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
