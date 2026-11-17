import AxeBuilder from '@axe-core/playwright';
import type { AppState, Transaction } from '../../shared/schema';
import { expect, test } from './fixtures';

function deposit(id: string, name: string, amount: number, date = '2026-09-08'): Transaction {
  return {
    id,
    accountId: 'demo-chequing',
    merchant: name,
    description: name,
    cashFlow: amount,
    rawAmount: -amount,
    date,
    authorizedDate: date,
    currency: 'CAD',
    pending: false,
    source: 'demo',
    category: 'Other',
    classification: 'Review',
    categoryOrigin: 'review',
    userCorrected: false,
    plaidPrimary: '',
    plaidDetailed: '',
    confidence: 'UNKNOWN',
  };
}

async function fixtureState(request: import('@playwright/test').APIRequestContext) {
  const state = (await (await request.post('/api/demo', { data: {} })).json()) as AppState;
  state.accounts = [
    { ...state.accounts.find((a) => a.id === 'demo-chequing')!, balance: 24095.92 },
  ];
  state.transactions = [
    {
      ...deposit('resp', 'CET MSP/DIV', 43.24, '2025-12-10'),
      merchantOverride: "Children's Education Fund",
      merchantCorrected: true,
      userCorrected: true,
      categoryOrigin: 'user',
    },
    {
      ...deposit('grant', 'School bursary', 3114.73, '2026-04-10'),
      category: 'Grants and Bursaries',
      classification: 'Review',
      userCorrected: true,
      categoryOrigin: 'user',
      depositPurpose: 'unknown',
    },
    deposit('unknown', 'Unknown deposit', 1000),
    { ...deposit('osap-pending', 'OSAP', 8000), pending: true },
  ];
  return state;
}

test('personal balance is cash minus funding; users flag, change and remove deposits with persistence', async ({
  page,
  request,
}) => {
  const state = await fixtureState(request);
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/transactions/unknown', async (route) => {
    const patch = route.request().postDataJSON();
    expect(patch.saveRule).toBe(false);
    state.transactions[2] = {
      ...state.transactions[2],
      ...patch,
      userCorrected: true,
      categoryOrigin: 'user',
    };
    await route.fulfill({ json: state });
  });
  await page.goto('/#overview');
  const card = page.getByRole('region', { name: 'Student money breakdown' });
  await expect(card.locator('.money-personal')).toContainText('$20,937.95');
  await expect(card).not.toContainText('unassigned');
  await expect(card).not.toContainText('estimated');
  await expect(card).toContainText('$3,157.97');
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await card.screenshot({ path: `artifacts/personal-balance-${width}.png` });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include('.student-money')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await card.getByRole('button', { name: 'Manage funding' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage non-personal funds' });
  await expect(dialog).toContainText('All imported months');
  await expect(dialog).toContainText("Children's Education Fund");
  await expect(dialog.getByRole('combobox', { name: /Money type for OSAP/ })).toHaveCount(0);
  const search = dialog.getByRole('searchbox', { name: 'Search deposits' });
  await search.fill('Unknown');
  const type = dialog.getByRole('combobox', { name: /Money type for Unknown deposit/ });
  await type.selectOption('loan');
  await expect(dialog.getByRole('status')).toContainText('Saved as Loan');
  await expect(card.locator('.money-personal')).toContainText('$19,937.95');
  await type.selectOption('resp');
  await expect(dialog.getByRole('status')).toContainText('Saved as RESP');
  await expect(card.locator('.money-personal')).toContainText('$19,937.95');
  await search.fill('');
  await dialog.getByRole('combobox', { name: 'Show', exact: true }).selectOption('funding');
  await expect(dialog.locator('.funding-deposit')).toHaveCount(3);
  expect(
    (await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
  await dialog.screenshot({ path: 'artifacts/funding-manager-mobile.png' });
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(card.locator('.money-personal')).toContainText('$19,937.95');
  await card.getByRole('button', { name: 'Manage funding' }).click();
  await dialog
    .getByRole('combobox', { name: /Money type for Unknown deposit/ })
    .selectOption('personal');
  await expect(card.locator('.money-personal')).toContainText('$20,937.95');
  await expect(dialog.getByRole('status')).toContainText('Removed from the funding deduction');
});

test('automatic funding can be removed and failed saves do not change the balance', async ({
  page,
  request,
}) => {
  const state = await fixtureState(request);
  let fail = true;
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.route('**/api/transactions/resp', async (route) => {
    if (fail) return route.fulfill({ status: 500, json: { error: 'Could not save. Try again.' } });
    const patch = route.request().postDataJSON();
    state.transactions[0] = {
      ...state.transactions[0],
      ...patch,
      userCorrected: true,
      categoryOrigin: 'user',
    };
    await route.fulfill({ json: state });
  });
  await page.goto('/#semester');
  const card = page.getByRole('region', { name: 'Student money breakdown' });
  await card.getByRole('button', { name: 'Manage funding' }).click();
  const dialog = page.getByRole('dialog');
  const type = dialog.getByRole('combobox', { name: /Money type for CET MSP\/DIV/ });
  await type.selectOption('personal');
  await expect(dialog.getByRole('alert')).toContainText('Could not save');
  await expect(type).toHaveValue('resp');
  await expect(card.locator('.money-personal')).toContainText('$20,937.95');
  fail = false;
  await type.selectOption('personal');
  await expect(dialog.getByRole('status')).toContainText('Saved as personal money');
  await expect(card.locator('.money-personal')).toContainText('$20,981.19');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(card.locator('.money-personal')).toContainText('$20,981.19');
});

test('the account-free demo flags funding locally without private API calls', async ({ page }) => {
  await page.goto('/#demo');
  const card = page.getByRole('region', { name: 'Student money breakdown' });
  await card.getByRole('button', { name: 'Manage funding' }).click();
  const dialog = page.getByRole('dialog');
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/transactions/') && r.method() === 'PATCH') writes.push(r.url());
  });
  await dialog.getByRole('searchbox', { name: 'Search deposits' }).fill('OSAP');
  const flag = dialog.getByRole('combobox', { name: /Money type for OSAP/ }).first();
  await flag.selectOption('personal');
  await expect(dialog.getByRole('status')).toContainText('Saved as personal money');
  expect(writes).toEqual([]);
});
