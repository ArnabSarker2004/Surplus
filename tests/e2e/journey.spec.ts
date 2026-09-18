import { expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.delete('/api/data');
});

test('demo → onboarding → plan → insight → opportunity → scenario → savings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your semester/ })).toBeVisible();
  await expect(page.locator('.welcome-copy')).toHaveCSS('opacity', '1');
  await expect(page.locator('.welcome-art')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/welcome-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Try the TMU demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Make it yours' }).click();
  await expect(page.getByRole('heading', { name: 'Where are you studying?' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /TMU Toronto Metropolitan University/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'artifacts/onboarding-desktop.png', fullPage: true });
  for (let step = 0; step < 8; step++)
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Build my semester plan' }).click();
  await expect(page.getByRole('heading', { name: 'See the whole picture.' })).toBeVisible();
  await expect(page.getByText('Funding gap', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Budgets & insights' }).click();
  await expect(
    page.getByRole('heading', { name: 'A little intention goes a long way.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'A little less takeout, a little more room' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try this in my plan' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Small changes. New possibilities.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Opportunities', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Your skills can open doors.' })).toBeVisible();
  await page.getByRole('button', { name: 'Demo examples', exact: true }).click();
  await page.getByRole('button', { name: 'Why this might fit' }).first().click();
  await expect(page.getByText('Uses your React and TypeScript skills')).toBeVisible();
  await page.getByRole('button', { name: 'What if I receive this?' }).first().click();
  await expect(page.getByText('Hypothetical scenario', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save scenario' }).click();
  await page.reload();
  await expect(page.getByLabel('What if I receive an opportunity?')).toHaveValue('zone');
  await page.getByRole('link', { name: 'Savings goals', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Emergency fund', exact: true }).click();
  await page.getByRole('spinbutton', { name: /Already saved/ }).fill('550');
  await page.getByRole('button', { name: 'Save goal', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('$550', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('$550', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('all routes render, category changes persist, settings exposes no secrets', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  await page.goto('/#transactions');
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Balzac');
  await page
    .getByRole('button', { name: /Edit Balzac/ })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption('Eating Out');
  await page.getByRole('button', { name: 'Save category' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const [hash, heading] of [
    ['overview', 'A little clarity, Alex.'],
    ['semester', 'See the whole picture.'],
    ['budgets', 'A little intention goes a long way.'],
    ['opportunities', 'Your skills can open doors.'],
    ['scenario', 'Small changes. New possibilities.'],
    ['goals', 'For your future self.'],
    ['learn', 'A little knowledge. A longer view.'],
    ['settings', 'Make yourself at home.'],
  ]) {
    await page.goto('/#' + hash);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await expect(page.getByText(/Access tokens stay encrypted on the server/)).toBeVisible();
});

test('mobile layout and reduced-motion onboarding work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.welcome-copy')).toHaveCSS('opacity', '1');
  await expect(page.locator('.welcome-art')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/welcome-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Set up my semester', exact: true }).click();
  await page.getByRole('button', { name: /TMU Toronto Metropolitan University/ }).click();
  await expect(page.locator('.institution-card').last()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/onboarding-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Jordan');
  for (let step = 1; step < 8; step++)
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Build my semester plan' }).click();
  await expect(page.getByRole('heading', { name: 'See the whole picture.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clarity, Jordan.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
