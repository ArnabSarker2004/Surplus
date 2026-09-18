import { ArrowRight, Leaf, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  asOf,
  cad,
  forecast,
  prettyDate,
  readiness,
  safeToSave,
  scenarioPlan,
  sum,
} from '../../../shared/finance';
import { type Goal } from '../../../shared/schema';
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  MoneyInput,
  PageHead,
  Progress,
  TextLink,
} from '../components/ui';
import { uid, useApp } from '../lib';

export function GoalsPage() {
  const { w, state, save, busy, navigate } = useApp();
  const [goal, setGoal] = useState<Goal | null>(null);
  const safe = safeToSave(w, state.accounts, state.opportunities);
  const hypothetical = scenarioPlan(w, state.opportunities);
  const ready = readiness(w, state.opportunities);
  const monthlyEssential = sum(
    w.expenses.filter((e) => e.essential && e.frequency === 'Monthly').map((e) => e.amount),
  );
  const emergency = w.goals.find((g) => /emergency/i.test(g.name));
  return (
    <>
      <PageHead
        eyebrow="SAVINGS GOALS"
        title="For your future self."
        description="Whatever you’re working toward, start with a little room."
        action={
          <Button
            onClick={() =>
              setGoal({
                id: uid(),
                name: '',
                target: 1000,
                current: 0,
                date: w.semester.end,
                priority: 'Medium',
                contribution: 0,
                frequency: 'Monthly',
              })
            }
          >
            <Plus size={17} /> New goal
          </Button>
        }
      />
      <div className="savings-hero">
        <span className="circle-icon sage">
          <ShieldCheck size={28} />
        </span>
        <div>
          <span className="eyebrow">SAFE TO SAVE · 30-DAY ESTIMATE</span>
          <h2>{cad(safe.amount)}</h2>
          <p>
            {safe.amount
              ? 'Estimated room after upcoming payments, card balances, and your minimum buffer.'
              : 'Your semester needs this money first. Keeping it accessible is progress, too.'}
          </p>
        </div>
        <div>
          <strong>
            {monthlyEssential ? ((emergency?.current ?? 0) / monthlyEssential).toFixed(1) : '—'}{' '}
            months
          </strong>
          <span>of recurring essentials in your emergency goal</span>
        </div>
      </div>
      <details className="details calculation-details">
        <summary>
          Show the safe-to-save calculation <Plus size={15} />
        </summary>
        <div className="detail-list">
          {[
            ['Available chequing cash', safe.cash],
            ['Confirmed / expected earned income in 30 days', safe.income],
            ['Planned payments in 30 days', -safe.bills],
            ['Outstanding credit-card balances', -safe.cardBalance],
            ['Minimum desired balance', -safe.buffer],
            ['Unresolved semester gap', -safe.gap],
          ].map(([label, amount]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{cad(amount as number)}</strong>
            </div>
          ))}
        </div>
        <p className="field-note">
          Conservative estimate, floored at zero. Existing goal savings are not treated as spendable
          cash. Card balances are reserved here, without counting card payments as spending. Goal
          balances are manually tracked and do not transfer money.
        </p>
      </details>
      <div className="goal-grid">
        {w.goals.map((g) => {
          const trend = forecast(w, state.transactions, g.current, g.target);
          const remaining = Math.max(0, g.target - g.current);
          const date = asOf(w);
          const months = Math.max(
            1,
            Math.ceil((Date.parse(g.date) - Date.parse(date)) / (30.44 * 86400000)),
          );
          const monthly = g.frequency === 'Weekly' ? (g.contribution * 52) / 12 : g.contribution;
          const completionMonths = monthly ? Math.ceil(remaining / monthly) : null;
          return (
            <section className="card savings-goal" key={g.id}>
              <div className="goal-card-top">
                <span className="circle-icon sage">
                  <Leaf size={24} />
                </span>
                <Badge tone={g.priority === 'High' ? 'amber' : 'neutral'}>
                  {g.priority} priority
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`Edit ${g.name}`}
                  onClick={() => setGoal({ ...g })}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <h2>{g.name}</h2>
              <p>
                For {prettyDate(g.date)}, {g.date.slice(0, 4)}
              </p>
              <div className="goal-balance">
                <strong>{cad(g.current)}</strong>
                <span>of {cad(g.target)}</span>
              </div>
              <Progress value={(g.current / g.target) * 100} label={`${g.name} progress`} />
              <div className="budget-caption">
                <span>{cad(remaining)} to go</span>
                <span>{Math.round((g.current / g.target) * 100)}%</span>
              </div>
              <div className="goal-metrics">
                <div>
                  <span>To reach your target date</span>
                  <strong>{cad(remaining / months)} / month</strong>
                </div>
                <div>
                  <span>Your planned contribution</span>
                  <strong>
                    {cad(g.contribution)} / {g.frequency === 'Weekly' ? 'week' : 'month'}
                  </strong>
                </div>
                <div>
                  <span>At that contribution</span>
                  <strong>
                    {remaining === 0
                      ? 'Goal reached'
                      : completionMonths
                        ? `About ${completionMonths} months`
                        : 'Set a contribution'}
                  </strong>
                </div>
              </div>
              <small className="field-note">
                Recent recurring net cash flow: {cad(trend.average)} / month. A trend illustration
                gives {cad(trend.ending)} by semester end before any new tuition bill. This is not a
                contribution recommendation.
              </small>
            </section>
          );
        })}
      </div>
      {!w.goals.length && (
        <Empty
          title="What are you growing toward?"
          detail="Add an emergency fund, tuition goal, laptop, or anything that matters to you."
        />
      )}
      <div className="action-banner">
        <Leaf size={27} />
        <div>
          <h3>
            Your what-if plan creates {cad(hypothetical.savingsAllocated)} in additional goal
            allocations.
          </h3>
          <p>
            Those are hypothetical. Record actual savings in your goal when you’ve set the money
            aside.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('scenario')}>
          Adjust your scenario <ArrowRight size={16} />
        </Button>
      </div>
      <section className="card readiness-strip">
        <div>
          <span className="eyebrow">YOUR NEXT FINANCIAL CHAPTER</span>
          <h2>{ready.status}</h2>
          <p>{ready.reason}</p>
        </div>
        <TextLink onClick={() => navigate('learn')}>Explore your learning path</TextLink>
      </section>
      {goal && (
        <Modal
          title={
            w.goals.some((g) => g.id === goal.id)
              ? 'A little closer to your goal'
              : 'Start something good'
          }
          onClose={() => setGoal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const goals = w.goals.some((g) => g.id === goal.id)
                ? w.goals.map((g) => (g.id === goal.id ? goal : g))
                : [...w.goals, goal];
              try {
                await save({ ...w, goals }, 'Your savings goal is updated.');
                setGoal(null);
              } catch {
                /* Toast shows error. */
              }
            }}
          >
            <div className="form-stack">
              <Field label="Goal name">
                <input
                  required
                  placeholder="e.g. Emergency fund"
                  value={goal.name}
                  onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                />
              </Field>
              <div className="form-grid">
                <Field label="Target amount">
                  <MoneyInput
                    min={1}
                    value={goal.target}
                    onChange={(target) => setGoal({ ...goal, target })}
                  />
                </Field>
                <Field label="Already saved">
                  <MoneyInput
                    value={goal.current}
                    onChange={(current) => setGoal({ ...goal, current })}
                  />
                </Field>
                <Field label="Target date">
                  <input
                    required
                    type="date"
                    value={goal.date}
                    onChange={(e) => setGoal({ ...goal, date: e.target.value })}
                  />
                </Field>
                <Field label="Priority">
                  <select
                    value={goal.priority}
                    onChange={(e) =>
                      setGoal({ ...goal, priority: e.target.value as Goal['priority'] })
                    }
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </Field>
                <Field label="Planned contribution">
                  <MoneyInput
                    value={goal.contribution}
                    onChange={(contribution) => setGoal({ ...goal, contribution })}
                  />
                </Field>
                <Field label="Contribution frequency">
                  <select
                    value={goal.frequency}
                    onChange={(e) =>
                      setGoal({ ...goal, frequency: e.target.value as Goal['frequency'] })
                    }
                  >
                    <option>Monthly</option>
                    <option>Weekly</option>
                  </select>
                </Field>
              </div>
              <p className="field-note">
                Record actual savings only. This app does not move money or verify balances.
              </p>
            </div>
            <div className="modal-actions">
              {w.goals.some((g) => g.id === goal.id) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await save(
                        { ...w, goals: w.goals.filter((g) => g.id !== goal.id) },
                        'Goal removed.',
                      );
                      setGoal(null);
                    } catch {
                      /* Toast shows error. */
                    }
                  }}
                >
                  <Trash2 size={15} /> Delete goal
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                Save goal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
