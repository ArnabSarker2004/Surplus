import AxeBuilder from '@axe-core/playwright';
import type { AppState } from '../../shared/schema';
import { test, expect } from './fixtures';

test('education deposits are detected, filterable and explained without counting pending funding', async ({
  page,
  request,
}) => {
  const state = (await (await request.post('/api/demo', { data: {} })).json()) as AppState;
  const deposit = (id: string, name: string, amount: number, pending = false) => ({
    id,
    accountId: 'demo-chequing',
    date: '2026-09-08',
    authorizedDate: '2026-09-08',
    merchant: name,
    description: name,
    cashFlow: amount,
    rawAmount: -amount,
    currency: 'CAD',
    pending,
    userCorrected: false,
    plaidPrimary: '',
    plaidDetailed: '',
    confidence: 'UNKNOWN',
    source: 'demo' as const,
    category: 'Other' as const,
    classification: 'Review' as const,
    categoryOrigin: 'review' as const,
  });
  state.transactions = [
    deposit('osap', 'OSAP DISBURSEMENT', 4600),
    deposit('resp', 'RBC RESP EAP', 1200),
    deposit('aid', 'NSLSC DISBURSEMENT', 700),
    deposit('pending', 'RESP PENDING PAYMENT', 300, true),
  ];
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/transactions/enrichment', (route) =>
    route.fulfill({ json: { state, status: 'cached', configured: false, remaining: 0 } }),
  );
  await page.goto('/#transactions');
  const summary = page.getByRole('region', { name: 'Education funding deposits' });
  await expect(summary.getByText('$4,600.00', { exact: true })).toBeVisible();
  await expect(summary.getByText('$1,200.00', { exact: true })).toBeVisible();
  await expect(summary.getByText('$700.00', { exact: true })).toBeVisible();
  await expect(summary).toContainText('$300.00 pending funding');
  await expect(summary).toContainText('4 auto-detected');
  const filter = page.getByRole('combobox', { name: 'Filter education funding' });
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await summary.screenshot({ path: `artifacts/education-deposits-${width}.png` });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await filter.selectOption('resp');
  await expect(page.locator('.transaction-table tbody > tr')).toHaveCount(2);
  await expect(page.locator('.transaction-table')).toContainText('RESP Funding');
  await expect(summary.getByText('$1,200.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Details for RBC RESP EAP on 2026-09-08' }).click();
  const evidence = page.getByRole('region', { name: 'Education funding detection' });
  await expect(evidence).toContainText('Auto-detected');
  await expect(evidence).toContainText('RBC RESP EAP');
  await expect(evidence).toContainText('does not establish their split');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await filter.selectOption('osap');
  await expect(page.locator('.transaction-table tbody > tr')).toHaveCount(1);
  await expect(page.locator('.transaction-table')).toContainText('Loan / grant split unknown');
  await filter.selectOption('student-aid');
  await expect(page.locator('.transaction-table tbody > tr')).toHaveCount(1);
  await expect(page.locator('.transaction-table')).toContainText('Student Aid Funding');
  await summary.getByRole('button', { name: 'Review account money' }).click();
  await expect(page.getByRole('region', { name: 'Student money breakdown' })).toBeVisible();
});
