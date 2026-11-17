import { test, expect } from '../e2e/fixtures';
import type { AppState } from '../../shared/schema';

test('weak merchant evidence stays quiet; unresolved categories clear after confirmation', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const state = (await (await request.get('/api/state')).json()) as AppState;
  await page.goto('/#intelligence');
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'This week', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Your next seven days' })).toBeVisible();
  await expect(page.locator('#outlook-review')).toHaveCount(0);
  await expect(
    page.getByText('things to know about these estimates', { exact: false }),
  ).toHaveCount(0);
  const target = state.transactions.find((t) => !t.pending && t.cashFlow < 0)!;
  let unresolved = true;
  const fixture = () => ({
    ...state,
    transactions: state.transactions.map((t) =>
      t.id === target.id
        ? {
            ...t,
            date: '2026-09-10',
            category: 'Other',
            classification: 'Review',
            categoryOrigin: 'review',
            userCorrected: false,
            merchantOverride: null,
            enrichment: undefined,
          }
        : t,
    ),
  });
  await page.route('**/api/state', async (route) =>
    unresolved ? route.fulfill({ json: fixture() }) : route.continue(),
  );
  await page.route('**/api/transactions/enrichment', async (route) =>
    unresolved
      ? route.fulfill({
          json: { state: fixture(), status: 'cached', configured: false, remaining: 0 },
        })
      : route.continue(),
  );
  await page.route(`**/api/transactions/${target.id}`, async (route) => {
    const result = await route.fetch();
    unresolved = false;
    await route.fulfill({ response: result });
  });
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'This week', exact: true })
    .click();
  const queue = page.locator('#outlook-review');
  await expect(queue).toContainText('1 transaction needs your input');
  await queue.click();
  await expect(
    page.getByRole('dialog', { name: 'Review transactions', exact: true }),
  ).toContainText('Choose a spending category');
  await page.getByRole('button', { name: 'Review entry' }).click();
  const dialog = page.getByRole('dialog', { name: 'Quick transaction review', exact: true });
  await dialog.getByLabel('Review category').selectOption('Other');
  await dialog.getByRole('button', { name: 'Save review' }).click();
  await expect(queue).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'This week', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Your next seven days' })).toBeVisible();
  await expect(queue).toHaveCount(0);
  const saved = (await (await request.get('/api/state')).json()).transactions.find(
    (t: { id: string }) => t.id === target.id,
  );
  expect(saved.category).toBe('Other');
  expect(saved.userCorrected).toBe(true);
});
