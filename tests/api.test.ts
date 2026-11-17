import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../backend/src/app';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { demoWorkspace, opportunities } from '../shared/demo';
import { plan, scenarioPlan, normalize } from '../shared/finance';
import type { AppState } from '../shared/schema';

describe('local HTTP application', () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;
  let client: ReturnType<typeof request.agent>;
  beforeEach(async () => {
    store = await Store.open();
    app = createApp(store, randomBytes(32));
    client = request.agent(app);
    await client
      .post('/api/auth/setup')
      .send({ username: 'api-test', password: 'test-only-long-passphrase' })
      .expect(201);
  });
  afterEach(() => store.close());
  it('serves an authenticated, empty initial workspace without bank credentials', async () => {
    const r = await client.get('/api/state').expect(200);
    assert.equal(r.body.workspace, null);
    assert.equal(r.body.transactions.length, 0);
  });
  it('seeds Demo Mode idempotently', async () => {
    const a = await client.post('/api/demo').send({}).expect(200);
    const b = await client.post('/api/demo').send({}).expect(200);
    assert.equal(a.body.transactions.length, b.body.transactions.length);
    assert.ok(a.body.transactions.length > 200);
    assert.equal(a.body.workspace.source, 'demo');
  });
  it('persists reviewed cash allocations through reload and export and rejects over-allocation', async () => {
    await client.post('/api/demo').send({}).expect(200);
    const w = demoWorkspace();
    w.cashAllocations![0] = {
      accountId: 'demo-chequing',
      own: 825.4,
      loans: 1800,
      education: 3000,
      reviewedBalance: 5625.4,
    };
    await client.put('/api/workspace').send(w).expect(200);
    for (const path of ['/api/state', '/api/export']) {
      const saved = await client.get(path).expect(200);
      assert.deepEqual(saved.body.workspace.cashAllocations, w.cashAllocations);
    }
    w.cashAllocations![0].education = 9000;
    await client.put('/api/workspace').send(w).expect(400);
    const loaded = await client.get('/api/state').expect(200);
    assert.equal(loaded.body.workspace.cashAllocations[0].education, 3000);
  });
  it('serves public resources and persists resource notes through reload and export', async () => {
    const catalog = await client.get('/api/resources').expect(200);
    assert.equal(catalog.body.automaticMonitoring, false);
    assert.ok(catalog.body.resources.length >= 30);
    const w = demoWorkspace();
    w.resourceProgress.venturematch = {
      stage: 'Contacted',
      notes: 'Ask about the next cohort',
      followUp: '2026-10-01',
    };
    await client.put('/api/workspace').send(w).expect(200);
    for (const path of ['/api/state', '/api/export']) {
      const r = await client.get(path).expect(200);
      assert.deepEqual(r.body.workspace.resourceProgress, w.resourceProgress);
    }
    w.resourceProgress.venturematch.followUp = '2026-02-31';
    await client.put('/api/workspace').send(w).expect(400);
    const r = await client.get('/api/state');
    assert.equal(r.body.workspace.resourceProgress.venturematch.followUp, '2026-10-01');
  });
  it('loads older workspaces without resource progress and clears progress on data deletion', async () => {
    const legacy = { ...demoWorkspace() } as Record<string, unknown>;
    delete legacy.resourceProgress;
    store.transaction(() => store.set('workspace', legacy));
    const loaded = await client.get('/api/state').expect(200);
    assert.deepEqual(loaded.body.workspace.resourceProgress, {});
    await client.put('/api/workspace').send(legacy).expect(200);
    await client.delete('/api/data').expect(200);
    assert.equal((await client.get('/api/state')).body.workspace, null);
    assert.ok((await client.get('/api/resources')).body.resources.length >= 30);
  });
  it('supports the semester → award → scenario → goal workflow', async () => {
    const response = await client.post('/api/demo').send({}).expect(200);
    const state = response.body as AppState;
    const w = state.workspace!;
    assert.equal(plan(w, opportunities).gap, 276);
    w.applications.zone = 'Applied';
    w.scenario.opportunityId = 'zone';
    let saved = (await client.put('/api/workspace').send(w).expect(200)).body as AppState;
    assert.equal(plan(saved.workspace!, opportunities).gap, 276);
    assert.equal(scenarioPlan(saved.workspace!, opportunities).ending, 474);
    w.applications.zone = 'Awarded';
    w.goals[0].current = 550;
    saved = (await client.put('/api/workspace').send(w).expect(200)).body as AppState;
    assert.equal(plan(saved.workspace!, opportunities).ending, 474);
    assert.equal(saved.workspace!.goals[0].current, 550);
    const reloaded = await client.get('/api/state').expect(200);
    assert.equal(reloaded.body.workspace.applications.zone, 'Awarded');
  });
  it('rejects invalid funding instead of corrupting the saved workspace', async () => {
    const w = demoWorkspace();
    await client.put('/api/workspace').send(w).expect(200);
    w.funding[0].amount = -12;
    await client.put('/api/workspace').send(w).expect(400);
    const r = await client.get('/api/state');
    assert.equal(r.body.workspace.funding[0].amount, 850);
  });
  it('rejects impossible source switching before connecting Sandbox', async () => {
    const w = demoWorkspace();
    w.source = 'sandbox';
    await client.put('/api/workspace').send(w).expect(400);
  });
  it('updates a category and saved merchant rule together', async () => {
    const state = (await client.post('/api/demo').send({})).body as AppState;
    const tx = state.transactions.find((t) => t.category === 'Coffee')!;
    const r = await client
      .patch(`/api/transactions/${tx.id}`)
      .send({ category: 'Eating Out', saveRule: true })
      .expect(200);
    assert.equal(
      r.body.transactions.find((t: { id: string }) => t.id === tx.id).userCorrected,
      true,
    );
    assert.equal(r.body.rules.length, 1);
    const sameMerchant = r.body.transactions.filter(
      (t: { merchant: string }) => t.merchant === tx.merchant,
    );
    assert.ok(sameMerchant.every((t: { category: string }) => t.category === 'Eating Out'));
  });
  it('detects historical education deposits on reads and exports and keeps corrections after reload', async () => {
    await client.post('/api/demo').send({}).expect(200);
    const resp = normalize(
      {
        transaction_id: 'education-resp',
        account_id: 'demo-chequing',
        date: '2026-09-08',
        name: 'RBC RESP EDUCATIONAL ASSISTANCE PAYMENT',
        amount: -1200,
        iso_currency_code: 'CAD',
        pending: false,
      },
      [],
      undefined,
      'demo',
    );
    store.transaction(() =>
      store.set('transactions', [
        { ...resp, category: 'Other', classification: 'Review', categoryOrigin: 'review' },
      ]),
    );
    for (const path of ['/api/state', '/api/export']) {
      const loaded = await client.get(path).expect(200);
      assert.equal(loaded.body.transactions[0].category, 'RESP Funding');
      assert.equal(loaded.body.transactions[0].cashFlow, 1200);
      assert.equal(loaded.body.transactions[0].description, resp.description);
      assert.equal(loaded.body.workspace.funding.length, demoWorkspace().funding.length);
    }
    await client
      .patch('/api/transactions/education-resp')
      .send({ category: 'Other', classification: 'Review', saveRule: false })
      .expect(200);
    const corrected = await client.get('/api/state').expect(200);
    assert.equal(corrected.body.transactions[0].category, 'Other');
    assert.equal(corrected.body.transactions[0].userCorrected, true);
  });
  it('persists a deposit purpose without changing bank amounts and rejects source rules on outflows', async () => {
    await client.post('/api/demo').send({}).expect(200);
    const deposit = normalize(
      {
        transaction_id: 'unclear-money',
        account_id: 'demo-chequing',
        date: '2026-09-08',
        name: 'Unfamiliar company',
        amount: -650,
        pending: false,
        iso_currency_code: 'CAD',
      },
      [],
      undefined,
      'demo',
    );
    store.transaction(() =>
      store.set('transactions', [
        deposit,
        { ...deposit, id: 'outflow', cashFlow: -650, rawAmount: 650 },
      ]),
    );
    await client
      .patch('/api/transactions/unclear-money')
      .send({ category: 'Other', depositPurpose: 'education', saveRule: false })
      .expect(200);
    for (const path of ['/api/state', '/api/export']) {
      const saved = await client.get(path).expect(200);
      assert.equal(saved.body.transactions[0].depositPurpose, 'education');
      assert.equal(saved.body.transactions[0].category, 'Education Funding');
      assert.equal(saved.body.transactions[0].cashFlow, 650);
      assert.equal(saved.body.transactions[0].description, 'Unfamiliar company');
    }
    await client
      .patch('/api/transactions/outflow')
      .send({ category: 'Other', depositPurpose: 'personal', saveRule: false })
      .expect(400);
    for (const [purpose, category] of [
      ['osap', 'OSAP Funding'],
      ['resp', 'RESP Funding'],
      ['grant', 'Grants and Bursaries'],
      ['scholarship', 'Scholarships'],
      ['loan', 'Other'],
      ['personal', 'Other'],
    ]) {
      await client
        .patch('/api/transactions/unclear-money')
        .send({ category: 'Other', depositPurpose: purpose, saveRule: false })
        .expect(200);
      const reloaded = await client.get('/api/state').expect(200);
      const transaction = reloaded.body.transactions.find(
        (t: { id: string }) => t.id === 'unclear-money',
      );
      assert.equal(transaction.depositPurpose, purpose);
      assert.equal(transaction.category, category);
      assert.equal(transaction.cashFlow, 650);
    }
    await client
      .patch('/api/transactions/unclear-money')
      .send({ category: 'Other', depositPurpose: 'loan', saveRule: true })
      .expect(400);
  });
  it('keeps imported data separate from Demo Mode', async () => {
    store.transaction(() => {
      store.set('transactions', [{ id: 'private-test', source: 'sandbox' }]);
      store.set('accounts', [{ id: 'private-account', source: 'sandbox' }]);
    });
    const r = await client.post('/api/demo').send({}).expect(200);
    assert.ok(!JSON.stringify(r.body).includes('private-test'));
    assert.ok(!JSON.stringify(r.body).includes('private-account'));
  });
  it('never serializes Plaid tokens in state, status, or exports', async () => {
    store.transaction(() =>
      store.set('plaid', {
        encryptedToken: 'secret-sentinel',
        cursor: 'cursor-sentinel',
        status: 'ready',
      }),
    );
    for (const path of ['/api/state', '/api/plaid/status', '/api/export']) {
      const r = await client.get(path).expect(200);
      assert.ok(!r.text.includes('secret-sentinel'));
      assert.ok(!r.text.includes('cursor-sentinel'));
    }
  });
  it('rejects cross-origin writes and DNS-rebinding Hosts', async () => {
    await client.post('/api/demo').set('Origin', 'https://malicious.example').send({}).expect(403);
    await client.get('/api/state').set('Host', 'malicious.example').expect(403);
    await client.post('/api/demo').set('Content-Type', 'text/plain').send('{}').expect(415);
  });
  it('handles malformed JSON and missing transactions', async () => {
    await client.post('/api/demo').set('Content-Type', 'application/json').send('{').expect(400);
    await client.patch('/api/transactions/missing').send({ category: 'Coffee' }).expect(404);
  });
  it('removes all local data and connections', async () => {
    await client.post('/api/demo').send({});
    store.transaction(() => store.set('plaid', { encryptedToken: 'sentinel' }));
    await client.delete('/api/data').expect(200);
    const r = await client.get('/api/state');
    assert.equal(r.body.workspace, null);
    assert.equal(r.body.transactions.length, 0);
    assert.equal(store.get('plaid', null), null);
  });
  it('rolls back a failed database transaction', () => {
    assert.throws(() =>
      store.transaction(() => {
        store.set('sentinel', 'bad');
        throw new Error('test failure');
      }),
    );
    assert.equal(store.get('sentinel', null), null);
  });
  it('restores memory when the on-disk export fails', () => {
    store.transaction(() => store.set('sentinel', 'saved'));
    store.persist = () => {
      throw new Error('Simulated disk failure');
    };
    assert.throws(() => store.transaction(() => store.set('sentinel', 'unsaved')));
    assert.equal(store.get('sentinel', null), 'saved');
  });
  it('persists SQLite data across reopen', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'surplus-test-'));
    const file = join(dir, 'test.sqlite');
    const db = await Store.open(file);
    db.transaction(() => db.set('workspace', demoWorkspace()));
    db.close();
    const reopened = await Store.open(file);
    assert.equal(reopened.get('workspace', demoWorkspace()).profile.name, 'Alex');
    reopened.close();
    rmSync(dir, { recursive: true });
  });
});
