import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('quick setup uses presets, accepts money without leading zeroes, and offers optional banking', async ({
  page,
  request,
}) => {
  await request.delete('/api/data');
  await page.goto('/');
  await page.getByRole('button', { name: /Set up my semester/ }).click();
  await page.getByRole('button', { name: 'Quick setup · 6 steps' }).click();
  await page.getByRole('button', { name: /TMU Toronto Metropolitan University/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Sam');
  await page.getByLabel('Faculty', { exact: true }).selectOption('Business');
  await page.getByLabel('Program', { exact: true }).selectOption('Business Management');
  const year = new Date().getFullYear();
  await page
    .getByLabel('Semester preset', { exact: false })
    .selectOption({ label: `Fall ${year}` });
  await expect(page.getByLabel('Semester starts')).toHaveValue(`${year}-09-01`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: '+ Rent', exact: true }).click();
  const amount = page.getByRole('spinbutton', { name: /Amount/ });
  await expect(amount).toHaveValue('');
  await amount.pressSequentially('80');
  await expect(amount).toHaveValue('80');
  await amount.fill('');
  await amount.pressSequentially('0.50');
  await expect(amount).toHaveValue('0.50');
  await amount.press('Tab');
  await expect(amount).toHaveValue('0.5');
  await amount.fill('80');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: '+ Savings', exact: true }).click();
  await page.getByRole('spinbutton', { name: /Amount per payment/ }).fill('2000');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Step 5 of 6')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bank connection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect my bank', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/setup-bank-mobile.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Step 6 of 6')).toBeVisible();
  await page.getByRole('button', { name: 'Build my semester plan' }).click();
  await expect(page.getByRole('heading', { name: 'See the whole picture.' })).toBeVisible();
  const state = await (await request.get('/api/state')).json();
  expect(state.workspace.profile.program).toBe('Business Management');
  expect(state.workspace.expenses[0].amount).toBe(80);
  expect(state.workspace.source).toBe('manual');
});

test('bank panel opens Link once, imports and syncs, reconnects, and confirms disconnect', async ({
  page,
  request,
}) => {
  await request.post('/api/demo', { data: {} });
  const state = await (await request.get('/api/state')).json();
  const linked = {
    ...state,
    workspace: { ...state.workspace, source: 'live' },
    accounts: [],
    transactions: [],
  };
  let connected = false;
  let synced = false;
  let updates = 0;
  let exchanges = 0;
  let productionStarts = 0;
  await page.route('https://cdn.plaid.com/link/v2/stable/link-initialize.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Plaid={create:function(config){return {open:function(){config.onSuccess('public-production-fixture',{});},exit:function(){},destroy:function(){}}}};`,
    }),
  );
  await page.route('**/api/plaid/status', (route) =>
    route.fulfill({
      json: {
        configured: true,
        productionConfigured: true,
        connected,
        environment: connected ? 'production' : 'sandbox',
        source: connected ? 'live' : 'sandbox',
        accounts: connected
          ? [
              {
                id: 'fixture-account',
                name: 'Canadian chequing',
                type: 'depository',
                subtype: 'checking',
                currency: 'CAD',
                balance: 1200,
                source: 'live',
              },
            ]
          : [],
        syncedAt: synced ? new Date().toISOString() : null,
        error: null,
      },
    }),
  );
  await page.route('**/api/plaid/link-token', (route) => {
    const input = route.request().postDataJSON();
    expect(input.environment).toBe('production');
    if (input.update) updates++;
    else productionStarts++;
    return route.fulfill({ json: { linkToken: 'link-production-fixture' } });
  });
  await page.route('**/api/plaid/exchange', (route) => {
    exchanges++;
    connected = true;
    return route.fulfill({ json: linked });
  });
  await page.route('**/api/plaid/sync', (route) => {
    synced = true;
    return route.fulfill({ json: linked });
  });
  await page.route('**/api/plaid/item', (route) => {
    connected = false;
    return route.fulfill({
      json: { ...linked, workspace: { ...linked.workspace, source: 'manual' } },
    });
  });
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Connect my bank', exact: true }).click();
  await expect(page.getByText('Your bank is connected', { exact: true })).toBeVisible();
  await expect(page.getByText('Canadian chequing', { exact: true })).toBeVisible();
  await expect(page.getByText(/Sync complete/)).toBeVisible();
  expect(productionStarts).toBe(1);
  expect(exchanges).toBe(1);
  await page.getByRole('button', { name: 'Reconnect bank', exact: true }).click();
  await expect(page.getByText(/Sync complete/)).toBeVisible();
  expect(updates).toBe(1);
  expect(exchanges).toBe(1);
  await page.screenshot({ path: 'artifacts/bank-connected-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Disconnect this bank?' })).toBeVisible();
  expect(connected).toBe(true);
  await page.getByRole('button', { name: 'Disconnect bank', exact: true }).click();
  await expect(page.getByText(/Bank disconnected/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect my bank', exact: true })).toBeEnabled();
});
