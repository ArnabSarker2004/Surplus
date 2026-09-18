import { Plus, Trash2 } from 'lucide-react';
import type { Expense, Funding } from '../../../shared/schema';
import { categories } from '../../../shared/schema';
import { uid } from '../lib';
import { Button, Field, MoneyInput } from './ui';

export function FundingEditor({
  value,
  onChange,
  date,
}: {
  value: Funding[];
  onChange: (v: Funding[]) => void;
  date: string;
}) {
  const update = (id: string, patch: Partial<Funding>) =>
    onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <div className="editor-list">
      <div className="setup-shortcuts" aria-label="Common funding sources">
        {(
          [
            'Savings',
            'Family support',
            'OSAP grant',
            'OSAP loan',
            'Scholarship',
            'Employment income',
          ] as const
        ).map((name) => (
          <button
            type="button"
            key={name}
            onClick={() =>
              onChange([
                ...value,
                {
                  id: uid(),
                  name,
                  amount: 0,
                  date,
                  type:
                    name === 'OSAP loan'
                      ? 'Repayable'
                      : name === 'Employment income'
                        ? 'Earned'
                        : ['Savings', 'Family support'].includes(name)
                          ? 'Personal'
                          : 'Non-repayable',
                  status: 'Expected',
                  frequency: name === 'Employment income' ? 'Biweekly' : 'Once',
                },
              ])
            }
          >
            + {name}
          </button>
        ))}
      </div>
      {value.map((f, i) => (
        <div className="editor-row" key={f.id}>
          <div className="editor-row-header">
            <span>FUNDING SOURCE {i + 1}</span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${f.name || 'funding source'}`}
              onClick={() => onChange(value.filter((x) => x.id !== f.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="form-grid">
            <Field label="Source name">
              <input
                required
                value={f.name}
                onChange={(e) => update(f.id, { name: e.target.value })}
                placeholder="e.g. OSAP grant"
              />
            </Field>
            <Field label="Amount per payment">
              <MoneyInput value={f.amount} onChange={(amount) => update(f.id, { amount })} />
            </Field>
            <Field label="Funding type">
              <select
                value={f.type}
                onChange={(e) => update(f.id, { type: e.target.value as Funding['type'] })}
              >
                {['Non-repayable', 'Repayable', 'Earned', 'Personal'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={f.status}
                onChange={(e) => update(f.id, { status: e.target.value as Funding['status'] })}
              >
                {['Expected', 'Applied', 'Confirmed', 'Received'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="First / expected date">
              <input
                type="date"
                required
                value={f.date}
                onChange={(e) => update(f.id, { date: e.target.value })}
              />
            </Field>
            <Field label="Frequency">
              <select
                value={f.frequency}
                onChange={(e) =>
                  update(f.id, { frequency: e.target.value as Funding['frequency'] })
                }
              >
                {['Once', 'Weekly', 'Biweekly', 'Monthly'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange([
            ...value,
            {
              id: uid(),
              name: '',
              amount: 0,
              date,
              type: 'Non-repayable',
              status: 'Expected',
              frequency: 'Once',
            },
          ])
        }
      >
        <Plus size={17} /> Add funding source
      </Button>
      <p className="field-note">
        Keep grants and loans separate. Applied funding stays pending. Expected employment is shown
        separately and included in your projection.
      </p>
    </div>
  );
}
export function ExpenseEditor({
  value,
  onChange,
  date,
}: {
  value: Expense[];
  onChange: (v: Expense[]) => void;
  date: string;
}) {
  const update = (id: string, patch: Partial<Expense>) =>
    onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <div className="editor-list">
      <div className="setup-shortcuts" aria-label="Common expenses">
        {(
          [
            ['Tuition', 'Tuition and School', 'Once'],
            ['Rent', 'Housing', 'Monthly'],
            ['Groceries', 'Groceries', 'Monthly'],
            ['Transit pass', 'TTC and PRESTO', 'Monthly'],
            ['Phone bill', 'Phone and Internet', 'Monthly'],
            ['Textbooks', 'Textbooks and Supplies', 'Once'],
          ] as const
        ).map(([name, category, frequency]) => (
          <button
            type="button"
            key={name}
            onClick={() =>
              onChange([
                ...value,
                { id: uid(), name, category, frequency, amount: 0, date, essential: true },
              ])
            }
          >
            + {name}
          </button>
        ))}
      </div>
      {value.map((f, i) => (
        <div className="editor-row" key={f.id}>
          <div className="editor-row-header">
            <span>PLANNED COST {i + 1}</span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${f.name || 'expense'}`}
              onClick={() => onChange(value.filter((x) => x.id !== f.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="form-grid">
            <Field label="Expense name">
              <input
                required
                value={f.name}
                onChange={(e) => update(f.id, { name: e.target.value })}
                placeholder="e.g. Fall tuition"
              />
            </Field>
            <Field label="Amount">
              <MoneyInput value={f.amount} onChange={(amount) => update(f.id, { amount })} />
            </Field>
            <Field label="Category">
              <select
                value={f.category}
                onChange={(e) => update(f.id, { category: e.target.value as Expense['category'] })}
              >
                {categories.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Frequency">
              <select
                value={f.frequency}
                onChange={(e) =>
                  update(f.id, { frequency: e.target.value as Expense['frequency'] })
                }
              >
                <option>Once</option>
                <option>Monthly</option>
              </select>
            </Field>
            <Field label="First / due date">
              <input
                type="date"
                required
                value={f.date}
                onChange={(e) => update(f.id, { date: e.target.value })}
              />
            </Field>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={f.essential}
                onChange={(e) => update(f.id, { essential: e.target.checked })}
              />{' '}
              Essential expense
            </label>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange([
            ...value,
            {
              id: uid(),
              name: '',
              amount: 0,
              date,
              category: 'Other',
              frequency: 'Monthly',
              essential: false,
            },
          ])
        }
      >
        <Plus size={17} /> Add an expense
      </Button>
    </div>
  );
}
