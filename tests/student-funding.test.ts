import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, forecast, totals, type PlaidTransaction } from '../shared/finance';
import { detectStudentFunding, studentFunding } from '../shared/student-funding';
import { applyAutomaticCleanup } from '../shared/transaction-cleanup';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { TransactionService } from '../backend/src/services/transaction-service';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import { defaultForecastOptions } from '../shared/intelligence';
import { demoWorkspace } from '../shared/demo';

const raw = (name: string, patch: Partial<PlaidTransaction> = {}): PlaidTransaction => ({
  transaction_id: 'fund',
  account_id: 'cash',
  date: '2026-09-08',
  name,
  amount: -2300,
  iso_currency_code: 'CAD',
  pending: false,
  ...patch,
});
test('recognizes explicit OSAP/RESP descriptors and NSLSC labels even with unknown or transfer bank categories', () => {
  for (const [name, category] of [
    ['OSAP disbursement', 'OSAP Funding'],
    ['OSAP123456 deposit', 'OSAP Funding'],
    ['ONT STUD ASSIST', 'OSAP Funding'],
    ['O.S.A.P. CREDIT 019', 'OSAP Funding'],
    ['ONTARIO STUDENT ASSISTANCE PROGRAM', 'OSAP Funding'],
    ['CANADA-ONTARIO INTEGRATED STUDENT LOAN', 'OSAP Funding'],
    ['RBC RESP WITHDRAWAL EAP', 'RESP Funding'],
    ['R.E.S.P. distribution', 'RESP Funding'],
    ['Registered Education Savings Plan withdrawal', 'RESP Funding'],
    ['EDUCATIONAL ASSISTANCE PAYMENT', 'RESP Funding'],
    ['NSLSC deposit', 'Student Aid Funding'],
    ['NSLSC019 deposit', 'Student Aid Funding'],
    ['Canada Student Grant', 'Student Aid Funding'],
    ['EDUCATION FUNDING DEPOSIT', 'Education Funding'],
    ["Children's Educ Fund", 'RESP Funding'],
    ['National Student Loans Service Centre', 'Student Aid Funding'],
    ['Centre de service national de prêts aux étudiants', 'Student Aid Funding'],
  ]) {
    const t = normalize(
      raw(name, {
        merchant_name: 'Bank deposit',
        personal_finance_category: {
          primary: 'TRANSFER_IN',
          detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER',
          confidence_level: 'VERY_HIGH',
        },
      }),
      [],
      undefined,
      'live',
    );
    assert.equal(t.category, category, name);
    assert.equal(t.classification, 'Income', name);
    assert.equal(t.categoryOrigin, 'funding', name);
    assert.equal(t.description, name);
    assert.equal(t.rawAmount, -2300);
    assert.equal(t.cashFlow, 2300);
  }
});

test('uses original bank descriptions to detect education deposits hidden by a cleaned name', () => {
  const t = normalize(
    raw('Deposit', {
      merchant_name: 'Bank deposit',
      original_description: "Children's Education Fund",
    }),
  );
  assert.equal(t.category, 'RESP Funding');
  assert.equal(t.description, "Children's Education Fund");
  assert.equal(t.cashFlow, 2300);
  assert.equal(normalize(raw('PAYROLL', { original_description: ' ' })).description, 'PAYROLL');
});
test('does not match generic deposits, lookalikes, outflows, foreign currencies or internal reserve transfers', () => {
  for (const name of [
    'RESPONSIVE CONSULTING PAY',
    'OSAPAY',
    'RBC EAP',
    'PSE',
    'Canada deposit',
    'CRA CREDIT',
    'Scholarship',
    'INTERNAL TRANSFER RESP',
    'SAVINGS TRANSFER OSAP',
    'TRANSFER BETWEEN MY ACCOUNTS OSAP',
    'OSAP RESP',
  ])
    assert.equal(detectStudentFunding(normalize(raw(name))), null, name);
  for (const patch of [
    { amount: 300 },
    { amount: 0 },
    { iso_currency_code: 'USD' },
    { iso_currency_code: null },
  ])
    assert.equal(detectStudentFunding(normalize(raw('RESP withdrawal', patch))), null);
});
test('does not infer a loan/grant split from provider names or mixed descriptions', () => {
  for (const name of [
    'OSAP',
    'NSLSC',
    'National Student Loans Service Centre',
    'CANADA ONTARIO INTEGRATED STUDENT LOAN',
    'OSAP GRANT / LOAN',
    'OSAP LOAN AND GRANT',
  ])
    assert.equal(
      detectStudentFunding(normalize(raw(name)))?.detail,
      'Loan / grant split unknown',
      name,
    );
  assert.equal(detectStudentFunding(normalize(raw('OSAP LOAN')))?.detail, 'Loan described');
  assert.equal(detectStudentFunding(normalize(raw('OSAP GRANT')))?.detail, 'Grant described');
});
test('repairs saved historical deposits without changing bank facts, repeating detection, or inventing future pay', () => {
  const repo = new WorkspaceRepository(new MemoryDocuments({ workspace: demoWorkspace() }));
  const t = normalize(raw('RESP EAP DISBURSEMENT'), [], undefined, 'demo');
  repo.store.set('transactions', [
    { ...t, category: 'Other', classification: 'Review', categoryOrigin: 'review' },
  ]);
  const loaded = repo.state().transactions[0];
  assert.equal(loaded.category, 'RESP Funding');
  assert.equal(loaded.description, t.description);
  assert.equal(loaded.cashFlow, t.cashFlow);
  assert.equal(applyAutomaticCleanup(loaded), loaded);
  assert.equal(totals([loaded]).income, 2300);
  assert.equal(totals([{ ...loaded, pending: true }]).income, 0);
  const payload = forecastPayload(repo.state(), defaultForecastOptions);
  assert.equal(payload.transactions[0].category, 'RESP Funding');
  assert.equal(forecast(demoWorkspace(), [{ ...loaded, date: '2026-08-08' }], 0, 100).average, 0);
  assert.equal(repo.workspace()!.funding.length, demoWorkspace().funding.length);
});
test('preserves corrections, merchant rules, reimbursements and splits through imports and reloads', () => {
  const t = normalize(raw('OSAP DEPOSIT'), [], undefined, 'demo');
  for (const patch of [
    { userCorrected: true },
    { categoryOrigin: 'user' as const },
    { categoryOrigin: 'rule' as const },
    { forecastTreatment: 'reimbursement' as const },
    { splits: [{ category: 'Groceries' as const, amount: 2300 }] },
  ]) {
    const corrected = {
      ...t,
      category: 'Other' as const,
      classification: 'Review' as const,
      ...patch,
    };
    assert.equal(applyAutomaticCleanup(corrected), corrected);
  }
  const repo = new WorkspaceRepository(
    new MemoryDocuments({ workspace: demoWorkspace(), transactions: [t] }),
  );
  new TransactionService(repo).correct(t.id, { category: 'Employment Income', saveRule: false });
  const saved = repo.state().transactions[0];
  assert.equal(saved.category, 'Employment Income');
  assert.equal(studentFunding(saved), null);
  assert.equal(normalize(raw('OSAP DEPOSIT'), [], saved, 'demo').category, 'Employment Income');
  const ruled = normalize(
    raw('OSAP DEPOSIT'),
    [{ merchant: 'OSAP DEPOSIT', source: 'demo', category: 'Other', classification: 'Review' }],
    undefined,
    'demo',
  );
  assert.equal(ruled.category, 'Other');
});
test('recognizes pending funding without reporting it as received, and uses only bank counterparty evidence', () => {
  const pending = normalize(raw('RESP EAP', { pending: true }));
  assert.equal(studentFunding(pending)?.automatic, true);
  assert.equal(totals([pending]).income, 0);
  const counterpart = normalize(
    raw('DEPOSIT', {
      counterparties: [{ name: 'NSLSC', type: 'financial_institution', confidence_level: 'HIGH' }],
    }),
  );
  assert.equal(counterpart.category, 'Student Aid Funding');
  const pendingCounterpart = normalize(
    raw('DEPOSIT', {
      pending: true,
      counterparties: [{ name: 'NSLSC', type: 'financial_institution' }],
    }),
    [],
    undefined,
    'live',
  );
  const postedCounterpart = normalize(
    raw('DEPOSIT POSTED', {
      transaction_id: 'posted',
      pending_transaction_id: pendingCounterpart.id,
    }),
    [],
    pendingCounterpart,
    'live',
  );
  assert.equal(postedCounterpart.category, 'Student Aid Funding');
  assert.equal(postedCounterpart.fundingCounterparty, 'NSLSC');
  const legacyCounterpart = {
    ...counterpart,
    fundingCounterparty: undefined,
    category: 'Other' as const,
    classification: 'Review' as const,
    categoryOrigin: 'review' as const,
  };
  assert.equal(applyAutomaticCleanup(legacyCounterpart).category, 'Student Aid Funding');
  const plain = normalize(raw('DEPOSIT'));
  assert.equal(detectStudentFunding({ ...plain, merchantOverride: 'OSAP' } as typeof plain), null);
});
