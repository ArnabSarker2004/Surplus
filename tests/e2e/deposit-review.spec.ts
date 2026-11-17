import AxeBuilder from '@axe-core/playwright';
import type { AppState, Transaction } from '../../shared/schema';
import { expect, test } from './fixtures';

test('provider funds reserve cash and reviewing an unknown company changes the personal share', async ({
  page,
  request,
}) => {
  const state = (await (await request.post('/api/demo', { data: {} })).json()) as AppState;
  delete state.workspace!.cashAllocations;
  state.accounts = [{ ...state.accounts[0], balance: 5000 }];
  const deposit = (
    id: string,
    merchant: string,
    amount: number,
    category: Transaction['category'] = 'Other',
  ): Transaction => ({
    id,
    accountId: state.accounts[0].id,
    date: '2026-09-08',
    authorizedDate: '2026-09-08',
    merchant,
    description: merchant,
    cashFlow: amount,
    rawAmount: -amount,
    currency: 'CAD',
    pending: false,
    category,
    classification: category === 'Employment Income' ? 'Income' : 'Review',
    categoryOrigin: 'review',
    userCorrected: false,
    confidence: 'UNKNOWN',
    plaidPrimary: '',
    plaidDetailed: '',
    source: 'demo',
  });
  state.transactions = [
    deposit('job', 'Campus payroll', 2000, 'Employment Income'),
    deposit('school', 'Children’s Education Funds Inc', 2500),
    deposit('unknown', 'Unfamiliar company deposit', 500),
  ];
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/transactions/enrichment', (route) =>
    route.fulfill({ json: { state, status: 'cached', configured: false, remaining: 0 } }),
  );
  await page.route('**/api/transactions/unknown', async (route) => {
    const patch = route.request().postDataJSON();
    expect(patch.depositPurpose).toBe('personal');
    expect(patch.saveRule).toBe(false);
    state.transactions[2] = {
      ...state.transactions[2],
      ...patch,
      userCorrected: true,
      categoryOrigin: 'user',
    };
    await route.fulfill({ json: state });
  });
  await page.goto('/#overview');
  const balance = page.getByRole('region', { name: 'Student money breakdown' });
  await expect(balance.locator('.money-personal')).toContainText('$2,500.00');
  await expect(balance).not.toContainText('unassigned');
  await page.goto('/#transactions');
  const reviews = page.getByRole('region', { name: 'Non-salary deposits' });
  await expect(reviews).toContainText('Unfamiliar company deposit');
  await expect(reviews).toContainText('Children’s Education Funds Inc');
  await expect(reviews).toContainText('These count as personal money unless you flag them');
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await reviews.screenshot({ path: `artifacts/deposit-review-${width}.png` });
  }
  await reviews.getByRole('button', { name: 'Identify source' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Identify this deposit' });
  await dialog.getByRole('combobox', { name: 'Deposit source' }).selectOption('personal');
  expect(
    (await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
  await dialog.screenshot({ path: 'artifacts/deposit-source-mobile.png' });
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reviews).not.toContainText('deposits without a known source');
  await page.goto('/#overview');
  await expect(balance.locator('.money-personal')).toContainText('$2,500.00');
  await expect(balance).toContainText('$5,000.00');
  await page.reload();
  await expect(balance.locator('.money-personal')).toContainText('$2,500.00');
});
