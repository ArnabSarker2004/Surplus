import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.use({ actionTimeout: 10_000 });

test('company and detailed category corrections persist with readable evidence on mobile and desktop', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  await page.goto('/#transactions');
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Balzac');
  await page
    .getByRole('button', { name: /Details for Balzac/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Transaction details' })).toBeVisible();
  await dialog.getByText('View the evidence behind this match').click();
  await expect(dialog.getByText('Original bank description', { exact: true })).toBeVisible();
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await dialog.screenshot({ path: `artifacts/transaction-details-${width}.png` });
  }
  await dialog
    .getByRole('textbox', { name: 'Correct company name' })
    .fill('Balzac’s Coffee Roasters');
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Coffee');
  await dialog
    .getByRole('combobox', { name: /^Detailed category/ })
    .selectOption('FOOD_AND_DRINK_COFFEE');
  await expect(dialog.locator('.transaction-model-preview')).toContainText('Coffee / Coffee');
  await dialog.getByRole('button', { name: 'Save transaction' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Balzac’s Coffee Roasters');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Confirmed by you');
  const state = await (await request.get('/api/state')).json();
  const saved = state.transactions.find(
    (t: { merchantOverride?: string }) => t.merchantOverride === 'Balzac’s Coffee Roasters',
  );
  expect(saved.detailCategory).toBe('FOOD_AND_DRINK_COFFEE');
  expect(saved.description).not.toBe(saved.merchantOverride);
  const invalid = await request.patch(`/api/transactions/${saved.id}`, {
    data: { category: 'Housing', detailCategory: 'FOOD_AND_DRINK_COFFEE' },
  });
  expect(invalid.status()).toBe(400);
});
