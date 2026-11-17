import type { Category, Classification, Transaction } from './schema';
import { applyAutomaticCleanup } from './transaction-cleanup';
import { detectStudentFunding } from './student-funding';

export const depositPurposes = [
  ['personal', 'Personal money'],
  ['salary', 'Salary or job pay'],
  ['loan', 'Loan'],
  ['osap', 'OSAP'],
  ['grant', 'Grant / bursary'],
  ['scholarship', 'Scholarship'],
  ['resp', 'RESP'],
  ['education', 'Other education funding'],
  ['refund', 'Refund / reimbursement'],
  ['transfer', 'Transfer between my accounts'],
  ['unknown', 'Personal money (source unknown)'],
] as const;
export const fundingTypes = ['loan', 'osap', 'grant', 'scholarship', 'resp', 'education'] as const;
export type FundingType = (typeof fundingTypes)[number];
export const fundingLabels: Record<FundingType, string> = {
  loan: 'Loan',
  osap: 'OSAP',
  grant: 'Grant / bursary',
  scholarship: 'Scholarship',
  resp: 'RESP',
  education: 'Other education funding',
};

/** Money purpose is independent of an older spending category or classification.
 * A reviewed display name is valid evidence for this balance allocation; bank
 * evidence shown in Transaction details continues to use the original fields. */
function detectedFundingType(t: Transaction): FundingType | null {
  const names = [t.description, t.merchant, t.merchantOverride || ''];
  const clean = (name: string) =>
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ');
  if (
    names.some((name) =>
      /\b(?:INTERNAL TRANSFER|SAVINGS TRANSFER|TRANSFER BETWEEN (?:MY |OWN )?ACCOUNTS)\b/.test(
        clean(name),
      ),
    )
  )
    return null;
  const categories: Partial<Record<Category, FundingType>> = {
    'OSAP Funding': 'osap',
    'RESP Funding': 'resp',
    'Student Aid Funding': 'education',
    'Education Funding': 'education',
    'Grants and Bursaries': 'grant',
    Scholarships: 'scholarship',
  };
  if (categories[t.category]) return categories[t.category]!;
  const detected =
    detectStudentFunding(t) ||
    (t.merchantOverride ? detectStudentFunding({ ...t, merchant: t.merchantOverride }) : null);
  if (detected) return detected.kind === 'student-aid' ? 'education' : detected.kind;
  // A provider's employee payroll is pay, even if its name contains scholarship.
  if (/\b(?:PAYROLL|SALARY|WAGES)\b/.test(clean(t.description))) return null;
  if (names.some((name) => /\bSCHOLARSHIPS?\b/.test(clean(name)))) return 'scholarship';
  if (
    names.some((name) =>
      /\b(?:BURSAR(?:Y|IES)|(?:EDUCATION(?:AL)?|STUDENT|TUITION) GRANTS?|GRANT (?:PAYMENT|DEPOSIT))\b/.test(
        clean(name),
      ),
    )
  )
    return 'grant';
  return null;
}
export function depositSource(input: Transaction) {
  const t = applyAutomaticCleanup(input);
  if (t.currency !== 'CAD' || t.cashFlow <= 0 || t.splits?.length) return null;
  // Unknown is a legacy unreviewed source, not an explicit personal override.
  if (t.depositPurpose && t.depositPurpose !== 'unknown') return t.depositPurpose;
  if (t.forecastTreatment === 'reimbursement') return 'refund';
  const funding = detectedFundingType(t);
  if (funding) return detectStudentFunding(t)?.detail === 'Loan described' ? 'loan' : 'education';
  if (t.classification === 'Transfer') return 'transfer';
  if (t.classification !== 'Income' && t.classification !== 'Review') return 'refund';
  if (t.category === 'Employment Income' && t.classification === 'Income') return 'salary';
  return 'unknown';
}

/** An explicit personal flag overrides detection. Other cash is personal by default. */
export function nonPersonalSource(input: Transaction): FundingType | null {
  const t = applyAutomaticCleanup(input);
  const source = depositSource(t);
  if (!source) return null;
  if (
    t.depositPurpose &&
    fundingTypes.includes(t.depositPurpose as FundingType) &&
    t.depositPurpose !== 'education'
  )
    return t.depositPurpose as FundingType;
  if (source !== 'loan' && source !== 'education') return null;
  return detectedFundingType(t) ?? (source === 'loan' ? 'loan' : 'education');
}
export function depositPurposePatch(
  purpose: NonNullable<Transaction['depositPurpose']>,
  t: Transaction,
): {
  category: Category;
  classification: Classification;
  forecastTreatment: Transaction['forecastTreatment'];
  depositPurpose: Transaction['depositPurpose'];
} {
  const specificCategories: Partial<Record<NonNullable<Transaction['depositPurpose']>, Category>> =
    {
      osap: 'OSAP Funding',
      resp: 'RESP Funding',
      grant: 'Grants and Bursaries',
      scholarship: 'Scholarships',
      education: 'Education Funding',
    };
  const category: Category =
    specificCategories[purpose] ??
    (purpose === 'salary'
      ? 'Employment Income'
      : purpose === 'loan'
        ? 'Other'
        : purpose === 'transfer'
          ? 'Savings Transfer'
          : purpose === 'refund'
            ? ['Income', 'Review', 'Transfer'].includes(t.classification)
              ? 'Other'
              : t.category
            : 'Other');
  return {
    category,
    classification:
      purpose === 'transfer'
        ? 'Transfer'
        : purpose === 'unknown' || purpose === 'refund'
          ? 'Review'
          : 'Income',
    forecastTreatment: purpose === 'salary' ? 'automatic' : 'one_off',
    depositPurpose: purpose,
  };
}
