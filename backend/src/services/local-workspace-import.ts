import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { DocumentStore } from '../infrastructure/document-store';
import { transaction } from '../infrastructure/postgres';
import { PostgresWorkspace } from '../repositories/postgres-workspace';

/** An operator explicitly selects the destination; registration never claims legacy data. */
export async function importLocalWorkspace(pool: pg.Pool, local: DocumentStore, username: string) {
  const keys = ['workspace', 'accounts', 'transactions', 'rules', 'plaid'] as const;
  const snapshot = Object.fromEntries(keys.map((key) => [key, local.get(key, null)]));
  if (!snapshot.workspace && !snapshot.plaid && !(snapshot.accounts as unknown[] | null)?.length)
    throw new Error('The local workspace has no data to import.');
  const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('surplus-local-import'))");
    const user = await client.query('SELECT id FROM surplus_auth.users WHERE username=$1', [
      username,
    ]);
    if (!user.rowCount) throw new Error('Create the destination account in the app first.');
    if (
      (await client.query('SELECT 1 FROM surplus_auth.imports WHERE fingerprint=$1', [fingerprint]))
        .rowCount
    )
      throw new Error('This local workspace has already been imported.');
    await new PostgresWorkspace(pool).withClient(client, user.rows[0].id, (repository) => {
      if (
        repository.workspace() ||
        repository.accounts().length ||
        repository.transactions().length ||
        repository.rules().length ||
        repository.store.get('plaid', null)
      )
        throw new Error('The destination already has data. Import requires an empty workspace.');
      for (const key of keys) if (snapshot[key] !== null) repository.store.set(key, snapshot[key]);
    });
    await client.query('RESET ROLE');
    await client.query('INSERT INTO surplus_auth.imports(fingerprint,user_id) VALUES($1,$2)', [
      fingerprint,
      user.rows[0].id,
    ]);
  });
}
