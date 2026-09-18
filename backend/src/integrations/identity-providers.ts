import * as oidc from 'openid-client';
import type { ProviderId, SignInMethods } from '../../../shared/auth';
import type { Identity } from '../repositories/auth-repository';
import { publicOrigin, emailConfigured, identitySetup, microsoftTenant } from '../config/identity';
export { publicOrigin, emailConfigured } from '../config/identity';

export interface IdentityFlow {
  state: string;
  nonce: string;
  verifier: string;
}
export interface IdentityProviders {
  methods(): SignInMethods;
  authorize(provider: ProviderId, flow: IdentityFlow): Promise<string>;
  exchange(provider: ProviderId, response: URL | Request, flow: IdentityFlow): Promise<Identity>;
}
export class OpenIdProviders implements IdentityProviders {
  constructor(
    private readonly testConfiguration?: (provider: ProviderId) => Promise<oidc.Configuration>,
  ) {}
  private configs = new Map<ProviderId, { config: oidc.Configuration; until: number }>();
  methods(): SignInMethods {
    return {
      providers: (['google', 'microsoft'] as const).map((provider) => {
        const { id, name, available } = identitySetup(provider);
        return { id, name, available };
      }),
      email: emailConfigured(),
    };
  }
  private async configuration(provider: ProviderId) {
    if (this.testConfiguration) return this.testConfiguration(provider);
    if (!this.methods().providers.find((p) => p.id === provider)?.available)
      throw new Error('Provider unavailable');
    const cached = this.configs.get(provider);
    if (cached && cached.until > Date.now()) return cached.config;
    const prefix = provider.toUpperCase();
    const clientId = process.env[`${prefix}_CLIENT_ID`]!;
    const secret = process.env[`${prefix}_CLIENT_SECRET`]!;
    const issuer =
      provider === 'google'
        ? 'https://accounts.google.com'
        : `https://login.microsoftonline.com/${microsoftTenant()}/v2.0`;
    const config = await oidc.discovery(
      new URL(issuer),
      clientId,
      { client_secret: secret, id_token_signed_response_alg: 'RS256' },
      oidc.ClientSecretPost(secret),
      { timeout: 10 },
    );
    oidc.enableNonRepudiationChecks(config);
    this.configs.set(provider, { config, until: Date.now() + 30 * 60_000 });
    return config;
  }
  async authorize(provider: ProviderId, flow: IdentityFlow) {
    const config = await this.configuration(provider);
    const params: Record<string, string> = {
      redirect_uri: `${publicOrigin()}/api/auth/oauth/${provider}/callback`,
      scope: 'openid email profile',
      state: flow.state,
      nonce: flow.nonce,
    };
    params.code_challenge = await oidc.calculatePKCECodeChallenge(flow.verifier);
    params.code_challenge_method = 'S256';
    params.prompt = 'select_account';
    return oidc.buildAuthorizationUrl(config, params).href;
  }
  async exchange(
    provider: ProviderId,
    response: URL | Request,
    flow: IdentityFlow,
  ): Promise<Identity> {
    const config = await this.configuration(provider);
    const tokens = await oidc.authorizationCodeGrant(config, response, {
      expectedState: flow.state,
      expectedNonce: flow.nonce,
      idTokenExpected: true,
      pkceCodeVerifier: flow.verifier,
    });
    const claims = tokens.claims();
    if (!claims?.sub || !claims.iss) throw new Error('Missing identity');
    // Never authorize or merge accounts by email (Microsoft emails may be mutable).
    return {
      provider,
      subject: `${claims.iss}|${claims.sub}`,
      label: typeof claims.email === 'string' ? claims.email.slice(0, 254) : `${provider} account`,
    };
  }
}
