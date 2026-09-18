import assert from 'node:assert/strict';
import { it } from 'node:test';
import { randomUUID } from 'node:crypto';
import * as oidc from 'openid-client';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { OpenIdProviders } from '../backend/src/integrations/identity-providers';

for (const provider of ['google', 'microsoft'] as const) {
  it(`${provider}: validates signed tokens and builds a code flow with PKCE and account selection`, async () => {
    const microsoft = provider === 'microsoft';
    const tenant = randomUUID();
    const discovery = microsoft
      ? 'https://login.microsoftonline.com/common/v2.0'
      : 'https://accounts.google.com';
    const metadataIssuer = microsoft
      ? 'https://login.microsoftonline.com/{tenantid}/v2.0'
      : discovery;
    const issuer = microsoft ? `https://login.microsoftonline.com/${tenant}/v2.0` : discovery;
    const endpoint = 'https://identity.example.test';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
    const flow = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      verifier: oidc.randomPKCECodeVerifier(),
    };
    let token = '';
    const mockedFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      let payload;
      if (url.includes('.well-known'))
        payload = {
          issuer: metadataIssuer,
          authorization_endpoint: `${endpoint}/authorize`,
          token_endpoint: `${endpoint}/token`,
          jwks_uri: `${endpoint}/jwks`,
        };
      else if (url.endsWith('/jwks')) payload = { keys: [jwk] };
      else {
        const body = new URLSearchParams(String(init?.body));
        assert.equal(body.get('code_verifier'), flow.verifier);
        assert.equal(body.get('grant_type'), 'authorization_code');
        payload = { access_token: 'fixture-unused', token_type: 'Bearer', id_token: token };
      }
      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const config = await oidc.discovery(
      new URL(discovery),
      'fixture-client',
      { client_secret: 'fixture-secret', id_token_signed_response_alg: 'RS256' },
      oidc.ClientSecretPost('fixture-secret'),
      { [oidc.customFetch]: mockedFetch },
    );
    oidc.enableNonRepudiationChecks(config);
    const client = new OpenIdProviders(async () => config);
    const authorization = new URL(await client.authorize(provider, flow));
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    assert.equal(authorization.searchParams.get('scope'), 'openid email profile');
    assert.equal(authorization.searchParams.get('prompt'), 'select_account');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(
      authorization.searchParams.get('code_challenge'),
      await oidc.calculatePKCECodeChallenge(flow.verifier),
    );
    assert.equal(authorization.searchParams.get('nonce'), flow.nonce);
    const response = new URL(authorization.searchParams.get('redirect_uri')!);
    response.searchParams.set('code', 'fixture-code');
    response.searchParams.set('state', flow.state);
    const sign = (extra = {}) =>
      new SignJWT({
        iss: issuer,
        sub: 'student',
        aud: 'fixture-client',
        nonce: flow.nonce,
        email: 'student@example.test',
        ...(microsoft ? { tid: tenant } : {}),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        ...extra,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
        .sign(privateKey);
    token = await sign();
    const identity = await client.exchange(provider, response, flow);
    assert.equal(identity.subject, `${issuer}|student`);
    assert.equal(identity.provider, provider);
    token = await sign(microsoft ? { tid: randomUUID() } : { iss: 'https://untrusted.example' });
    await assert.rejects(client.exchange(provider, response, flow));
    token = await sign({ nonce: 'incorrect' });
    await assert.rejects(client.exchange(provider, response, flow));
  });
}
