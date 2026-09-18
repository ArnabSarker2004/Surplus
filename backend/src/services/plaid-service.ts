import {
  applySync,
  bankSource,
  type PlaidEnvironment,
  collectSync,
  configured,
  decrypt,
  encrypt,
  plaidAccounts,
  PlaidError,
  plaidRequest,
  type PlaidItem,
  type SyncPage,
} from '../integrations/plaid';
import { studentSandboxConfig } from '../integrations/student-sandbox';
import type { WorkspaceRepository } from '../repositories/workspace-repository';

/** Owns connection lifecycle and the all-pages-or-nothing sync boundary. */
export class PlaidService {
  private working = false;
  constructor(
    private repository: WorkspaceRepository,
    private key: Buffer,
    private userId?: string,
  ) {}
  get busy() {
    return this.working;
  }
  item() {
    return this.repository.store.get<PlaidItem | null>('plaid', null);
  }
  status() {
    const p = this.item();
    return {
      configured: configured(),
      productionConfigured: configured('production'),
      environment: p?.environment ?? 'sandbox',
      source: bankSource(p?.environment ?? 'sandbox'),
      accounts: this.repository
        .accounts()
        .filter((a) => a.source === bankSource(p?.environment ?? 'sandbox')),
      canImport: !this.userId && Boolean(process.env.PLAID_SANDBOX_ACCESS_TOKEN),
      connected: Boolean(p),
      status: this.working ? 'syncing' : (p?.status ?? 'disconnected'),
      syncedAt: p?.syncedAt ?? null,
      error: p?.error ?? null,
    };
  }
  async linkToken(environment: PlaidEnvironment = 'sandbox', update = false) {
    const item = this.item();
    if (update && !item) throw new PlaidError('NOT_CONNECTED');
    if (!update && item) throw new PlaidError('ALREADY_CONNECTED');
    if (update) environment = item!.environment ?? 'sandbox';
    const result = await plaidRequest<{ link_token: string }>(
      '/link/token/create',
      {
        user: { client_user_id: this.userId || 'surplus-local-student' },
        client_name: 'Surplus',
        ...(update
          ? { access_token: decrypt(item!.encryptedToken, this.key) }
          : { products: ['transactions'], transactions: { days_requested: 365 } }),
        country_codes: ['CA'],
        language: 'en',
      },
      environment,
    );
    return result.link_token;
  }
  private async connect(
    accessToken: string,
    id: string,
    environment: PlaidEnvironment = 'sandbox',
  ) {
    const source = bankSource(environment);
    // Persist the exchanged token before fetching accounts so transient bank failures
    // can be retried with Sync without consuming another Trial Item.
    const accounts = environment === 'sandbox' ? await plaidAccounts(accessToken, environment) : [];
    const { store } = this.repository;
    store.transaction(() => {
      store.set('plaid', {
        id,
        environment,
        encryptedToken: encrypt(accessToken, this.key),
        cursor: '',
        syncedAt: null,
        status: 'connected',
        error: null,
      } satisfies PlaidItem);
      store.set('accounts', [
        ...this.repository.accounts().filter((a) => a.source !== source),
        ...accounts,
      ]);
      store.set(
        'transactions',
        this.repository.transactions().filter((t) => t.source !== source),
      );
      const w = this.repository.workspace();
      if (w) store.set('workspace', { ...w, source });
    });
  }
  async addConnection(kind: 'exchange' | 'import' | 'dynamic' | 'student', publicToken?: string) {
    if (this.busy) throw new PlaidError('BUSY');
    if (this.item()) throw new PlaidError('ALREADY_CONNECTED');
    this.working = true;
    try {
      if (kind === 'import') {
        if (this.userId) throw new PlaidError('MISSING_ACCESS_TOKEN');
        const token = process.env.PLAID_SANDBOX_ACCESS_TOKEN;
        if (!token?.startsWith('access-sandbox-')) throw new PlaidError('MISSING_ACCESS_TOKEN');
        await this.connect(token, 'imported-sandbox');
        return;
      }
      if (kind === 'dynamic' || kind === 'student') {
        const result = await plaidRequest<{ public_token: string }>(
          '/sandbox/public_token/create',
          {
            institution_id: 'ins_109508',
            initial_products: ['transactions'],
            options: {
              override_username: kind === 'student' ? 'user_custom' : 'user_transactions_dynamic',
              override_password:
                kind === 'student' ? JSON.stringify(studentSandboxConfig()) : 'pass_good',
            },
          },
        );
        publicToken = result.public_token;
      }
      const environment: PlaidEnvironment = publicToken?.startsWith('public-production-')
        ? 'production'
        : 'sandbox';
      const exchanged = await plaidRequest<{ access_token: string; item_id: string }>(
        '/item/public_token/exchange',
        { public_token: publicToken },
        environment,
      );
      await this.connect(exchanged.access_token, exchanged.item_id, environment);
    } finally {
      this.working = false;
    }
  }
  async sync() {
    const p = this.item();
    if (!p) throw new PlaidError('NOT_CONNECTED');
    if (this.busy) throw new PlaidError('BUSY');
    this.working = true;
    const environment = p.environment ?? 'sandbox';
    const source = bankSource(environment);
    try {
      const token = decrypt(p.encryptedToken, this.key);
      const data = await collectSync(p.cursor, (cursor) =>
        plaidRequest<SyncPage>(
          '/transactions/sync',
          { access_token: token, cursor, count: 100 },
          environment,
        ),
      );
      const accounts = await plaidAccounts(token, environment);
      const { store } = this.repository;
      store.transaction(() => {
        store.set('transactions', [
          ...this.repository.transactions().filter((t) => t.source !== source),
          ...applySync(
            this.repository.transactions().filter((t) => t.source === source),
            data.pages,
            this.repository.rules(),
            source,
          ),
        ]);
        store.set('accounts', [
          ...this.repository.accounts().filter((a) => a.source !== source),
          ...accounts,
        ]);
        store.set('plaid', {
          ...p,
          cursor: data.cursor,
          syncedAt: new Date().toISOString(),
          status: 'ready',
          error: null,
        });
      });
    } catch (error) {
      this.repository.store.transaction(() =>
        this.repository.store.set('plaid', {
          ...p,
          status: 'error',
          error:
            error instanceof PlaidError && error.code === 'ITEM_LOGIN_REQUIRED'
              ? 'Reconnect this bank account.'
              : 'Sync could not complete. Your previous data has been kept.',
        }),
      );
      throw error;
    } finally {
      this.working = false;
    }
  }
  async disconnect() {
    if (this.busy) throw new PlaidError('BUSY');
    this.working = true;
    try {
      const item = this.item();
      const source = bankSource(item?.environment ?? 'sandbox');
      if (item?.environment === 'production') {
        try {
          await plaidRequest(
            '/item/remove',
            { access_token: decrypt(item.encryptedToken, this.key) },
            'production',
          );
        } catch (e) {
          if (!(e instanceof PlaidError && e.code === 'INVALID_ACCESS_TOKEN')) throw e;
        }
      }
      const { store } = this.repository;
      store.transaction(() => {
        store.set('plaid', null);
        store.set(
          'transactions',
          this.repository.transactions().filter((t) => t.source !== source),
        );
        store.set(
          'accounts',
          this.repository.accounts().filter((a) => a.source !== source),
        );
        store.set(
          'rules',
          this.repository.rules().filter((r) => r.source !== source),
        );
        const w = this.repository.workspace();
        if (w?.source === source) store.set('workspace', { ...w, source: 'manual' });
      });
    } finally {
      this.working = false;
    }
  }
}
