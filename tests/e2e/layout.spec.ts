import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('demo pages keep chart labels and content inside mobile, tablet and desktop layouts', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const privateRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) privateRequests.push(path);
  });
  await page.goto('/#demo');
  const nav = page.getByRole('navigation', { name: 'Demo navigation' });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const name of [
      'Overview',
      'Semester plan',
      'Transactions',
      'Budgets & insights',
      'Money outlook',
      'What-if planner',
      'Savings goals',
      'Opportunities',
      'Learn & grow',
      'Bank connection',
    ]) {
      await nav.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('main h1')).toBeVisible();
      if (name === 'What-if planner') {
        await page
          .getByRole('spinbutton', { name: 'Additional income each month' })
          .fill('10000000');
        await page.getByRole('spinbutton', { name: 'Additional income each month' }).press('Tab');
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
          message: `${name} must fit at ${width}px`,
        })
        .toBe(true);
      expect(
        await page
          .locator('main h1, main h2, main h3, main p, main strong, main small, main button')
          .evaluateAll((nodes) =>
            nodes
              .filter(
                (node) =>
                  node.clientWidth > 0 &&
                  node.scrollWidth > node.clientWidth + 2 &&
                  !node.closest('.table-scroll'),
              )
              .map((node) => node.textContent),
          ),
        `Text should fit its container on ${name} at ${width}px`,
      ).toEqual([]);
      // SVG text has no scrollWidth. Measure rendered bounds against its viewport instead.
      const chartLabels = page.locator('.recharts-cartesian-axis-tick-value');
      if (await chartLabels.count()) {
        await expect
          .poll(
            () =>
              chartLabels.evaluateAll((labels) =>
                labels.flatMap((label) => {
                  const box = label.getBoundingClientRect();
                  const viewport = label.closest('svg')!.getBoundingClientRect();
                  return box.left < viewport.left - 1 ||
                    box.right > viewport.right + 1 ||
                    box.top < viewport.top - 1 ||
                    box.bottom > viewport.bottom + 1
                    ? [label.textContent]
                    : [];
                }),
              ),
            { message: `Chart labels must fit for ${name} at ${width}px` },
          )
          .toEqual([]);
      }
      if (
        [
          'Overview',
          'What-if planner',
          'Transactions',
          'Semester plan',
          'Savings goals',
          'Money outlook',
        ].includes(name)
      ) {
        await page.screenshot({
          path: `artifacts/polish-${name.split(' ')[0].toLowerCase()}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await nav.getByRole('button', { name: 'Overview', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
  expect(privateRequests).toEqual([]);
});
