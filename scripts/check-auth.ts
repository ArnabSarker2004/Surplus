import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { providerSchema } from '../shared/auth';
import { identitySetup, publicOrigin } from '../backend/src/config/identity';
import { OpenIdProviders } from '../backend/src/integrations/identity-providers';

const flag = process.argv.indexOf('--provider');
const selected = flag >= 0 ? providerSchema.safeParse(process.argv[flag + 1]) : null;
if (selected && !selected.success) {
  console.error('Use --provider google or --provider microsoft.');
  process.exitCode = 1;
} else {
  const providers = selected?.success ? [selected.data] : (['google', 'microsoft'] as const);
  try {
    console.info(`Open Surplus at ${publicOrigin()} for provider sign-in.`);
  } catch {
    console.error('Fix AUTH_PUBLIC_ORIGIN in .env; no credentials have been printed.');
  }
  const client = new OpenIdProviders();
  for (const provider of providers) {
    const setup = identitySetup(provider);
    console.info(
      `\n${setup.name}: ${setup.available ? 'configuration present' : 'setup incomplete'}`,
    );
    if (setup.redirectUri) console.info(`Web redirect URI: ${setup.redirectUri}`);
    if (setup.missing.length) console.info(`Missing .env fields: ${setup.missing.join(', ')}`);
    for (const problem of setup.problems) console.info(problem);
    if (!setup.available) {
      process.exitCode = 1;
      continue;
    }
    if (process.argv.includes('--probe')) {
      try {
        await client.authorize(provider, {
          state: randomBytes(32).toString('hex'),
          nonce: randomBytes(32).toString('hex'),
          verifier: randomBytes(32).toString('base64url'),
        });
        console.info(
          'Provider discovery succeeded. Complete a browser sign-in to verify the client credentials and registered redirect.',
        );
      } catch {
        console.error(
          'Provider discovery or local key validation failed. Check configuration and network access.',
        );
        process.exitCode = 1;
      }
    }
  }
  console.info('\nCredentials remain private. Setup guide: docs/social-login-setup.md');
}
