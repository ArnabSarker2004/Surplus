import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as oidc from 'openid-client';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createApp } from '../backend/src/app';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { AuthRepository } from '../backend/src/repositories/auth-repository';
import { AuthService } from '../backend/src/services/auth-service';
import { EmailAuthService } from '../backend/src/services/email-auth-service';
import {
  OpenIdProviders,
  type IdentityFlow,
  type IdentityProviders,
} from '../backend/src/integrations/identity-providers';

const credentials = { username: 'owner', password: 'a-long-test-only-passphrase' };
const getCookie = (res: { headers: Record<string, unknown> }, name = 'surplus_session') =>
  (res.headers['set-cookie'] as string[]).find((v) => v.startsWith(`${name}=`))!.split(';')[0];
describe('JWT, email codes and linked identity boundaries', () => {
  let store: Store;
  let auth: AuthService;
  let clock: number;
  let mail: { email: string; code: string }[];
  let email: EmailAuthService;
  beforeEach(async () => {
    store = await Store.open();
    clock = Date.now();
    auth = new AuthService(new AuthRepository(store), () => clock);
    mail = [];
    email = new EmailAuthService(
      auth,
      {
        async sendCode(address, code) {
          mail.push({ email: address, code });
        },
      },
      () => clock,
    );
  });
  afterEach(() => store.close());
  it('issues verified JWTs and rejects tampering, wrong audience, unsigned tokens, and revoked tokens', async () => {
    const token = await auth.authenticate(credentials.username, credentials.password, true, null);
    const repository = new AuthRepository(store);
    const payload = jwt.verify(token, repository.signingKey(), {
      algorithms: ['HS256'],
      issuer: 'surplus',
      audience: 'surplus-api',
    }) as jwt.JwtPayload;
    assert.equal(payload.sub, 'workspace-owner');
    assert.ok(payload.jti);
    assert.equal(payload.email, undefined);
    assert.ok(auth.status(token).user);
    assert.equal(auth.status(token.slice(0, -8) + 'tampered').user, null);
    const forged = jwt.sign({ sub: 'workspace-owner' }, repository.signingKey(), {
      audience: 'other',
      issuer: 'surplus',
    });
    assert.equal(auth.status(forged).user, null);
    assert.equal(auth.status(jwt.sign({}, '', { algorithm: 'none' })).user, null);
    auth.logout(token);
    assert.equal(auth.status(token).user, null);
  });
  it('creates a verified email owner, expires codes, limits guesses, and prevents replay', async () => {
    const id = await email.request('student@example.test', 'login', null);
    assert.equal(mail.length, 1);
    const token = await email.verify(id, mail[0].code);
    assert.ok(auth.status(token).user);
    assert.equal(auth.methods().email, 'student@example.test');
    await assert.rejects(() => email.verify(id, mail[0].code), /expired/);
    const expired = await email.request('student@example.test', 'login', null);
    clock += 10 * 60_000;
    await assert.rejects(() => email.verify(expired, mail[1].code), /expired/);
    const guessed = await email.request('student@example.test', 'login', null);
    const wrong = mail[2].code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      await assert.rejects(() => email.verify(guessed, wrong), /incorrect/);
    await assert.rejects(() => email.verify(guessed, mail[2].code), /expired/);
    await assert.rejects(email.request('student@example.test', 'login', null), /Too many/);
  });
  it('does not let an arbitrary email or matching social email claim an existing owner', async () => {
    const owner = await auth.authenticate(credentials.username, credentials.password, true, null);
    await email.request('attacker@example.test', 'login', null);
    assert.equal(mail.length, 0);
    assert.throws(
      () =>
        auth.completeIdentity(
          { provider: 'google', subject: 'unlinked', label: 'owner@example.test' },
          'login',
          null,
        ),
      /not linked/,
    );
    await assert.rejects(email.request('owner@example.test', 'link', null), /Sign out/);
    const id = await email.request('owner@example.test', 'link', owner);
    await email.verify(id, mail[0].code);
    auth.logout(owner);
    const login = await email.request('owner@example.test', 'login', null);
    assert.ok(auth.status(await email.verify(login, mail[1].code)).user);
  });
  it('requires a recent, unrevoked session to link; preserves a last sign-in method', async () => {
    const identity = {
      provider: 'google' as const,
      subject: 'issuer|123',
      label: 'student@example.test',
    };
    const token = auth.completeIdentity(identity, 'login', null);
    assert.throws(() => auth.unlink('google', token), /at least one/);
    auth.completeIdentity(
      { provider: 'microsoft', subject: 'microsoft|456', label: 'school account' },
      'link',
      token,
    );
    auth.unlink('google', token);
    assert.throws(() => auth.completeIdentity(identity, 'login', null), /not linked/);
    clock += 5 * 60_000 + 1;
    assert.throws(() => auth.completeIdentity(identity, 'link', token), /Sign out/);
    auth.logout(token);
    assert.throws(() => auth.completeIdentity(identity, 'link', token), /Sign out/);
  });
  it('invalidates an email linking request if its initiating session logs out', async () => {
    const owner = await auth.authenticate(credentials.username, credentials.password, true, null);
    const id = await email.request('owner@example.test', 'link', owner);
    auth.logout(owner);
    await assert.rejects(() => email.verify(id, mail[0].code), /Sign out/);
    assert.equal(auth.methods().email, null);
  });
  it('handles mail delivery failure without creating an account or exposing the code', async () => {
    const failing = new EmailAuthService(auth, {
      async sendCode() {
        throw new Error('smtp password');
      },
    });
    await assert.rejects(
      failing.request('x@example.test', 'login', null),
      (e) =>
        e instanceof Error &&
        /could not be delivered/.test(e.message) &&
        !e.message.includes('smtp password'),
    );
    assert.equal(auth.status(null).setupRequired, true);
  });
});

describe('OAuth and email HTTP flows', () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;
  let flows: IdentityFlow[];
  let code: string;
  beforeEach(async () => {
    store = await Store.open();
    flows = [];
    const providers: IdentityProviders = {
      methods: () => ({
        providers: [
          { id: 'google', name: 'Google', available: true },
          { id: 'microsoft', name: 'Microsoft', available: true },
        ],
        email: true,
      }),
      async authorize(provider, flow) {
        flows.push(flow);
        return `https://example.test/${provider}?state=${flow.state}`;
      },
      async exchange(provider, _response, _flow) {
        return { provider, subject: `${provider}|123`, label: 'student@example.test' };
      },
    };
    app = createApp(store, randomBytes(32), {
      providers,
      mailer: {
        async sendCode(_email, value) {
          code = value;
        },
      },
    });
  });
  afterEach(() => store.close());
  it('binds callbacks to one browser and consumes state once; accepts legitimate cross-site returns', async () => {
    const start = await request(app).post('/api/auth/oauth/google/start').send({}).expect(200);
    const flowCookie = getCookie(start, 'surplus_oauth');
    const path = `/api/auth/oauth/google/callback?code=valid&state=${flows[0].state}`;
    const stolen = await request(app).get(path).expect(303);
    assert.match(stolen.headers.location, /auth_error=failed/);
    const completed = await request(app)
      .get(path)
      .set('Cookie', flowCookie)
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(303);
    const cookie = getCookie(completed);
    await request(app).get('/api/state').set('Cookie', cookie).expect(200);
    assert.match(
      (await request(app).get(path).set('Cookie', flowCookie)).headers.location,
      /auth_error=failed/,
    );
  });
  it('rejects wrong state and provider substitutions, and handles cancellation', async () => {
    const start = await request(app).post('/api/auth/oauth/google/start').send({}).expect(200);
    const c = getCookie(start, 'surplus_oauth');
    assert.match(
      (await request(app).get('/api/auth/oauth/google/callback?state=bad').set('Cookie', c)).headers
        .location,
      /failed/,
    );
    const next = await request(app).post('/api/auth/oauth/google/start').send({});
    const cancel = await request(app)
      .get(`/api/auth/oauth/google/callback?error=access_denied&state=${flows[1].state}`)
      .set('Cookie', getCookie(next, 'surplus_oauth'));
    assert.match(cancel.headers.location, /cancelled/);
    assert.equal(new AuthRepository(store).account(), null);
    const substituted = await request(app).post('/api/auth/oauth/google/start').send({});
    const wrongProvider = await request(app)
      .get(`/api/auth/oauth/microsoft/callback?code=valid&state=${flows[2].state}`)
      .set('Cookie', getCookie(substituted, 'surplus_oauth'));
    assert.match(wrongProvider.headers.location, /failed/);
    assert.equal(new AuthRepository(store).account(), null);
  });
  it('catches a browser/callback origin mismatch before redirecting to a provider', async () => {
    const origin = process.env.AUTH_PUBLIC_ORIGIN || 'http://127.0.0.1:5173';
    const other = origin.includes('127.0.0.1') ? 'http://localhost:5173' : 'http://127.0.0.1:5173';
    const result = await request(app)
      .post('/api/auth/oauth/google/start')
      .set('Origin', other)
      .send({})
      .expect(400);
    assert.match(result.body.error, /Open Surplus at/);
    assert.equal(flows.length, 0);
  });
  it('rejects removed Apple endpoints and cross-site auth writes', async () => {
    await request(app).post('/api/auth/oauth/apple/start').send({}).expect(400);
    await request(app)
      .post('/api/auth/oauth/apple/callback')
      .set('Sec-Fetch-Site', 'cross-site')
      .type('form')
      .send({})
      .expect(403);
    await request(app)
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({})
      .expect(403);
    await request(app).post('/api/auth/oauth/google/start').type('form').send({}).expect(415);
  });
  it('binds email verification to the initiating browser and retains logout protection', async () => {
    const sent = await request(app)
      .post('/api/auth/email/request')
      .send({ email: 'student@example.test' })
      .expect(200);
    assert.ok(!JSON.stringify(sent.body).includes(code));
    await request(app).post('/api/auth/email/verify').send({ code }).expect(400);
    const verified = await request(app)
      .post('/api/auth/email/verify')
      .set('Cookie', getCookie(sent, 'surplus_email'))
      .send({ code })
      .expect(200);
    const cookie = getCookie(verified);
    await request(app).post('/api/auth/logout').set('Cookie', cookie).send({}).expect(200);
    await request(app).get('/api/state').set('Cookie', cookie).expect(401);
  });
});

it('OpenID validates signatures, issuer, audience, nonce and expiry using the real protocol client', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const issuer = 'https://identity.example.test';
  let token = '';
  const config = new oidc.Configuration(
    {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
    },
    'test-client',
    'test-secret',
  );
  oidc.enableNonRepudiationChecks(config);
  config[oidc.customFetch] = async (url) =>
    new Response(
      JSON.stringify(
        String(url).endsWith('/jwks')
          ? { keys: [jwk] }
          : { access_token: 'unused', token_type: 'Bearer', id_token: token },
      ),
      { headers: { 'Content-Type': 'application/json' } },
    );
  const provider = new OpenIdProviders(async () => config);
  const flow = { state: 'state', nonce: 'nonce', verifier: 'verifier' };
  const response = new URL(
    'https://app.example.test/api/auth/oauth/google/callback?code=code&state=state',
  );
  const sign = (overrides = {}) =>
    new SignJWT({
      nonce: 'nonce',
      email: 'student@example.test',
      iss: issuer,
      sub: 'student',
      aud: 'test-client',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .sign(privateKey);
  token = await sign();
  assert.equal((await provider.exchange('google', response, flow)).subject, `${issuer}|student`);
  for (const overrides of [
    { nonce: 'wrong' },
    { aud: 'wrong' },
    { iss: 'https://attacker.test' },
    { exp: 1 },
  ]) {
    token = await sign(overrides);
    await assert.rejects(provider.exchange('google', response, flow));
  }
  token = (await sign()).slice(0, -20) + 'invalidsignature';
  await assert.rejects(provider.exchange('google', response, flow));
});
