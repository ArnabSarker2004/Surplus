import { useState } from 'react';
import type { ForecastOptions, ForecastReport, HabitReport } from '../../../../shared/intelligence';
import type { AppState } from '../../../../shared/schema';
import { cad, prettyDate } from '../../../../shared/finance';
import { Badge, Button, SectionTitle } from '../../components/ui';
import { api, useApp } from '../../lib';
import { ForecastMetric } from './ForecastCharts';
import { HabitStats, SpendingMix } from './OutlookStats';

const hour = (value: number) =>
  value === 24 ? 'midnight' : `${value % 12 || 12} ${value < 12 ? 'AM' : 'PM'}`;
export function BehaviorPanel({
  report,
  onTry,
  busy,
}: {
  report: ForecastReport;
  onTry: (change: ForecastOptions['habitAdjustment']) => void;
  busy: boolean;
}) {
  const { demo, refresh, notify, navigate } = useApp();
  const [saving, setSaving] = useState('');
  const [measure, setMeasure] = useState<'money' | 'frequency'>('money');
  const [group, setGroup] = useState<'all' | 'optional' | 'groceries' | 'routine'>('all');
  const b = report.behavior,
    h = report.habits;
  const days =
    measure === 'money'
      ? h.days.map((d) => ({
          label: d.label,
          amount: group === 'all' ? d.optional + d.groceries + d.routine : d[group],
        }))
      : b.frequency.days.map((d) => ({ label: d.label, amount: d.observed }));
  const max = Math.max(1, ...days.map((d) => d.amount));
  const changeTreatment = async (
    id: string,
    treatment: HabitReport['review'][number]['treatment'],
  ) => {
    setSaving(id);
    try {
      refresh(
        await api<AppState>(`/intelligence/habits/${encodeURIComponent(id)}`, 'PATCH', {
          treatment,
        }),
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setSaving('');
    }
  };
  return (
    <div className="forecast-stack">
      <HabitStats report={report} />
      <section className="card">
        <SectionTitle
          title={measure === 'money' ? 'Average spending by day' : 'Purchases by day'}
          subtitle={`${measure === 'money' ? h.weeks : b.frequency.weeks} complete weeks · per weekday`}
        />
        <div className="plot-controls">
          <div className="forecast-segment" aria-label="Chart measure">
            <Button
              variant={measure === 'money' ? 'primary' : 'ghost'}
              aria-pressed={measure === 'money'}
              onClick={() => setMeasure('money')}
            >
              Spending
            </Button>
            <Button
              variant={measure === 'frequency' ? 'primary' : 'ghost'}
              aria-pressed={measure === 'frequency'}
              onClick={() => setMeasure('frequency')}
            >
              Purchase frequency
            </Button>
          </div>
          {measure === 'money' && (
            <select
              aria-label="Spending to show"
              value={group}
              onChange={(e) => setGroup(e.target.value as typeof group)}
            >
              <option value="all">All spending</option>
              <option value="optional">Optional purchases</option>
              <option value="groceries">Groceries</option>
              <option value="routine">Routine & other</option>
            </select>
          )}
        </div>
        <figure
          className="weekday-chart"
          aria-label={
            measure === 'money'
              ? 'Average spending per weekday in Canadian dollars'
              : 'Average optional purchases per weekday'
          }
        >
          {days.map((d) => (
            <div className="weekday-row" key={d.label}>
              <span>{d.label.slice(0, 3)}</span>
              <div className="weekday-track" aria-hidden="true">
                <i style={{ width: `${(Math.max(0, d.amount) / max) * 100}%` }} />
              </div>
              <strong>{measure === 'money' ? cad(d.amount) : `${d.amount.toFixed(1)} buys`}</strong>
            </div>
          ))}
        </figure>
        <details className="forecast-details">
          <summary>How this is calculated</summary>
          <p>
            {measure === 'money'
              ? 'Average per weekday, including days without purchases. Uses posted spending.'
              : b.frequency.note}
          </p>
          {measure === 'frequency' && <p>{b.frequency.method}</p>}
        </details>
      </section>
      <SpendingMix report={report} />
      <div className="forecast-grid">
        {h.patterns.map((p) => (
          <article className="card habit-prompt" key={p.id}>
            <Badge>
              {p.day} · {p.category}
            </Badge>
            <h3>
              {cad(p.weeklyAverage)} on an average {p.day}
            </h3>
            <details className="forecast-details">
              <summary>Pattern evidence</summary>
              <p>{p.explanation}</p>
            </details>
            <p>
              25% less could free up <strong>{cad(p.monthlyChangeAt25)}/month</strong>.
            </p>
            <Button
              variant="secondary"
              disabled={demo || busy}
              onClick={() =>
                onTry({ weekday: p.weekday, category: p.category, reductionPercent: 25 })
              }
            >
              See the effect on my goals
            </Button>
          </article>
        ))}
      </div>
      {!h.patterns.length && <p className="inline-notice">No strong spending pattern yet.</p>}
      <details className="card forecast-details spending-insights">
        <summary>More spending insights</summary>
        <div className="forecast-stack">
          <section className="card">
            <SectionTitle
              title="When and where purchases happen"
              subtitle="Only information actually supplied by your bank is used. Times are shown in Toronto time."
            />
            <div className="forecast-metrics">
              <ForecastMetric
                label="Optional purchases analyzed"
                value={String(b.coverage.purchases)}
                detail={`${b.frequency.weeks} complete weeks`}
              />
              <ForecastMetric
                label="With purchase timestamps"
                value={`${b.coverage.timestamped} / ${b.coverage.purchases}`}
                detail="Required for hour-level sequences"
              />
              <ForecastMetric
                label="With a usable city"
                value={`${b.coverage.located} / ${b.coverage.purchases}`}
                detail="Physical locations; online excluded"
              />
            </div>
            <div className="forecast-grid">
              <div>
                <h3>Repeated time windows</h3>
                {b.windows.length ? (
                  b.windows.map((w) => (
                    <div className="forecast-observation" key={`${w.weekday}-${w.startHour}`}>
                      <strong>
                        {w.day}, {hour(w.startHour)}–{hour(w.endHour)}
                      </strong>
                      <p>
                        {w.events} purchases on {w.distinctDays} separate days · {w.shareOfTimed}%
                        of timestamped optional purchases.
                      </p>
                    </div>
                  ))
                ) : (
                  <p>
                    At least three separate days with purchase timestamps in the same window are
                    needed. Posting dates alone cannot establish an evening pattern.
                  </p>
                )}
              </div>
              <div>
                <h3>Purchases within two hours</h3>
                {b.sequences.length ? (
                  b.sequences.map((s) => (
                    <div className="forecast-observation" key={`${s.from}-${s.to}`}>
                      <strong>
                        {s.from} → {s.to}
                      </strong>
                      <p>
                        {s.occurrences} consecutive pairs across {s.distinctDays} days. This is a
                        sequence, not evidence that one purchase caused the next.
                      </p>
                    </div>
                  ))
                ) : (
                  <p>
                    No repeated sequence meets the evidence threshold. Exact authorization
                    timestamps are required.
                  </p>
                )}
              </div>
            </div>
            <h3>Places in your spending history</h3>
            {b.locations.length ? (
              <div className="forecast-grid">
                {b.locations.map((l) => (
                  <div className="forecast-observation" key={`${l.city}-${l.region}-${l.country}`}>
                    <strong>{[l.city, l.region, l.country].filter(Boolean).join(', ')}</strong>
                    <p>
                      {l.visits} optional purchases · {cad(l.total)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p>
                No city has three qualifying visits yet. Bank location coverage varies; missing
                cities are not inferred.
              </p>
            )}
            <details className="forecast-details">
              <summary>Your most frequent merchants</summary>
              {b.merchants.map((m, i) => (
                <div className="forecast-pair" key={`${m.merchant}-${i}`}>
                  <span>
                    {m.merchant}
                    <small>{m.category} · past 90 days</small>
                  </span>
                  <strong>
                    {m.visits} purchases · {cad(m.total)}
                  </strong>
                </div>
              ))}
              {!b.merchants.length && (
                <p>No merchant has three observed purchases in the last 90 days.</p>
              )}
            </details>
          </section>
          <section className="card">
            <SectionTitle
              title="Does payday change your spending?"
              subtitle="A research-informed comparison with your own history, not a label about your behaviour."
            />
            {b.payday.status === 'observed' ? (
              <div className="forecast-metrics">
                <ForecastMetric
                  label="Payday + following two days"
                  value={cad(b.payday.after!)}
                  detail="Average optional spending per day"
                />
                <ForecastMetric
                  label="Same weekdays one week earlier"
                  value={cad(b.payday.comparison!)}
                  detail="Excludes controls near other paydays"
                />
                <ForecastMetric
                  label="Observed difference"
                  value={
                    b.payday.changePercent === null
                      ? 'Baseline too small'
                      : `${b.payday.changePercent > 0 ? '+' : ''}${b.payday.changePercent}%`
                  }
                  detail={`${b.payday.cycles} separate pay cycles`}
                />
              </div>
            ) : (
              <p>Not enough comparable pay cycles yet ({b.payday.cycles} found).</p>
            )}
            <p>{b.payday.note}</p>
          </section>
          <div className="forecast-grid">
            <section className="card">
              <SectionTitle
                title="Recurring charges creeping up"
                subtitle="Monthly timing plus autocorrelation checks. A prompt to check the bill, not a claim that a subscription is unused."
              />
              {b.risingCharges.length ? (
                b.risingCharges.map((c, i) => (
                  <div className="forecast-observation" key={`${c.merchant}-${i}`}>
                    <strong>{c.merchant}</strong>
                    <p>
                      {cad(c.before)} → {cad(c.after)} per charge
                    </p>
                    <Badge tone="amber">About {cad(c.annualExtra)} more per year</Badge>
                    <p>
                      {c.observations} charges · Last {prettyDate(c.lastDate)}
                    </p>
                  </div>
                ))
              ) : (
                <p>
                  No qualifying increase found. Six monthly charges and a sustained increase of at
                  least $1 and 5% are needed.
                </p>
              )}
            </section>
            <section className="card">
              <SectionTitle
                title="Your repeat-merchant ticket trend"
                subtitle="A change in purchase size can reflect quantities, tips or habits. It is not a personal inflation measurement."
              />
              {b.ticketTrends.length ? (
                b.ticketTrends.map((t, i) => (
                  <div className="forecast-observation" key={`${t.merchant}-${i}`}>
                    <strong>{t.merchant}</strong>
                    <p>
                      Median purchase: {cad(t.before)} → {cad(t.after)} (
                      {t.changePercent > 0 ? '+' : ''}
                      {t.changePercent}%)
                    </p>
                    <small>
                      {t.earlierCount} earlier purchases · {t.recentCount} recent purchases · Two
                      90-day windows
                    </small>
                  </div>
                ))
              ) : (
                <p>
                  Two three-month windows with at least four purchases each are needed to compare a
                  merchant's typical ticket.
                </p>
              )}
            </section>
          </div>
          <section className="card">
            <SectionTitle
              title="A closer look at your spending"
              subtitle="Last 90 days of posted CAD purchases, net of refunds. Specific categories appear only when confirmed by you or supported by a strong bank category match."
            />
            {b.detailSpending.map((d) => (
              <div className="forecast-pair" key={`${d.category}-${d.detail}`}>
                <span>
                  {d.detail === 'No confirmed detail' ? d.category : d.detail}
                  <small>
                    {d.category} · {d.purchases} purchases
                    {d.detail === 'No confirmed detail' ? ' · Detail needs review' : ''}
                  </small>
                </span>
                <strong>{cad(d.amount)}</strong>
              </div>
            ))}
            {!b.detailSpending.length && (
              <p>
                No qualifying spending yet. Confirm categories in your transactions to add detail.
              </p>
            )}
            <Button variant="ghost" onClick={() => navigate('transactions')}>
              Review companies & categories
            </Button>
          </section>
          <details className="card forecast-details">
            <summary>All detected recurring payments & unusual purchases</summary>
            {report.recurring
              .filter((r) => r.direction === 'expense')
              .map((r, i) => (
                <div className="forecast-pair" key={`${r.merchant}-${i}`}>
                  <span>
                    {r.merchant}
                    <small>
                      {r.frequency} · Next {r.nextDate || 'outside forecast'} ·{' '}
                      {r.included ? 'Included in forecast' : 'Replaced by your entered plan'}
                    </small>
                  </span>
                  <strong>{cad(r.amount)}</strong>
                </div>
              ))}
            {!report.recurring.some((r) => r.direction === 'expense') && (
              <p>No stable recurring payments detected. Add known bills in your semester plan.</p>
            )}
            <h3>Unusual purchases to review</h3>
            {report.anomalies.map((a) => (
              <div className="forecast-pair" key={a.id}>
                <span>
                  {a.merchant}
                  <small>
                    {prettyDate(a.date)} · {a.category} · Earlier typical purchase{' '}
                    {cad(a.typicalAmount)}
                  </small>
                </span>
                <strong>{cad(a.amount)}</strong>
              </div>
            ))}
            {!report.anomalies.length && <p>No qualifying unusual purchases detected.</p>}
            <p>Large purchases are review prompts, not fraud or impulse determinations.</p>
          </details>
        </div>
      </details>
      <details className="card forecast-details">
        <summary>Adjust routine purchases</summary>
        <SectionTitle
          title="You know the context best"
          subtitle="Mark planned purchases as routine to remove them from habit prompts. Their amounts still count in your cash forecast."
        />
        {h.review.map((t) => (
          <div className="habit-review-row" key={t.id}>
            <div>
              <strong>{t.merchant}</strong>
              <small>
                {prettyDate(t.date)} · {t.category} · {cad(t.amount)}
              </small>
            </div>
            <select
              aria-label={`Treatment for ${t.merchant} on ${t.date}`}
              value={t.treatment}
              disabled={demo || busy || !!saving}
              onChange={(e) => void changeTreatment(t.id, e.target.value as typeof t.treatment)}
            >
              <option value="automatic">Use category</option>
              <option value="routine">Routine / planned</option>
              <option value="optional">Optional</option>
            </select>
          </div>
        ))}
        {!h.review.length && <p>No qualifying purchases to review yet.</p>}
      </details>
      <details className="card forecast-details">
        <summary>Research, evidence thresholds & limits</summary>
        {b.research.map((s) => (
          <div key={s.url}>
            <h3>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </h3>
            <p>{s.detail}</p>
          </div>
        ))}
        {[...b.notes, ...h.notes].map((note) => (
          <p key={note}>{note}</p>
        ))}
      </details>
    </div>
  );
}
