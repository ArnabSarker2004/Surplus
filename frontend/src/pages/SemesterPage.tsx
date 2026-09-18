import { ArrowRight, CalendarDays, Info, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  cad,
  fundingAmount,
  isFundingIncluded,
  occurrences,
  plan,
  prettyDate,
  sum,
} from '../../../shared/finance';
import { ExpenseEditor, FundingEditor } from '../components/Editors';
import { Badge, Button, Empty, Modal, PageHead, SectionTitle } from '../components/ui';
import { useApp } from '../lib';

export function SemesterPage() {
  const { w, state, save, busy, navigate, edit } = useApp();
  const p = plan(w, state.opportunities);
  const [editor, setEditor] = useState<'funding' | 'expenses' | null>(null);
  const [draft, setDraft] = useState(w);
  const open = (type: typeof editor) => {
    setDraft(structuredClone(w));
    setEditor(type);
  };
  const groups = ['Non-repayable', 'Repayable', 'Earned', 'Personal'];
  return (
    <>
      <PageHead
        eyebrow="YOUR SEMESTER PLAN"
        title="See the whole picture."
        description="A home for every cost, every source, and every possibility."
        action={
          <Button variant="secondary" onClick={edit}>
            Edit semester <CalendarDays size={16} />
          </Button>
        }
      />
      <div className="plan-summary">
        <div>
          <span>Total semester costs</span>
          <strong>{cad(p.cost)}</strong>
        </div>
        <span className="math-symbol">−</span>
        <div>
          <span>Planned funding</span>
          <strong>{cad(p.funding)}</strong>
        </div>
        <span className="math-symbol">=</span>
        <div>
          <span>{p.gap ? 'Funding gap' : 'Projected surplus'}</span>
          <strong className={p.gap ? 'amber-text' : 'positive'}>{cad(p.gap || p.ending)}</strong>
        </div>
        <Badge tone={p.gap ? 'amber' : 'green'}>
          {p.gap ? 'Let’s make a little room' : 'Costs are covered'}
        </Badge>
      </div>
      <div className="inline-notice">
        <Info size={18} />
        <span>
          {cad(p.confirmed)} confirmed + {cad(p.earned)} expected earnings + {cad(p.awarded)}{' '}
          awarded opportunities. {cad(p.pending)} in pending funding and {cad(p.potential)} in
          opportunity applications stay outside your base plan.
        </span>
      </div>
      <div className="two-col">
        <section className="card">
          <SectionTitle
            title="Where it’s coming from"
            subtitle="Separate grants, loans, work, and savings"
            action={
              <button
                className="icon-button"
                aria-label="Edit funding"
                onClick={() => open('funding')}
              >
                <Plus size={20} />
              </button>
            }
          />
          <div className="funding-groups">
            {groups.map((type) => (
              <div key={type}>
                <span>
                  <span className={`funding-dot type-${type.toLowerCase()}`} />
                  {type}
                </span>
                <strong>
                  {cad(
                    sum(
                      w.funding
                        .filter((f) => f.type === type && isFundingIncluded(f))
                        .map((f) => fundingAmount(w, f)),
                    ),
                  )}
                </strong>
              </div>
            ))}
          </div>
          <div className="detail-list">
            {w.funding.map((f) => (
              <div key={f.id}>
                <span>
                  <strong>{f.name}</strong>
                  <small>
                    {prettyDate(f.date)} · {f.frequency} · {f.type}
                  </small>
                </span>
                <span>
                  <strong>{cad(fundingAmount(w, f))}</strong>
                  <Badge tone={isFundingIncluded(f) ? 'green' : 'amber'}>{f.status}</Badge>
                </span>
              </div>
            ))}
          </div>
          {!w.funding.length && (
            <Empty
              title="Every source belongs here"
              detail="Add savings, grants, loans, employment, or family support."
            />
          )}
          <Button variant="secondary" onClick={() => open('funding')}>
            Manage funding <ArrowRight size={16} />
          </Button>
        </section>
        <section className="card">
          <SectionTitle
            title="What you’re planning for"
            subtitle="One-time and recurring semester costs"
            action={
              <button
                className="icon-button"
                aria-label="Edit expenses"
                onClick={() => open('expenses')}
              >
                <Plus size={20} />
              </button>
            }
          />
          <div className="detail-list expense-list">
            {w.expenses.map((e) => (
              <div key={e.id}>
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {prettyDate(e.date)} ·{' '}
                    {e.frequency === 'Once' ? 'One-time' : `${cad(e.amount)} / month`} ·{' '}
                    {e.essential ? 'Essential' : 'Flexible'}
                  </small>
                </span>
                <strong>
                  {cad(
                    e.amount *
                      occurrences(e.date, e.frequency, w.semester.start, w.semester.end).length,
                  )}
                </strong>
              </div>
            ))}
          </div>
          {!w.expenses.length && (
            <Empty
              title="Make room for the real costs"
              detail="Add tuition, rent, transportation, and everyday spending."
            />
          )}
          <Button variant="secondary" onClick={() => open('expenses')}>
            Manage costs <ArrowRight size={16} />
          </Button>
        </section>
      </div>
      <section className="card timeline-card">
        <SectionTitle
          title="Timing matters, too."
          subtitle="Monthly planned cash flow · deposits and expenses use their expected dates"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Funding</th>
                <th>Costs</th>
                <th>Projected balance</th>
              </tr>
            </thead>
            <tbody>
              {p.timeline.map((t) => (
                <tr key={t.month}>
                  <td>
                    {t.label} {t.month.slice(0, 4)}
                  </td>
                  <td className="positive">+{cad(t.income)}</td>
                  <td>{cad(t.expenses)}</td>
                  <td>
                    <Badge tone={t.balance < 0 ? 'amber' : 'green'}>{cad(t.balance, true)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-note">
          This is an entered semester budget, not a bank-balance forecast. Already received funding
          belongs in the semester it funds. Imported deposits do not get counted again. A monthly
          view can hide an earlier shortfall within that month.
        </p>
      </section>
      <div className="action-banner">
        <span className="circle-icon sage">
          <SlidersHorizontal size={23} />
        </span>
        <div>
          <h3>There’s more than one way to close a gap.</h3>
          <p>
            {cad(p.monthlyAction)} per remaining month would cover costs and your{' '}
            {cad(w.semester.minimumBalance)} desired balance.
          </p>
        </div>
        <Button onClick={() => navigate('scenario')}>
          Explore a what-if <ArrowRight size={16} />
        </Button>
      </div>
      {editor && (
        <Modal
          title={editor === 'funding' ? 'Your funding sources' : 'Your planned costs'}
          onClose={() => setEditor(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save(draft);
                setEditor(null);
              } catch {
                /* Toast explains the failure. */
              }
            }}
          >
            {editor === 'funding' ? (
              <FundingEditor
                value={draft.funding}
                onChange={(funding) => setDraft({ ...draft, funding })}
                date={w.semester.start}
              />
            ) : (
              <ExpenseEditor
                value={draft.expenses}
                onChange={(expenses) => setDraft({ ...draft, expenses })}
                date={w.semester.start}
              />
            )}
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button disabled={busy} type="submit">
                Save changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
