import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoAccounts, demoWorkspace } from '../shared/demo';
import { cashBreakdown, normalize, round, safeToSave } from '../shared/finance';
import { workspaceSchema } from '../shared/schema';

const funding = (name: string, amount: number) =>
  normalize(
    {
      transaction_id: name,
      account_id: 'demo-chequing',
      name,
      amount: -amount,
      date: '2026-09-08',
      pending: false,
      iso_currency_code: 'CAD',
    },
    [],
    undefined,
    'demo',
  );

describe('student account money', () => {
  it('counts all remaining cash as personal, including opening balances and unknown deposits', () => {
    const b = cashBreakdown(
      demoWorkspace(),
      [{ ...demoAccounts[0], balance: 24095.92 }],
      [
        funding("Children's Education Fund", 43.24),
        funding('School bursary', 3114.73),
        funding('Unknown deposit', 10031.16),
      ],
    );
    assert.equal(b.cash, 24095.92);
    assert.equal(b.receivedFunding.total, 3157.97);
    assert.equal(b.own, 20937.95);
    assert.equal(b.unassigned, 0);
    assert.equal(round(b.own + b.education + b.loans), b.cash);
  });
  it('excludes foreign, unknown-balance and other-source accounts without withholding unflagged cash', () => {
    const b = cashBreakdown(demoWorkspace(), [
      ...demoAccounts,
      { ...demoAccounts[0], id: 'foreign', currency: 'USD' },
      { ...demoAccounts[0], id: 'unknown', balanceKnown: false },
      { ...demoAccounts[0], id: 'live', source: 'live' },
    ]);
    assert.equal(b.cash, 6075.4);
    assert.equal(b.own, b.cash);
    assert.equal(b.unassigned, 0);
    assert.equal(b.unknownAccounts, 1);
  });
  it('recalculates from transaction flags when balances change and ignores legacy manual allocations', () => {
    for (const balance of [1000, 5000, 6000]) {
      const b = cashBreakdown(
        demoWorkspace(),
        [{ ...demoAccounts[0], balance }],
        [funding('RESP', 2000)],
      );
      assert.equal(b.own, Math.max(0, balance - 2000));
      assert.equal(b.own + b.loans + b.education, balance);
    }
  });
  it('never treats overdrafts as available personal cash', () => {
    const b = cashBreakdown(demoWorkspace(), [{ ...demoAccounts[0], balance: -300 }]);
    assert.equal(b.cash, 0);
    assert.equal(b.own, 0);
    assert.equal(b.overdraft, 300);
  });
  it('keeps legacy workspace payloads valid without using allocations to override funding flags', () => {
    const w = demoWorkspace();
    w.cashAllocations![0].own = 9999;
    assert.equal(workspaceSchema.safeParse(w).success, false);
    delete w.cashAllocations;
    assert.equal(workspaceSchema.safeParse(w).success, true);
  });
  it('protects flagged funding in savings estimates and never saves future OSAP income', () => {
    const w = demoWorkspace();
    w.expenses = [];
    w.goals = [];
    w.funding = ['Repayable', 'Non-repayable'].map((type, i) => ({
      id: String(i),
      name: 'Future OSAP',
      type: type as 'Repayable' | 'Non-repayable',
      amount: 9000,
      status: 'Confirmed',
      frequency: 'Once',
      date: '2026-09-20',
    }));
    const tx = [funding('OSAP loan', 1800), funding('OSAP grant', 2800)];
    const s = safeToSave(w, [demoAccounts[0]], [], tx);
    assert.equal(s.income, 0);
    assert.equal(s.protectedCash, 4600);
    assert.equal(s.amount, 775.4);
    delete w.cashAllocations;
    assert.equal(safeToSave(w, [demoAccounts[0]], [], tx).amount, 775.4);
  });
  it('protects saved goals in chequing without counting personal savings twice', () => {
    const w = demoWorkspace();
    w.expenses = [];
    w.funding = [];
    w.goals = [{ ...w.goals[0], target: 2000, current: 1000 }];
    assert.equal(safeToSave(w, demoAccounts, []).goalReserve, 550);
    w.goals[0].current = 450;
    assert.equal(safeToSave(w, demoAccounts, []).goalReserve, 0);
  });
});
