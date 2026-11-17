import { z } from 'zod';
import type { Category, Transaction } from './schema';
import taxonomy from './data/plaid-categories.json';
import { localMerchant } from './local-merchants';

export interface MerchantDetails {
  name: string | null;
  entityId: string | null;
  website: string | null;
  confidence: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  source: 'plaid_counterparty' | 'plaid_merchant' | 'description' | 'unresolved';
  intermediaries: { name: string; type: string }[];
  reason: string;
  mcc: string | null;
}
export interface MerchantFields {
  merchant_name?: string | null;
  merchant_entity_id?: string | null;
  merchant_category_code?: string | null;
  website?: string | null;
  name: string;
  counterparties?:
    | {
        name?: string;
        entity_id?: string | null;
        type?: string;
        confidence_level?: string | null;
        website?: string | null;
      }[]
    | null;
}
const clean = (value: string | null | undefined, max = 250) =>
  value
    // Strip bank control characters before displaying descriptions.
    // eslint-disable-next-line no-control-regex
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || null;
const level = (value: string | null | undefined): MerchantDetails['confidence'] =>
  ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'].includes(value || '')
    ? (value as MerchantDetails['confidence'])
    : 'UNKNOWN';
const generic =
  /^(?:paypal|sq|square|stripe|interac|e[ -]?transfer|pos(?: purchase)?|purchase|debit(?: purchase)?|visa(?: debit)?|mastercard|payment|transfer)(?:\s|\*|$)/i;
const processor = /^(?:paypal|sq|square|stripe)(?:\s|\*|$)/i;

/** Never auto-fetch a provider website or image. This only builds a safe explicit link. */
export function merchantWebsite(value: string | null | undefined) {
  if (!value || value.length > 500) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !host.includes('.') ||
      /^(?:\d|\[)/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test)$/.test(host)
    )
      return null;
    return `https://${host}/`;
  } catch {
    return null;
  }
}

export function resolveMerchant(input: MerchantFields): MerchantDetails {
  const parties = (input.counterparties || []).slice(0, 12);
  const merchants = parties.filter((p) => p.type === 'merchant' && clean(p.name));
  const rank = { VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
  merchants.sort((a, b) => rank[level(b.confidence_level)] - rank[level(a.confidence_level)]);
  const unique = merchants.filter(
    (p, i) => merchants.findIndex((q) => (q.entity_id || q.name) === (p.entity_id || p.name)) === i,
  );
  const preferred =
    unique.find((p) => p.entity_id && p.entity_id === input.merchant_entity_id) ||
    (unique.length === 1 ? unique[0] : undefined);
  const intermediaries = parties
    .filter(
      (p) =>
        ['marketplace', 'payment_app', 'payment_terminal', 'financial_institution'].includes(
          p.type || '',
        ) && clean(p.name),
    )
    .map((p) => ({ name: clean(p.name)!, type: p.type! }));
  const base = {
    intermediaries,
    mcc: /^\d{4}$/.test(input.merchant_category_code || '') ? input.merchant_category_code! : null,
  };
  if (preferred)
    return {
      ...base,
      name: clean(preferred.name),
      entityId: clean(preferred.entity_id, 160),
      website: merchantWebsite(preferred.website || input.website),
      confidence: level(preferred.confidence_level),
      source: 'plaid_counterparty',
      reason:
        'Plaid identified a merchant counterparty. This is a trading-name match, not verification of its legal parent company.',
    };
  if (unique.length > 1)
    return {
      ...base,
      name: null,
      entityId: null,
      website: null,
      confidence: 'UNKNOWN',
      source: 'unresolved',
      reason:
        'Several merchant counterparties were supplied without a unique matching entity. Choose the company after checking the receipt.',
    };
  const name = clean(input.merchant_name);
  const intermediaryOnly =
    name && intermediaries.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (name && !intermediaryOnly && !generic.test(name))
    return {
      ...base,
      name,
      entityId: clean(input.merchant_entity_id, 160),
      website: merchantWebsite(input.website),
      confidence: 'UNKNOWN',
      source: 'plaid_merchant',
      reason:
        'Merchant name supplied by Plaid. No separate merchant confidence was supplied; category confidence does not verify the company.',
    };
  const description = clean(input.name);
  if (description && !generic.test(description) && !intermediaryOnly && !intermediaries.length)
    return {
      ...base,
      name: description,
      entityId: null,
      website: null,
      confidence: 'LOW',
      source: 'description',
      reason: 'Bank description only. This display label is not a verified company identity.',
    };
  if (!intermediaries.length && description && processor.test(description)) {
    const name = description.match(processor)?.[0].replace(/[\s*]+$/, '') || 'Payment processor';
    intermediaries.push({ name: /^sq$/i.test(name) ? 'Square' : name, type: 'payment_terminal' });
  }
  return {
    ...base,
    name: null,
    entityId: null,
    website: null,
    confidence: 'UNKNOWN',
    source: 'unresolved',
    reason:
      'The available description identifies a payment channel or intermediary, not a unique underlying merchant. Check your receipt or enter the company yourself.',
  };
}
export const merchantDetails = (t: Pick<Transaction, 'merchant' | 'merchantDetails'>) =>
  t.merchantDetails || resolveMerchant({ name: t.merchant });

/** Display/analysis enrichment is separate from immutable provider evidence and user choices. */
export function automaticMerchant(t: Transaction) {
  if (
    t.merchantOverride ||
    t.merchantCorrected ||
    t.pending ||
    t.cashFlow >= 0 ||
    t.classification === 'Transfer'
  )
    return null;
  const local = localMerchant(t.description);
  if (local) return local;
  const result = t.enrichment;
  if (!result?.merchant || result.method === 'unresolved' || generic.test(result.merchant))
    return null;
  const m = merchantDetails(t);
  // Preserve a meaningful, strong provider identity. Weak categories can still be improved separately.
  if (['HIGH', 'VERY_HIGH'].includes(m.confidence) && !/^[a-z]{2,4}$/i.test(m.name || ''))
    return null;
  return { name: result.merchant, category: result.category, method: result.method };
}
export const merchantName = (t: Transaction) =>
  t.merchantOverride || automaticMerchant(t)?.name || merchantDetails(t).name || t.merchant;
export const merchantEvidence = (t: Transaction) =>
  t.merchantOverride
    ? 'Confirmed by you'
    : automaticMerchant(t)
      ? automaticMerchant(t)!.method === 'groq'
        ? 'AI name · editable'
        : 'Automatically cleaned'
      : merchantDetails(t).source === 'unresolved'
        ? 'Company needs review'
        : merchantDetails(t).source === 'description'
          ? 'Bank description only'
          : ['HIGH', 'VERY_HIGH'].includes(merchantDetails(t).confidence)
            ? 'Strong Plaid match'
            : 'Plaid name · unverified';
type RuleMerchant = Pick<Transaction, 'merchant' | 'merchantDetails'> &
  Partial<Pick<Transaction, 'description'>>;
export function merchantRuleKeys(t: RuleMerchant) {
  const m = merchantDetails(t);
  const local = localMerchant(t.description || t.merchant);
  const legacy =
    m.source === 'unresolved'
      ? null
      : m.entityId && ['HIGH', 'VERY_HIGH'].includes(m.confidence)
        ? `entity:${m.entityId}`
        : `name:${(m.name || t.merchant).trim().toLowerCase()}`;
  // References change on each PRESTO tap; a remembered edit follows the recognized merchant.
  // Retain the old provider key as a lookup alias so existing saved rules still work.
  return [local ? `local:${local.name.toLowerCase()}` : null, legacy].filter(
    (key): key is string => key !== null,
  );
}
export function merchantRuleKey(t: RuleMerchant) {
  return merchantRuleKeys(t)[0] || null;
}
export function modelMerchantKey(t: Transaction) {
  if (t.merchantOverride) return `user:${t.merchantOverride.trim().toLowerCase()}`;
  const automatic = automaticMerchant(t);
  if (automatic) return `auto:${automatic.method}:${automatic.name.toLowerCase()}`;
  return merchantRuleKey(t) || `unresolved:${t.id}`;
}

/** Precise detailed-code rules run before primary-category fallback. Supports PFC v1/v2. */
export function categoryFromPlaid(primary: string, detailed: string): Category {
  const code = detailed || primary;
  const rules: [RegExp, Category][] = [
    [/^LOAN_PAYMENTS_CREDIT_CARD/, 'Debt Payments'],
    [/^TRANSFER.*(?:INVESTMENT|RETIREMENT)/, 'Investing'],
    [/^TRANSFER_(?:IN|OUT)/, 'Savings Transfer'],
    [/^INCOME_(?:WAGES|SALARY|CONTRACTOR|GIG_ECONOMY)$/, 'Employment Income'],
    [/^INCOME_/, 'Other'],
    [/COFFEE/, 'Coffee'],
    [/GROCERIES/, 'Groceries'],
    [/^FOOD_AND_DRINK/, 'Eating Out'],
    [/TELEPHONE|INTERNET_AND_CABLE/, 'Phone and Internet'],
    [/^RENT_AND_UTILITIES|MORTGAGE/, 'Housing'],
    [/TRANSPORTATION_TAXIS/, 'Rideshare'],
    [/TRANSPORTATION_PUBLIC/, 'TTC and PRESTO'],
    [/^MEDICAL/, 'Healthcare'],
    [/GYMS/, 'Fitness'],
    [/^ENTERTAINMENT/, 'Entertainment'],
    [/GENERAL_SERVICES_EDUCATION|TUITION/, 'Tuition and School'],
    [/GENERAL_MERCHANDISE_BOOKSTORES/, 'Shopping'],
    [/^GENERAL_MERCHANDISE/, 'Shopping'],
  ];
  return rules.find(([re]) => re.test(code))?.[1] || 'Other';
}
export const detailedCategories = Object.entries(taxonomy).map(([code, value]) => ({
  code,
  ...value,
  category: categoryFromPlaid(value.primary, code),
}));
export function detailOptions(category: Category) {
  return detailedCategories
    .filter((d) => d.category === category)
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function transactionDetail(t: Transaction) {
  if (t.detailCategoryCorrected && !t.detailCategory) return null;
  const code = t.detailCategoryCorrected ? t.detailCategory : t.plaidDetailed;
  const match = detailedCategories.find((d) => d.code === code && d.category === t.category);
  // Raw low-confidence bank detail remains visible in evidence, not promoted to model input.
  return match && (t.detailCategoryCorrected || ['HIGH', 'VERY_HIGH'].includes(t.confidence))
    ? match
    : null;
}
export const correctionExtras = {
  merchantOverride: z
    .string()
    .trim()
    .min(1)
    .max(160)
    // Reject control characters in user-confirmed labels.
    // eslint-disable-next-line no-control-regex
    .refine((s) => !/[\u0000-\u001f\u007f]/.test(s))
    .nullable()
    .optional(),
  detailCategory: z.string().max(120).nullable().optional(),
};
export function validDetail(category: Category, code: string | null | undefined) {
  return (
    code === undefined ||
    code === null ||
    detailedCategories.some((d) => d.code === code && d.category === category)
  );
}
