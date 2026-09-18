import { test, expect } from '../e2e/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('real Python service powers forecasts, tuition scenarios, explanations and responsive charts', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#intelligence');
  await expect(page.getByRole('heading', { name: 'See a little further ahead.' })).toBeVisible();
  await page.getByRole('button', { name: 'Build my forecast' }).click();
  await expect(page.getByRole('heading', { name: 'The possible paths ahead' })).toBeVisible();
  await expect(page.getByText('Python forecasting engine', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'A better fit for the way you spend' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fall tuition', exact: true })).toBeVisible();
  await page.getByText('How this forecast was built', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Variable weekly spending' })).toBeVisible();
  await page.getByRole('button', { name: 'How much should I trust this forecast?' }).click();
  await expect(page.locator('.intelligence-answer')).toContainText('400 simulated paths');
  await page.getByRole('spinbutton', { name: /Extra monthly income/ }).fill('500');
  await page.getByText('Credit card comparison assumptions', { exact: true }).click();
  await page.getByLabel('Do you pay card statements in full?').selectOption('yes');
  await page.getByRole('button', { name: 'Update forecast' }).click();
  await expect(page.getByRole('button', { name: 'Update forecast' })).toBeEnabled();
  await expect(page.locator('.intelligence-results')).not.toHaveClass(/updating/);
  await expect(
    page.getByText('Highest estimated net value in this catalogue', { exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Reward preference', exact: true }).selectOption('Points');
  await expect(page.locator('.credit-match')).toHaveCount(1);
  await expect(page.locator('.credit-match')).toContainText('American Express Cobalt');
  await page.getByRole('combobox', { name: 'Reward preference', exact: true }).selectOption('all');
  await page.getByText('Tuition target & cash assumptions', { exact: true }).click();
  await page.getByLabel('Explore a different tuition bill').check();
  await page.getByRole('spinbutton', { name: 'Tuition amount' }).fill('12000');
  await page.getByLabel('Tuition due date').fill('2026-11-20');
  await page.getByRole('button', { name: 'Update forecast' }).click();
  await expect(page.getByRole('heading', { name: 'Tuition target', exact: true })).toBeVisible();
  const stored = await (await request.get('/api/state')).json();
  expect(
    stored.workspace.expenses.find(
      (expense: { category: string }) => expense.category === 'Tuition and School',
    ).amount,
  ).not.toBe(12000);
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect
      .poll(() =>
        page.locator('.recharts-cartesian-axis-tick-value').evaluateAll((labels) =>
          labels
            .filter((label) => {
              const box = label.getBoundingClientRect(),
                svg = label.closest('svg')!.getBoundingClientRect();
              return (
                box.left < svg.left - 1 || box.right > svg.right + 1 || box.bottom > svg.bottom + 1
              );
            })
            .map((label) => label.textContent),
        ),
      )
      .toEqual([]);
    await page.screenshot({ path: `artifacts/intelligence-${width}.png`, fullPage: true });
    await page
      .locator('.intelligence-chart')
      .screenshot({ path: `artifacts/intelligence-chart-${width}.png` });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test('forecast failure has a retry and sparse manual data requests a cash balance', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const state = await (await request.get('/api/state')).json();
  await request.put('/api/workspace', { data: { ...state.workspace, source: 'manual' } });
  await page.goto('/#intelligence');
  await page.route('**/api/intelligence/forecast', (route) =>
    route.fulfill({ status: 503, json: { error: 'Forecast service unavailable. Try again.' } }),
  );
  await page.getByRole('button', { name: 'Build my forecast' }).click();
  await expect(page.getByRole('alert')).toContainText('Try again');
  await page.unroute('**/api/intelligence/forecast');
  await page.getByRole('button', { name: 'Build my forecast' }).click();
  await expect(page.getByText('limited history', { exact: true })).toBeVisible();
  await expect(
    page.getByText('No CAD cash account balance is available.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Cash balance needed', { exact: true })).toBeVisible();
});
