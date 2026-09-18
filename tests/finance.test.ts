import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoAccounts, demoTransactions, demoWorkspace, opportunities } from '../shared/demo';
import {
  categorize,
  categorySpending,
  forecast,
  fundingAmount,
  insights,
  investment,
  matchOpportunity,
  normalize,
  occurrences,
  plan,
  readiness,
  safeToSave,
  scenarioPlan,
  spendingAnalysis,
  totals,
  type PlaidTransaction,
} from '../shared/finance';
import { workspaceSchema } from '../shared/schema';

const raw = (
  id: string,
  amount: number,
  description = 'Groceries',
  primary = 'FOOD_AND_DRINK',
  detailed = 'FOOD_AND_DRINK_GROCERIES',
): PlaidTransaction => ({
  transaction_id: id,
  account_id: 'a',
  date: '2026-09-12',
  name: description,
  amount,
  pending: false,
  iso_currency_code: 'CAD',
  personal_finance_category: { primary, detailed, confidence_level: 'HIGH' },
});
describe('financial domain', () => {
  it('distinguishes recurring monthly bills from frequent coffee purchases', () => {
    const a = spendingAnalysis(demoWorkspace(), demoTransactions());
    assert.ok(a.recurring.some((r) => r.merchant === 'Spotify Student'));
    assert.ok(!a.recurring.some((r) => r.category === 'Coffee'));
    assert.ok(a.weeklyDiscretionary > 0);
    assert.equal(a.projectedRemainingSpending, Math.round(a.monthlyAverage * 4 * 100) / 100);
  });
  it('validates the complete demo fixture', () =>
    assert.equal(workspaceSchema.safeParse(demoWorkspace()).success, true));
  it('provides nine months with unique transaction IDs', () => {
    const tx = demoTransactions();
    assert.equal(new Set(tx.map((t) => t.date.slice(0, 7))).size, 9);
    assert.equal(new Set(tx.map((t) => t.id)).size, tx.length);
  });
  it('preserves raw Plaid amounts and normalizes expense direction', () => {
    const t = normalize(raw('a', 23.45));
    assert.equal(t.rawAmount, 23.45);
    assert.equal(t.cashFlow, -23.45);
  });
  it('normalizes income and computes savings rate', () => {
    const stats = totals([normalize(raw('a', -100, 'Payroll')), normalize(raw('b', 40))]);
    assert.deepEqual(stats, { income: 100, spending: 40, net: 60, savingsRate: 60 });
  });
  it('reduces spending for refunds rather than calling them income', () => {
    const tx = [normalize(raw('a', 40)), normalize(raw('b', -10))];
    assert.equal(totals(tx).spending, 30);
    assert.equal(totals(tx).income, 0);
  });
  it('excludes both sides of savings transfers and credit-card payments', () => {
    const tx = [
      normalize(raw('a', 100, 'Savings transfer')),
      normalize(raw('b', -100, 'Savings transfer')),
      normalize(raw('c', 200, 'Credit card payment')),
      normalize(raw('d', -200, 'Credit card payment')),
    ];
    assert.equal(totals(tx).spending, 0);
    assert.equal(totals(tx).income, 0);
  });
  it('excludes pending and non-CAD amounts from analytics', () => {
    const t = normalize(raw('a', 50));
    assert.equal(
      totals([
        { ...t, pending: true },
        { ...t, currency: 'USD' },
      ]).spending,
      0,
    );
  });
  it('handles no income without NaN', () => assert.equal(totals([]).savingsRate, 0));
  it('maps student merchants before Plaid categories', () =>
    assert.equal(
      categorize('OSAP loan', 'INCOME', 'INCOME_OTHER_INCOME', 'HIGH', [], 'sandbox'),
      'OSAP Funding',
    ));
  it('does not trust low-confidence automatic categories', () =>
    assert.equal(
      categorize('Unknown', 'FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES', 'LOW', [], 'sandbox'),
      'Other',
    ));
  it('merchant rules override known student mappings, only in the same source', () => {
    const rules = [
      {
        merchant: 'OSAP loan',
        category: 'Other' as const,
        classification: 'Review' as const,
        source: 'sandbox' as const,
      },
    ];
    assert.equal(categorize('OSAP loan', '', '', '', rules, 'sandbox'), 'Other');
    assert.equal(categorize('OSAP loan', '', '', '', rules, 'demo'), 'OSAP Funding');
  });
  it('preserves explicit user corrections over future normalization', () => {
    const r = raw('a', 50);
    const prev = { ...normalize(r), category: 'Coffee' as const, userCorrected: true };
    assert.equal(normalize(r, [], prev).category, 'Coffee');
  });
  it('clamps recurring monthly dates without overflowing February', () =>
    assert.deepEqual(occurrences('2026-01-31', 'Monthly', '2026-01-01', '2026-04-30'), [
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]));
  it('counts eight biweekly demo paydays', () => {
    const w = demoWorkspace();
    assert.equal(
      fundingAmount(
        w,
        w.funding.find((f) => f.id === 'job')!,
      ),
      3520,
    );
  });
  it('computes the demo funding gap from entered sources and expenses', () => {
    const p = plan(demoWorkspace(), opportunities);
    assert.equal(p.cost, 9246);
    assert.equal(p.funding, 8970);
    assert.equal(p.gap, 276);
    assert.equal(p.ending, -276);
    assert.equal(p.pending, 1000);
    assert.equal(p.timeline.at(-1)?.balance, p.ending);
  });
  it('does not count applied or expected grants as available funding', () => {
    const w = demoWorkspace();
    const base = plan(w, opportunities).funding;
    w.funding.push({ ...w.funding[1], id: 'pending', status: 'Expected', amount: 700 });
    assert.equal(plan(w, opportunities).funding, base);
  });
  it('counts awarded opportunities exactly once', () => {
    const w = demoWorkspace();
    w.applications.zone = 'Applied';
    assert.equal(plan(w, opportunities).funding, 8970);
    w.applications.zone = 'Awarded';
    assert.equal(plan(w, opportunities).funding, 9720);
    w.scenario.opportunityId = 'zone';
    assert.equal(scenarioPlan(w, opportunities).opportunityIncome, 0);
  });
  it('does not include an award paid outside the semester', () => {
    const w = demoWorkspace();
    w.applications.zone = 'Awarded';
    assert.equal(
      plan(
        w,
        opportunities.map((o) => ({ ...o, paymentDate: '2027-01-01' })),
      ).awarded,
      0,
    );
  });
  it('models a scenario without changing the base data', () => {
    const w = demoWorkspace();
    w.scenario.monthlyReduction = 25;
    w.scenario.opportunityId = 'zone';
    const s = scenarioPlan(w, opportunities);
    assert.equal(s.improvement, 850);
    assert.equal(s.ending, 574);
    assert.equal(plan(w, opportunities).ending, -276);
  });
  it('reserves hypothetical savings without inventing spending', () => {
    const w = demoWorkspace();
    w.scenario.monthlySavings = 50;
    assert.equal(scenarioPlan(w, opportunities).savingsAllocated, 200);
    assert.equal(scenarioPlan(w, opportunities).ending, -476);
  });
  it('never reports negative safe-to-save', () =>
    assert.equal(safeToSave(demoWorkspace(), demoAccounts, opportunities).amount, 0));
  it('does not count investment accounts or emergency savings as spending cash', () => {
    const result = safeToSave(demoWorkspace(), demoAccounts, opportunities);
    assert.equal(result.cash, 5625.4);
    assert.equal(result.cardBalance, 285.6);
  });
  it('matches eligible students with explainable reasons', () => {
    const m = matchOpportunity(opportunities[0], demoWorkspace().profile, '2026-09-16');
    assert.equal(m.eligible, true);
    assert.ok(m.score >= 90);
    assert.ok(m.reasons.some((r) => r.includes('React')));
  });
  it('exposes institution, availability, and deadline conflicts', () => {
    const p = { ...demoWorkspace().profile, institution: 'York University', weeklyHours: 0 };
    const m = matchOpportunity(opportunities[0], p, '2027-01-01');
    assert.equal(m.eligible, false);
    assert.ok(m.conflicts.length >= 3);
    assert.ok(m.score <= 40);
  });
  it('prioritizes semester stability over investing', () =>
    assert.equal(readiness(demoWorkspace(), opportunities).step, 0));
  it('checks debt and emergency targets before investing education', () => {
    const w = demoWorkspace();
    w.applications.bursary = 'Awarded';
    w.profile.highInterestDebt = true;
    assert.equal(readiness(w, opportunities).step, 1);
    w.profile.highInterestDebt = false;
    assert.equal(readiness(w, opportunities).step, 2);
    w.goals[0].current = 1500;
    assert.equal(readiness(w, opportunities).step, 4);
    w.profile.horizonYears = 1;
    assert.equal(readiness(w, opportunities).step, 3);
  });
  it('models zero return, positive fees, and negative returns', () => {
    assert.equal(investment(100, 10, 1, 0, 0).value, 220);
    assert.ok(investment(1000, 0, 10, 5, 1).fees > 0);
    assert.ok(investment(1000, 0, 1, -10, 0).value < 1000);
  });
  it('generates traceable restaurant and subscription insights', () => {
    const items = insights(demoWorkspace(), demoTransactions());
    assert.ok(items.some((i) => i.id === 'restaurants'));
    assert.ok(items.some((i) => i.id === 'coffee'));
    assert.ok(items.every((i) => i.impact > 0 && i.assumption.length > 10));
  });
  it('derives forecasts from three complete months and documents tuition risk', () => {
    const f = forecast(demoWorkspace(), demoTransactions(), 450, 1500);
    assert.equal(f.remaining, 4);
    assert.equal(f.required, 262.5);
    assert.ok(Number.isFinite(f.ending));
  });
  it('category totals reconcile with spending', () => {
    const tx = demoTransactions().filter((t) => t.date.startsWith('2026-09'));
    const total = categorySpending(tx).reduce((s, c) => s + c.amount, 0);
    assert.ok(Math.abs(total - totals(tx).spending) < 0.001);
  });
  it('rejects invalid dates, negative money and duplicate IDs', () => {
    const w = demoWorkspace();
    w.funding[0].date = '2026-02-31';
    assert.equal(workspaceSchema.safeParse(w).success, false);
    const b = demoWorkspace();
    b.goals[0].target = -1;
    assert.equal(workspaceSchema.safeParse(b).success, false);
    const c = demoWorkspace();
    c.funding.push(c.funding[0]);
    assert.equal(workspaceSchema.safeParse(c).success, false);
  });
});
