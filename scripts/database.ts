import 'dotenv/config';
import { postgresPool } from '../backend/src/infrastructure/postgres';
import { migrate } from '../backend/src/infrastructure/migrations';

let pool: ReturnType<typeof postgresPool> | undefined;
try {
  pool = postgresPool();
  await pool.query('SELECT 1');
  console.info('PostgreSQL connection verified.');
  if (process.argv.includes('--migrate')) console.info({ applied: await migrate(pool) });
  const tables = await pool.query(
    "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('surplus','surplus_auth') ORDER BY 1,2",
  );
  console.info({ applicationTables: tables.rows });
} catch (error) {
  const code = (error as { code?: string }).code;
  console.error(
    `Database operation failed (${code || 'CONFIGURATION_OR_MIGRATION_ERROR'}). Credentials and database details have been withheld.`,
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
