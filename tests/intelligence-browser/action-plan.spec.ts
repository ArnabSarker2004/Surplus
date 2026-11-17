import { test, expect } from '../e2e/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('weekly plan, quick review, dated changes, payment assignments and accuracy work together', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const inFlight = new Set<unknown>();
  let peakForecasts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/intelligence/forecast')) {
      inFlight.add(r);
      peakForecasts = Math.max(peakForecasts, inFlight.size);
    }
  });
  page.on('requestfinished', (r) => inFlight.delete(r));
  page.on('requestfailed', (r) => inFlight.delete(r));
  await request.post('/api/demo', { data: {} });
  await page.goto('/#intelligence');
  await expect(page.getByRole('heading', { name: 'Money in. Student life out.' })).toBeVisible();
  await expect(page.locator('#outlook-review')).toHaveCount(0);
  const dialog = page.getByRole('dialog');
  const nav = page.getByRole('navigation', { name: 'Money outlook sections' });
  await nav.getByRole('button', { name: 'Work & study', exact: true }).click();
  await page.getByRole('button', { name: 'Routine changes', exact: true }).click();
  await page.getByRole('button', { name: 'Add a dated change' }).click();
  await dialog.getByLabel('Change name').fill('Exam work reduction');
  await dialog.getByLabel('Change starts').fill('2026-10-01');
  await dialog.getByLabel('Change ends').fill('2026-10-14');
  await dialog.getByLabel('Weekly incoming change', { exact: true }).fill('-70');
  await dialog.getByRole('button', { name: 'Save dated change' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Exam work reduction', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Payment accounts', exact: true }).click();
  await page
    .getByRole('combobox', { name: /Account for/ })
    .first()
    .selectOption({ index: 1 });
  await expect(page.locator('.intelligence-results')).toBeVisible();
  await page.getByRole('button', { name: 'Tuition dates', exact: true }).click();
  await page.getByRole('button', { name: 'Plan this bill' }).first().click();
  await dialog.getByRole('spinbutton', { name: /Assessed tuition amount/ }).fill('3200');
  await dialog.getByRole('button', { name: 'Save tuition bill' }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await (await request.get('/api/state')).json();
  expect(saved.workspace.lifeEvents[0].weeklyIncomeChange).toBe(-70);
  expect(
    saved.workspace.expenses.some(
      (e: { amount: number; date: string }) => e.amount === 3200 && e.date === '2026-09-25',
    ),
  ).toBe(true);
  await nav.getByRole('button', { name: 'This week', exact: true }).click();
  await page.getByText('Reminders & bank updates', { exact: true }).click();
  await page.getByLabel('Show in-app action reminders').uncheck();
  await expect(page.locator('.weekly-actions')).toHaveCount(0);
  for (const width of [1440, 360]) {
    await expect(page.locator('.intelligence-results')).not.toHaveClass(/updating/);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/weekly-plan-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'About these estimates', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'How forecasts compare with reality' }),
  ).toBeVisible();
  await expect(page.getByText('Not scored yet', { exact: true })).toHaveCount(3);
  await page.reload();
  const final = await (await request.get('/api/state')).json();
  expect(final.workspace.intelligenceSettings.alerts).toBe(false);
  expect(final.workspace.lifeEvents).toHaveLength(1);
  expect(peakForecasts).toBe(1);
});
