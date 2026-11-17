import { test, expect } from '../e2e/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('real Python powers cash, CPI, goals, habits and reward views without clipped labels', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await request.post('/api/demo', { data: {} });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#intelligence');
  await expect(page.getByRole('heading', { name: 'Money outlook', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Money in. Student life out.' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'Cash flow', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'How your balance could change' })).toBeVisible();
  await expect(page.locator('.recharts-line-curve')).toHaveCount(1);
  await page.getByRole('button', { name: '90 days', exact: true }).click();
  await expect(page.getByRole('button', { name: '90 days', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Show range', { exact: true }).check();
  await expect(page.locator('.recharts-area-area')).toHaveCount(1);
  await page.getByLabel('Show range', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Rising prices', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'What could rising prices change?' }),
  ).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Money outlook sections' });
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of [
      'My semester',
      'Work & study',
      'This week',
      'Cash flow',
      'My goals',
      'Spending habits',
      'Card options',
      'About these estimates',
    ]) {
      if (name === 'About these estimates') {
        await page.getByRole('button', { name, exact: true }).click();
      } else {
        await nav.getByRole('button', { name, exact: true }).click();
        await expect(nav.getByRole('button', { name, exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
      }
      if (name === 'Spending habits') {
        await expect(page.locator('.weekday-row').first()).toBeVisible();
      }
      if (name === 'My goals') {
        await page.getByText('See savings over time', { exact: true }).click();
        await expect(
          page.locator('.recharts-reference-line').getByText('Goal', { exact: true }),
        ).toBeVisible();
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await expect
        .poll(() =>
          page
            .locator(
              '.recharts-cartesian-axis-tick-value, .recharts-reference-line .recharts-label',
            )
            .evaluateAll((labels) =>
              labels
                .filter((label) => {
                  const box = label.getBoundingClientRect(),
                    svg = label.closest('svg')!.getBoundingClientRect();
                  return (
                    box.left < svg.left - 1 ||
                    box.right > svg.right + 1 ||
                    box.bottom > svg.bottom + 1 ||
                    box.top < svg.top - 1
                  );
                })
                .map((label) => label.textContent),
            ),
        )
        .toEqual([]);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      ).toEqual([]);
      if (width !== 768)
        await page.screenshot({
          path: `artifacts/forecast-${name.replaceAll(' ', '-')}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole('button', { name: 'Spending habits', exact: true }).click();
  await page.getByRole('button', { name: 'Purchase frequency', exact: true }).click();
  await expect(page.locator('.weekday-row').first()).toBeVisible();
  await expect(
    page.getByRole('figure', { name: 'Average optional purchases per weekday' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try a change', exact: true }).click();
  await page.getByRole('spinbutton', { name: /Extra monthly income/ }).fill('500');
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByLabel('Do you pay card statements in full?').selectOption('yes');
  await page.getByRole('button', { name: 'Cash & tuition', exact: true }).click();
  await page.getByLabel('Use my own current cash balance').check();
  await page.getByRole('spinbutton', { name: /Total current cash/ }).fill('50000');
  await page.getByRole('button', { name: 'Update outlook', exact: true }).click();
  await expect(page.locator('.intelligence-results')).not.toHaveClass(/updating/);
  await nav.getByRole('button', { name: 'Card options', exact: true }).click();
  await expect(
    page.getByText('Highest estimated net value in this catalogue', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Reward preference', exact: true })
    .selectOption('Points');
  await expect(page.locator('.credit-match')).toHaveCount(1);
  await expect(page.locator('.credit-match')).toContainText('American Express Cobalt');
  await page.getByRole('button', { name: 'Try a change', exact: true }).click();
  await page.getByRole('button', { name: 'Cash & tuition', exact: true }).click();
  await page.getByLabel('Explore a different tuition bill').check();
  await page.getByRole('spinbutton', { name: /^Tuition amount/ }).fill('12000');
  await page.getByLabel('Tuition due date').fill('2026-11-20');
  await page.getByRole('button', { name: 'Update outlook', exact: true }).click();
  await expect(page.locator('.intelligence-results')).not.toHaveClass(/updating/);
  await nav.getByRole('button', { name: 'My goals', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tuition target', exact: true })).toBeVisible();
  const stored = await (await request.get('/api/state')).json();
  expect(
    stored.workspace.expenses.find((e: { category: string }) => e.category === 'Tuition and School')
      .amount,
  ).not.toBe(12000);
  await page.getByRole('button', { name: 'Try a change', exact: true }).click();
  await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
  await expect(page.locator('.intelligence-results')).not.toHaveClass(/updating/);
  await expect(page.getByRole('spinbutton', { name: /Extra monthly income/ })).toHaveValue('');
  await page.getByRole('button', { name: 'Cash & tuition', exact: true }).click();
  await expect(page.getByLabel('Use my own current cash balance')).not.toBeChecked();
  await expect(page.getByLabel('Explore a different tuition bill')).not.toBeChecked();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'About these estimates', exact: true }).click();
  await page.getByRole('button', { name: 'How much should I trust this forecast?' }).click();
  await expect(page.locator('.intelligence-answer')).toContainText('400 simulated paths');
  expect(errors).toEqual([]);
});

test('routine corrections persist and automatically rebuild, and goal scenarios leave saved budgets intact', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const original = await (await request.get('/api/state')).json();
  await page.goto('/#intelligence');
  await expect(page.getByRole('heading', { name: 'Money in. Student life out.' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'Spending habits' })
    .click();
  await page.getByText('Adjust routine purchases', { exact: true }).click();
  const review = page.locator('.habit-review-row').first();
  const selector = review.locator('select');
  await selector.selectOption('routine');
  await expect(page.locator('.intelligence-results')).toBeVisible();
  await expect(page.locator('.habit-review-row').first().locator('select')).toHaveValue('routine');
  const changed = await (await request.get('/api/state')).json();
  const corrections = changed.transactions.filter(
    (t: { habitTreatment?: string }) => t.habitTreatment === 'routine',
  );
  expect(corrections).toHaveLength(1);
  expect(
    changed.transactions.find((t: { id: string }) => t.id === corrections[0].id).cashFlow,
  ).toBe(original.transactions.find((t: { id: string }) => t.id === corrections[0].id).cashFlow);
  const scenario = page
    .getByRole('button', { name: 'See the effect on my goals', exact: true })
    .first();
  if (await scenario.count()) {
    await scenario.click();
    await expect(page.getByRole('heading', { name: 'My goals' })).toBeVisible();
  }
  expect((await (await request.get('/api/state')).json()).workspace.budgets).toEqual(
    original.workspace.budgets,
  );
  await page.goto('/#goals');
  await page.getByRole('button', { name: 'View my goal outlook' }).click();
  await expect(page.getByRole('heading', { name: 'My goals' })).toBeVisible();
});

test('forecast failure can retry and sparse manual data does not invent risk scores', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const state = await (await request.get('/api/state')).json();
  await request.put('/api/workspace', { data: { ...state.workspace, source: 'manual' } });
  await page.route('**/api/intelligence/forecast', (route) =>
    route.fulfill({ status: 503, json: { error: 'Forecast service unavailable. Try again.' } }),
  );
  await page.goto('/#intelligence');
  await expect(page.getByRole('alert')).toContainText('Try again');
  await page.unroute('**/api/intelligence/forecast');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Building your picture', { exact: true })).toBeVisible();
  await expect(page.getByText('Start with your balance', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'About these estimates', exact: true }).click();
  await page.locator('.intelligence-warnings > summary').click();
  await expect(
    page.getByText('No CAD cash account balance is available.', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'Cash flow', exact: true })
    .click();
  await page.getByRole('button', { name: 'Next two weeks', exact: true }).click();
  await page.getByText('Risk estimates & assumptions', { exact: true }).click();
  await expect(page.getByText('Not scored', { exact: true })).toHaveCount(4);
});
