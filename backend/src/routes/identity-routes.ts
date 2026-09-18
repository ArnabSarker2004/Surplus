import { Router, type Request as ExpressRequest } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { emailSchema, providerSchema, type ProviderId } from '../../../shared/auth';
import {
  publicOrigin,
  type IdentityFlow,
  type IdentityProviders,
} from '../integrations/identity-providers';
import { sessionToken, setSessionCookie, requireSession } from '../middleware/auth-session';
import { AuthError } from '../services/auth-service';
import type { EmailAuthService } from '../services/email-auth-service';

import type { AuthPort } from '../services/auth-port';

const intentSchema = z.enum(['login', 'link']).default('login');
const cookieValue = (req: ExpressRequest, name: string) =>
  req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;
interface PendingFlow extends IdentityFlow {
  provider: ProviderId;
  expires: number;
  intent: 'login' | 'link';
  ownerToken: string | null;
}
export function identityRoutes(
  auth: AuthPort,
  providers: IdentityProviders,
  email: EmailAuthService,
) {
  const router = Router();
  const flows = new Map<string, PendingFlow>();
  const secure = () => publicOrigin().startsWith('https:');
  const checkBinding = async (req: ExpressRequest) => {
    const expected = req.headers['x-surplus-user'];
    if (expected && (await auth.status(sessionToken(req))).user?.id !== expected)
      throw new AuthError(
        'The account changed in another tab. Reload before connecting a sign-in method.',
        403,
      );
  };
  router.get('/methods', (_req, res) => res.json(providers.methods()));
  router.get('/connections', requireSession(auth), async (req, res) =>
    res.json(await auth.methods(sessionToken(req))),
  );
  router.delete('/connections/:method', requireSession(auth), async (req, res) => {
    const method = z.enum(['email', 'google', 'microsoft']).parse(req.params.method);
    await auth.unlink(method, sessionToken(req));
    res.json(await auth.methods(sessionToken(req)));
  });
  router.post('/email/request', async (req, res) => {
    if (!providers.methods().email)
      throw new AuthError('Email sign-in is not available yet. Use your password.', 503);
    const input = z.object({ email: emailSchema, intent: intentSchema }).parse(req.body);
    if (input.intent === 'link') await checkBinding(req);
    const id = await email.request(input.email, input.intent, sessionToken(req));
    res.cookie('surplus_email', id, {
      httpOnly: true,
      sameSite: 'strict',
      secure: secure(),
      path: '/api/auth/email',
      maxAge: 10 * 60_000,
    });
    res.json({
      message:
        'If this address can sign in, a code is on its way. Check your inbox and spam folder.',
    });
  });
  router.post('/email/verify', async (req, res) => {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const token = await email.verify(cookieValue(req, 'surplus_email'), code);
    res.clearCookie('surplus_email', {
      httpOnly: true,
      sameSite: 'strict',
      secure: secure(),
      path: '/api/auth/email',
    });
    setSessionCookie(req, res, token);
    res.json(await auth.status(token));
  });
  router.post('/oauth/:provider/start', async (req, res) => {
    const provider = providerSchema.parse(req.params.provider);
    const intent = intentSchema.parse(req.body.intent);
    // A flow cookie belongs to the browser origin where it was set. Catch address
    // mismatches before redirecting, rather than returning a mysterious state error.
    if (req.get('origin') && req.get('origin') !== publicOrigin())
      throw new AuthError(
        `Open Surplus at ${publicOrigin()} before using this sign-in method.`,
        400,
      );
    if (!providers.methods().providers.find((p) => p.id === provider)?.available)
      throw new AuthError('This sign-in provider is not available yet. Use another method.', 503);
    if (intent === 'link') {
      await checkBinding(req);
      await auth.requireRecent(sessionToken(req));
    }
    for (const [id, flow] of flows) if (flow.expires < Date.now()) flows.delete(id);
    if (flows.size >= 100)
      throw new AuthError('Too many sign-in requests. Try again shortly.', 429);
    const binding = randomBytes(32).toString('hex');
    const flow: PendingFlow = {
      provider,
      intent,
      ownerToken: sessionToken(req),
      state: randomBytes(32).toString('base64url'),
      nonce: randomBytes(32).toString('base64url'),
      verifier: randomBytes(32).toString('base64url'),
      expires: Date.now() + 10 * 60_000,
    };
    let url: string;
    try {
      url = await providers.authorize(provider, flow);
    } catch {
      throw new AuthError('This sign-in provider could not be reached. Please try again.', 503);
    }
    const previous = cookieValue(req, 'surplus_oauth');
    if (previous) flows.delete(previous);
    flows.set(binding, flow);
    res.cookie('surplus_oauth', binding, {
      httpOnly: true,
      secure: secure(),
      sameSite: 'lax',
      path: '/api/auth/oauth',
      maxAge: 10 * 60_000,
    });
    res.json({ url });
  });
  router.get('/oauth/:provider/callback', async (req, res) => {
    const binding = cookieValue(req, 'surplus_oauth');
    const flow = binding ? flows.get(binding) : null;
    if (binding) flows.delete(binding);
    res.clearCookie('surplus_oauth', {
      httpOnly: true,
      secure: secure(),
      sameSite: 'lax',
      path: '/api/auth/oauth',
    });
    try {
      const provider = providerSchema.parse(req.params.provider);
      const params = req.query;
      if (
        !flow ||
        flow.provider !== provider ||
        flow.expires < Date.now() ||
        params.state !== flow.state
      )
        throw new Error('Invalid state');
      if (params.error)
        return res.redirect(
          303,
          `${publicOrigin()}/?auth_error=cancelled${flow.intent === 'link' ? '#settings' : ''}`,
        );
      const response = new URL(req.originalUrl, publicOrigin());
      const identity = await providers.exchange(provider, response, flow);
      const token = await auth.completeIdentity(identity, flow.intent, flow.ownerToken);
      setSessionCookie(req, res, token);
      return res.redirect(
        303,
        `${publicOrigin()}/${flow.intent === 'link' ? '?auth_connected=1#settings' : ''}`,
      );
    } catch (error) {
      const reason = error instanceof AuthError && error.status === 403 ? 'not_linked' : 'failed';
      return res.redirect(
        303,
        `${publicOrigin()}/?auth_error=${reason}${flow?.intent === 'link' ? '#settings' : ''}`,
      );
    }
  });
  return router;
}
