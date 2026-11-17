import { ArrowRight, Coffee, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  asOf,
  cad,
  categorySpending,
  insights,
  posted,
  spendingAnalysis,
  sum,
} from '../../../shared/finance';
import { categories, type Category } from '../../../shared/schema';
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  MoneyInput,
  PageHead,
  Progress,
  SectionTitle,
} from '../components/ui';
import { uid, useApp } from '../lib';

export function BudgetsPage() {
  const { w, state, save, busy, navigate } = useApp();
  const [month, setMonth] = useState(asOf(w).slice(0, 7));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(w.budgets);
  const suggested = insights(w, state.transactions);
  const analysis = spendingAnalysis(w, state.transactions);
  const tx = state.transactions.filter((t) => t.date.startsWith(month));
  const spending = categorySpending(tx);
  const breakdown = ['Essential', 'Flexible', 'Discretionary'].map((c) => ({
    name: c,
    amount: -sum(
      posted(tx)
        .filter((t) => t.classification === c)
        .map((t) => t.cashFlow),
    ),
  }));
  return (
    <>
      <PageHead
        eyebrow="BUDGETS & INSIGHTS"
        title="A little intention goes a long way."
        description="Set monthly spending limits and see which habits affect your budget."
        action={
          <div className="button-row">
            <input
              type="month"
              aria-label="Budget month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(structuredClone(w.budgets));
                setEditing(true);
              }}
            >
              Edit budgets <Pencil size={15} />
            </Button>
          </div>
        }
      />
      <div className="mini-stats standalone">
        {breakdown.map((b) => (
          <div key={b.name}>
            <small>{b.name} spending</small>
            <strong>{cad(b.amount, true)}</strong>
          </div>
        ))}
      </div>
      <div className="budget-grid">
        {w.budgets.map((b) => {
          const used = spending.find((s) => s.category === b.category)?.amount ?? 0;
          const percent = (used / b.limit) * 100;
          const tone = percent >= 100 ? 'red' : percent >= 80 ? 'amber' : 'green';
          return (
            <section className="card budget-card" key={b.id}>
              <div className="budget-title">
                <h3>{b.category}</h3>
                <Badge tone={tone}>
                  {percent >= 100
                    ? 'Over budget'
                    : percent >= 80
                      ? 'Approaching limit'
                      : 'Within budget'}
                </Badge>
              </div>
              <div className="budget-numbers">
                <strong>{cad(used)}</strong>
                <span>of {cad(b.limit)}</span>
              </div>
              <Progress value={percent} label={`${b.category} budget used`} tone={tone} />
              <div className="budget-caption">
                <span>
                  {used > b.limit ? `${cad(used - b.limit)} over` : `${cad(b.limit - used)} left`}
                </span>
                <span>{Math.round(percent)}% used</span>
              </div>
            </section>
          );
        })}
      </div>
      {!w.budgets.length && (
        <Empty
          title="Set a little intention"
          detail="Add a monthly category budget to get started."
          action={<Button onClick={() => setEditing(true)}>Add a budget</Button>}
        />
      )}
      <div className="section-divider">
        <div>
          <span className="eyebrow">PATTERNS, WITH A PURPOSE</span>
          <h2>A few things we noticed.</h2>
        </div>
        <Badge>Based on your transactions</Badge>
      </div>
      <div className="insight-grid">
        {suggested.map((s, i) => (
          <section className="card insight-card" key={s.id}>
            <span className={`circle-icon ${i === 1 ? 'sand' : 'sage'}`}>
              {i === 1 ? <Coffee size={21} /> : <Sparkles size={21} />}
            </span>
            <h3>{s.title}</h3>
            <p>{s.detail}</p>
            <p>{s.action}</p>
            <div className="insight-impact">
              <strong>{cad(s.impact)}</strong>
              <span>potential monthly reduction</span>
            </div>
            <small>{s.assumption}</small>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await save(
                    { ...w, scenario: { ...w.scenario, monthlyReduction: s.impact } },
                    'Spending change added to your what-if planner.',
                  );
                  navigate('scenario');
                } catch {
                  /* Toast shows error. */
                }
              }}
            >
              Try this in my plan <ArrowRight size={15} />
            </Button>
          </section>
        ))}
      </div>
      {!suggested.length && (
        <Empty
          title="Patterns take a little time"
          detail="We use completed months to make fair comparisons. More history will help us spot useful changes."
        />
      )}
      <div className="two-col">
        <section className="card">
          <SectionTitle
            title="Regulars in your routine"
            subtitle="Similar merchant charges in each of the last three complete months"
          />
          {analysis.recurring.length ? (
            <div className="detail-list">
              {analysis.recurring.map((r) => (
                <div key={r.merchant}>
                  <span>
                    <strong>{r.merchant}</strong>
                    <small>
                      {r.category} · {r.observations} observations
                    </small>
                  </span>
                  <strong>{cad(r.monthly, true)} / month</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No clear recurring pattern yet"
              detail="Three complete months help us distinguish a regular bill from an occasional purchase."
            />
          )}
          <p className="field-note">
            Estimated recurring charges, not verified contracts. One or two purchases each month,
            with monthly amounts within 20% of their average.
          </p>
        </section>
        <section className="card">
          <SectionTitle title="A wider view" subtitle={`Transaction patterns as of ${asOf(w)}`} />
          <div className="detail-list">
            <div>
              <span>Discretionary spending in the last 7 days</span>
              <strong>{cad(analysis.weeklyDiscretionary)}</strong>
            </div>
            <div>
              <span>Average spending per complete month</span>
              <strong>{cad(analysis.monthlyAverage)}</strong>
            </div>
            <div>
              <span>Trend across remaining semester months</span>
              <strong>{cad(analysis.projectedRemainingSpending)}</strong>
            </div>
          </div>
          {analysis.unusual.length ? (
            <>
              <h3>Worth a second look</h3>
              {analysis.unusual.map((t) => (
                <p className="field-note" key={t.id}>
                  {t.merchant}: {cad(-t.cashFlow)} on {t.date}, more than twice your previous
                  average purchase there.
                </p>
              ))}
            </>
          ) : (
            <p className="field-note">
              No unusually large purchases found against your recent merchant history.
            </p>
          )}
          <p className="field-note">
            Trend assumes recent spending repeats. It does not include newly planned tuition or
            other upcoming costs. Your entered semester plan is the primary forecast.
          </p>
        </section>
      </div>
      {editing && (
        <Modal title="Your monthly budgets" onClose={() => setEditing(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save({ ...w, budgets: draft });
                setEditing(false);
              } catch {
                /* Toast shows error. */
              }
            }}
          >
            <div className="form-stack">
              {draft.map((b) => (
                <div key={b.id} className="budget-edit-row">
                  <Field label="Category">
                    <select
                      value={b.category}
                      onChange={(e) =>
                        setDraft(
                          draft.map((x) =>
                            x.id === b.id ? { ...x, category: e.target.value as Category } : x,
                          ),
                        )
                      }
                    >
                      {categories
                        .filter(
                          (c) => !['Debt Payments', 'Savings Transfer', 'Investing'].includes(c),
                        )
                        .map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Monthly limit">
                    <MoneyInput
                      min={1}
                      value={b.limit}
                      onChange={(limit) =>
                        setDraft(draft.map((x) => (x.id === b.id ? { ...x, limit } : x)))
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${b.category} budget`}
                    onClick={() => setDraft(draft.filter((x) => x.id !== b.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setDraft([
                    ...draft,
                    {
                      id: uid(),
                      category:
                        categories.find(
                          (c) =>
                            !draft.some((b) => b.category === c) &&
                            [
                              'Groceries',
                              'Eating Out',
                              'Coffee',
                              'Shopping',
                              'Subscriptions',
                              'Entertainment',
                            ].includes(c),
                        ) ?? 'Other',
                      limit: 100,
                    },
                  ])
                }
              >
                <Plus size={16} /> Add category budget
              </Button>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button disabled={busy}>Save budgets</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
