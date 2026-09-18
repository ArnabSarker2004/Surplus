import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { postgresPool } from '../backend/src/infrastructure/postgres';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { importLocalWorkspace } from '../backend/src/services/local-workspace-import';
import { encryptionKey, decrypt, type PlaidItem } from '../backend/src/integrations/plaid';

const username = process.argv[process.argv.indexOf('--username') + 1];
if (!process.argv.includes('--username') || !username || !/^[a-z0-9_.-]{3,64}$/.test(username)) {
  console.error('Usage: npm run db:import-local -- --username YOUR_EXISTING_ACCOUNT');
  process.exitCode = 1;
} else {
  let pool: ReturnType<typeof postgresPool> | undefined;
  let store: Store | undefined;
  try {
    const directory = resolve(process.env.SURPLUS_DATA_DIR || 'data');
    const file = resolve(directory, 'surplus.sqlite');
    if (!existsSync(file)) throw new Error('The local database does not exist.');
    store = await Store.open(file);
    const item = store.get<PlaidItem | null>('plaid', null);
    if (item) decrypt(item.encryptedToken, encryptionKey(directory));
    pool = postgresPool();
    await importLocalWorkspace(pool, store, username);
    console.info(
      'Local workspace imported to the selected account. The original SQLite file and encryption key were preserved.',
    );
  } catch (error) {
    const safe = [
      'The local database does not exist.',
      'The local workspace has no data to import.',
      'Create the destination account in the app first.',
      'This local workspace has already been imported.',
      'The destination already has data. Import requires an empty workspace.',
    ];
    console.error(
      error instanceof Error && safe.includes(error.message)
        ? error.message
        : 'Import failed; the database transaction was rolled back and local data was preserved. Check connection settings and encryption key.',
    );
    process.exitCode = 1;
  } finally {
    store?.close();
    await pool?.end();
  }
}
