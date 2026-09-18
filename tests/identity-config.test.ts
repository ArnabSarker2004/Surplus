import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { identitySetup, publicOrigin } from '../backend/src/config/identity';
import { OpenIdProviders } from '../backend/src/integrations/identity-providers';

const names = [
  'AUTH_PUBLIC_ORIGIN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
});
afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

it('reports missing configuration and public callbacks without exposing configured values', () => {
  process.env.AUTH_PUBLIC_ORIGIN = 'http://localhost:5173';
  process.env.GOOGLE_CLIENT_ID = 'client-private-test-marker';
  assert.deepEqual(identitySetup('google').missing, ['GOOGLE_CLIENT_SECRET']);
  assert.equal(
    identitySetup('google').redirectUri,
    'http://localhost:5173/api/auth/oauth/google/callback',
  );
  assert.equal(
    JSON.stringify(identitySetup('google')).includes('client-private-test-marker'),
    false,
  );
  process.env.GOOGLE_CLIENT_SECRET = 'secret-private-test-marker';
  assert.equal(identitySetup('google').available, true);
  assert.equal(
    JSON.stringify(new OpenIdProviders().methods()).includes('private-test-marker'),
    false,
  );
});
it('disables an invalid Microsoft tenant without blocking Google', () => {
  for (const name of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
  ])
    process.env[name] = 'test-value';
  process.env.MICROSOFT_TENANT_ID = 'https://attacker.example';
  assert.equal(identitySetup('microsoft').available, false);
  assert.equal(identitySetup('google').available, true);
  process.env.MICROSOFT_TENANT_ID = 'common';
  assert.equal(identitySetup('microsoft').available, true);
});
it('rejects invalid public origins without echoing sensitive URL components', () => {
  for (const value of [
    'invalid',
    'https://name:private-value@example.test',
    'https://example.test/path',
    'http://example.test',
  ]) {
    process.env.AUTH_PUBLIC_ORIGIN = value;
    assert.throws(publicOrigin, /AUTH_PUBLIC_ORIGIN/);
    assert.equal(identitySetup('google').available, false);
    assert.equal(JSON.stringify(identitySetup('google')).includes('private-value'), false);
  }
});
