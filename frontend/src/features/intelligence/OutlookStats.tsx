import type { ForecastReport } from '../../../../shared/intelligence';
import { cad, prettyDate } from '../../../../shared/finance';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ShieldCheck,
  Target,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

const colours = ['#315c49', '#829570', '#c49a56', '#888bb0', '#bfbba6'];
function Ring({
  parts,
  value,
  caption,
  label,
  shades = colours,
}: {
  parts: number[];
  value: string;
  caption: string;
  label: string;
  shades?: string[];
}) {
  const total = parts.reduce((a, b) => a + Math.max(0, b), 0);
  let position = 0;
  const stops = parts.map((amount, i) => {
    const start = position;
    position += total ? (Math.max(0, amount) / total) * 100 : 0;
    return `${shades[i % shades.length]} ${start}% ${position}%`;
  });
  return (
    <div
      className="stat-ring"
      style={{ background: total ? `conic-gradient(${stops.join(',')})` : '#e9ece4' }}
      role="img"
      aria-label={label}
    >
      <div>
        <strong>{value}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  note?: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={`outlook-stat-card ${accent ? 'stat-accent' : ''}`}>
      <div className="stat-card-label">
        {icon}
        <span>{label}</span>
      </div>
      <strong className="stat-card-value">{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}
export function SpendingMix({ report }: { report: ForecastReport }) {
  const categories = report.categories
    .filter((c) => c.last30 > 0)
    .sort((a, b) => b.last30 - a.last30);
  const shown = categories.slice(0, 4).map((c) => ({ label: c.category, amount: c.last30 }));
  if (categories.length > 4)
    shown.push({
      label: 'Other categories',
      amount: categories.slice(4).reduce((n, c) => n + c.last30, 0),
    });
  const total = shown.reduce((n, c) => n + c.amount, 0);
  return (
    <section className="card infographic-card">
      <div className="infographic-heading">
        <h3>Where spending went</h3>
        <span>Last 30 days</span>
      </div>
      {shown.length ? (
        <div className="ring-layout">
          <Ring
            parts={shown.map((c) => c.amount)}
            value={cad(total)}
            caption="spending"
            label="Spending split by category. Amounts listed alongside."
          />
          <dl className="stat-legend">
            {shown.map((c, i) => (
              <div key={c.label}>
                <dt>
                  <i style={{ background: colours[i] }} />
                  {c.label}
                </dt>
                <dd>{cad(c.amount)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="field-note">Spending categories will appear after your first purchases.</p>
      )}
      {report.categories.some((c) => c.last30 < 0) && (
        <small>Categories with net refunds are excluded.</small>
      )}
    </section>
  );
}
export function CashReserveCard({ report }: { report: ForecastReport }) {
  const { summary } = report;
  const cash = summary.startingUsableCash;
  const protectedCash = summary.buffer + summary.goalReserve;
  const free = cash === null ? null : Math.max(0, cash - protectedCash);
  const segments = [summary.goalReserve, summary.buffer, free || 0];
  const total = segments.reduce((a, b) => a + b, 0);
  return (
    <section className="card infographic-card">
      <div className="infographic-heading">
        <h3>Cash reserved</h3>
        <ShieldCheck size={18} aria-hidden="true" />
      </div>
      <div className="infographic-value">
        {cash === null ? '—' : cad(protectedCash)}
        <small>Cushion + saved goals</small>
      </div>
      <div className="reserve-track" aria-hidden="true">
        {segments.map((amount, i) => (
          <span
            key={i}
            style={{ width: `${total ? (amount / total) * 100 : 0}%`, background: colours[i] }}
          />
        ))}
      </div>
      <dl className="stat-legend">
        <div>
          <dt>
            <i style={{ background: colours[0] }} />
            Saved goals
          </dt>
          <dd>{cad(summary.goalReserve)}</dd>
        </div>
        <div>
          <dt>
            <i style={{ background: colours[1] }} />
            Safety cushion
          </dt>
          <dd>{cad(summary.buffer)}</dd>
        </div>
        <div>
          <dt>
            <i style={{ background: colours[2] }} />
            Cash after cushion & goals
          </dt>
          <dd>{free === null ? '—' : cad(free)}</dd>
        </div>
      </dl>
      {cash !== null && cash < protectedCash ? (
        <small className="outlook-negative">
          {cad(protectedCash - cash)} more needed to cover reserves
        </small>
      ) : (
        <small>Before upcoming bills · includes loan and education funding</small>
      )}
    </section>
  );
}
export function CashWeekCard({ report }: { report: ForecastReport }) {
  const plan = report.weeklyPlan;
  if (!plan) return null;
  const incoming = plan?.scheduledIncome || 0;
  const outgoing = (plan?.scheduledBills || 0) + (plan?.variableSpending || 0);
  const max = Math.max(1, incoming, outgoing);
  return (
    <section className="card infographic-card">
      <div className="infographic-heading">
        <h3>The next 7 days</h3>
        <CalendarDays size={18} aria-hidden="true" />
      </div>
      <div className="cash-flow-bar">
        <div>
          <span>
            <ArrowDownLeft size={16} />
            Scheduled in
          </span>
          <strong>{cad(incoming)}</strong>
        </div>
        <i style={{ width: `${(incoming / max) * 100}%` }} />
      </div>
      <div className="cash-flow-bar flow-out">
        <div>
          <span>
            <ArrowUpRight size={16} />
            Expected out
          </span>
          <strong>{cad(outgoing)}</strong>
        </div>
        <i style={{ width: `${(outgoing / max) * 100}%` }} />
      </div>
      <div className="stat-bottom">
        <span>Scheduled in − expected out</span>
        <strong className={incoming < outgoing ? 'outlook-negative' : undefined}>
          {incoming > outgoing ? '+' : ''}
          {cad(incoming - outgoing)}
        </strong>
      </div>
    </section>
  );
}
export function HabitStats({ report }: { report: ForecastReport }) {
  const h = report.habits;
  const optional = h.days.reduce((n, d) => n + d.optional, 0);
  const routine = h.days.reduce((n, d) => n + d.groceries + d.routine, 0);
  const biggest = [...h.days].sort(
    (a, b) => b.optional + b.groceries + b.routine - (a.optional + a.groceries + a.routine),
  )[0];
  return (
    <div className="outlook-stat-grid">
      <Stat
        label="Optional spending"
        value={h.weeks ? cad(optional) : '—'}
        note="Average per week"
        icon={<Wallet size={17} />}
      />
      <Stat
        label="Routine & groceries"
        value={h.weeks ? cad(routine) : '—'}
        note="Average per week"
        icon={<ShieldCheck size={17} />}
      />
      <Stat
        label="Highest spending day"
        value={h.weeks && biggest ? biggest.label : '—'}
        note={
          h.weeks && biggest
            ? `${cad(biggest.optional + biggest.groceries + biggest.routine)} on average`
            : 'More history needed'
        }
        icon={<CalendarDays size={17} />}
      />
    </div>
  );
}
export function GoalStats({ report }: { report: ForecastReport }) {
  const total = report.goals.reduce((n, g) => n + g.target, 0);
  const saved = report.goals.reduce((n, g) => n + Math.min(g.current, g.target), 0);
  const next = [...report.goals]
    .filter((g) => g.current < g.target && g.deadline >= report.asOf)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  return (
    <div className="outlook-stat-grid goal-stat-grid">
      <article className="outlook-stat-card stat-with-ring">
        <Ring
          parts={[saved, Math.max(0, total - saved)]}
          shades={['#315c49', '#e7ebdf']}
          value={total ? `${Math.round((saved / total) * 100)}%` : '—'}
          caption="funded"
          label={`${cad(saved)} saved toward ${cad(total)} in total goals`}
        />
        <div>
          <span className="stat-card-label">Saved toward goals</span>
          <strong className="stat-card-value">{cad(saved)}</strong>
          <small>of {cad(total)} in targets</small>
        </div>
      </article>
      <Stat
        label="Still to save"
        value={cad(Math.max(0, total - saved))}
        note={`${report.goals.length} savings goals`}
        icon={<Target size={17} />}
      />
      <Stat
        label="Next goal deadline"
        value={next ? prettyDate(next.deadline) : '—'}
        note={next?.name || 'No upcoming deadline'}
        icon={<CalendarDays size={17} />}
      />
    </div>
  );
}
