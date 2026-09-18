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
});
