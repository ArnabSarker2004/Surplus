import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

/** Database credentials and raw driver errors must never enter API responses or logs. */
export function postgresPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.password ||
    url.password.includes('YOUR-PASSWORD')
  )
    throw new Error('Complete the PostgreSQL connection string and password in .env.');
  // URL SSL options override pg's SSL object, so explicitly enforce verification here.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'])
    url.searchParams.delete(key);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const certificate =
    process.env.DATABASE_CA_FILE ||
    (url.hostname.endsWith('.supabase.com') || url.hostname.endsWith('.supabase.co')
      ? resolve('backend/certificates/supabase-ca.crt')
      : undefined);
  const pool = new pg.Pool({
    connectionString: url.href,
    max: 5,
    connectionTimeoutMillis: 12_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(certificate ? { ca: readFileSync(certificate, 'utf8') } : {}),
        },
  });
  pool.on('error', () => console.error('An idle database connection ended. It will be replaced.'));
  return pool;
}

export async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  let broken: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      broken = new Error('Database transaction could not be rolled back.');
    }
    throw error;
  } finally {
    // Never return a connection with uncertain transaction/role state to the pool.
    client.release(broken);
  }
}
