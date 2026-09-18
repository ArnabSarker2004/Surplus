import { demoAccounts, demoTransactions } from '../../../shared/demo';

/** A compact CAD fixture, below Plaid's approximately 55 KB custom-user limit. */
export function studentSandboxConfig() {
  const transactions = demoTransactions()
    .filter((t) => !t.pending)
    .slice(0, 160);
  return {
    override_accounts: demoAccounts.map((a) => ({
      type: a.type,
      subtype: a.subtype,
      starting_balance: a.balance,
      currency: 'CAD',
      meta: { name: a.name, official_name: `Surplus sample ${a.name}` },
      transactions: transactions
        .filter((t) => t.accountId === a.id)
        .map((t) => ({
          date_transacted: t.date,
          date_posted: t.date,
          amount: t.rawAmount,
          description: t.description,
          currency: 'CAD',
        })),
    })),
  };
}
