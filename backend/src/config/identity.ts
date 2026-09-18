import type { ProviderId } from '../../../shared/auth';

export function publicOrigin() {
  let url: URL;
  try {
    url = new URL(process.env.AUTH_PUBLIC_ORIGIN || 'http://127.0.0.1:5173');
  } catch {
    throw new Error('AUTH_PUBLIC_ORIGIN must be an HTTPS origin or loopback HTTP origin.');
  }
  if (
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new Error('AUTH_PUBLIC_ORIGIN must be an HTTPS origin or loopback HTTP origin.');
  return url.origin;
}

const definitions = {
  google: { name: 'Google', required: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  microsoft: { name: 'Microsoft', required: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'] },
} as const;

export function microsoftTenant() {
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || 'common';
  if (
    !/^(common|organizations|consumers|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(
      tenant,
    )
  )
    throw new Error(
      'MICROSOFT_TENANT_ID must be common, organizations, consumers, or a tenant UUID.',
    );
  return tenant;
}

/** Operator diagnostics contain field names and public callback addresses, never credentials. */
export function identitySetup(provider: ProviderId) {
  const definition = definitions[provider];
  const missing = definition.required.filter((name) => !process.env[name]?.trim());
  const problems: string[] = [];
  let redirectUri: string | null = null;
  try {
    const origin = publicOrigin();
    redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;
  } catch {
    problems.push('Set AUTH_PUBLIC_ORIGIN to the exact HTTPS or loopback HTTP browser origin.');
  }
  if (provider === 'microsoft') {
    try {
      microsoftTenant();
    } catch {
      problems.push(
        'MICROSOFT_TENANT_ID must be common, organizations, consumers, or a tenant UUID.',
      );
    }
  }
  return {
    id: provider,
    name: definition.name,
    available: !missing.length && !problems.length,
    missing,
    problems,
    redirectUri,
  };
}

export function emailConfigured() {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].every(
    (name) => !!process.env[name]?.trim(),
  );
}
