import { categories, type MerchantRule, type Transaction } from '../schema';
import { categorize, classify } from './categorization';
import { round, sum } from './money';

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  date: string;
  authorized_date?: string | null;
  merchant_name?: string | null;
  name: string;
  amount: number;
  iso_currency_code?: string | null;
  pending: boolean;
  personal_finance_category?: {
    primary: string;
    detailed: string;
    confidence_level?: string;
  } | null;
  pending_transaction_id?: string | null;
}
export function normalize(
  t: PlaidTransaction,
  rules: MerchantRule[] = [],
  previous?: Transaction,
  source: Transaction['source'] = 'sandbox',
): Transaction {
  const merchant = t.merchant_name || t.name;
  const cashFlow = round(-t.amount);
  const pfc = t.personal_finance_category;
  const category = previous?.userCorrected
    ? previous.category
    : categorize(
        merchant,
        pfc?.primary ?? '',
        pfc?.detailed ?? '',
        pfc?.confidence_level ?? '',
        rules,
        source,
      );
  const rule = rules.find(
    (r) => r.source === source && r.merchant.toLowerCase() === merchant.toLowerCase(),
  );
  return {
    id: t.transaction_id,
    accountId: t.account_id,
    date: t.date,
    authorizedDate: t.authorized_date ?? null,
    merchant,
    description: t.name,
    rawAmount: t.amount,
    cashFlow,
    currency: t.iso_currency_code || 'UNKNOWN',
    pending: t.pending,
    plaidPrimary: pfc?.primary ?? '',
    plaidDetailed: pfc?.detailed ?? '',
    confidence: pfc?.confidence_level ?? 'UNKNOWN',
    category,
    classification: previous?.userCorrected
      ? previous.classification
      : (rule?.classification ?? classify(category, cashFlow)),
    userCorrected: previous?.userCorrected ?? false,
    habitTreatment: previous?.habitTreatment ?? 'automatic',
    source,
  };
}
export const posted = (transactions: Transaction[]) =>
  transactions.filter((t) => !t.pending && t.currency === 'CAD');
export function totals(transactions: Transaction[]) {
  const included = posted(transactions).filter((t) => t.classification !== 'Transfer');
  const income = sum(included.filter((t) => t.classification === 'Income').map((t) => t.cashFlow));
  const spending =
    -sum(included.filter((t) => t.classification !== 'Income').map((t) => t.cashFlow)) || 0;
  return {
    income,
    spending,
    net: round(income - spending),
    savingsRate: income > 0 ? round(((income - spending) / income) * 100) : 0,
  };
}
export function categorySpending(transactions: Transaction[]) {
  return categories
    .map((category) => ({
      category,
      amount: -sum(
        posted(transactions)
          .filter(
            (t) => t.category === category && !['Income', 'Transfer'].includes(t.classification),
          )
          .map((t) => t.cashFlow),
      ),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
