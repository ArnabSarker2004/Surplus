import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { randomBytes } from 'node:crypto';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { PlaidService } from '../backend/src/services/plaid-service';
import { decrypt } from '../backend/src/integrations/plaid';
import { syncIfDue } from '../backend/src/services/bank-background';

describe('live banking environment and connection lifecycle', () => {
  let store: Store;
  let repo: WorkspaceRepository;
  let service: PlaidService;
  const key = randomBytes(32);
  let originalFetch: typeof fetch;
  let saved: Record<string, string | undefined>;
  let failSync: boolean;
  let failRemove: boolean;
  let calls: { url: string; body: Record<string, unknown> }[];
  beforeEach(async () => {
    store = await Store.open();
    repo = new WorkspaceRepository(store);
    repo.seedDemo();
    service = new PlaidService(repo, key, 'fixture-user');
    saved = Object.fromEntries(
      [
        'PLAID_CLIENT_ID',
        'PLAID_SANDBOX_SECRET',
        'PLAID_PRODUCTION_SECRET',
        'PLAID_PLAN',
        'PLAID_TRIAL_CONFIRMED_ON',
      ].map((k) => [k, process.env[k]]),
    );
    Object.assign(process.env, {
      PLAID_CLIENT_ID: 'fixture-client',
      PLAID_SANDBOX_SECRET: 'fixture-sandbox',
      PLAID_PRODUCTION_SECRET: 'fixture-production',
    });
    originalFetch = globalThis.fetch;
    calls = [];
    failSync = false;
    failRemove = false;
    globalThis.fetch = async (url, init) => {
      const path = new URL(String(url)).pathname;
      const body = JSON.parse(String(init?.body));
      if (path === '/v1/enrich' && new URL(String(url)).hostname === '127.0.0.1') {
        assert.deepEqual(Object.keys(body).sort(), ['allowExternal', 'items']);
        assert.equal(body.allowExternal, false);
        return new Response('{}', { status: 503 });
      }
      calls.push({ url: String(url), body });
      let response: unknown;
      if (path === '/link/token/create') response = { link_token: 'link-production-fixture' };
      else if (path === '/item/public_token/exchange')
        response = { access_token: 'access-production-fixture', item_id: 'fixture-item' };
      else if (path === '/transactions/refresh') response = { request_id: 'test-refresh' };
      else if (path === '/accounts/get' || path === '/accounts/balance/get')
        response = {
          accounts: [
            {
              account_id: 'live-account',
              name: 'Canadian chequing',
              type: 'depository',
              subtype: 'checking',
              balances: { current: 1200, iso_currency_code: 'CAD' },
            },
          ],
        };
      else if (path === '/transactions/sync') {
        if (failSync)
          return new Response(JSON.stringify({ error_code: 'ITEM_LOGIN_REQUIRED' }), {
            status: 400,
          });
        response = {
          added: [
            {
              transaction_id: 'live-transaction',
              account_id: 'live-account',
              date: '2026-09-18',
              authorized_datetime: '2026-09-17T20:00:00-04:00',
              location: { city: 'Toronto', region: 'ON', country: 'CA', address: 'Not retained' },
              name: 'Groceries',
              amount: 80,
              pending: false,
              iso_currency_code: 'CAD',
            },
          ],
          modified: [],
          removed: [],
          next_cursor: 'live-cursor',
          has_more: false,
        };
      } else if (path === '/item/remove') {
        if (failRemove)
          return new Response(JSON.stringify({ error_code: 'INSTITUTION_DOWN' }), { status: 400 });
        response = { removed: true };
      } else throw new Error('Unexpected request');
      return new Response(JSON.stringify(response), { status: 200 });
    };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    store.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it('gates extra production calls and enforces refresh cooldown without relinking', async () => {
    await service.addConnection('exchange', 'public-production-fixture');
    delete process.env.PLAID_PLAN;
    const before = calls.length;
    await assert.rejects(service.trialRefresh('balance'), { code: 'TRIAL_NOT_CONFIRMED' });
    await assert.rejects(service.trialRefresh('transactions'), { code: 'TRIAL_NOT_CONFIRMED' });
    assert.equal(calls.length, before);
    process.env.PLAID_PLAN = 'trial';
    process.env.PLAID_TRIAL_CONFIRMED_ON = new Date().toISOString().slice(0, 10);
    await service.trialRefresh('balance');
    assert.ok(calls.at(-1)?.url.endsWith('/accounts/balance/get'));
    assert.equal(repo.state().accounts[0].balance, 1200);
    await assert.rejects(service.trialRefresh('transactions'), { code: 'REFRESH_COOLDOWN' });
    store.set('plaid', { ...service.item(), lastRefreshRequestedAt: null });
    await service.trialRefresh('transactions');
    assert.ok(calls.at(-1)?.url.endsWith('/transactions/refresh'));
    assert.equal(calls.filter((c) => c.url.endsWith('/item/public_token/exchange')).length, 1);
  });
  it('backs off failed automatic sync and only retrieves existing Transactions updates', async () => {
    await service.addConnection('exchange', 'public-production-fixture');
    repo.save({
      ...repo.workspace()!,
      intelligenceSettings: { autoSync: true, alerts: true, dismissed: [] },
    });
    failSync = true;
    assert.equal(await syncIfDue(repo, key), false);
    const count = calls.length;
    assert.equal(await syncIfDue(repo, key), false);
    assert.equal(calls.length, count);
    failSync = false;
    const later = Date.now() + 7 * 3600000;
    assert.equal(await syncIfDue(repo, key, undefined, later), true);
    assert.ok(calls.slice(count).every((c) => /\/(transactions\/sync|accounts\/get)$/.test(c.url)));
  });
  it('uses production credentials for Canadian Link and never falls back to Sandbox', async () => {
    await service.linkToken('production');
    assert.equal(calls[0].url, 'https://production.plaid.com/link/token/create');
    assert.equal(calls[0].body.secret, 'fixture-production');
    assert.deepEqual(calls[0].body.country_codes, ['CA']);
    assert.deepEqual(calls[0].body.products, ['transactions']);
    assert.deepEqual(calls[0].body.transactions, { days_requested: 730 });
    assert.deepEqual(calls[0].body.user, { client_user_id: 'fixture-user' });
    delete process.env.PLAID_PRODUCTION_SECRET;
    await assert.rejects(service.linkToken('production'));
    assert.equal(calls.length, 1);
  });
  it('persists the encrypted live Item before sync and isolates live data from demo', async () => {
    await service.addConnection('exchange', 'public-production-fixture');
    assert.equal(calls.length, 1);
    assert.equal(service.item()?.environment, 'production');
    assert.equal(decrypt(service.item()!.encryptedToken, key), 'access-production-fixture');
    assert.equal(repo.state().transactions.length, 0);
    await service.sync();
    assert.equal(repo.state().workspace?.source, 'live');
    assert.equal(repo.state().transactions[0].cashFlow, -80);
    assert.equal(repo.state().transactions[0].source, 'live');
    assert.equal(repo.state().accounts[0].source, 'live');
    assert.ok(repo.transactions().some((t) => t.source === 'demo'));
    assert.ok(!JSON.stringify(service.status()).includes('access-production'));
    assert.ok(calls.every((c) => c.url.startsWith('https://production.plaid.com')));
    failSync = true;
    await assert.rejects(service.sync());
    assert.equal(service.item()?.cursor, 'live-cursor');
    assert.equal(repo.state().transactions.length, 1);
    assert.match(service.status().error!, /Reconnect/);
  });
  it('reconnects the same Item without requesting another product or exchanging a token', async () => {
    await service.addConnection('exchange', 'public-production-fixture');
    await service.linkToken('sandbox', true);
    const last = calls.at(-1)!;
    assert.equal(last.body.access_token, 'access-production-fixture');
    assert.equal(last.body.products, undefined);
    assert.equal(last.body.transactions, undefined);
    assert.match(last.url, /production/);
  });
  it('hydrates old transaction metadata once, preserves corrections and keeps the old cursor on failure', async () => {
    await service.addConnection('exchange', 'public-production-fixture');
    await service.sync();
    repo.setHabitTreatment('live-transaction', 'routine');
    store.set('plaid', {
      ...service.item(),
      cursor: 'old-cursor',
      transactionMetadataVersion: 2,
    });
    failSync = true;
    await assert.rejects(service.sync());
    assert.equal(service.item()?.cursor, 'old-cursor');
    assert.equal(service.item()?.transactionMetadataVersion, 2);
    failSync = false;
    await service.sync();
    assert.equal(calls.filter((c) => c.url.endsWith('/transactions/sync')).at(-1)?.body.cursor, '');
    assert.equal(service.item()?.transactionMetadataVersion, 3);
    assert.deepEqual(
      calls.filter((c) => c.url.endsWith('/transactions/sync')).at(-1)?.body.options,
      { include_original_description: true },
    );
    const item = repo.state().transactions[0];
    assert.equal(item.authorizedAt, '2026-09-17T20:00:00-04:00');
    assert.deepEqual(item.location, { city: 'Toronto', region: 'ON', country: 'CA' });
    assert.equal(item.habitTreatment, 'routine');
    assert.equal(item.cashFlow, -80);
    await service.sync();
    assert.equal(
      calls.filter((c) => c.url.endsWith('/transactions/sync')).at(-1)?.body.cursor,
      'live-cursor',
    );
  });
  it('retains data when revocation fails, then revokes live access before clearing imports', async () => {
    await service.addConnection('exchange', 'public-production-fixture');
    await service.sync();
    failRemove = true;
    await assert.rejects(service.disconnect());
    assert.ok(service.item());
    assert.equal(repo.state().transactions.length, 1);
    failRemove = false;
    await service.disconnect();
    assert.equal(service.item(), null);
    assert.equal(repo.workspace()?.source, 'manual');
    assert.ok(!repo.transactions().some((t) => t.source === 'live'));
    assert.ok(repo.transactions().some((t) => t.source === 'demo'));
    assert.match(calls.at(-1)!.url, /production.plaid.com\/item\/remove/);
  });
});
