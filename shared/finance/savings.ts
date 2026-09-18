import type { Account, Opportunity, Transaction, Workspace } from '../schema';
import { asOf, monthsBetween, occurrences, round, sum } from './money';
import { plan } from './planning';
import { totals } from './transactions';

export function safeToSave(w: Workspace, accounts: Account[], opportunities: Opportunity[]) {
  const date = asOf(w);
  const end = new Date(Date.parse(date) + 30 * 86400000).toISOString().slice(0, 10);
  const cash = sum(
    accounts
      .filter((a) => a.type === 'depository' && a.subtype !== 'savings' && a.currency === 'CAD')
      .map((a) => a.balance),
  );
  const income = sum(
    w.funding
      .filter((f) => f.status === 'Confirmed' || (f.type === 'Earned' && f.status === 'Expected'))
      .map(
        (f) =>
          f.amount *
          occurrences(f.date, f.frequency, date, f.endDate && f.endDate < end ? f.endDate : end)
            .length,
      ),
  );
  const bills = sum(
    w.expenses.map(
      (e) =>
        e.amount *
        occurrences(e.date, e.frequency, date, end < w.semester.end ? end : w.semester.end).length,
    ),
  );
  const cardBalance = sum(
    accounts
      .filter((a) => a.type === 'credit' && a.currency === 'CAD')
      .map((a) => Math.max(0, a.balance)),
  );
  const gap = plan(w, opportunities).gap;
  const amount = Math.max(
    0,
    round(cash + income - bills - cardBalance - w.semester.minimumBalance - gap),
  );
  return { amount, cash, income, bills, cardBalance, gap, buffer: w.semester.minimumBalance };
}
export function forecast(w: Workspace, tx: Transaction[], current: number, target: number) {
  const date = asOf(w);
  const cursor = new Date(date.slice(0, 7) + '-01T12:00:00Z');
  cursor.setUTCMonth(cursor.getUTCMonth() - 3);
  const months = monthsBetween(cursor.toISOString().slice(0, 10), date).slice(0, -1);
  const net = months.map(
    (m) =>
      totals(
        tx.filter(
          (t) =>
            t.date.startsWith(m) &&
            ![
              'OSAP Funding',
              'Grants and Bursaries',
              'Scholarships',
              'Stipends and Opportunities',
            ].includes(t.category),
        ),
      ).net,
  );
  const average = round(sum(net) / 3);
  const remaining = monthsBetween(
    date > w.semester.start ? date : w.semester.start,
    w.semester.end,
  ).length;
  const ending = round(current + average * remaining);
  return {
    average,
    remaining,
    ending,
    onTrack: ending >= target,
    required: remaining
      ? Math.max(0, round((target - current) / remaining))
      : Math.max(0, target - current),
  };
}
