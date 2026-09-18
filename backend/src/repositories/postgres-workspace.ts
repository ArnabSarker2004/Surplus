import type pg from 'pg';
import type { Workspace, Account, Transaction, MerchantRule } from '../../../shared/schema';
import { transaction } from '../infrastructure/postgres';
import { MemoryDocuments } from '../infrastructure/document-store';
import { WorkspaceRepository } from './workspace-repository';

const arrays = {
  funding: 'funding',
  expenses: 'planned_expenses',
  goals: 'savings_goals',
  budgets: 'budgets',
} as const;
const maps = { applications: 'applications', resourceProgress: 'resource_progress' } as const;
const children = [
  'transactions',
  'bank_accounts',
  'plaid_connections',
  'merchant_rules',
  ...Object.values(arrays),
  ...Object.values(maps),
] as const;

/** One transaction and row lock per user's operation. RLS uses server-verified identity only. */
export class PostgresWorkspace {
  constructor(private pool: pg.Pool) {}
  async run<T>(userId: string, work: (repository: WorkspaceRepository) => Promise<T> | T) {
    return transaction(this.pool, (client) => this.withClient(client, userId, work));
  }
  /** Caller must already own a database transaction. Used for atomic local-data imports. */
  async withClient<T>(
    client: pg.PoolClient,
    userId: string,
    work: (repository: WorkspaceRepository) => Promise<T> | T,
  ) {
    await client.query('SET LOCAL ROLE surplus_runtime');
    await client.query("SELECT set_config('surplus.user_id',$1,true)", [userId]);
    const found = await client.query(
      'SELECT payload FROM surplus.workspaces WHERE user_id=$1 FOR UPDATE',
      [userId],
    );
    if (!found.rowCount) throw new Error('Workspace account does not exist.');
    const store = await this.load(client, userId, found.rows[0].payload);
    const result = await work(new WorkspaceRepository(store));
    if (store.dirty) await this.save(client, userId, store);
    return result;
  }
  private async load(client: pg.PoolClient, userId: string, metadata: Workspace | null) {
    const workspace = metadata ? { ...metadata } : null;
    const initial: Record<string, unknown> = { workspace };
    // All table names below are static application constants, never request input.
    for (const [field, table] of Object.entries(arrays)) {
      const rows = await client.query(
        `SELECT payload FROM surplus.${table} WHERE user_id=$1 ORDER BY position`,
        [userId],
      );
      if (workspace) Object.assign(workspace, { [field]: rows.rows.map((r) => r.payload) });
    }
    for (const [field, table] of Object.entries(maps)) {
      const rows = await client.query(
        `SELECT id,payload FROM surplus.${table} WHERE user_id=$1 ORDER BY position`,
        [userId],
      );
      if (workspace)
        Object.assign(workspace, {
          [field]: Object.fromEntries(rows.rows.map((r) => [r.id, r.payload])),
        });
    }
    for (const [key, table] of [
      ['accounts', 'bank_accounts'],
      ['transactions', 'transactions'],
      ['rules', 'merchant_rules'],
    ] as const) {
      const rows = await client.query(
        `SELECT payload FROM surplus.${table} WHERE user_id=$1 ORDER BY id`,
        [userId],
      );
      initial[key] = rows.rows.map((r) => r.payload);
    }
    const plaid = await client.query(
      'SELECT payload FROM surplus.plaid_connections WHERE user_id=$1',
      [userId],
    );
    initial.plaid = plaid.rows[0]?.payload || null;
    const history = await client.query('SELECT payload FROM surplus.forecast_history WHERE user_id=$1', [userId]);
    initial.forecastHistory = history.rows[0]?.payload || {};
    return new MemoryDocuments(initial);
  }
  private async save(client: pg.PoolClient, userId: string, store: MemoryDocuments) {
    if (store.changedKeys.has('forecastHistory')) {
      const history = store.get<Record<string, unknown>>('forecastHistory', {});
      if (Object.keys(history).length) await client.query('INSERT INTO surplus.forecast_history(user_id,payload) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()', [userId, history]);
      else await client.query('DELETE FROM surplus.forecast_history WHERE user_id=$1', [userId]);
      // Recording a forecast never rewrites financial transactions or balances.
      if (store.changedKeys.size === 1) return;
    }
    const workspace = store.get<Workspace | null>('workspace', null);
    const metadata: Record<string, unknown> | null = workspace ? { ...workspace } : null;
    if (metadata)
      for (const key of [...Object.keys(arrays), ...Object.keys(maps)]) delete metadata[key];
    // The parent remains to preserve its serialization lock, even when deleting all user data.
    for (const table of children)
      await client.query(`DELETE FROM surplus.${table} WHERE user_id=$1`, [userId]);
    await client.query(
      'UPDATE surplus.workspaces SET payload=$2,updated_at=now() WHERE user_id=$1',
      [userId, metadata],
    );
    const insert = async (table: string, values: { id: string; payload: unknown }[]) => {
      if (values.length)
        await client.query(
          `INSERT INTO surplus.${table}(user_id,id,position,payload)
        SELECT $1,value->>'id',ordinality::int,value->'payload' FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY`,
          [userId, JSON.stringify(values)],
        );
    };
    if (workspace) {
      for (const [key, table] of Object.entries(arrays))
        await insert(
          table,
          workspace[key as keyof typeof arrays].map((payload) => ({ id: payload.id, payload })),
        );
      for (const [key, table] of Object.entries(maps))
        await insert(
          table,
          Object.entries(workspace[key as keyof typeof maps]).map(([id, payload]) => ({
            id,
            payload,
          })),
        );
    }
    await insert(
      'merchant_rules',
      store
        .get<MerchantRule[]>('rules', [])
        .map((payload) => ({ id: JSON.stringify([payload.source, payload.merchant]), payload })),
    );
    const accounts = store.get<Account[]>('accounts', []);
    if (accounts.length)
      await client.query(
        `INSERT INTO surplus.bank_accounts(user_id,id,payload)
      SELECT $1,value->>'id',value FROM jsonb_array_elements($2::jsonb)`,
        [userId, JSON.stringify(accounts)],
      );
    const transactions = store.get<Transaction[]>('transactions', []);
    if (transactions.length)
      await client.query(
        `INSERT INTO surplus.transactions(user_id,id,account_id,payload)
      SELECT $1,value->>'id',value->>'accountId',value FROM jsonb_array_elements($2::jsonb)`,
        [userId, JSON.stringify(transactions)],
      );
    const plaid = store.get<unknown>('plaid', null);
    if (plaid)
      await client.query('INSERT INTO surplus.plaid_connections(user_id,payload) VALUES($1,$2)', [
        userId,
        plaid,
      ]);
  }
}
