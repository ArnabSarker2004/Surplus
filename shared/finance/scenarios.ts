import type { Opportunity, Scenario, Workspace } from '../schema';
import { asOf, round } from './money';
import { plan } from './planning';

export function scenarioPlan(w: Workspace, opportunities: Opportunity[], s: Scenario = w.scenario) {
  const base = plan(w, opportunities);
  const selected = opportunities.find((o) => o.id === s.opportunityId);
  const opportunityIncome =
    selected &&
    w.applications[selected.id] !== 'Awarded' &&
    selected.paymentDate >= asOf(w) &&
    selected.paymentDate >= w.semester.start &&
    selected.paymentDate <= w.semester.end
      ? selected.amount
      : 0;
  const improvement = round(
    (s.monthlyReduction + s.monthlyIncome - s.monthlySavings) * base.remainingMonths +
      s.oneTimeIncome +
      opportunityIncome -
      s.oneTimeExpense,
  );
  const ending = round(base.ending + improvement);
  return {
    ...base,
    improvement,
    ending,
    gap: Math.max(0, -ending),
    targetGap: Math.max(0, w.semester.minimumBalance - ending),
    savingsAllocated: s.monthlySavings * base.remainingMonths,
    opportunityIncome,
    coveredPercent: base.gap ? Math.min(100, Math.max(0, (improvement / base.gap) * 100)) : 0,
  };
}
