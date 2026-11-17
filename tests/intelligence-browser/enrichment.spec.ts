import { test, expect } from '../e2e/fixtures';
import AxeBuilder from '@axe-core/playwright';
import type { AppState } from '../../shared/schema';

test('real Python cleanup and Express cache return local suggestions with bank amounts intact', async ({
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const before = (await (await request.get('/api/state')).json()) as AppState;
  const response = await request.post('/api/transactions/enrichment', { data: {} });
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(['local', 'cached']).toContain(result.status);
  const state = result.state as AppState;
  const netflix = state.transactions.find((t) => t.description === 'Netflix' && !t.pending)!;
  expect(netflix.enrichment?.merchant).toBe('Netflix');
  expect(netflix.enrichment?.category).toBe('Subscriptions');
  expect(netflix.enrichment?.method).toBe('local');
  expect(state.transactions.map((t) => [t.id, t.description, t.cashFlow, t.category])).toEqual(
    before.transactions.map((t) => [t.id, t.description, t.cashFlow, t.category]),
  );
  const cached = await (await request.post('/api/transactions/enrichment', { data: {} })).json();
  expect(cached.status).toBe('cached');
});

test('cleanup applies on opening the list and inline corrections persist without a modal', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const original = await (await request.get('/api/state')).json();
  const row = original.transactions.find((t: { merchant: string }) =>
    t.merchant.includes('Balzac'),
  );
  await page.route('**/api/transactions/enrichment', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { configured: false, status: 'idle', model: 'test' } });
    await route.fulfill({
      json: {
        configured: false,
        status: 'local',
        state: {
          ...original,
          transactions: original.transactions.map((t: { id: string }) =>
            t.id === row.id
              ? {
                  ...t,
                  enrichment: {
                    descriptorHash: 'test',
                    merchant: 'Suggested coffee shop',
                    cleaned: 'Coffee shop',
                    category: 'Coffee',
                    method: 'local',
                    model: null,
                    updatedAt: new Date().toISOString(),
                  },
                }
              : t,
          ),
        },
      },
    });
  });
  await page.goto('/#transactions');
  await expect(page.getByRole('status')).toContainText('Local cleanup is applied');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByText('Cleanup settings', { exact: true }).click();
  await expect(page.getByLabel('Use Groq for unfamiliar merchants')).toBeDisabled();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Balzac');
  await page
    .getByRole('button', { name: /Quick edit Suggested coffee shop/ })
    .first()
    .click();
  const editor = page.getByRole('form', { name: /Quick edit Suggested coffee shop/ });
  await expect(editor.getByRole('textbox', { name: 'Merchant name' })).toHaveValue(
    'Suggested coffee shop',
  );
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await editor.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      }),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/transaction-quick-edit-${width}.png`,
      fullPage: true,
    });
  }
  await editor.getByRole('textbox', { name: 'Merchant name' }).fill('My coffee shop');
  await editor.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Groceries');
  await editor.getByLabel('Remember this for the same merchant').check();
  await page.route(`**/api/transactions/${row.id}`, (route) =>
    route.fulfill({ status: 503, json: { error: 'Please retry this save.' } }),
  );
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor.getByRole('alert')).toContainText('Please retry');
  await expect(editor.getByRole('textbox', { name: 'Merchant name' })).toHaveValue(
    'My coffee shop',
  );
  await page.unroute(`**/api/transactions/${row.id}`);
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor).toHaveCount(0);
  const saved = (await (await request.get('/api/state')).json()).transactions.find(
    (t: { id: string }) => t.id === row.id,
  );
  expect(saved.merchantOverride).toBe('My coffee shop');
  expect(saved.merchantCorrected).toBe(true);
  expect(saved.category).toBe('Groceries');
  expect(saved.cashFlow).toBe(row.cashFlow);
  expect(saved.description).toBe(row.description);
  await page.unroute('**/api/transactions/enrichment');
  await page.reload();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('My coffee shop');
  await expect(
    page.getByRole('button', { name: /Quick edit My coffee shop/ }).first(),
  ).toBeVisible();
  expect(
    (await (await request.get('/api/state')).json()).rules.some(
      (r: { merchantOverride: string }) => r.merchantOverride === 'My coffee shop',
    ),
  ).toBe(true);
});
