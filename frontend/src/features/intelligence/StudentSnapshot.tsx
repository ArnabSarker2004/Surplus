import { useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, GraduationCap, CalendarDays, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastReport } from '../../../../shared/intelligence';
import { cad, prettyDate } from '../../../../shared/finance';
import { Button } from '../../components/ui';
import { chartMoney } from '../../components/chart-format';
import { money } from './ForecastCharts';

export function StudentSnapshot({
  report: r,
  onWork,
  onCash,
  onTuition,
}: {
  report: ForecastReport;
  onWork: () => void;
  onCash: () => void;
  onTuition: () => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const s = r.student;
  const term = s?.semester;
  const bill = r.tuition
    .filter((b) => b.dueDate > r.asOf)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const gap = s?.gaps[0];
  const tuitionCovered =
    bill?.gapAtDeadline === null || !bill ? null : Math.max(0, bill.amount - bill.gapAtDeadline);
  const coverage =
    bill && tuitionCovered !== null ? Math.min(100, (tuitionCovered / bill.amount) * 100) : null;
  const months = s?.months || [];
  const offset = Math.min(monthOffset, Math.max(0, months.length - 1));
  const visibleMonths = months.slice(offset, offset + 7);
  const monthName = (value: string) =>
    new Date(`${value}-01T12:00:00`).toLocaleDateString('en-CA', {
      month: 'short',
      year: '2-digit',
    });
  const jobs = (s?.jobs || [])
    .filter((j) => j.lastPayday === null || j.lastPayday >= r.asOf)
    .sort((a, b) => a.firstPayday.localeCompare(b.firstPayday));
  const [jobOffset, setJobOffset] = useState(0);
  const shownJobs = jobs.slice(Math.min(jobOffset, Math.max(0, jobs.length - 1)), jobOffset + 3);
  return (
    <div className="student-overview">
      <div className="student-metrics">
        <button type="button" className="student-metric" onClick={onTuition}>
          <span>
            <GraduationCap size={18} /> Next tuition <ArrowUpRight size={15} />
          </span>
          <strong>
            {!bill
              ? 'Add tuition'
              : bill.gapAtDeadline === null
                ? 'Needs a forecast'
                : bill.gapAtDeadline > 0
                  ? `${cad(bill.gapAtDeadline)} gap`
                  : 'Covered'}
          </strong>
          <small>
            {bill
              ? `${cad(bill.amount)} due ${prettyDate(bill.dueDate)}`
              : 'Set the amount and deadline'}
          </small>
        </button>
        <button type="button" className="student-metric" onClick={onCash}>
          <span>
            <Wallet size={18} /> Cash at term end <ArrowUpRight size={15} />
          </span>
          <strong
            className={term?.balance !== null && (term?.balance ?? 0) < 0 ? 'outlook-negative' : ''}
          >
            {money(term?.balance ?? null)}
          </strong>
          <small>
            {!r.quality.cashKnown
              ? 'Start with your balance'
              : term?.inHorizon
                ? `After bills · ${prettyDate(term.end)}`
                : 'Extend the outlook to your term end'}
          </small>
        </button>
        <button type="button" className="student-metric" onClick={onWork}>
          <span>
            <BriefcaseBusiness size={18} /> Job pay ahead <ArrowUpRight size={15} />
          </span>
          <strong>
            {s?.incomeBasis === 'schedule' ? cad(s.scheduledEarnings) : 'Set work dates'}
          </strong>
          <small>
            {s?.incomeBasis === 'schedule'
              ? `Scheduled over the next ${r.horizonDays} days`
              : 'Historical wages may keep repeating'}
          </small>
        </button>
        <button type="button" className="student-metric student-metric-accent" onClick={onWork}>
          <span>
            <CalendarDays size={18} /> Next gap in job pay <ArrowUpRight size={15} />
          </span>
          <strong>
            {gap
              ? `${gap.days} days`
              : s?.incomeBasis === 'schedule'
                ? 'No gap planned'
                : 'Dates needed'}
          </strong>
          <small>
            {gap
              ? `${prettyDate(gap.start)} – ${prettyDate(gap.end)}`
              : 'Across your current outlook'}
          </small>
        </button>
      </div>
      <div className="student-dashboard-grid">
        <section className="card student-monthly">
          <div className="student-section-head">
            <div>
              <p className="student-eyebrow">YOUR STUDENT YEAR</p>
              <h2>Money in. Student life out.</h2>
            </div>
            <Button variant="ghost" onClick={onCash}>
              Cash forecast <ArrowUpRight size={15} />
            </Button>
          </div>
          <p className="field-note">
            Pay and planned funding alongside living costs and tuition. First and last months may be
            partial.
          </p>
          <div className="student-chart-legend">
            <span>
              <i /> Money in
            </span>
            <span>
              <i /> Spending & tuition
            </span>
          </div>
          {visibleMonths.length ? (
            <div
              className="student-month-chart"
              role="img"
              aria-label={visibleMonths
                .map(
                  (m) =>
                    `${monthName(m.month)}: ${cad(m.income)} incoming, ${cad(m.spending)} outgoing`,
                )
                .join('; ')}
            >
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={visibleMonths}
                  barGap={5}
                  margin={{ top: 12, right: 4, bottom: 0, left: -12 }}
                >
                  <CartesianGrid vertical={false} stroke="#e4e8df" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) =>
                      new Date(`${v}-01T12:00:00`).toLocaleDateString('en-CA', { month: 'short' })
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#506149', fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={chartMoney}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#506149', fontSize: 11 }}
                    width={65}
                  />
                  <Tooltip
                    labelFormatter={(v) => monthName(String(v))}
                    formatter={(v: number, name: string) => [cad(v), name]}
                  />
                  <Bar
                    dataKey="income"
                    name="Money in"
                    fill="#315c49"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="spending"
                    name="Spending & tuition"
                    fill="#ba8054"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p>Your monthly picture will appear with the next forecast.</p>
          )}
          {months.length > 7 && (
            <div className="button-row">
              <Button
                variant="ghost"
                disabled={!offset}
                onClick={() => setMonthOffset(Math.max(0, offset - 7))}
              >
                Earlier months
              </Button>
              <Button
                variant="ghost"
                disabled={offset + 7 >= months.length}
                onClick={() => setMonthOffset(offset + 7)}
              >
                Later months
              </Button>
            </div>
          )}
          <div className="student-tuition-strip">
            <div>
              <GraduationCap size={20} />
              <strong>{bill?.name || 'Plan your next tuition bill'}</strong>
              <span>
                {coverage === null
                  ? 'Amount and cash balance needed'
                  : `${Math.round(coverage)}% covered at the deadline`}
              </span>
            </div>
            <div
              className="student-progress"
              role="img"
              aria-label={
                coverage === null
                  ? 'Tuition coverage unavailable'
                  : `${Math.round(coverage)} percent of tuition covered`
              }
            >
              <i style={{ width: `${coverage ?? 0}%` }} />
            </div>
            <small>
              {bill?.gapAtDeadline
                ? `${cad(bill.extraPerWeek ?? 0)} extra per week would close the modeled gap.`
                : bill && coverage !== null
                  ? 'Based on estimated cash after bills, your buffer and saved goals.'
                  : 'Add or review tuition in your semester plan.'}
            </small>
          </div>
        </section>
        <section className="card student-work-preview">
          <div className="student-section-head">
            <div>
              <p className="student-eyebrow">WORK → STUDY → WORK</p>
              <h2>After the last paycheque</h2>
            </div>
          </div>
          <div className="student-term-track">
            {shownJobs.map((job) => (
              <div className="student-track-item" key={job.id}>
                <span className="student-track-dot" />
                <div>
                  <strong>{job.name}</strong>
                  <small>
                    {job.kind} · {prettyDate(job.start)}
                    {job.end ? ` – ${prettyDate(job.end)}` : ''}
                  </small>
                  <span>
                    {job.lastPayday
                      ? `Last pay ${prettyDate(job.lastPayday)}`
                      : 'No last payday set'}{' '}
                    · {job.paydaysLeft} paydays ahead
                  </span>
                </div>
              </div>
            ))}
            {!jobs.length && (
              <p>
                {s?.incomeBasis === 'schedule'
                  ? 'No upcoming job pay in your plan.'
                  : 'Add a work term to see when pay stops.'}
              </p>
            )}
            {jobs.length > 3 && (
              <div className="button-row">
                <Button
                  variant="ghost"
                  disabled={!jobOffset}
                  onClick={() => setJobOffset(Math.max(0, jobOffset - 3))}
                >
                  Previous jobs
                </Button>
                <Button
                  variant="ghost"
                  disabled={jobOffset + 3 >= jobs.length}
                  onClick={() => setJobOffset(jobOffset + 3)}
                >
                  More jobs
                </Button>
              </div>
            )}
          </div>
          {gap ? (
            <div className={`student-gap ${gap.firstPressureDate ? 'student-gap-warning' : ''}`}>
              <span>To bridge the next gap</span>
              <strong>{cad(gap.cashNeeded)}</strong>
              <p>
                Estimated costs minus other planned income during {gap.days} days without job pay.
              </p>
              <small>
                {gap.firstPressureDate
                  ? `Your protected cash is at risk from ${prettyDate(gap.firstPressureDate)}.`
                  : gap.endingCash === null
                    ? 'Add your current cash to check coverage.'
                    : `Estimated cash after the gap: ${cad(gap.endingCash)}.`}
              </small>
            </div>
          ) : (
            <div className="student-gap">
              <strong>
                {s?.incomeBasis === 'schedule'
                  ? 'Check your last payday'
                  : 'Make the forecast fit your term'}
              </strong>
              <p>
                {s?.incomeBasis === 'schedule'
                  ? 'A job without an end date keeps paying across the outlook.'
                  : 'Co-op terms and campus jobs have an end. Your forecast should too.'}
              </p>
            </div>
          )}
          <Button variant="secondary" onClick={onWork}>
            Plan work & study <ArrowUpRight size={15} />
          </Button>
        </section>
      </div>
    </div>
  );
}
