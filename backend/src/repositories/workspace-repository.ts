import { demoAccounts, demoTransactions, demoWorkspace, opportunities } from '../../../shared/demo';
import type {
  Account,
  AppState,
  MerchantRule,
  Transaction,
  Workspace,
} from '../../../shared/schema';
import type { DocumentStore } from '../infrastructure/document-store';

/** Persistence boundary. Services operate on domain objects, never SQL. */
export class WorkspaceRepository {
  constructor(public readonly store: DocumentStore) {}
  workspace() {
    const workspace = this.store.get<Workspace | null>('workspace', null);
    return workspace ? { ...workspace, resourceProgress: workspace.resourceProgress ?? {} } : null;
  }
  transactions() {
    return this.store.get<Transaction[]>('transactions', []);
  }
  accounts() {
    return this.store.get<Account[]>('accounts', []);
  }
  rules() {
    return this.store.get<MerchantRule[]>('rules', []);
  }
  state(): AppState {
    const workspace = this.workspace();
    const source = workspace?.source ?? 'manual';
    return {
      workspace,
      opportunities,
      transactions: this.transactions().filter((t) => t.source === source),
      accounts: this.accounts().filter((a) => a.source === source),
      rules: this.rules().filter((r) => r.source === source),
    };
  }
  save(workspace: Workspace) {
    this.store.transaction(() => this.store.set('workspace', workspace));
  }
  seedDemo() {
    this.store.transaction(() => {
      this.store.set('workspace', demoWorkspace());
      this.store.set('transactions', [
        ...this.transactions().filter((t) => t.source !== 'demo'),
        ...demoTransactions(),
      ]);
      this.store.set('accounts', [
        ...this.accounts().filter((a) => a.source !== 'demo'),
        ...demoAccounts,
      ]);
      this.store.set(
        'rules',
        this.rules().filter((r) => r.source !== 'demo'),
      );
    });
  }
  clear() {
    this.store.transaction(() => {
      for (const key of ['workspace', 'transactions', 'accounts', 'rules', 'plaid', 'forecastHistory'])
        this.store.remove(key);
    });
  }
  saveCategorization(transactions: Transaction[], rules: MerchantRule[]) {
    this.store.transaction(() => {
      this.store.set('transactions', transactions);
      this.store.set('rules', rules);
    });
  }
  setHabitTreatment(id: string, treatment: NonNullable<Transaction['habitTreatment']>) {
    const source = this.workspace()?.source;
    const rows = this.transactions();
    const match = rows.find((t) => t.id === id && t.source === source);
    if (!match) return false;
    this.store.transaction(() => this.store.set('transactions', rows.map((t) => t.id === id && t.source === source ? { ...t, habitTreatment: treatment } : t)));
    return true;
  }
}
