import { GraduationCap, ArrowRight } from 'lucide-react';
import type { Transaction } from '../../../../shared/schema';
import { studentFunding } from '../../../../shared/student-funding';
import { cad, sum } from '../../../../shared/finance';
import { Badge, Button } from '../../components/ui';

export function StudentFundingTag({ transaction }: { transaction: Transaction }) {
  const match = studentFunding(transaction);
  return match ? (
    <small className="transaction-funding-tag">
      {match.automatic ? 'Auto-detected' : 'Assigned source'} · {match.detail}
      {transaction.pending ? ' · Pending' : ''}
    </small>
  ) : null;
}

export function EducationFundingSummary({
  transactions,
  onReview,
}: {
  transactions: Transaction[];
  onReview: () => void;
}) {
  const rows = transactions.filter((t) => studentFunding(t));
  if (!rows.length) return null;
  const received = rows.filter((t) => !t.pending);
  const pending = rows.filter((t) => t.pending);
  return (
    <section className="card education-deposits" aria-label="Education funding deposits">
      <div className="education-deposits-heading">
        <GraduationCap size={21} />
        <div>
          <h2>Education money coming in</h2>
          <p>In this filtered view · CAD · separate from wages</p>
        </div>
        <Badge tone="green">
          {rows.filter((t) => studentFunding(t)!.automatic).length} auto-detected
        </Badge>
      </div>
      <dl className="education-deposit-totals">
        {[
          ['OSAP', 'osap'],
          ['RESP', 'resp'],
          ['Other education funding', 'student-aid'],
        ].map(([label, kind]) => (
          <div key={kind}>
            <dt>{label}</dt>
            <dd>
              {cad(
                sum(
                  received.filter((t) => studentFunding(t)!.kind === kind).map((t) => t.cashFlow),
                ),
                true,
              )}
            </dd>
          </div>
        ))}
      </dl>
      {!!pending.length && (
        <p className="field-note">
          {cad(sum(pending.map((t) => t.cashFlow)), true)} pending funding · excluded from received
          amounts and cash-flow totals.
        </p>
      )}
      <div className="education-deposits-footer">
        <p>
          These deposits are deducted from your personal balance. Use Manage funding in the balance
          card to change a flag or mark a deposit as personal money.
        </p>
        <Button variant="secondary" onClick={onReview}>
          Review account money <ArrowRight size={15} />
        </Button>
      </div>
    </section>
  );
}

export function StudentFundingDetails({ transaction }: { transaction: Transaction }) {
  const match = studentFunding(transaction);
  if (!match) return null;
  return (
    <section className="student-funding-evidence" aria-label="Education funding detection">
      <div className="education-deposits-heading">
        <GraduationCap size={20} />
        <strong>{match.label} funding</strong>
        <Badge tone={match.automatic ? 'green' : 'neutral'}>
          {match.automatic ? 'Auto-detected' : 'Assigned source'}
        </Badge>
      </div>
      <p>{match.explanation}</p>
      <dl>
        <dt>{match.evidenceField}</dt>
        <dd>{match.evidence}</dd>
      </dl>
      <p>
        Recorded as money in, not employment pay. This feeds the estimated reserve inside your
        existing bank balance; it does not add a second semester-plan entry.
      </p>
      {transaction.pending && (
        <p>Pending deposit: excluded from received funding and totals until it posts.</p>
      )}
    </section>
  );
}
