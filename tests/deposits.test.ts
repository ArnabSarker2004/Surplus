import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoAccounts, demoWorkspace } from '../shared/demo';
import { cashBreakdown, normalize, safeToSave } from '../shared/finance';
import { depositSource } from '../shared/deposits';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { TransactionService } from '../backend/src/services/transaction-service';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import { defaultForecastOptions } from '../shared/intelligence';
import { fundingTypes, nonPersonalSource } from '../shared/deposits';
const deposit = (name: string, amount: number, id = name) =>
  normalize(
    {
      transaction_id: id,
      account_id: 'demo-chequing',
      date: '2026-09-08',
      name,
      amount: -amount,
      iso_currency_code: 'CAD',
      pending: false,
    },
    [],
    undefined,
    'demo',
  );
const workspace = () => {
  const w = demoWorkspace();
  delete w.cashAllocations;
  w.funding = [];
  w.expenses = [];
  w.goals = [];
  return w;
};
const accounts = [{ ...demoAccounts[0], balance: 5000 }];
test('education provider deposits and unclear non-salary cash reconcile within the bank balance', () => {
  const tx = [
    deposit('PAYROLL', 2000),
    deposit('Children’s Education Funds Inc.', 2500),
    deposit('Unfamiliar company deposit', 500),
  ];
  const b = cashBreakdown(workspace(), accounts, tx);
  assert.deepEqual([b.cash, b.own, b.education, b.loans, b.unassigned], [5000, 2500, 2500, 0, 0]);
  assert.equal(b.automatic, true);
  assert.equal(safeToSave(workspace(), accounts, [], tx).protectedCash, 2500);
  assert.equal(
    forecastPayload(
      { workspace: workspace(), accounts, transactions: tx, rules: [], opportunities: [] },
      defaultForecastOptions,
    ).savingsEligibleCash,
    2500,
  );
});
test('recognizes several education providers but never generic banks, acronyms or provider employee payroll', () => {
  for (const name of [
    "Children's Education Fund",
    'Children’s Education Fund',
    'Children Education Fund',
    'Childrens Education Funds Inc',
    'CEFI',
    'Canadian Scholarship Trust',
    'CST Savings',
    'Knowledge First Financial',
    'Embark Student Corp',
    'Heritage Education Funds',
    'University Scholarships of Canada',
  ])
    assert.equal(depositSource(deposit(name, 100)), 'education', name);
  for (const name of ['CST', 'Embark Travel', 'RBC', 'CEF', 'New company', 'Canada credit'])
    assert.equal(depositSource(deposit(name, 100)), 'unknown', name);
  const payroll = normalize(
    {
      transaction_id: 'work',
      account_id: 'demo-chequing',
      date: '2026-09-08',
      name: 'CEFI PAYROLL',
      merchant_name: 'Children Education Funds Inc',
      amount: -300,
      pending: false,
      iso_currency_code: 'CAD',
    },
    [],
    undefined,
    'demo',
  );
  assert.equal(depositSource(payroll), 'salary');
});

test('subtracts full RESP and education totals from every imported month, even after spending followed by pay', () => {
  const tx = [
    { ...deposit("Children's Education Fund", 1000, 'resp-old'), date: '2025-12-10' },
    { ...deposit('RESP withdrawal', 2000, 'resp-new'), date: '2026-07-10' },
    { ...deposit('Purchase', -3000), date: '2026-08-10' },
    deposit('PAYROLL', 6000),
    deposit('School bursary', 500),
    { ...deposit('OSAP', 4000), pending: true },
    { ...deposit('OSAP', 4000, 'future-osap'), date: '2026-10-01' },
  ];
  const b = cashBreakdown(workspace(), [{ ...accounts[0], balance: 6500 }], [...tx, tx[0]]);
  assert.equal(b.receivedFunding.resp, 3000);
  assert.equal(b.receivedFunding.osap, 0);
  assert.equal(b.receivedFunding.otherEducation, 500);
  assert.equal(b.receivedFunding.total, 3500);
  assert.equal(b.education, 3500);
  assert.equal(b.afterFunding, 3000);
  assert.equal(b.own, 3000);
  assert.equal(b.own + b.loans + b.education + b.unassigned, b.cash);
});

test('keeps education reserves protected when funding moves from chequing to savings', () => {
  const w = workspace();
  const bank = [
    { ...accounts[0], balance: 0 },
    { ...demoAccounts[1], balance: 4500 },
  ];
  const tx = [
    deposit("Children's Education Fund", 3000),
    { ...deposit('INTERNAL TRANSFER', -3000, 'transfer-out'), date: '2026-09-09' },
    {
      ...deposit('INTERNAL TRANSFER', 3000, 'transfer-in'),
      accountId: bank[1].id,
      date: '2026-09-09',
    },
    { ...deposit('PAYROLL', 1500), accountId: bank[1].id, date: '2026-09-10' },
  ];
  const b = cashBreakdown(w, bank, tx);
  assert.equal(b.receivedFunding.resp, 3000);
  assert.equal(b.education, 3000);
  assert.equal(b.rows[1].education, 3000);
  assert.equal(b.afterFunding, 1500);
  assert.equal(b.own, 1500);
  w.goals = [{ ...demoWorkspace().goals[0], target: 5000, current: 2000 }];
  assert.equal(safeToSave(w, bank, [], tx).goalReserve, 500);
  assert.equal(
    forecastPayload(
      { workspace: w, accounts: bank, transactions: tx, rules: [], opportunities: [] },
      defaultForecastOptions,
    ).savingsEligibleCash,
    1500,
  );
});

test('old manual allocations cannot override full transaction funding totals', () => {
  const w = workspace();
  const tx = [
    deposit('OSAP LOAN', 1200),
    deposit("Children's Education Fund", 2800),
    deposit('PAYROLL', 1000),
  ];
  const automatic = cashBreakdown(w, accounts, tx);
  w.cashAllocations = automatic.rows.map((r) => ({
    accountId: r.account.id,
    own: 2200,
    loans: 800,
    education: 2000,
    reviewedBalance: r.balance,
    reviewedDeposits: r.deposits.map(({ id, amount, bucket }) => ({ id, amount, bucket })),
  }));
  const reviewed = cashBreakdown(w, accounts, tx);
  assert.equal(reviewed.receivedFunding.osap, 1200);
  assert.equal(reviewed.receivedFunding.resp, 2800);
  assert.equal(reviewed.protectedFunding, 4000);
  assert.equal(reviewed.afterFunding, 1000);
  assert.equal(reviewed.own, 1000);
});

test('scholarships, bursaries and student aid are non-personal while unflagged stipends are personal', () => {
  const tx = [
    deposit('Scholarship', 1000),
    deposit('Bursary', 700),
    deposit('Learning Zone stipend', 300),
    deposit('NSLSC', 1200),
    deposit('PAYROLL', 1800),
  ];
  const b = cashBreakdown(workspace(), accounts, tx);
  assert.equal(b.education, 2900);
  assert.equal(b.receivedFunding.studentAid, 1200);
  assert.equal(b.receivedFunding.otherEducation, 1700);
  assert.equal(b.afterFunding, 2100);
});

test('an explicit loan flag uses the selected funding type', () => {
  const t = {
    ...deposit('OSAP deposit', 1200),
    category: 'Other' as const,
    depositPurpose: 'loan' as const,
    userCorrected: true,
    categoryOrigin: 'user' as const,
  };
  const b = cashBreakdown(workspace(), accounts, [t]);
  assert.equal(b.receivedFunding.osap, 0);
  assert.equal(b.receivedFunding.otherLoans, 1200);
  assert.equal(b.loans, 1200);
});
test('source reviews persist, change ownership, preserve amounts and cannot become merchant-wide rules', () => {
  const tx = [deposit('PAYROLL', 2000), deposit('CEFI', 2500), deposit('Unknown', 500)];
  const repo = new WorkspaceRepository(
    new MemoryDocuments({ workspace: workspace(), accounts, transactions: tx }),
  );
  const service = new TransactionService(repo);
  service.correct('Unknown', { category: 'Other', saveRule: false, depositPurpose: 'personal' });
  let state = repo.state();
  assert.equal(state.transactions[2].cashFlow, 500);
  assert.equal(state.transactions[2].description, 'Unknown');
  assert.equal(cashBreakdown(state.workspace!, state.accounts, state.transactions).own, 2500);
  assert.equal(depositSource(state.transactions[2]), 'personal');
  service.correct('Unknown', { category: 'Other', saveRule: false, depositPurpose: 'loan' });
  state = repo.state();
  assert.equal(cashBreakdown(state.workspace!, state.accounts, state.transactions).loans, 500);
  assert.throws(() =>
    service.correct('Unknown', { category: 'Other', saveRule: true, depositPurpose: 'personal' }),
  );
  assert.equal(
    normalize(
      {
        transaction_id: 'Unknown',
        account_id: 'demo-chequing',
        date: '2026-09-08',
        name: 'Unknown',
        amount: -500,
        pending: false,
        iso_currency_code: 'CAD',
      },
      [],
      state.transactions[2],
      'demo',
    ).depositPurpose,
    'loan',
  );
});
test('reviews checkpoint deposits once, while new deposits remain reserved on every reload', () => {
  const w = workspace();
  const tx = [deposit('PAYROLL', 2000), deposit('CEFI', 3000)];
  const b = cashBreakdown(w, accounts, tx);
  w.cashAllocations = b.rows.map((r) => ({
    accountId: r.account.id,
    own: r.own,
    loans: r.loans,
    education: r.education,
    reviewedBalance: r.balance,
    reviewedDeposits: r.deposits.map(({ id, amount, bucket }) => ({ id, amount, bucket })),
  }));
  assert.equal(cashBreakdown(w, accounts, tx).own, 2000);
  const next = [...tx, deposit('CST Savings', 700)];
  const nextAccounts = [{ ...accounts[0], balance: 5700 }];
  for (let repeat = 0; repeat < 3; repeat++) {
    const result = cashBreakdown(w, nextAccounts, next);
    assert.equal(result.cash, 5700);
    assert.equal(result.education, 3700);
    assert.equal(result.own, 2000);
  }
});
test('remaining reserves fall after spending and never exceed cash; pending, future and other-source deposits do not count', () => {
  const tx = [deposit('CEFI', 3000), { ...deposit('Purchase', -2000), date: '2026-09-10' }];
  const low = [{ ...accounts[0], balance: 1000 }];
  const result = cashBreakdown(workspace(), low, tx);
  assert.equal(result.education, 1000);
  assert.equal(result.own, 0);
  const excluded = [
    { ...deposit('CEFI', 1000), pending: true },
    { ...deposit('CEFI', 1000), date: '2027-01-01' },
    { ...deposit('CEFI', 1000), source: 'live' as const },
  ];
  assert.equal(cashBreakdown(workspace(), low, excluded).education, 0);
  assert.equal(cashBreakdown(workspace(), low, excluded).own, 1000);
});

test('each funding flag deducts a deposit once, can be changed or removed, and survives reimport', () => {
  const original = deposit('Bank deposit', 750);
  const repo = new WorkspaceRepository(
    new MemoryDocuments({ workspace: workspace(), accounts, transactions: [original] }),
  );
  const service = new TransactionService(repo);
  assert.equal(cashBreakdown(workspace(), accounts, [original]).own, 5000);
  for (const purpose of fundingTypes) {
    service.correct(original.id, { category: 'Other', saveRule: false, depositPurpose: purpose });
    const state = repo.state();
    const b = cashBreakdown(state.workspace!, state.accounts, state.transactions);
    assert.equal(b.receivedFunding.total, 750);
    assert.equal(b.fundingTotals[purpose], 750);
    assert.equal(b.own, 4250);
    const reimported = normalize(
      {
        transaction_id: original.id,
        account_id: original.accountId,
        name: original.description,
        amount: -750,
        date: original.date,
        pending: false,
        iso_currency_code: 'CAD',
      },
      [],
      state.transactions[0],
      'demo',
    );
    assert.equal(cashBreakdown(workspace(), accounts, [reimported]).fundingTotals[purpose], 750);
  }
  service.correct(original.id, { category: 'Other', saveRule: false, depositPurpose: 'personal' });
  const state = repo.state();
  assert.equal(cashBreakdown(state.workspace!, state.accounts, state.transactions).own, 5000);
  assert.equal(state.transactions[0].cashFlow, 750);
  assert.equal(state.transactions[0].description, 'Bank deposit');
});

test('a personal flag overrides automatic RESP detection across reloads and sync', () => {
  const t = deposit("Children's Education Fund", 3000);
  const repo = new WorkspaceRepository(
    new MemoryDocuments({ workspace: workspace(), accounts, transactions: [t] }),
  );
  new TransactionService(repo).correct(t.id, {
    category: 'Other',
    saveRule: false,
    depositPurpose: 'personal',
  });
  const state = repo.state();
  assert.equal(cashBreakdown(state.workspace!, state.accounts, state.transactions).own, 5000);
  assert.equal(
    cashBreakdown(state.workspace!, state.accounts, state.transactions).receivedFunding.total,
    0,
  );
});

test('a reviewed education-provider name is deducted even when the raw bank code and old category are unknown', () => {
  const original = deposit('CET MSP/DIV', 2826.2);
  const repo = new WorkspaceRepository(
    new MemoryDocuments({ workspace: workspace(), accounts, transactions: [original] }),
  );
  new TransactionService(repo).correct(original.id, {
    category: 'Other',
    saveRule: false,
    merchantOverride: "Children's Education Fund",
  });
  const state = repo.state();
  const t = state.transactions[0];
  assert.equal(t.description, 'CET MSP/DIV');
  assert.equal(t.category, 'Other');
  assert.equal(t.userCorrected, true);
  assert.equal(nonPersonalSource(t), 'resp');
  const b = cashBreakdown(state.workspace!, state.accounts, state.transactions);
  assert.equal(b.fundingTotals.resp, 2826.2);
  assert.equal(b.own, 2173.8);
  assert.equal(forecastPayload(state, defaultForecastOptions).savingsEligibleCash, 2173.8);
  const synced = normalize(
    {
      transaction_id: original.id,
      account_id: original.accountId,
      name: 'CET MSP/DIV',
      date: original.date,
      amount: -2826.2,
      pending: false,
      iso_currency_code: 'CAD',
    },
    [],
    t,
    'demo',
  );
  assert.equal(nonPersonalSource(synced), 'resp');
  assert.equal(synced.description, 'CET MSP/DIV');
  // An opaque bank code on its own is not evidence that every payment is RESP.
  assert.equal(nonPersonalSource(original), null);
});

test('funding categories and named scholarships do not become personal because of old classifications or an unknown source', () => {
  const original = deposit('Bank deposit', 1000);
  for (const [category, type] of [
    ['RESP Funding', 'resp'],
    ['OSAP Funding', 'osap'],
    ['Scholarships', 'scholarship'],
    ['Grants and Bursaries', 'grant'],
  ] as const) {
    for (const classification of ['Review', 'Transfer', 'Income'] as const) {
      const t = {
        ...original,
        category,
        classification,
        userCorrected: true,
        categoryOrigin: 'user' as const,
        depositPurpose: 'unknown' as const,
      };
      assert.equal(nonPersonalSource(t), type);
      assert.equal(cashBreakdown(workspace(), accounts, [t]).own, 4000);
    }
  }
  for (const [name, type] of [
    ['University Scholarship Payment', 'scholarship'],
    ['Student grant deposit', 'grant'],
    ['TMU bursary', 'grant'],
  ] as const) {
    assert.equal(nonPersonalSource({ ...original, description: name }), type);
  }
  for (const purpose of ['personal', 'salary', 'transfer', 'refund'] as const) {
    assert.equal(
      nonPersonalSource({
        ...original,
        merchantOverride: "Children's Education Fund",
        depositPurpose: purpose,
      }),
      null,
    );
  }
  assert.equal(
    nonPersonalSource({
      ...original,
      merchantOverride: "Children's Education Fund",
      forecastTreatment: 'reimbursement',
    }),
    null,
  );
  assert.equal(
    nonPersonalSource({
      ...original,
      description: 'INTERNAL TRANSFER RESP',
      category: 'RESP Funding',
      userCorrected: true,
    }),
    null,
  );
  assert.equal(nonPersonalSource({ ...original, description: 'Grant Thornton' }), null);
  assert.equal(
    nonPersonalSource({
      ...original,
      description: 'Canadian Scholarship Trust PAYROLL',
      category: 'Employment Income',
    }),
    null,
  );
});
