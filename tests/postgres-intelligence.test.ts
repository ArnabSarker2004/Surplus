import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../backend/src/app';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { postgresPool } from '../backend/src/infrastructure/postgres';
import { PostgresAuthService } from '../backend/src/services/postgres-auth-service';
import { PostgresWorkspace } from '../backend/src/repositories/postgres-workspace';
import { postgresWorkspaceRoutes } from '../backend/src/routes/postgres-workspace-routes';
import { demoWorkspace } from '../shared/demo';

describe('PostgreSQL forecast isolation', { skip: !process.env.DATABASE_URL }, () => {
  const pool = postgresPool(),
    key = randomBytes(32),
    workspaces = new PostgresWorkspace(pool);
  const auth = new PostgresAuthService(pool, randomBytes(32));
  const usernames = [`ml-test-${randomUUID()}`, `ml-test-${randomUUID()}`];
  const ids: string[] = [],
    cookies: string[] = [];
  let store: Store, app: ReturnType<typeof createApp>;
  before(async () => {
    store = await Store.open();
    app = createApp(store, key, {}, { auth, routes: postgresWorkspaceRoutes(workspaces, key) });
    for (const username of usernames) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, password: 'test-only-forecast-passphrase' })
        .expect(201);
      ids.push(response.body.user.id);
      cookies.push((response.headers['set-cookie'] as unknown as string[])[0].split(';')[0]);
    }
    await request(app).post('/api/demo').set('Cookie', cookies[0]).send({}).expect(200);
    await request(app)
      .put('/api/workspace')
      .set('Cookie', cookies[1])
      .send({ ...demoWorkspace(), source: 'manual' })
      .expect(200);
  });
  after(async () => {
    await pool.query('DELETE FROM surplus_auth.users WHERE username=ANY($1::text[])', [usernames]);
    await pool.end();
    store?.close();
  });
  it('takes only the authenticated user snapshot and releases the DB lock before inference', async () => {
    const previousFetch = global.fetch;
    const previousToken = process.env.INTELLIGENCE_SERVICE_TOKEN;
    process.env.INTELLIGENCE_SERVICE_TOKEN = 'test-only-private-intelligence-token';
    const sources: string[] = [];
    const versions = await pool.query(
      'SELECT id,xmin::text AS version FROM surplus.transactions WHERE user_id=$1 ORDER BY id',
      [ids[0]],
    );
    try {
      global.fetch = async (_url, options) => {
        const payload = JSON.parse(String(options?.body));
        sources.push(payload.source);
        assert.equal(payload.transactions.length > 0, payload.source === 'demo');
        assert.equal(payload.profile, undefined);
        // This would block if the HTTP call still held the workspace's FOR UPDATE lock.
        await workspaces.run(ids[0], (repository) => repository.state());
        return Response.json({
          version: 'surplus-forecast-1.0',
          asOf: payload.asOf,
          source: payload.source,
          timeline: [],
        });
      };
      for (const cookie of cookies)
        await request(app)
          .post('/api/intelligence/forecast')
          .set('Cookie', cookie)
          .send({})
          .expect(200);
      assert.deepEqual(sources, ['demo', 'manual']);
      assert.deepEqual(
        (
          await pool.query(
            'SELECT id,xmin::text AS version FROM surplus.transactions WHERE user_id=$1 ORDER BY id',
            [ids[0]],
          )
        ).rows,
        versions.rows,
      );
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE surplus_runtime');
        await client.query("SELECT set_config('surplus.user_id',$1,true)", [ids[1]]);
        assert.deepEqual(
          (await client.query('SELECT user_id FROM surplus.forecast_history')).rows.map(
            (r) => r.user_id,
          ),
          [ids[1]],
        );
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      await request(app)
        .post('/api/intelligence/forecast')
        .set('Cookie', cookies[1])
        .send({ userId: ids[0] })
        .expect(400);
      await request(app).post('/api/intelligence/forecast').send({}).expect(401);
    } finally {
      global.fetch = previousFetch;
      if (previousToken === undefined) delete process.env.INTELLIGENCE_SERVICE_TOKEN;
      else process.env.INTELLIGENCE_SERVICE_TOKEN = previousToken;
    }
  });
  it('never lets a second user relabel the first user transactions', async () => {
    const own = await workspaces.run(ids[0], (repository) => repository.state().transactions[0]);
    await request(app)
      .patch(`/api/intelligence/habits/${own.id}`)
      .set('Cookie', cookies[1])
      .send({ treatment: 'routine' })
      .expect(404);
    await request(app)
      .patch(`/api/intelligence/habits/${own.id}`)
      .set('Cookie', cookies[0])
      .send({ treatment: 'routine' })
      .expect(200);
    assert.equal(
      (await workspaces.run(ids[0], (repository) => repository.state().transactions[0]))
        .habitTreatment,
      'routine',
    );
  });
  it('persists merchant and detail corrections per user and rejects mismatched detailed categories', async () => {
    const own = await workspaces.run(ids[0], (repository) => repository.state().transactions[0]);
    const body = {
      category: 'Coffee',
      merchantOverride: 'Confirmed test coffee company',
      detailCategory: 'FOOD_AND_DRINK_COFFEE',
      saveRule: true,
    };
    await request(app)
      .patch(`/api/transactions/${own.id}`)
      .set('Cookie', cookies[1])
      .send(body)
      .expect(404);
    await request(app)
      .patch(`/api/transactions/${own.id}`)
      .set('Cookie', cookies[0])
      .send({ ...body, category: 'Housing' })
      .expect(400);
    await request(app)
      .patch(`/api/transactions/${own.id}`)
      .set('Cookie', cookies[0])
      .send(body)
      .expect(200);
    const state = await workspaces.run(ids[0], (repository) => repository.state());
    const saved = state.transactions.find((t) => t.id === own.id)!;
    assert.equal(saved.merchantOverride, body.merchantOverride);
    assert.equal(saved.detailCategory, body.detailCategory);
    assert.equal(saved.description, own.description);
    assert.equal(saved.cashFlow, own.cashFlow);
    assert.ok(
      state.rules.some((r) => r.merchantOverride === body.merchantOverride && r.merchantKey),
    );
    assert.equal(
      (await workspaces.run(ids[1], (repository) => repository.state())).transactions.length,
      0,
    );
  });
  it('isolates forecast observations with database RLS and does not rewrite financial rows', async () => {
    const before = await pool.query(
      'SELECT id,xmin::text AS version FROM surplus.transactions WHERE user_id=$1 ORDER BY id',
      [ids[0]],
    );
    await workspaces.run(ids[0], (repository) =>
      repository.store.set('intelligenceJournal', {
        observations: [{ date: '2026-09-20', source: 'demo', cash: 100 }],
        predictions: [],
      }),
    );
    const after = await pool.query(
      'SELECT id,xmin::text AS version FROM surplus.transactions WHERE user_id=$1 ORDER BY id',
      [ids[0]],
    );
    assert.deepEqual(after.rows, before.rows);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE surplus_runtime');
      await client.query("SELECT set_config('surplus.user_id',$1,true)", [ids[1]]);
      assert.equal(
        (
          await client.query('SELECT * FROM surplus.intelligence_journal WHERE user_id=$1', [
            ids[0],
          ])
        ).rowCount,
        0,
      );
      await assert.rejects(
        client.query('INSERT INTO surplus.intelligence_journal(user_id,payload) VALUES($1,$2)', [
          ids[0],
          {},
        ]),
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('keeps merchant caches private and cache-only writes preserve transaction rows', async () => {
    const before = await pool.query(
      'SELECT id,xmin::text AS version FROM surplus.transactions WHERE user_id=$1 ORDER BY id',
      [ids[0]],
    );
    await workspaces.run(ids[0], (repo) =>
      repo.store.set('merchantEnrichment', { entries: { test: { merchant: 'Private test' } } }),
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT id,xmin::text AS version FROM surplus.transactions WHERE user_id=$1 ORDER BY id',
          [ids[0]],
        )
      ).rows,
      before.rows,
    );
    assert.deepEqual(
      await workspaces.run(ids[1], (repo) => repo.store.get('merchantEnrichment', {})),
      { entries: {} },
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE surplus_runtime');
      await client.query("SELECT set_config('surplus.user_id',$1,true)", [ids[1]]);
      assert.equal(
        (await client.query('SELECT * FROM surplus.merchant_enrichment WHERE user_id=$1', [ids[0]]))
          .rowCount,
        0,
      );
      await assert.rejects(
        client.query('INSERT INTO surplus.merchant_enrichment(user_id,payload) VALUES($1,$2)', [
          ids[0],
          {},
        ]),
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
