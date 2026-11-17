import type { Account, Transaction, Workspace } from '../schema';
import { asOf, round, sum } from './money';
import { applyAutomaticCleanup } from '../transaction-cleanup';
import { depositSource, fundingTypes, nonPersonalSource, type FundingType } from '../deposits';

export function accountDeposits(w: Workspace, account: Account, transactions: Transaction[]) {
  const observed = account.balanceObservedAt?.slice(0, 10);
  const cutoff = observed && observed < asOf(w) ? observed : asOf(w);
  const rows = [
    ...new Map(
      transactions
        .filter(
          (t) =>
            t.source === w.source &&
            t.accountId === account.id &&
            t.currency === 'CAD' &&
            !t.pending &&
            t.date <= cutoff,
        )
        .map((t) => [t.id, applyAutomaticCleanup(t)]),
    ).values(),
  ];
  return {
    rows,
    deposits: rows
      .filter((t) => t.cashFlow > 0)
      .map((t) => {
        const fundingType = nonPersonalSource(t);
        return {
          id: t.id,
          amount: t.cashFlow,
          name: t.description,
          date: t.date,
          transaction: t,
          fundingType,
          bucket: !fundingType
            ? ('own' as const)
            : depositSource(t) === 'loan'
              ? ('loans' as const)
              : ('education' as const),
        };
      }),
  };
}

/** Personal cash is current cash minus detected or individually flagged funding.
 * Legacy cash allocations do not override transaction flags or create an unassigned remainder. */
export function cashBreakdown(w: Workspace, accounts: Account[], transactions: Transaction[] = []) {
  const eligible = accounts.filter(
    (a) => a.source === w.source && a.type === 'depository' && a.currency === 'CAD',
  );
  const rows = eligible
    .filter((a) => a.balanceKnown !== false)
    .map((account) => {
      const data = accountDeposits(w, account, transactions);
      return {
        account,
        balance: round(Math.max(0, account.balance)),
        own: 0,
        loans: 0,
        education: 0,
        unassigned: 0,
        changed: false,
        reviewed: true,
        automatic: data.deposits.some((d) => d.fundingType && !d.transaction.userCorrected),
        deposits: data.deposits,
        fundingDeposits: data.deposits.filter((d) => d.fundingType !== null),
      };
    });
  // Keep the full deduction even when the original deposit was moved to another CAD account.
  for (const bucket of ['loans', 'education'] as const) {
    let overflow = 0;
    for (const row of rows) {
      const requested = sum(
        row.fundingDeposits.filter((d) => d.bucket === bucket).map((d) => d.amount),
      );
      row[bucket] = Math.min(round(row.balance - row.loans - row.education), requested);
      overflow = round(overflow + requested - row[bucket]);
    }
    for (const row of rows) {
      const extra = Math.min(overflow, round(row.balance - row.loans - row.education));
      row[bucket] = round(row[bucket] + extra);
      overflow = round(overflow - extra);
    }
  }
  for (const row of rows) row.own = round(row.balance - row.loans - row.education);
  const total = (key: 'balance' | 'own' | 'loans' | 'education') => sum(rows.map((r) => r[key]));
  const deposits = rows.flatMap((r) => r.fundingDeposits);
  const fundingTotals = Object.fromEntries(
    fundingTypes.map((type) => [
      type,
      sum(deposits.filter((d) => d.fundingType === type).map((d) => d.amount)),
    ]),
  ) as Record<FundingType, number>;
  const receivedFunding = {
    osap: fundingTotals.osap,
    resp: fundingTotals.resp,
    studentAid: fundingTotals.education,
    otherEducation: round(fundingTotals.grant + fundingTotals.scholarship),
    otherLoans: fundingTotals.loan,
    total: sum(deposits.map((d) => d.amount)),
  };
  const cash = total('balance');
  const protectedFunding = round(total('loans') + total('education'));
  return {
    rows,
    cash,
    own: total('own'),
    loans: total('loans'),
    education: total('education'),
    unassigned: 0,
    fundingTotals,
    receivedFunding,
    protectedFunding,
    afterFunding: round(cash - protectedFunding),
    overdraft: sum(rows.map((r) => Math.max(0, -r.account.balance))),
    unknownAccounts: eligible.filter((a) => a.balanceKnown === false).length,
    automatic: rows.some((r) => r.automatic),
    needsReview: false,
  };
}
