import { useState } from 'react';
import type { Workspace } from '../../../../shared/schema';
import { studentCalendar } from '../../../../shared/student-calendar';
import { cad } from '../../../../shared/finance';
import { useApp, uid } from '../../lib';
import { Button, Field, Modal, MoneyInput, SectionTitle } from '../../components/ui';

type LifeEvent = NonNullable<Workspace['lifeEvents']>[number];
export function StudentPlan({
  asOf,
  view = 'changes',
}: {
  asOf: string;
  view?: 'changes' | 'calendar' | 'accounts';
}) {
  const { w, state, save: saveWorkspace, notify, busy } = useApp();
  const save = async (next: typeof w, message?: string) => {
    try {
      await saveWorkspace(next, message);
      return true;
    } catch {
      return false;
    }
  };
  const [draft, setDraft] = useState<LifeEvent | null>(null);
  const [tuition, setTuition] = useState<{ name: string; date: string; amount: number } | null>(
    null,
  );
  const accounts = state.accounts.filter((a) => a.type === 'depository' && a.currency === 'CAD');
  const isTmu = /toronto metropolitan|\btmu\b|ryerson/i.test(w.profile.institution);
  const dates = studentCalendar.events.filter(
    (e) => e.end >= asOf && !(e.id === 'fall-study' && /engineering/i.test(w.profile.faculty)),
  );
  return (
    <section className="card student-plan">
      {view === 'changes' && (
        <>
          <SectionTitle
            title="Life changes your spending"
            subtitle="Add a dated change to your usual pattern, such as fewer shifts during exams. These are your assumptions; calendar dates do not automatically change your money."
          />
          <Button
            variant="secondary"
            onClick={() =>
              setDraft({
                id: uid(),
                name: 'Change in work hours',
                start: asOf,
                end: asOf,
                weeklyIncomeChange: 0,
                weeklyExpenseChange: 0,
              })
            }
          >
            Add a dated change
          </Button>
          {(w.lifeEvents || []).map((e) => (
            <div className="review-queue-row" key={e.id}>
              <div>
                <strong>{e.name}</strong>
                <small>
                  {e.start} to {e.end}
                </small>
                <small>
                  Weekly incoming change {cad(e.weeklyIncomeChange)} · Variable spending change{' '}
                  {cad(e.weeklyExpenseChange)}
                </small>
              </div>
              <div className="button-row">
                <Button variant="ghost" onClick={() => setDraft(e)}>
                  Edit change
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void save({
                      ...w,
                      lifeEvents: (w.lifeEvents || []).filter((x) => x.id !== e.id),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      {view === 'calendar' && !isTmu && (
        <p>
          Add tuition amounts and deadlines in your semester plan. Your outlook uses those exact
          dates.
        </p>
      )}
      {view === 'calendar' && isTmu && (
        <>
          <h3>Dates to plan around at TMU</h3>
          <p className="field-note">
            Official undergraduate dates · checked {studentCalendar.reviewedAt}. Confirm your
            program and tuition amount. These reminders never add assumed income or tuition
            automatically.
          </p>
          {asOf > studentCalendar.validThrough ? (
            <p>This calendar needs its next annual update. Check the official source.</p>
          ) : (
            dates.map((e) => (
              <div className="review-queue-row" key={e.id}>
                <div>
                  <strong>{e.name}</strong>
                  <small>
                    {e.start}
                    {e.end !== e.start ? ` to ${e.end}` : ''}
                  </small>
                  <small>{e.note}</small>
                </div>
                {e.kind === 'tuition' ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setTuition({
                        name: e.name,
                        date: e.start,
                        amount:
                          w.expenses.find(
                            (x) => x.category === 'Tuition and School' && x.date === e.start,
                          )?.amount || 0,
                      })
                    }
                  >
                    Plan this bill
                  </Button>
                ) : e.kind === 'study' ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: uid(),
                        name: e.name,
                        start: e.start,
                        end: e.end,
                        weeklyIncomeChange: 0,
                        weeklyExpenseChange: 0,
                      })
                    }
                  >
                    Use these dates
                  </Button>
                ) : null}
              </div>
            ))
          )}
          <a href={studentCalendar.source} target="_blank" rel="noreferrer">
            Verify TMU's official calendar ↗
          </a>
        </>
      )}
      {view === 'accounts' && (
        <>
          <h3>Which account pays each bill?</h3>
          <p className="field-note">
            Choose the CAD cash account used for each plan entry. With one cash account, unassigned
            payments use it; with several, unassigned payments remain an explicit gap.
          </p>
          {[
            ...w.expenses.map((e) => ({ ...e, field: 'expenses' as const })),
            ...w.funding
              .filter((f) => f.status !== 'Applied')
              .map((f) => ({ ...f, field: 'funding' as const })),
          ].map((e) => (
            <div className="payment-assignment" key={`${e.field}-${e.id}`}>
              <span>
                {e.name}
                <small>
                  {cad(e.amount)} · {e.date}
                </small>
              </span>
              <select
                aria-label={`Account for ${e.name}`}
                value={e.accountId || ''}
                disabled={busy}
                onChange={(event) =>
                  void save({
                    ...w,
                    [e.field]: w[e.field].map((item) =>
                      item.id === e.id ? { ...item, accountId: event.target.value || null } : item,
                    ),
                  })
                }
              >
                <option value="">
                  {accounts.length === 1 ? 'Use my only cash account' : 'Not assigned'}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}
      {draft && (
        <Modal title="Plan a change in your routine" onClose={() => setDraft(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (draft.end < draft.start) {
                notify('End date must be on or after start date.', true);
                return;
              }
              const saved = await save(
                {
                  ...w,
                  lifeEvents: [...(w.lifeEvents || []).filter((x) => x.id !== draft.id), draft],
                },
                'Saved your dated change.',
              );
              if (saved) setDraft(null);
            }}
          >
            <div className="form-stack">
              <Field label="Change name">
                <input
                  required
                  maxLength={160}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <div className="form-grid">
                <Field label="Change starts">
                  <input
                    type="date"
                    required
                    value={draft.start}
                    onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  />
                </Field>
                <Field label="Change ends">
                  <input
                    type="date"
                    required
                    min={draft.start}
                    value={draft.end}
                    onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label="Weekly incoming change"
                hint="Extra money is positive; fewer paid shifts is negative. This adjusts your existing forecast, so do not also add the same change as new funding."
              >
                <input
                  aria-label="Weekly incoming change"
                  type="number"
                  step="0.01"
                  min="-10000"
                  max="10000"
                  value={draft.weeklyIncomeChange}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDraft({ ...draft, weeklyIncomeChange: Number(e.target.value) })
                  }
                />
              </Field>
              <Field
                label="Weekly variable spending change"
                hint="Positive adds spending; negative reduces modeled variable spending. Update rent or tuition directly in the semester plan."
              >
                <input
                  aria-label="Weekly variable spending change"
                  type="number"
                  step="0.01"
                  min="-10000"
                  max="10000"
                  value={draft.weeklyExpenseChange}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDraft({ ...draft, weeklyExpenseChange: Number(e.target.value) })
                  }
                />
              </Field>
              <p className="field-note">
                Changes are spread across active days. Overlapping changes add together and are
                included in your saved baseline.
              </p>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button disabled={busy}>Save dated change</Button>
            </div>
          </form>
        </Modal>
      )}
      {tuition && (
        <Modal title="Confirm your tuition bill" onClose={() => setTuition(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (tuition.amount <= 0) return;
              const existing = w.expenses.find(
                (x) => x.category === 'Tuition and School' && x.date === tuition.date,
              );
              const saved = await save(
                {
                  ...w,
                  expenses: [
                    ...w.expenses.filter((x) => x.id !== existing?.id),
                    {
                      id: existing?.id || uid(),
                      name: tuition.name,
                      date: tuition.date,
                      amount: tuition.amount,
                      category: 'Tuition and School',
                      essential: true,
                      frequency: 'Once',
                      accountId: existing?.accountId,
                    },
                  ],
                },
                'Tuition bill saved.',
              );
              if (saved) setTuition(null);
            }}
          >
            <div className="form-stack">
              <p>
                {tuition.name} · {tuition.date}. A tuition entry on this same date will be updated.
              </p>
              <Field label="Assessed tuition amount">
                <MoneyInput
                  value={tuition.amount}
                  onChange={(amount) => setTuition({ ...tuition, amount })}
                />
              </Field>
              <p className="field-note">
                Use your assessed amount from MyServiceHub. The calendar supplies a deadline, not
                your personal fee amount.
              </p>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setTuition(null)}>
                Cancel
              </Button>
              <Button disabled={busy || tuition.amount <= 0}>Save tuition bill</Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
