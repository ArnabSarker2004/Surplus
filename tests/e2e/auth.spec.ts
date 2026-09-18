import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { testCredentials } from './fixtures';

test('premium entry explains provider readiness and offers an accessible feature preview', async ({
  page,
}) => {
  await page.goto('/?auth_error=cancelled');
  await expect(page.getByRole('status')).toContainText('Sign-in was cancelled');
  await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: /Continue with Microsoft.*Not enabled/ }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: /Apple/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Find your next step/ }).click();
  await expect(page.getByText('Possibility, on your radar.')).toBeVisible();
  await page.getByRole('button', { name: /Grow your goals/ }).click();
  await expect(page.getByText('Small steps. Real progress.')).toBeVisible();
  await page.getByText('Need a hand signing in?').click();
  await expect(page.getByText(/School accounts may require/)).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('email-code UI handles errors and enters the authenticated app after verification', async ({
  page,
  context,
}) => {
  const status = await (await context.request.get('/api/auth/session')).json();
  if (status.setupRequired) {
    await context.request.post('/api/auth/setup', { data: testCredentials });
    await context.request.post('/api/auth/logout', { data: {} });
  }
  // UI transport fixtures only: real code expiry/replay and SMTP failures are API-tested.
  await page.route('**/api/auth/methods', (route) =>
    route.fulfill({
      json: {
        providers: [
          { id: 'google', name: 'Google', available: true },
          { id: 'microsoft', name: 'Microsoft', available: false },
        ],
        email: true,
      },
    }),
  );
  await page.route('**/api/auth/oauth/google/start', (route) =>
    route.fulfill({
      status: 503,
      json: { error: 'This sign-in provider could not be reached. Please try again.' },
    }),
  );
  await page.route('**/api/auth/email/request', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      email: 'student@example.test',
      intent: 'login',
    });
    await route.fulfill({ json: { message: 'Code requested.' } });
  });
  await page.route('**/api/auth/email/verify', async (route) => {
    if (route.request().postDataJSON().code !== '123456')
      return route.fulfill({
        status: 400,
        json: { error: 'That code is incorrect. Please try again.' },
      });
    const login = await context.request.post('/api/auth/login', { data: testCredentials });
    expect(login.ok()).toBe(true);
    await route.fulfill({ json: await login.json() });
  });
  await page.goto('/#login');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be reached');
  await page.getByRole('button', { name: 'Email code', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Email address', exact: true })
    .fill('student@example.test');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('status')).toContainText('student@example.test');
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page.getByRole('button', { name: 'Log out', exact: true }).first()).toBeVisible();
});

test('setup or sign-in, logout across tabs, and sign-in again preserve the saved plan', async ({
  page,
  context,
}) => {
  const status = await (await context.request.get('/api/auth/session')).json();
  await page.goto('/#transactions');
  await expect(
    page.getByRole('heading', {
      name: status.setupRequired ? 'Make this space yours.' : 'Welcome back.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'See every little detail.' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(testCredentials.username);
  await page.getByLabel('Password', { exact: true }).fill(testCredentials.password);
  if (status.setupRequired)
    await page.getByLabel('Confirm password', { exact: true }).fill(testCredentials.password);
  await page.screenshot({ path: 'artifacts/account-desktop.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByRole('button', {
      name: status.setupRequired ? 'Create account & continue' : 'Sign in',
      exact: true,
    })
    .click();
  await expect(page.getByRole('button', { name: 'Log out', exact: true }).first()).toBeVisible();
  await context.request.post('/api/demo', { data: {} });
  await page.goto('/#overview');
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/#overview');
  await expect(second.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem('surplus-onboarding-v1', JSON.stringify({ private: 'draft' })),
  );
  const authCookie = (await context.cookies()).find((cookie) => cookie.name === 'surplus_session')!;
  expect(authCookie.httpOnly).toBe(true);
  expect(authCookie.sameSite).toBe('Strict');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect((await context.request.get('/api/state')).status()).toBe(401);
  expect((await context.request.get('/api/export')).status()).toBe(401);
  expect(await page.evaluate(() => localStorage.getItem('surplus-onboarding-v1'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(testCredentials.username);
  await page.getByLabel('Password', { exact: true }).fill('this-is-a-wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Username or password is incorrect.');
  await page.getByLabel('Password', { exact: true }).fill(testCredentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.goto('/#overview');
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
});

test('mobile logout and failed logout are explicit; revoked sessions cannot reopen private pages', async ({
  page,
  context,
}) => {
  const status = await (await context.request.get('/api/auth/session')).json();
  await context.request.post(`/api/auth/${status.setupRequired ? 'setup' : 'login'}`, {
    data: testCredentials,
  });
  await context.request.post('/api/demo', { data: {} });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#overview');
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.route('**/api/auth/logout', (route) => route.abort());
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('You are still signed in');
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  await page.unroute('**/api/auth/logout');
  await page.getByRole('button', { name: 'Retry logout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/logout-mobile.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(testCredentials.username);
  await page.getByLabel('Password', { exact: true }).fill(testCredentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  await context.request.post('/api/auth/logout', { data: {} });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Settings & connections', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});
