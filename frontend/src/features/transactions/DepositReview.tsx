import { useState } from 'react';
import { ArrowRight, CircleHelp } from 'lucide-react';
import type { Account, Transaction } from '../../../../shared/schema';
import { depositPurposes, depositSource } from '../../../../shared/deposits';
import { cad, sum } from '../../../../shared/finance';
import { merchantName } from '../../../../shared/merchants';
import { Badge, Button } from '../../components/ui';

export function DepositReview({
  transactions,
  accounts,
  onReview,
}: {
  transactions: Transaction[];
  accounts: Account[];
  onReview: (t: Transaction) => void;
}) {
  const [offset, setOffset] = useState(0);
  const all = transactions.filter(
    (t) =>
      accounts.some((a) => a.id === t.accountId && a.type === 'depository') &&
      !t.pending &&
      !['salary', 'transfer', null].includes(depositSource(t)),
  );
  if (!all.length) return null;
  const unknown = all.filter((t) => depositSource(t) === 'unknown');
  const rows = [...unknown, ...all.filter((t) => depositSource(t) !== 'unknown')];
  const start = Math.min(offset, Math.max(0, Math.floor((rows.length - 1) / 5) * 5));
  return (
    <section className="card deposit-review" aria-label="Non-salary deposits">
      <div className="education-deposits-heading">
        <CircleHelp size={21} />
        <div>
          <h2>Money in beyond salary</h2>
          <p>
            In this filtered view · flag loans and education funding to deduct them from your
            balance
          </p>
        </div>
        <Badge>{all.length} deposits</Badge>
      </div>
      {!!unknown.length && (
        <p className="field-note">
          {cad(sum(unknown.map((t) => t.cashFlow)), true)} in deposits without a known source. These
          count as personal money unless you flag them as loans or education funding.
        </p>
      )}
      <div className="deposit-review-list">
        {rows.slice(start, start + 5).map((t) => (
          <div key={t.id}>
            <div>
              <strong>{merchantName(t)}</strong>
              <small>
                {t.date} · {accounts.find((a) => a.id === t.accountId)?.name}
              </small>
              <span>{depositPurposes.find(([purpose]) => purpose === depositSource(t))?.[1]}</span>
            </div>
            <strong>{cad(t.cashFlow, true)}</strong>
            <Button variant="secondary" onClick={() => onReview(t)}>
              Identify source <ArrowRight size={14} />
            </Button>
          </div>
        ))}
      </div>
      {rows.length > 5 && (
        <div className="button-row">
          <Button variant="ghost" disabled={!start} onClick={() => setOffset(start - 5)}>
            Previous deposits
          </Button>
          <span>
            {start + 1}–{Math.min(start + 5, rows.length)} of {rows.length}
          </span>
          <Button
            variant="ghost"
            disabled={start + 5 >= rows.length}
            onClick={() => setOffset(start + 5)}
          >
            Next deposits
          </Button>
        </div>
      )}
      <p className="field-note">
        A company name alone may not identify the purpose of a payment. Your review takes priority
        over automatic detection.
      </p>
    </section>
  );
}
