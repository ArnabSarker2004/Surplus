import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Store } from './infrastructure/sqlite-store';
import { errorHandler } from './middleware/error-handler';
import { localSecurity } from './middleware/local-security';
import { WorkspaceRepository } from './repositories/workspace-repository';
import { ResourceRepository } from './repositories/resource-repository';
import { resourceRoutes } from './routes/resource-routes';
import { plaidRoutes } from './routes/plaid-routes';
import { transactionRoutes } from './routes/transaction-routes';
import { workspaceRoutes } from './routes/workspace-routes';
import { PlaidService } from './services/plaid-service';
import { TransactionService } from './services/transaction-service';
import { AuthRepository } from './repositories/auth-repository';
import { AuthService } from './services/auth-service';
import { authRoutes } from './routes/auth-routes';
import { requireSession } from './middleware/auth-session';
import { OpenIdProviders, type IdentityProviders } from './integrations/identity-providers';
import { SmtpAuthMailer, type AuthMailer } from './integrations/auth-mail';
import { EmailAuthService } from './services/email-auth-service';
import { identityRoutes } from './routes/identity-routes';
import type { AuthPort } from './services/auth-port';

/** Composition root: inject persistence, wire services, mount HTTP adapters. */
export function createApp(
  store: Store,
  key: Buffer,
  identity: { providers?: IdentityProviders; mailer?: AuthMailer } = {},
  cloud?: { auth: AuthPort; routes: express.Router },
) {
  const app = express();
  const repository = new WorkspaceRepository(store);
  const plaid = new PlaidService(repository, key);
  const transactions = new TransactionService(repository);
  const auth = cloud?.auth || new AuthService(new AuthRepository(store));
  app.disable('x-powered-by');
  if (process.env.AUTH_PUBLIC_ORIGIN?.startsWith('https:')) app.set('trust proxy', 'loopback');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.plaid.com'],
          connectSrc: ["'self'", 'https://*.plaid.com'],
          frameSrc: ['https://*.plaid.com'],
          imgSrc: ["'self'", 'data:', 'https://*.plaid.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(localSecurity, express.json({ limit: '512kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes(auth));
  app.use(
    '/api/auth',
    identityRoutes(
      auth,
      identity.providers || new OpenIdProviders(),
      new EmailAuthService(auth, identity.mailer || new SmtpAuthMailer()),
    ),
  );
  app.use('/api/resources', resourceRoutes(new ResourceRepository()));
  app.use('/api', requireSession(auth));
  if (cloud) app.use('/api', cloud.routes);
  else {
    app.use('/api', workspaceRoutes(repository, plaid));
    app.use('/api/transactions', transactionRoutes(transactions, repository));
    app.use('/api/plaid', plaidRoutes(plaid, repository));
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const dist = resolve('dist/frontend');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
