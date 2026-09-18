import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../backend/src/app';
import { postgresPool } from '../backend/src/infrastructure/postgres';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { PostgresAuthService } from '../backend/src/services/postgres-auth-service';
import { PostgresWorkspace } from '../backend/src/repositories/postgres-workspace';
import { postgresWorkspaceRoutes } from '../backend/src/routes/postgres-workspace-routes';
import type {
  IdentityFlow,
  IdentityProviders,
} from '../backend/src/integrations/identity-providers';
import type { ProviderId } from '../shared/auth';
import type { Transaction } from '../shared/schema';

describe(
  'PostgreSQL social signup and returning login',
  { skip: !process.env.DATABASE_URL },
  () => {
    const pool = postgresPool();
    const key = randomBytes(32);
    const auth = new PostgresAuthService(pool, randomBytes(32));
    const runId = randomUUID();
    const subject = (provider: string) => `${provider}|test-${runId}`;
    const flows = new Map<ProviderId, IdentityFlow>();
    let store: Store;
    let app: ReturnType<typeof createApp>;
    const providers: IdentityProviders = {
      methods: () => ({
        providers: (['google', 'microsoft'] as const).map((id) => ({
          id,
          name: id,
          available: true,
        })),
        email: false,
      }),
      async authorize(provider, flow) {
        flows.set(provider, flow);
        return `https://identity.example.test/authorize?state=${flow.state}`;
      },
      async exchange(provider) {
        return { provider, subject: subject(provider), label: 'same-display-email@example.test' };
      },
    };
    const cookie = (response: { headers: Record<string, unknown> }, name: string) =>
      (response.headers['set-cookie'] as string[])
        .find((v) => v.startsWith(`${name}=`))!
        .split(';')[0];
    const signIn = async (provider: ProviderId) => {
      const start = await request(app)
        .post(`/api/auth/oauth/${provider}/start`)
        .send({ intent: 'login' })
        .expect(200);
      const flowCookie = cookie(start, 'surplus_oauth');
      const params = { code: 'fixture-code', state: flows.get(provider)!.state };
      const finish = await request(app)
        .get(`/api/auth/oauth/${provider}/callback`)
        .set('Cookie', flowCookie)
        .set('Sec-Fetch-Site', 'cross-site')
        .query(params)
        .expect(303);
      assert.equal(finish.headers.location.includes('auth_error'), false);
      return cookie(finish, 'surplus_session');
    };
    before(async () => {
      store = await Store.open();
      app = createApp(
        store,
        key,
        { providers },
        { auth, routes: postgresWorkspaceRoutes(new PostgresWorkspace(pool), key) },
      );
    });
    after(async () => {
      // Fixture subjects uniquely identify this run, including concurrent signup accounts.
      await pool.query(
        'DELETE FROM surplus_auth.users WHERE id IN (SELECT user_id FROM surplus_auth.identities WHERE subject=ANY($1::text[]))',
        [['google', 'microsoft', 'concurrent'].map(subject)],
      );
      store?.close();
      await pool.end();
    });
    const ids = new Set<string>();
    for (const provider of ['google', 'microsoft'] as const) {
      it(`${provider}: creates one private account and returns to its saved plan after logout`, async () => {
        const session = await signIn(provider);
        const status = await request(app)
          .get('/api/auth/session')
          .set('Cookie', session)
          .expect(200);
        const id = status.body.user.id;
        assert.ok(id);
        assert.equal(
          ids.has(id),
          false,
          'matching display emails must not merge provider accounts',
        );
        ids.add(id);
        const empty = await request(app).get('/api/state').set('Cookie', session).expect(200);
        assert.equal(empty.body.workspace, null);
        const saved = await request(app)
          .post('/api/demo')
          .set('Cookie', session)
          .send({})
          .expect(200);
        const methods = await request(app)
          .get('/api/auth/connections')
          .set('Cookie', session)
          .expect(200);
        assert.equal(methods.body.password, false);
        assert.equal(methods.body.identities[0].provider, provider);
        await request(app)
          .delete(`/api/auth/connections/${provider}`)
          .set('Cookie', session)
          .expect(409);
        await request(app).post('/api/auth/logout').set('Cookie', session).send({}).expect(200);
        await request(app).get('/api/state').set('Cookie', session).expect(401);
        const returned = await signIn(provider);
        const returningStatus = await request(app)
          .get('/api/auth/session')
          .set('Cookie', returned)
          .expect(200);
        assert.equal(returningStatus.body.user.id, id);
        const restored = await request(app).get('/api/state').set('Cookie', returned).expect(200);
        assert.deepEqual(restored.body.workspace, saved.body.workspace);
        const byId = (records: Transaction[]) =>
          Object.fromEntries(records.map((record) => [record.id, record]));
        assert.deepEqual(byId(restored.body.transactions), byId(saved.body.transactions));
      });
    }
    it('concurrent first sign-ins create one account with two valid sessions', async () => {
      const identity = {
        provider: 'google' as const,
        subject: subject('concurrent'),
        label: 'concurrent@example.test',
      };
      const [first, second] = await Promise.all([
        auth.completeIdentity(identity, 'login', null),
        auth.completeIdentity(identity, 'login', null),
      ]);
      const [a, b] = await Promise.all([auth.status(first), auth.status(second)]);
      assert.ok(a.user);
      assert.equal(a.user.id, b.user?.id);
      const count = await pool.query(
        'SELECT count(*)::int AS count FROM surplus_auth.identities WHERE subject=$1',
        [identity.subject],
      );
      assert.equal(count.rows[0].count, 1);
    });
  },
);
