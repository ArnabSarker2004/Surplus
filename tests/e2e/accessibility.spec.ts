import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('welcome, onboarding, and dashboard meet automated WCAG checks', async ({ page, request }) => {
  await request.delete('/api/data');
  await page.goto('/');
  await expect(page.locator('.welcome-copy')).toHaveCSS('opacity', '1');
  await expect(page.locator('.welcome-art')).toHaveCSS('opacity', '1');
  const findings: unknown[] = [];
  const scan = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    findings.push(
      ...result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    );
  };
  await scan();
  await page.getByRole('button', { name: 'Set up my semester', exact: true }).click();
  await expect(page.locator('.institution-card').last()).toHaveCSS('opacity', '1');
  await scan();
  await page.getByRole('button', { name: 'Save draft and exit setup' }).click();
  await page.getByRole('button', { name: 'Try the TMU demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await scan();
  expect(findings).toEqual([]);
  await page.keyboard.press('Tab');
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
});
