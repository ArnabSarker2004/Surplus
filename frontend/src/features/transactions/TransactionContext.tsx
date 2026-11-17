import { categories, type Transaction } from '../../../../shared/schema';
import { classify, cad } from '../../../../shared/finance';
import { splitsMatch } from '../../../../shared/transaction-review';
import { Button, Field, MoneyInput } from '../../components/ui';

export function TransactionContext({
  transaction: tx,
  change,
}: {
  transaction: Transaction;
  change: (tx: Transaction) => void;
}) {
  const choices = categories.filter(
    (c) => !['Income', 'Transfer', 'Review'].includes(classify(c, tx.cashFlow)),
  );
  return (
    <div className="transaction-context form-stack">
      <Field
        label="Forecast treatment"
        hint="One-off entries stay in actual spending and current cash, but are excluded from usual future spending/income patterns."
      >
        <select
          aria-label="Forecast treatment"
          value={tx.forecastTreatment || 'automatic'}
          onChange={(e) =>
            change({ ...tx, forecastTreatment: e.target.value as Transaction['forecastTreatment'] })
          }
        >
          <option value="automatic">Use normal spending / income pattern</option>
          <option value="one_off">One-off purchase or deposit</option>
          {tx.cashFlow > 0 && (
            <option value="reimbursement">Received reimbursement / refund</option>
          )}
        </select>
      </Field>
      {tx.forecastTreatment === 'reimbursement' && (
        <p className="field-note">
          Choose the original spending category above. Only money already received reduces spending;
          an expected reimbursement is not income.
        </p>
      )}
      <details className="forecast-details">
        <summary>Split this purchase across categories</summary>
        <p className="field-note">
          Keep the original {cad(Math.abs(tx.cashFlow), true)} bank entry. Assign its parts to
          spending categories for budgets and models.
        </p>
        {(tx.splits || []).map((part, i) => (
          <div className="review-split-row" key={i}>
            <Field label={`Part ${i + 1} category`}>
              <select
                value={part.category}
                onChange={(e) =>
                  change({
                    ...tx,
                    splits: tx.splits!.map((p, n) =>
                      n === i ? { ...p, category: e.target.value as typeof p.category } : p,
                    ),
                  })
                }
              >
                {choices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label={`Part ${i + 1} amount`}>
              <MoneyInput
                value={part.amount}
                onChange={(amount) =>
                  change({
                    ...tx,
                    splits: tx.splits!.map((p, n) => (n === i ? { ...p, amount } : p)),
                  })
                }
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove part ${i + 1}`}
              onClick={() => change({ ...tx, splits: tx.splits!.filter((_, n) => n !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="button-row">
          <Button
            type="button"
            variant="secondary"
            disabled={(tx.splits?.length || 0) >= 8}
            onClick={() =>
              change({
                ...tx,
                splits: [
                  ...(tx.splits || []),
                  {
                    category: choices.includes(tx.category) ? tx.category : 'Groceries',
                    amount: 0,
                  },
                ],
              })
            }
          >
            Add a split
          </Button>
          {!!tx.splits?.length && (
            <Button type="button" variant="ghost" onClick={() => change({ ...tx, splits: [] })}>
              Clear splits
            </Button>
          )}
        </div>
        {!!tx.splits?.length && (
          <p role="status" className="field-note">
            {cad(
              tx.splits.reduce((s, p) => s + p.amount, 0),
              true,
            )}{' '}
            allocated / {cad(Math.abs(tx.cashFlow), true)} total.{' '}
            {!splitsMatch(tx) && 'Use at least two parts that add up exactly.'}
          </p>
        )}
      </details>
    </div>
  );
}
