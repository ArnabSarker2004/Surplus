import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { postgresPool, transaction } from '../backend/src/infrastructure/postgres';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { PostgresAuthService } from '../backend/src/services/postgres-auth-service';
import { PostgresWorkspace } from '../backend/src/repositories/postgres-workspace';
import { postgresWorkspaceRoutes } from '../backend/src/routes/postgres-workspace-routes';
import { createApp } from '../backend/src/app';
import { encrypt, decrypt, type PlaidItem } from '../backend/src/integrations/plaid';
import { demoWorkspace } from '../shared/demo';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { importLocalWorkspace } from '../backend/src/services/local-workspace-import';

describe('PostgreSQL accounts and persistence', { skip: !process.env.DATABASE_URL }, () => {
  const pool = postgresPool();
  const key = randomBytes(32);
  const signingKey = randomBytes(32);
  const auth = new PostgresAuthService(pool, signingKey);
  const workspaces = new PostgresWorkspace(pool);
  const usernames = [`test-${randomUUID()}`, `test-${randomUUID()}`];
  const ids: string[] = [];
  const tokens: string[] = [];
  const password = 'temporary-test-only-password';
  let store: Store;
  let app: ReturnType<typeof createApp>;
  before(async () => {
    store = await Store.open();
    app = createApp(store, key, {}, { auth, routes: postgresWorkspaceRoutes(workspaces, key) });
    for (const username of usernames) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, password })
        .expect(201);
      ids.push(response.body.user.id);
      tokens.push(
        (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0].split('=')[1],
      );
    }
  });
  after(async () => {
    // Only the two uniquely named disposable users created by this test run are removed.
    await pool.query('DELETE FROM surplus_auth.imports WHERE user_id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM surplus_auth.users WHERE username=ANY($1::text[])', [usernames]);
    store?.close();
    await pool.end();
  });
  const cookie = (index: number) => `surplus_session=${tokens[index]}`;
  it('registers separate accounts and rejects duplicate names and unauthenticated access', async () => {
    assert.notEqual(ids[0], ids[1]);
    assert.equal((await auth.status(null)).registrationOpen, true);
    await request(app).get('/api/state').expect(401);
    await request(app)
      .post('/api/auth/register')
      .send({ username: usernames[0], password })
      .expect(409);
    await request(app)
      .post('/api/auth/login')
      .send({ username: usernames[0], password: 'incorrect-password' })
      .expect(401);
  });
  it('persists demo data across repository instances without sharing it with another user', async () => {
    await request(app).post('/api/demo').set('Cookie', cookie(0)).send({}).expect(200);
    const saved = await new PostgresWorkspace(pool).run(ids[0], (repository) => repository.state());
    assert.ok(saved.workspace);
    assert.ok(saved.accounts.length);
    assert.ok(saved.transactions.length);
    const other = await request(app).get('/api/state').set('Cookie', cookie(1)).expect(200);
    assert.equal(other.body.workspace, null);
    assert.equal(other.body.transactions.length, 0);
    await request(app)
      .patch(`/api/transactions/${saved.transactions[0].id}`)
      .set('Cookie', cookie(1))
      .send({ category: 'Other' })
      .expect(404);
    const counts = await pool.query(
      'SELECT count(*)::int AS count FROM surplus.funding WHERE user_id=$1',
      [ids[0]],
    );
    assert.equal(counts.rows[0].count, saved.workspace.funding.length);
  });
  it('enforces database RLS for reads, writes, deletes and absent user identity', async () => {
    await transaction(pool, async (client) => {
      await client.query('SET LOCAL ROLE surplus_runtime');
      await client.query("SELECT set_config('surplus.user_id',$1,true)", [ids[1]]);
      assert.equal(
        (await client.query('SELECT * FROM surplus.workspaces WHERE user_id=$1', [ids[0]]))
          .rowCount,
        0,
      );
      assert.equal(
        (await client.query('DELETE FROM surplus.bank_accounts WHERE user_id=$1', [ids[0]]))
          .rowCount,
        0,
      );
      await client.query('SAVEPOINT forbidden');
      await assert.rejects(
        client.query('INSERT INTO surplus.funding(user_id,id,payload) VALUES($1,$2,$3)', [
          ids[0],
          'forbidden',
          { amount: 1 },
        ]),
        (error: unknown) => (error as { code: string }).code === '42501',
      );
      await client.query('ROLLBACK TO SAVEPOINT forbidden');
      await client.query("SELECT set_config('surplus.user_id','',true)");
      assert.equal((await client.query('SELECT * FROM surplus.workspaces')).rowCount, 0);
    });
  });
  it('rejects stale browser account bindings without revoking the current account', async () => {
    await request(app)
      .get('/api/state')
      .set('Cookie', cookie(1))
      .set('X-Surplus-User', ids[0])
      .expect(401);
    assert.ok((await auth.status(tokens[1])).user);
    await request(app)
      .get('/api/state')
      .set('Cookie', cookie(1))
      .set('X-Surplus-User', ids[1])
      .expect(200);
  });
  it('rolls back partial changes and serializes edits to the same workspace', async () => {
    const before = await workspaces.run(ids[0], (r) => r.state());
    await assert.rejects(
      workspaces.run(ids[0], (r) => {
        r.clear();
        throw new Error('test rollback');
      }),
      /test rollback/,
    );
    assert.deepEqual(await workspaces.run(ids[0], (r) => r.state()), before);
    await Promise.all([
      workspaces.run(ids[0], async (r) => {
        const w = r.workspace()!;
        await new Promise((resolve) => setTimeout(resolve, 50));
        w.applications['first'] = 'Saved';
        r.save(w);
      }),
      workspaces.run(ids[0], (r) => {
        const w = r.workspace()!;
        w.applications['second'] = 'Applied';
        r.save(w);
      }),
    ]);
    const result = await workspaces.run(ids[0], (r) => r.workspace());
    assert.equal(result!.applications.first, 'Saved');
    assert.equal(result!.applications.second, 'Applied');
  });
  it('stores encrypted Plaid credentials privately and blocks the shared environment token import', async () => {
    const token = `access-sandbox-${randomUUID()}`;
    await workspaces.run(ids[0], (r) =>
      r.store.set('plaid', {
        id: 'test-item',
        encryptedToken: encrypt(token, key),
        cursor: '',
        syncedAt: null,
        status: 'connected',
        error: null,
      } satisfies PlaidItem),
    );
    const item = await workspaces.run(ids[0], (r) => r.store.get<PlaidItem>('plaid', null!));
    assert.equal(decrypt(item.encryptedToken, key), token);
    const exported = await request(app).get('/api/export').set('Cookie', cookie(0)).expect(200);
    assert.equal(JSON.stringify(exported.body).includes('encryptedToken'), false);
    assert.equal(JSON.stringify(exported.body).includes(token), false);
    const status = await request(app).get('/api/plaid/status').set('Cookie', cookie(1)).expect(200);
    assert.equal(status.body.connected, false);
    assert.equal(status.body.canImport, false);
    await request(app).post('/api/plaid/import').set('Cookie', cookie(1)).send({}).expect(403);
  });
  it('validates workspaces and deletes only the current user’s financial records', async () => {
    await request(app)
      .put('/api/workspace')
      .set('Cookie', cookie(1))
      .send({ bad: true })
      .expect(400);
    const workspace = demoWorkspace();
    workspace.source = 'manual';
    await request(app).put('/api/workspace').set('Cookie', cookie(1)).send(workspace).expect(200);
    await request(app).delete('/api/data').set('Cookie', cookie(1)).send({}).expect(200);
    assert.equal(await workspaces.run(ids[1], (r) => r.workspace()), null);
    assert.ok(await workspaces.run(ids[0], (r) => r.workspace()));
    assert.ok((await auth.status(tokens[1])).user);
  });
  it('isolates linked identities, prevents identity theft and does not merge on a matching label', async () => {
    const identity = { provider: 'google' as const, subject: randomUUID(), label: usernames[1] };
    await auth.completeIdentity(identity, 'link', tokens[0]);
    assert.equal((await auth.methods(tokens[0])).identities.length, 1);
    assert.equal((await auth.methods(tokens[1])).identities.length, 0);
    await assert.rejects(auth.completeIdentity(identity, 'link', tokens[1]), /already connected/);
    const signedIn = await auth.completeIdentity(identity, 'login', null);
    assert.equal((await auth.status(signedIn)).user?.id, ids[0]);
    await auth.logout(signedIn);
    await auth.unlink('google', tokens[0]);
  });
  it('imports a local plan only into an explicitly selected empty account and prevents duplicate imports', async () => {
    const workspace = demoWorkspace();
    workspace.source = 'manual';
    const snapshot = new MemoryDocuments({ workspace, accounts: [], transactions: [], rules: [] });
    await assert.rejects(
      importLocalWorkspace(pool, snapshot, 'missing-' + randomUUID()),
      /Create the destination/,
    );
    await assert.rejects(importLocalWorkspace(pool, snapshot, usernames[0]), /already has data/);
    await importLocalWorkspace(pool, snapshot, usernames[1]);
    assert.deepEqual(await workspaces.run(ids[1], (r) => r.workspace()), workspace);
    await assert.rejects(
      importLocalWorkspace(pool, snapshot, usernames[1]),
      /already been imported/,
    );
    assert.deepEqual(snapshot.get('workspace', null), workspace);
  });
  it('revokes sessions on logout and restores saved data after signing back in', async () => {
    await request(app).post('/api/auth/logout').set('Cookie', cookie(0)).send({}).expect(200);
    await request(app).get('/api/state').set('Cookie', cookie(0)).expect(401);
    const next = await auth.authenticate(usernames[0], password, false, null);
    const restarted = new PostgresAuthService(pool, signingKey);
    assert.equal((await restarted.status(next)).user?.id, ids[0]);
    assert.equal((await restarted.status(next.slice(0, -12) + 'tampered')).user, null);
    assert.ok(await workspaces.run(ids[0], (r) => r.workspace()));
    await auth.logout(next);
  });
});
