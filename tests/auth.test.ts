import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../backend/src/app';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { AuthRepository } from '../backend/src/repositories/auth-repository';
import { AuthService, SESSION_IDLE_MS, SESSION_MAX_MS } from '../backend/src/services/auth-service';
import { demoWorkspace } from '../shared/demo';

const credentials = { username: 'test-owner', password: 'test-only-long-passphrase' };
const cookie = (response: { headers: Record<string, unknown> }) =>
  (response.headers['set-cookie'] as string[])[0].split(';')[0];
describe('local account and session security', () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;
  beforeEach(async () => {
    store = await Store.open();
    app = createApp(store, randomBytes(32));
  });
  afterEach(() => store.close());
  it('denies all private reads and writes before setup and without a session', async () => {
    for (const path of ['/api/state', '/api/export', '/api/plaid/status'])
      await request(app).get(path).expect(401);
    for (const path of [
      '/api/demo',
      '/api/plaid/sandbox',
      '/api/plaid/sync',
      '/api/plaid/import',
      '/api/plaid/link-token',
    ])
      await request(app).post(path).send({}).expect(401);
    await request(app).put('/api/workspace').send(demoWorkspace()).expect(401);
    await request(app).patch('/api/transactions/x').send({}).expect(401);
    await request(app).delete('/api/data').expect(401);
    await request(app).delete('/api/plaid/item').expect(401);
    await request(app).get('/api/resources').expect(200);
    assert.deepEqual((await request(app).get('/api/auth/session')).body, {
      setupRequired: true,
      user: null,
    });
  });
  it('adopts existing data once, stores only a salted password hash, and issues an HttpOnly cookie', async () => {
    store.transaction(() => {
      store.set('workspace', demoWorkspace());
      store.set('plaid', { encryptedToken: 'preserve-me' });
    });
    const setup = await request(app).post('/api/auth/setup').send(credentials).expect(201);
    const headers = (setup.headers['set-cookie'] as unknown as string[])[0];
    assert.match(headers, /HttpOnly/);
    assert.match(headers, /SameSite=Strict/);
    assert.match(headers, /Path=\//);
    assert.equal(setup.body.user.username, credentials.username);
    assert.equal(store.get('plaid', { encryptedToken: '' }).encryptedToken, 'preserve-me');
    const account = new AuthRepository(store).account()!;
    assert.ok(account.password!.hash.length === 128);
    assert.ok(!JSON.stringify(account).includes(credentials.password));
    const saved = await request(app).get('/api/state').set('Cookie', cookie(setup)).expect(200);
    assert.equal(saved.body.workspace.profile.name, 'Alex');
    await request(app)
      .post('/api/auth/setup')
      .send({ ...credentials, username: 'attacker' })
      .expect(409);
  });
  it('revokes logout tokens server-side, preserves data, and rotates tokens on sign-in', async () => {
    const initial = cookie(await request(app).post('/api/auth/setup').send(credentials));
    await request(app).post('/api/demo').set('Cookie', initial).send({}).expect(200);
    const exported = await request(app).get('/api/export').set('Cookie', initial).expect(200);
    assert.ok(!exported.text.includes('auth.account'));
    assert.ok(!exported.text.includes(new AuthRepository(store).account()!.password!.hash));
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', initial)
      .send({})
      .expect(200);
    assert.match(
      (logout.headers['set-cookie'] as unknown as string[])[0],
      /Expires=Thu, 01 Jan 1970/,
    );
    await request(app).get('/api/state').set('Cookie', initial).expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'this-is-the-wrong-password' })
      .expect(401);
    const next = cookie(await request(app).post('/api/auth/login').send(credentials).expect(200));
    assert.notEqual(initial, next);
    assert.equal(
      (await request(app).get('/api/state').set('Cookie', next)).body.workspace.profile.name,
      'Alex',
    );
    const rotated = cookie(
      await request(app).post('/api/auth/login').set('Cookie', next).send(credentials).expect(200),
    );
    await request(app).get('/api/state').set('Cookie', next).expect(401);
    await request(app).get('/api/state').set('Cookie', rotated).expect(200);
  });
  it('expires idle and absolute sessions; status polls do not keep them alive', async () => {
    let now = 1_000_000;
    const repository = new AuthRepository(store);
    const auth = new AuthService(repository, () => now);
    const token = await auth.authenticate(credentials.username, credentials.password, true, null);
    now += SESSION_IDLE_MS - 1;
    assert.ok(auth.status(token).user);
    now += 1;
    assert.equal(auth.status(token).user, null);
    const fresh = await auth.authenticate(credentials.username, credentials.password, false, null);
    const sessions = repository.sessions();
    sessions[0].createdAt = now - SESSION_MAX_MS;
    sessions[0].lastSeen = now;
    repository.saveSessions(sessions);
    assert.equal(auth.status(fresh).user, null);
  });
  it('keeps valid sessions across server recreation and keeps accounts after workspace deletion', async () => {
    const token = cookie(await request(app).post('/api/auth/setup').send(credentials));
    app = createApp(store, randomBytes(32));
    await request(app).get('/api/state').set('Cookie', token).expect(200);
    await request(app).delete('/api/data').set('Cookie', token).expect(200);
    await request(app).get('/api/state').expect(401);
    assert.equal((await request(app).get('/api/auth/session')).body.setupRequired, false);
    assert.ok((await request(app).get('/api/auth/session').set('Cookie', token)).body.user);
  });
  it('rejects cross-site auth changes, short passwords, and repeated bad passwords', async () => {
    await request(app)
      .post('/api/auth/setup')
      .set('Origin', 'https://evil.example')
      .send(credentials)
      .expect(403);
    await request(app)
      .post('/api/auth/setup')
      .set('Sec-Fetch-Site', 'cross-site')
      .send(credentials)
      .expect(403);
    await request(app)
      .post('/api/auth/setup')
      .send({ ...credentials, password: 'short' })
      .expect(400);
    await request(app).post('/api/auth/setup').send(credentials).expect(201);
    for (let i = 0; i < 5; i++)
      await request(app)
        .post('/api/auth/login')
        .send({ ...credentials, password: 'wrong-long-passphrase' })
        .expect(401);
    await request(app).post('/api/auth/login').send(credentials).expect(429);
  });
});
