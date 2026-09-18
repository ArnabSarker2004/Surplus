import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { decrypt, PlaidError, plaidRequest } from '../backend/src/integrations/plaid';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { PlaidService } from '../backend/src/services/plaid-service';

// Uses a separate in-memory repository; never changes the user's saved workspace.
async function verify(kind: 'import' | 'student') {
  const store = await Store.open();
  const key = randomBytes(32);
  const repository = new WorkspaceRepository(store);
  repository.seedDemo();
  const service = new PlaidService(repository, key);
  let createdToken: string | null = null;
  try {
    await service.addConnection(kind);
    if (kind === 'student') createdToken = decrypt(service.item()!.encryptedToken, key);
    for (let attempt = 0; attempt < 4; attempt++) {
      await service.sync();
      if (repository.state().transactions.length) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const state = repository.state();
    assert.ok(state.accounts.length > 0, 'Expected Sandbox accounts.');
    assert.ok(
      state.transactions.length > 0,
      'History is still preparing; retry verification later.',
    );
    assert.equal(new Set(state.transactions.map((t) => t.id)).size, state.transactions.length);
    const priorCount = state.transactions.length;
    await service.sync();
    if (kind === 'student') {
      assert.ok(state.accounts.every((a) => a.currency === 'CAD'));
      assert.ok(state.transactions.every((t) => t.currency === 'CAD'));
      assert.equal(repository.state().transactions.length, priorCount);
    }
    const linkToken = await service.linkToken();
    assert.ok(linkToken.startsWith('link-sandbox-'));
    console.info(
      JSON.stringify({
        fixture: kind,
        accounts: state.accounts.length,
        transactions: priorCount,
        currencies: [...new Set(state.accounts.map((a) => a.currency))],
        duplicateTransactions: false,
        linkTokenCreated: true,
        repeatedSyncPassed: true,
      }),
    );
  } finally {
    // Revoke only the new fixture created by this verification, never the supplied item.
    if (createdToken) await plaidRequest('/item/remove', { access_token: createdToken });
    store.close();
  }
}
try {
  if (process.env.PLAID_SANDBOX_ACCESS_TOKEN) await verify('import');
  await verify('student');
} catch (error) {
  console.error(
    error instanceof PlaidError
      ? `Sandbox verification failed: ${error.code}`
      : 'Sandbox verification failed. Check configuration or retry after history is prepared.',
  );
  process.exitCode = 1;
}
