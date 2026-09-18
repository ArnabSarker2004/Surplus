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
import { plan, scenarioPlan } from '../shared/finance';
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
