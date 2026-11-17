import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { TransactionService } from '../backend/src/services/transaction-service';
import { analysisTransactions, reviewReasons, reviewQueue } from '../shared/transaction-review';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import { defaultForecastOptions } from '../shared/intelligence';
import { categorySpending, normalize } from '../shared/finance';
import { observeBalances, evaluateForecast } from '../backend/src/services/forecast-evaluation';
import { recordForecast } from '../backend/src/services/forecast-history';
import type { ForecastReport } from '../shared/intelligence';
import { syncIfDue } from '../backend/src/services/bank-background';
import { trialFeaturesEnabled } from '../backend/src/services/plaid-service';

function setup() {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  return { store, repo };
}

test('forecast review asks only for unresolved decisions and respects confirmed Other', () => {
  const { repo, store } = setup();
  const known = {
    ...repo.transactions()[0],
    pending: false,
    date: '2026-09-10',
    currency: 'CAD',
    cashFlow: -20,
    category: 'Coffee' as const,
    classification: 'Discretionary' as const,
    userCorrected: false,
    merchantDetails: undefined,
    categoryOrigin: 'merchant' as const,
  };
  assert.deepEqual(reviewReasons(known), []);
  const unknown = {
    ...known,
    category: 'Other' as const,
    classification: 'Review' as const,
    categoryOrigin: 'review' as const,
  };
  assert.deepEqual(reviewReasons(unknown), ['Choose a spending category']);
  assert.deepEqual(reviewReasons({ ...unknown, cashFlow: 20 }), ['Identify this deposit']);
  for (const row of [
    { ...unknown, userCorrected: true },
    { ...unknown, categoryOrigin: 'user' as const },
    { ...unknown, categoryOrigin: 'rule' as const },
    { ...unknown, forecastTreatment: 'one_off' as const },
    { ...unknown, cashFlow: 0 },
    { ...unknown, pending: true },
    { ...unknown, currency: 'USD' },
  ])
    assert.deepEqual(reviewReasons(row), []);
  const split = {
    ...known,
    userCorrected: true,
    splits: [
      { category: 'Coffee' as const, amount: 8 },
      { category: 'Shopping' as const, amount: 8 },
    ],
  };
  assert.deepEqual(reviewReasons(split), ['Update split amounts']);
  assert.deepEqual(
    reviewQueue(
      [
        known,
        unknown,
        { ...unknown, id: 'future', date: '2027-01-01' },
        { ...unknown, id: 'old', date: '2020-01-01' },
      ],
      '2026-09-16',
    ),
    [unknown],
  );
  store.set('transactions', [unknown]);
  assert.equal(
    forecastPayload(repo.state(), defaultForecastOptions).transactions[0].reviewRequired,
    true,
  );
  new TransactionService(repo).correct(unknown.id, { category: 'Other', saveRule: false });
  assert.equal(reviewQueue(repo.transactions()).length, 0);
  assert.equal(
    forecastPayload(repo.state(), defaultForecastOptions).transactions[0].reviewRequired,
    false,
  );
});
test('splits preserve every cent and context survives sync; totals agree with categories', () => {
  const { repo, store } = setup();
  const original = repo.transactions().find((t) => t.cashFlow < 0)!;
  const tx = {
    ...original,
    cashFlow: -100,
    rawAmount: 100,
    category: 'Shopping' as const,
    classification: 'Discretionary' as const,
  };
  store.set('transactions', [tx]);
  const service = new TransactionService(repo);
  assert.throws(() =>
    service.correct(tx.id, {
      category: 'Shopping',
      saveRule: false,
      splits: [
        { category: 'Groceries', amount: 20 },
        { category: 'Shopping', amount: 70 },
      ],
    }),
  );
  service.correct(tx.id, {
    category: 'Shopping',
    saveRule: false,
    splits: [
      { category: 'Groceries', amount: 70 },
      { category: 'Shopping', amount: 30 },
    ],
    forecastTreatment: 'one_off',
  });
  const saved = repo.transactions()[0];
  assert.equal(saved.cashFlow, -100);
  assert.equal(
    analysisTransactions([saved]).reduce((s, t) => s + t.cashFlow, 0),
    -100,
  );
  assert.deepEqual(categorySpending([saved]), [
    { category: 'Groceries', amount: 70 },
    { category: 'Shopping', amount: 30 },
  ]);
  const sync = normalize(
    {
      transaction_id: tx.id,
      account_id: tx.accountId,
      date: tx.date,
      name: tx.merchant,
      amount: 100,
      pending: false,
      iso_currency_code: 'CAD',
    },
    [],
    saved,
    'demo',
  );
  assert.deepEqual(sync.splits, saved.splits);
  assert.equal(sync.forecastTreatment, 'one_off');
  assert.throws(() =>
    service.correct(tx.id, {
      category: 'Coffee',
      saveRule: false,
      forecastTreatment: 'reimbursement',
    }),
  );
});

test('forecast evaluation scores only later same-date observations with matching accounts', () => {
  const { repo, store } = setup();
  repo.save({ ...repo.workspace()!, source: 'live' });
  store.set('accounts', [
    {
      id: 'cash',
      name: 'Cash',
      type: 'depository',
      subtype: '',
      balance: 1000,
      currency: 'CAD',
      source: 'live',
    },
  ]);
  store.set('transactions', []);
  const report = {
    source: 'live',
    asOf: '2026-09-20',
    quality: { cashKnown: true },
    timeline: Array.from({ length: 91 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 8, 20 + i)).toISOString().slice(0, 10),
      median: 1000 - i * 10,
      low: 900 - i * 10,
      high: 1100 - i * 10,
    })),
  } as ForecastReport;
  observeBalances(repo, 'live', new Date('2026-09-20T16:00:00Z'));
  assert.equal(evaluateForecast(repo, repo.state(), report, true).status, 'collecting');
  const prediction = store.get('intelligenceJournal', {});
  evaluateForecast(
    repo,
    repo.state(),
    { ...report, timeline: report.timeline.map((p) => ({ ...p, median: 100000 })) },
    true,
  );
  assert.deepEqual(store.get('intelligenceJournal', {}), prediction);
  observeBalances(repo, 'live', new Date('2026-09-27T16:00:00Z'));
  const results = evaluateForecast(repo, repo.state(), { ...report, asOf: '2026-09-27' }, false);
  assert.equal(results.checkpoints[0].count, 1);
  assert.equal(results.checkpoints[0].mae, 70);
  assert.equal(results.checkpoints[0].coverage, 100);
  assert.equal(results.checkpoints[1].count, 0);
  repo.clear();
  assert.deepEqual(store.get('intelligenceJournal', {}), {});
});

test('goal explanations show input changes while what-if never replaces baseline history', () => {
  const { repo, store } = setup();
  const report = {
    version: 'surplus-forecast-1.0',
    source: 'demo',
    asOf: '2026-09-20',
    horizonDays: 180,
    summary: { startingUsableCash: 100, spendingNext30: 200, incomeNext30: 400 },
    goals: [{ id: 'g', projectedDate: '2026-12-01' }],
  } as ForecastReport;
  recordForecast(repo, repo.state(), {}, report);
  const history = store.get('forecastHistory', {});
  assert.equal(
    recordForecast(repo, repo.state(), { monthlyExtraIncome: 100 }, report).goalChanges?.status,
    'scenario',
  );
  assert.deepEqual(store.get('forecastHistory', {}), history);
  repo.save({
    ...repo.workspace()!,
    semester: { ...repo.workspace()!.semester, minimumBalance: 123 },
  });
  const next = recordForecast(
    repo,
    repo.state(),
    {},
    { ...report, summary: { ...report.summary, spendingNext30: 250 } },
  );
  assert.ok(next.goalChanges?.drivers?.some((d) => d.kind === 'spending' && d.amount === 50));
  assert.ok(next.goalChanges?.drivers?.some((d) => d.kind === 'plan'));
});

test('background sync defaults off and never consumes a demo or unconnected item', async () => {
  const { repo } = setup();
  assert.equal(await syncIfDue(repo, Buffer.alloc(32)), false);
  repo.save({
    ...repo.workspace()!,
    intelligenceSettings: { autoSync: true, alerts: true, dismissed: [] },
  });
  assert.equal(await syncIfDue(repo, Buffer.alloc(32)), false);
});

test('additional Trial features fail closed without a recent explicit plan confirmation', () => {
  const plan = process.env.PLAID_PLAN,
    date = process.env.PLAID_TRIAL_CONFIRMED_ON;
  try {
    delete process.env.PLAID_PLAN;
    delete process.env.PLAID_TRIAL_CONFIRMED_ON;
    assert.equal(trialFeaturesEnabled(), false);
    process.env.PLAID_PLAN = 'trial';
    process.env.PLAID_TRIAL_CONFIRMED_ON = '2026-09-20';
    assert.equal(trialFeaturesEnabled(Date.parse('2026-09-21')), true);
    assert.equal(trialFeaturesEnabled(Date.parse('2026-11-01')), false);
    process.env.PLAID_PLAN = 'paid';
    assert.equal(trialFeaturesEnabled(Date.parse('2026-09-21')), false);
  } finally {
    if (plan === undefined) delete process.env.PLAID_PLAN;
    else process.env.PLAID_PLAN = plan;
    if (date === undefined) delete process.env.PLAID_TRIAL_CONFIRMED_ON;
    else process.env.PLAID_TRIAL_CONFIRMED_ON = date;
  }
});
