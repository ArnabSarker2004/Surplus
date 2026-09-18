import 'dotenv/config';
import { resolve } from 'node:path';
import { createApp } from './app';
import { Store } from './infrastructure/sqlite-store';
import { encryptionKey } from './integrations/plaid';
import { postgresPool } from './infrastructure/postgres';
import { PostgresAuthService } from './services/postgres-auth-service';
import { AuthRepository } from './repositories/auth-repository';
import { PostgresWorkspace } from './repositories/postgres-workspace';
import { postgresWorkspaceRoutes } from './routes/postgres-workspace-routes';
const dataDir = resolve(process.env.SURPLUS_DATA_DIR || 'data');
const store = await Store.open(resolve(dataDir, 'surplus.sqlite'));
const key = encryptionKey(dataDir);
const pool = process.env.DATABASE_URL ? postgresPool() : undefined;
if (pool) {
  // Fail closed if configuration/schema is unavailable; never silently save to another database.
  try {
    await pool.query('SELECT 1 FROM surplus_auth.users LIMIT 0');
  } catch {
    await pool.end();
    throw new Error(
      'PostgreSQL is unavailable or migrations are missing. Run npm run db:check and npm run db:migrate.',
    );
  }
}
const app = createApp(
  store,
  key,
  {},
  pool
    ? {
        auth: new PostgresAuthService(pool, new AuthRepository(store).signingKey()),
        routes: postgresWorkspaceRoutes(new PostgresWorkspace(pool), key),
      }
    : undefined,
);
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '127.0.0.1', () => {
  console.info(`Surplus API ready at http://127.0.0.1:${port}`);
  console.info(
    `Persistence: ${pool ? 'PostgreSQL, separate accounts' : 'local SQLite, one owner'}`,
  );
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    server.close(() => {
      void (async () => {
        await pool?.end();
        store.close();
        process.exit(0);
      })();
    });
  });
