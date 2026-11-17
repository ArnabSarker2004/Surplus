import type { Transaction } from './schema';
import { automaticMerchant, merchantDetails } from './merchants';
import { classify } from './finance/categorization';
import { detectStudentFunding } from './student-funding';

/** Apply estimates without marking them user-confirmed or modifying a bank field. Idempotent. */
export function applyAutomaticCleanup(t: Transaction): Transaction {
  if (
    t.userCorrected ||
    t.categoryOrigin === 'user' ||
    t.categoryOrigin === 'rule' ||
    t.splits?.length ||
    t.forecastTreatment === 'reimbursement'
  )
    return t;
  const funding = detectStudentFunding(t);
  if (funding)
    return t.category === funding.category &&
      t.classification === 'Income' &&
      t.categoryOrigin === 'funding'
      ? t
      : { ...t, category: funding.category, classification: 'Income', categoryOrigin: 'funding' };
  if (t.pending || t.cashFlow >= 0 || t.classification === 'Transfer') return t;
  if (
    t.categoryOrigin !== 'enrichment' &&
    (t.category !== 'Other' || ['HIGH', 'VERY_HIGH'].includes(t.confidence))
  )
    return t;
  const automatic = automaticMerchant(t);
  // A known multipurpose payee (e.g. OneCard) cannot support an older AI category guess.
  if (
    automatic?.method === 'local' &&
    automatic.category === null &&
    t.categoryOrigin === 'enrichment'
  )
    return { ...t, category: 'Other', classification: 'Review', categoryOrigin: 'review' };
  const provider = merchantDetails(t);
  const compatible =
    ['HIGH', 'VERY_HIGH'].includes(provider.confidence) &&
    t.enrichment?.merchant?.toLowerCase() === provider.name?.toLowerCase();
  const category = automatic
    ? automatic.category
    : compatible && t.enrichment?.method !== 'unresolved'
      ? t.enrichment?.category
      : null;
  if (!category || ['Income', 'Transfer', 'Review'].includes(classify(category, t.cashFlow)))
    return t;
  if (t.category === category && t.categoryOrigin === 'enrichment') return t;
  return {
    ...t,
    category,
    classification: classify(category, t.cashFlow),
    categoryOrigin: 'enrichment',
  };
}
