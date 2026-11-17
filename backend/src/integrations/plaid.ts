import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalize, type PlaidTransaction } from '../../../shared/finance';
import type { Account, MerchantRule, Transaction } from '../../../shared/schema';

export type PlaidEnvironment = 'sandbox' | 'production';
export const bankSource = (environment: PlaidEnvironment) =>
  environment === 'production' ? ('live' as const) : ('sandbox' as const);

export class PlaidError extends Error {
  constructor(public code: string) {
    super('The bank request could not be completed.');
  }
}
export interface PlaidItem {
  environment?: PlaidEnvironment;
  id: string;
  encryptedToken: string;
  cursor: string;
  transactionMetadataVersion?: number;
  lastRefreshRequestedAt?: string;
  lastAutoAttemptAt?: string;
  syncedAt: string | null;
  status: 'connected' | 'ready' | 'error';
  error: string | null;
}
export function encryptionKey(dataDir: string) {
  const configured = process.env.TOKEN_ENCRYPTION_KEY;
  if (configured) {
    if (!/^[a-f0-9]{64}$/i.test(configured))
      throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters.');
    return Buffer.from(configured, 'hex');
  }
  mkdirSync(dataDir, { recursive: true });
  const path = resolve(dataDir, '.token-key');
  if (!existsSync(path)) writeFileSync(path, randomBytes(32), { mode: 0o600 });
  const key = readFileSync(path);
  if (key.length !== 32) throw new Error('Local encryption key has an invalid size.');
  return key;
}
export function encrypt(token: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString('base64');
}
export function decrypt(value: string, key: Buffer) {
  const b = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString('utf8');
}
export function configured(environment: PlaidEnvironment = 'sandbox') {
  return Boolean(
    process.env.PLAID_CLIENT_ID &&
    process.env[environment === 'production' ? 'PLAID_PRODUCTION_SECRET' : 'PLAID_SANDBOX_SECRET'],
  );
}
export async function plaidRequest<T>(
  path: string,
  payload: Record<string, unknown>,
  environment: PlaidEnvironment = 'sandbox',
): Promise<T> {
  if (!configured(environment)) throw new PlaidError('NOT_CONFIGURED');
  try {
    const res = await fetch(`https://${environment}.plaid.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret:
          process.env[
            environment === 'production' ? 'PLAID_PRODUCTION_SECRET' : 'PLAID_SANDBOX_SECRET'
          ],
        ...payload,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json()) as T & { error_code?: string };
    if (!res.ok) throw new PlaidError(data.error_code || 'SANDBOX_ERROR');
    return data;
  } catch (error) {
    if (error instanceof PlaidError) throw error;
    throw new PlaidError('CONNECTION_ERROR');
  }
}
export interface SyncPage {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
  transactions_update_status?: string;
}
export async function collectSync(cursor: string, request: (cursor: string) => Promise<SyncPage>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let next = cursor;
    const pages: SyncPage[] = [];
    try {
      for (let i = 0; i < 200; i++) {
        const page = await request(next);
        pages.push(page);
        if (page.has_more && page.next_cursor === next) throw new PlaidError('INVALID_CURSOR');
        next = page.next_cursor;
        if (!page.has_more) return { pages, cursor: next };
      }
      throw new PlaidError('TOO_MANY_PAGES');
    } catch (e) {
      if (
        e instanceof PlaidError &&
        e.code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' &&
        attempt < 2
      )
        continue;
      throw e;
    }
  }
  throw new PlaidError('SYNC_RETRY_LIMIT');
}
export function applySync(
  existing: Transaction[],
  pages: SyncPage[],
  rules: MerchantRule[],
  source: Transaction['source'] = 'sandbox',
) {
  const items = new Map(existing.map((t) => [t.id, t]));
  const original = new Map(existing.filter((t) => t.source === source).map((t) => [t.id, t]));
  for (const page of pages) {
    for (const t of [...page.added, ...page.modified]) {
      const previous =
        items.get(t.transaction_id) ??
        (t.pending_transaction_id
          ? (items.get(t.pending_transaction_id) ?? original.get(t.pending_transaction_id))
          : undefined);
      if (t.pending_transaction_id) items.delete(t.pending_transaction_id);
      items.set(t.transaction_id, normalize(t, rules, previous, source));
    }
    for (const t of page.removed) items.delete(t.transaction_id);
  }
  return [...items.values()].sort((a, b) => b.date.localeCompare(a.date));
}
interface RawAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string | null;
  balances: { current: number | null; available?: number | null; iso_currency_code: string | null };
}
export async function plaidAccounts(
  token: string,
  environment: PlaidEnvironment = 'sandbox',
  fresh = false,
): Promise<Account[]> {
  const response = await plaidRequest<{ accounts: RawAccount[] }>(
    fresh ? '/accounts/balance/get' : '/accounts/get',
    {
      access_token: token,
    },
    environment,
  );
  return response.accounts.map((a) => ({
    id: a.account_id,
    name: a.name,
    type: ['depository', 'credit', 'investment', 'loan'].includes(a.type)
      ? (a.type as Account['type'])
      : 'other',
    subtype: a.subtype ?? '',
    balance: a.balances.current ?? 0,
    balanceKnown: a.balances.current !== null,
    available: a.balances.available ?? null,
    balanceObservedAt: new Date().toISOString(),
    currency: a.balances.iso_currency_code ?? 'UNKNOWN',
    source: bankSource(environment),
  }));
}
