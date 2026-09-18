import type { Funding, Opportunity, Workspace } from '../schema';
import { asOf, monthsBetween, occurrences, round, sum } from './money';

export const isFundingIncluded = (f: Funding) =>
  ['Confirmed', 'Received'].includes(f.status) || (f.type === 'Earned' && f.status === 'Expected');
export const fundingDates = (w: Workspace, f: Funding) =>
  occurrences(
    f.date,
    f.frequency,
    w.semester.start,
    f.endDate && f.endDate < w.semester.end ? f.endDate : w.semester.end,
  );
export const fundingAmount = (w: Workspace, f: Funding) =>
  round(f.amount * fundingDates(w, f).length);
export function plan(w: Workspace, opportunities: Opportunity[]) {
  const months = monthsBetween(w.semester.start, w.semester.end);
  const cost = sum(
    w.expenses.map(
      (e) => e.amount * occurrences(e.date, e.frequency, w.semester.start, w.semester.end).length,
    ),
  );
  const confirmed = sum(
    w.funding
      .filter((f) => ['Confirmed', 'Received'].includes(f.status))
      .map((f) => fundingAmount(w, f)),
  );
  const earned = sum(
    w.funding
      .filter((f) => f.type === 'Earned' && f.status === 'Expected')
      .map((f) => fundingAmount(w, f)),
  );
  const withinSemester = opportunities.filter(
    (o) => o.paymentDate >= w.semester.start && o.paymentDate <= w.semester.end,
  );
  const awarded = sum(
    withinSemester.filter((o) => w.applications[o.id] === 'Awarded').map((o) => o.amount),
  );
  const pending = sum(
    w.funding.filter((f) => !isFundingIncluded(f)).map((f) => fundingAmount(w, f)),
  );
  const potential = sum(
    withinSemester
      .filter((o) => ['Saved', 'Applying', 'Applied'].includes(w.applications[o.id]))
      .map((o) => o.amount),
  );
  const funding = sum([confirmed, earned, awarded]);
  const ending = round(funding - cost);
  const gap = Math.max(0, -ending);
  const targetGap = Math.max(0, round(w.semester.minimumBalance - ending));
  const remainingMonths = months.filter((m) => m >= asOf(w).slice(0, 7)).length;
  let running = 0;
  const timeline = months.map((month) => {
    const income =
      sum(
        w.funding
          .filter(isFundingIncluded)
          .map((f) => f.amount * fundingDates(w, f).filter((d) => d.startsWith(month)).length),
      ) +
      sum(
        withinSemester
          .filter((o) => w.applications[o.id] === 'Awarded' && o.paymentDate.startsWith(month))
          .map((o) => o.amount),
      );
    const expenses = sum(
      w.expenses.map(
        (e) =>
          e.amount *
          occurrences(e.date, e.frequency, w.semester.start, w.semester.end).filter((d) =>
            d.startsWith(month),
          ).length,
      ),
    );
    running = round(running + income - expenses);
    return {
      month,
      label: new Date(month + '-01T12:00:00').toLocaleDateString('en', { month: 'short' }),
      income,
      expenses,
      balance: running,
    };
  });
  return {
    cost,
    confirmed,
    earned,
    awarded,
    pending,
    potential,
    funding,
    ending,
    gap,
    targetGap,
    remainingMonths,
    monthlyAction: remainingMonths ? round(targetGap / remainingMonths) : targetGap,
    months,
    timeline,
  };
}
