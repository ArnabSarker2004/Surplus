import { categories, type MerchantRule, type Transaction } from '../schema';
import { categorize, classify } from './categorization';
import { round, sum } from './money';
import { analysisTransactions } from '../transaction-review';
import { applyAutomaticCleanup } from '../transaction-cleanup';
import { detectStudentFunding } from '../student-funding';
import {
  categoryFromPlaid,
  merchantRuleKeys,
  resolveMerchant,
  type MerchantFields,
} from '../merchants';

export interface PlaidTransaction extends MerchantFields {
  transaction_id: string;
  account_id: string;
  date: string;
  authorized_date?: string | null;
  authorized_datetime?: string | null;
  location?: { city?: string | null; region?: string | null; country?: string | null } | null;
  payment_channel?: string | null;
  merchant_name?: string | null;
  name: string;
  original_description?: string | null;
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
  const description = t.original_description?.trim() || t.name;
  const company = resolveMerchant(t);
  const matchKeys = merchantRuleKeys({ merchant, merchantDetails: company, description: t.name });
  const rule = rules.find(
    (r) =>
      r.source === source &&
      matchKeys.length > 0 &&
      (r.merchantKey
        ? matchKeys.includes(r.merchantKey)
        : r.merchant.toLowerCase() === merchant.toLowerCase()),
  );
  const cashFlow = round(-t.amount);
  // Plaid can omit authorization metadata once a pending purchase posts. Reuse
  // only a bank-supplied timestamp from the same transaction or linked pending ID.
  const samePurchase =
    previous?.source === source &&
    previous.accountId === t.account_id &&
    (previous.id === t.transaction_id || previous.id === t.pending_transaction_id);
  const priorAuthorization = samePurchase ? previous : undefined;
  const fundingCounterparty =
    (t.counterparties || [])
      .slice(0, 12)
      .map((p) => p.name?.slice(0, 250))
      .find(
        (name) =>
          name &&
          detectStudentFunding({
            merchant: '',
            description: '',
            cashFlow,
            currency: t.iso_currency_code || 'UNKNOWN',
            fundingCounterparty: name,
          }),
      ) ??
    priorAuthorization?.fundingCounterparty ??
    null;
  const authorizedAt = t.authorized_datetime ?? priorAuthorization?.authorizedAt;
  const pfc = t.personal_finance_category;
  const category = previous?.userCorrected
    ? previous.category
    : (rule?.category ??
      categorize(
        company.name || merchant,
        pfc?.primary ?? '',
        pfc?.detailed ?? '',
        pfc?.confidence_level ?? '',
        [],
        source,
        cashFlow,
        t.iso_currency_code || 'UNKNOWN',
        description,
      ));
  return applyAutomaticCleanup({
    id: t.transaction_id,
    accountId: t.account_id,
    date: t.date,
    authorizedDate: t.authorized_date ?? priorAuthorization?.authorizedDate ?? null,
    authorizedAt:
      typeof authorizedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(authorizedAt) &&
      Number.isFinite(Date.parse(authorizedAt))
        ? authorizedAt
        : null,
    location: t.location
      ? {
          city: t.location.city?.slice(0, 100) || null,
          region: t.location.region?.slice(0, 100) || null,
          country: t.location.country?.slice(0, 100) || null,
        }
      : null,
    paymentChannel: ['online', 'in store', 'other'].includes(t.payment_channel || '')
      ? (t.payment_channel as 'online' | 'in store' | 'other')
      : null,
    merchant,
    fundingCounterparty,
    merchantDetails: company,
    merchantOverride: previous?.merchantCorrected
      ? previous.merchantOverride
      : (rule?.merchantOverride ?? null),
    merchantCorrected: previous?.merchantCorrected ?? false,
    categoryOrigin: previous?.userCorrected
      ? 'user'
      : rule
        ? 'rule'
        : category === 'Other'
          ? 'review'
          : ['HIGH', 'VERY_HIGH'].includes(pfc?.confidence_level || '') &&
              categoryFromPlaid(pfc?.primary || '', pfc?.detailed || '') === category
            ? 'plaid'
            : 'merchant',
    detailCategory: previous?.detailCategoryCorrected
      ? previous.detailCategory
      : (rule?.detailCategory ?? null),
    detailCategoryCorrected:
      previous?.detailCategoryCorrected || rule?.detailCategory !== undefined,
    description,
    enrichment: previous?.description === description ? previous.enrichment : undefined,
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
    forecastTreatment: previous?.forecastTreatment ?? 'automatic',
    splits: previous?.splits ?? [],
    source,
    depositPurpose: previous?.depositPurpose,
  });
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
        posted(analysisTransactions(transactions))
          .filter(
            (t) => t.category === category && !['Income', 'Transfer'].includes(t.classification),
          )
          .map((t) => t.cashFlow),
      ),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
