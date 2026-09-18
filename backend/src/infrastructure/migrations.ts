import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type pg from 'pg';
import { transaction } from './postgres';

export async function migrate(pool: pg.Pool) {
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('surplus-migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS surplus_migrations');
    await client.query('REVOKE ALL ON SCHEMA surplus_migrations FROM PUBLIC');
    await client.query(
      'CREATE TABLE IF NOT EXISTS surplus_migrations.versions (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied: string[] = [];
    const directory = resolve('backend/migrations');
    for (const name of readdirSync(directory)
      .filter((n) => /^\d+.*\.sql$/.test(n))
      .sort()) {
      const sql = readFileSync(resolve(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query(
        'SELECT checksum FROM surplus_migrations.versions WHERE name=$1',
        [name],
      );
      if (previous.rowCount) {
        if (previous.rows[0].checksum !== checksum)
          throw new Error('An applied migration has changed. Add a new migration instead.');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO surplus_migrations.versions(name,checksum) VALUES($1,$2)', [
        name,
        checksum,
      ]);
      applied.push(name);
    }
    return applied;
  });
}
