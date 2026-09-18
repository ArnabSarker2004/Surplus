import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { postgresPool } from '../../backend/src/infrastructure/postgres';
import { demoWorkspace } from '../../shared/demo';

const username = `browser-${randomUUID()}`;
const priorUsername = `browser-${randomUUID()}`;
const secondUsername = `browser-${randomUUID()}`;
const password = 'temporary-browser-test-password';
test.afterAll(async () => {
  const pool = postgresPool();
  try {
    await pool.query('DELETE FROM surplus_auth.users WHERE username=ANY($1::text[])', [
      [username, secondUsername, priorUsername],
    ]);
  } finally {
    await pool.end();
  }
});
test('switching accounts does not reuse the previous account’s plan or onboarding draft', async ({
  page,
}) => {
  const login = await page.request.post('/api/auth/register', {
    data: { username: priorUsername, password },
  });
  expect(login.ok()).toBeTruthy();
  const owner = (await login.json()).user;
  expect((await page.request.post('/api/demo', { data: {} })).ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little clarity, Alex.' })).toBeVisible();
  const draft = demoWorkspace();
  draft.profile.name = 'Private previous student';
  await page.evaluate(
    ({ id, draft }) => {
      localStorage.setItem(`surplus-onboarding-v1:${id}`, JSON.stringify(draft));
      localStorage.setItem('surplus-onboarding-v1', JSON.stringify(draft));
    },
    { id: owner.id, draft },
  );
  const registered = await page.request.post('/api/auth/register', {
    data: { username: secondUsername, password },
  });
  expect(registered.ok()).toBeTruthy();
  // A still-open tab is bound to the previous account until it refreshes its session.
  const stale = await page.evaluate(
    async (id) => (await fetch('/api/state', { headers: { 'X-Surplus-User': id } })).status,
    owner.id,
  );
  expect(stale).toBe(401);
  await page.reload();
  await page.getByRole('button', { name: /Set up my semester/ }).click();
  await page.getByRole('button', { name: /Toronto Metropolitan University/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('What should we call you?')).toHaveValue('');
  const state = await (await page.request.get('/api/state')).json();
  expect(state.workspace).toBeNull();
  expect(state.transactions).toEqual([]);
});
test('creates a cloud account, saves a plan, logs out, and signs back in with the plan intact', async ({
  page,
}) => {
  await page.goto('/#login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make this space yours.' })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account & continue', exact: true }).click();
  await page.getByRole('button', { name: /Try the TMU demo/ }).click();
  await expect(page.getByRole('button', { name: 'Log out', exact: true }).first()).toBeVisible();
  const state = await (await page.request.get('/api/state')).json();
  expect(state.workspace).toBeTruthy();
  expect(state.transactions.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Log out', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  expect((await page.request.get('/api/state')).status()).toBe(401);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log out', exact: true }).first()).toBeVisible();
  const restored = await (await page.request.get('/api/state')).json();
  expect(restored.workspace).toEqual(state.workspace);
  expect(restored.transactions).toEqual(state.transactions);
});
