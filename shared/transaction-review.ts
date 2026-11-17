import { z } from 'zod';
import { categorySchema, type Transaction } from './schema';
import { classify } from './finance/categorization';

export const reviewFields = {
  depositPurpose: z
    .enum([
      'salary',
      'personal',
      'education',
      'loan',
      'osap',
      'resp',
      'grant',
      'scholarship',
      'refund',
      'transfer',
      'unknown',
    ])
    .optional(),
  forecastTreatment: z.enum(['automatic', 'one_off', 'reimbursement']).optional(),
  splits: z
    .array(
      z
        .object({
          category: categorySchema,
          amount: z.number().finite().positive().max(10_000_000),
        })
        .strict(),
    )
    .max(8)
    .optional(),
};
export const splitsMatch = (t: Pick<Transaction, 'cashFlow' | 'splits'>) =>
  !t.splits?.length ||
  (t.splits.length >= 2 &&
    Math.abs(
      t.splits.reduce((s, p) => s + Math.round(p.amount * 100), 0) -
        Math.round(Math.abs(t.cashFlow) * 100),
    ) === 0);

/** Virtual allocations sum to the immutable bank amount; the original bank record is never split in storage. */
export function analysisTransactions(rows: Transaction[]): Transaction[] {
  return rows.flatMap((t) =>
    t.splits?.length && splitsMatch(t)
      ? Array.from(
          t.splits.reduce(
            (parts, p) =>
              parts.set(p.category, (parts.get(p.category) || 0) + Math.round(p.amount * 100)),
            new Map<Transaction['category'], number>(),
          ),
        )
          .map(([category, cents]) => ({ category, amount: cents / 100 }))
          .map((p, i) => ({
            ...t,
            bankTransactionId: t.id,
            id: `${t.id}:part:${i}`,
            cashFlow: Math.sign(t.cashFlow) * p.amount,
            rawAmount: -Math.sign(t.cashFlow) * p.amount,
            category: p.category,
            classification: classify(p.category, t.cashFlow),
            detailCategory: null,
            detailCategoryCorrected: true,
            splits: [],
            categoryOrigin: 'user' as const,
          }))
      : [t],
  );
}
export function reviewReasons(t: Transaction) {
  if (t.pending || t.currency !== 'CAD' || t.cashFlow === 0) return [];
  const splitChanged = !!t.splits?.length && !splitsMatch(t);
  const categoryUnresolved =
    t.classification === 'Review' &&
    !t.userCorrected &&
    !['user', 'rule'].includes(t.categoryOrigin || '') &&
    (!t.forecastTreatment || t.forecastTreatment === 'automatic') &&
    !t.splits?.length;
  return [
    ...(splitChanged ? ['Update split amounts'] : []),
    ...(categoryUnresolved
      ? [t.cashFlow > 0 ? 'Identify this deposit' : 'Choose a spending category']
      : []),
  ];
}

/** Only unresolved decisions on transactions used by the forecast belong in its review queue. */
export function reviewQueue(rows: Transaction[], asOf?: string) {
  const start = asOf
    ? new Date(Date.parse(asOf) - 730 * 86400000).toISOString().slice(0, 10)
    : null;
  return rows
    .filter((t) => (!asOf || (t.date <= asOf && t.date >= start!)) && reviewReasons(t).length)
    .sort((a, b) => Math.abs(b.cashFlow) - Math.abs(a.cashFlow) || b.date.localeCompare(a.date));
}
