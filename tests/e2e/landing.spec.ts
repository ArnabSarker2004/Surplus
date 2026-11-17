import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test('public home leads to login, signup and an isolated interactive demo', async ({ page }) => {
  // The public entry works independently of account storage; use cloud account availability.
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        setupRequired: false,
        registrationOpen: true,
        user: null,
      },
    }),
  );
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) privateRequests.push(path);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'More life. Less money worry.' })).toBeVisible();
  await page.getByRole('button', { name: 'The product', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Built around your life. Not just your balance.' }),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Savings & scenarios', exact: true }).click();
  await expect(page.getByText('See what a different choice could make possible.')).toBeVisible();
  await expect(page.locator('.marketing-preview-total')).toContainText('$178.50');
  await page.getByRole('button', { name: 'Campus opportunities', exact: true }).click();
  await expect(page.getByText('Look beyond the budget. Find a way forward.')).toBeVisible();
  await page.getByRole('button', { name: 'Semester planning', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Can I try it without signing up?' }).click();
  await expect(
    page.getByText('Yes. The interactive demo uses a fictional student budget.', { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/landing-desktop.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page
    .getByRole('navigation', { name: 'Public navigation' })
    .getByRole('link', { name: 'Log in', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page
    .getByRole('navigation', { name: 'Public navigation' })
    .getByRole('link', { name: 'Sign up', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Make this space yours.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with Microsoft/ })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page.getByRole('link', { name: 'Try the demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  const demoNav = page.getByRole('navigation', { name: 'Demo navigation' });
  await page.getByRole('button', { name: 'Open money outlook' }).click();
  await expect(page.getByRole('heading', { name: 'Money in. Student life out.' })).toBeVisible();
  await page.getByRole('button', { name: 'About these estimates', exact: true }).click();
  await expect(page.getByText('Python forecasting engine', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Money outlook sections' })
    .getByRole('button', { name: 'Card options', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Card options', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Credit card matches' })).toBeVisible();
  await demoNav.getByRole('button', { name: 'Savings goals', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Emergency fund', exact: true }).click();
  await page.getByRole('spinbutton', { name: /Already saved/ }).fill('550');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByText('$550', { exact: true })).toBeVisible();
  await demoNav.getByRole('button', { name: 'Transactions', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Balzac');
  await page
    .getByRole('button', { name: /Details for Balzac/ })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption('Eating Out');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await demoNav.getByRole('button', { name: 'Savings goals', exact: true }).click();
  await expect(page.getByText('$550', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('$550', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  expect(privateRequests).toEqual([]);
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/landing-mobile.png', fullPage: true });
});
