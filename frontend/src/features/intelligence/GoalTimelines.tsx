import { useState } from 'react';
import type { ForecastReport } from '../../../../shared/intelligence';
import { cad, prettyDate } from '../../../../shared/finance';
import { Button, Empty, Field, SectionTitle } from '../../components/ui';
import { useApp } from '../../lib';
import { ForecastChart, ForecastMetric, money } from './ForecastCharts';
import { GoalStats } from './OutlookStats';

export function GoalTimelines({ report }: { report: ForecastReport }) {
  const { navigate } = useApp();
  const [selected, select] = useState('');
  const goal = report.goals.find((g) => g.id === selected) || report.goals[0];
  const change = report.goalChanges?.goals.find((g) => g.id === goal?.id);
  return (
    <div className="forecast-stack">
      <SectionTitle
        title="My goals"
        action={
          <Button variant="secondary" onClick={() => navigate('goals')}>
            Manage goals
          </Button>
        }
      />
      {report.goals.length > 0 && <GoalStats report={report} />}
      {goal ? (
        <section className="card goal-at-glance">
          <Field label="Choose a goal">
            <select value={goal.id} onChange={(e) => select(e.target.value)}>
              {report.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="goal-main">
            <div>
              <h2>{goal.name}</h2>
              <span>Due {prettyDate(goal.deadline)}</span>
            </div>
            <div>
              <strong>{cad(goal.current)}</strong>
              <span>of {cad(goal.target)} saved</span>
            </div>
          </div>
          <div
            className="goal-progress"
            role="progressbar"
            aria-label={`Saved toward ${goal.name}`}
            aria-valuemin={0}
            aria-valuemax={goal.target}
            aria-valuenow={Math.min(goal.target, Math.max(0, goal.current))}
            aria-valuetext={`${cad(goal.current)} of ${cad(goal.target)} saved`}
          >
            <span
              style={{
                width: `${Math.min(100, Math.max(0, (goal.current / goal.target) * 100))}%`,
              }}
            />
          </div>
          <div className="forecast-metrics">
            <ForecastMetric
              label="Still to save"
              value={cad(Math.max(0, goal.target - goal.current))}
            />
            <ForecastMetric
              label="Estimated target date"
              value={
                goal.projectedDate ? prettyDate(goal.projectedDate) : 'Not reached in this outlook'
              }
            />
            <ForecastMetric
              label={
                goal.status === 'forecast' ? 'Estimated at deadline' : 'Estimated at outlook end'
              }
              value={money(goal.projectedAmount)}
            />
          </div>
          {change?.shiftDays ? (
            <p className="field-note">
              {Math.abs(change.shiftDays)} days {change.shiftDays < 0 ? 'earlier' : 'later'} than
              your last estimate.
            </p>
          ) : null}
          {goal.status !== 'forecast' && (
            <p className="field-note">
              {goal.status === 'beyond_horizon'
                ? 'Extend the outlook to include this deadline.'
                : 'This deadline has passed. Update it in Manage goals.'}
            </p>
          )}
          {goal.scenarioDate !== goal.projectedDate && (
            <p className="outlook-comparison">
              With your changes:{' '}
              <strong>
                {goal.scenarioDate ? prettyDate(goal.scenarioDate) : 'Not reached in this outlook'}
              </strong>
            </p>
          )}
          <details className="forecast-details">
            <summary>See savings over time</summary>
            {goal.trajectory.length ? (
              <ForecastChart
                goal
                target={goal.target}
                data={goal.trajectory.map((p) => ({ ...p, median: p.amount }))}
                label={`Estimated savings toward ${goal.name}, in Canadian dollars.`}
              />
            ) : (
              <p>Add a cash balance to see this timeline.</p>
            )}
            <p className="field-note">
              Goals share the same cash, after bills and your cushion. No money is moved.
            </p>
          </details>
        </section>
      ) : (
        <Empty title="Add a savings goal" detail="Set an amount and target date in My goals." />
      )}
      {!!report.goalChanges?.drivers?.length && (
        <details className="card forecast-details">
          <summary>What changed since your previous forecast?</summary>
          {report.goalChanges.drivers.map((d) => (
            <div className="forecast-pair" key={d.kind}>
              <span>
                {d.label}
                <small>{d.detail}</small>
              </span>
              {d.amount !== undefined && (
                <strong>
                  {d.amount >= 0 ? '+' : '−'}
                  {cad(Math.abs(d.amount))}
                </strong>
              )}
            </div>
          ))}
        </details>
      )}
      <SectionTitle title="Tuition" />
      {new Set(report.tuition.map((b) => b.dueDate)).size < report.tuition.length && (
        <p className="field-note">Bills on the same date share the shortfall shown below.</p>
      )}
      <div className="forecast-grid">
        {report.tuition.map((bill) => (
          <article className="card" key={bill.id + bill.dueDate}>
            <h3>{bill.name}</h3>
            <p className="field-note">
              {cad(bill.amount)} · Due {prettyDate(bill.dueDate)}
            </p>
            <div className="forecast-metrics">
              <ForecastMetric label="Estimated shortfall" value={money(bill.gapAtDeadline)} />
              <ForecastMetric label="Extra needed per week" value={money(bill.extraPerWeek)} />
            </div>
            <details className="forecast-details">
              <summary>Estimate details</summary>
              <p>
                {bill.successRate === null
                  ? 'More data needed to assess readiness.'
                  : `${bill.successRate}% of simulations cover this bill. This is not a guarantee.`}
              </p>
            </details>
          </article>
        ))}
      </div>
      {!report.tuition.length && (
        <p className="field-note">Add your tuition bill to the semester plan.</p>
      )}
    </div>
  );
}
