import type { Transaction } from './schema';

export const studentFundingCategories = [
  'OSAP Funding',
  'RESP Funding',
  'Student Aid Funding',
  'Education Funding',
] as const;
export interface StudentFundingMatch {
  kind: 'osap' | 'resp' | 'student-aid';
  category: (typeof studentFundingCategories)[number];
  label: string;
  detail: string;
  explanation: string;
  evidence: string;
  evidenceField: 'Bank description' | 'Bank name' | 'Bank counterparty';
}
const clean = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/([A-Z])(?=[0-9])|([0-9])(?=[A-Z])/g, '$& ')
    .trim();
type BankFields = Pick<Transaction, 'merchant' | 'description' | 'cashFlow' | 'currency'> &
  Pick<Partial<Transaction>, 'merchantDetails' | 'fundingCounterparty'>;

/** Detect explicit bank labels, never amounts, provider guesses, or user-edited names. */
export function detectStudentFunding(t: BankFields): StudentFundingMatch | null {
  if (t.currency !== 'CAD' || !Number.isFinite(t.cashFlow) || t.cashFlow <= 0) return null;
  if (
    /\b(?:PAYROLL|SALARY|WAGES)\b/i.test(t.description) &&
    !/\b(?:OSAP|RESP|EDUCATIONAL? ASSISTANCE)\b/i.test(t.description)
  )
    return null;
  const fields = [
    { text: t.description, field: 'Bank description' as const },
    { text: t.merchant, field: 'Bank name' as const },
    ...(t.merchantDetails?.intermediaries || [])
      .filter((p) => p.type === 'financial_institution')
      .map((p) => ({ text: p.name, field: 'Bank counterparty' as const })),
    ...(t.fundingCounterparty
      ? [{ text: t.fundingCounterparty, field: 'Bank counterparty' as const }]
      : []),
    ...(t.merchantDetails?.name &&
    ['plaid_counterparty', 'plaid_merchant'].includes(t.merchantDetails.source)
      ? [{ text: t.merchantDetails.name, field: 'Bank counterparty' as const }]
      : []),
  ];
  // Moving a labelled reserve between the student's own accounts is not new funding.
  if (
    fields.some(({ text }) =>
      /\b(?:INTERNAL TRANSFER|SAVINGS TRANSFER|TRANSFER BETWEEN (?:MY |OWN )?ACCOUNTS)\b/.test(
        clean(text),
      ),
    )
  )
    return null;
  const find = (pattern: RegExp) => fields.find(({ text }) => pattern.test(clean(text)));
  const osap = find(
    /\b(?:OSAP|O S A P|ONT(?:ARIO)? STUD(?:ENT)? ASSIST(?:ANCE)?(?: PROG(?:RAM)?)?|CANADA ONTARIO (?:INTEGRATED )?STUDENT (?:LOAN|LOANS|FUNDING))\b/,
  );
  const resp = find(
    /\b(?:RESP|R E S P|REGISTERED EDUCATION SAVINGS PLAN(?:S)?|EDUCATIONAL? ASSISTANCE PAYMENT(?:S)?|CHILDREN(?:S| S)? EDUC(?:ATION)? FUNDS?(?: INC)?|CEFI|CANADIAN SCHOLARSHIP TRUST|CST SAVINGS|KNOWLEDGE FIRST FINANCIAL|KNOWLEDGE FIRST FOUNDATION|EMBARK STUDENT CORP|HERITAGE EDUCATION FUNDS|UNIVERSITY SCHOLARSHIPS OF CANADA|USC EDUCATION SAVINGS PLANS)\b/,
  );
  const aid = find(
    /\b(?:NSLSC|N S L S C|CSNPE|NATIONAL STUDENT LOANS? SERVICE CENT(?:RE|ER)|CENTRE DE SERVICE NATIONAL DE PRETS AUX ETUDIANTS|CANADA STUDENT (?:LOANS?|GRANTS?)(?: PROGRAM)?)\b/,
  );
  const education = find(
    /\b(?:EDUCATION(?:AL)? FUNDING|STUDENT FINANCIAL AID|STUDENT AID PAYMENT)\b/,
  );
  // Conflicting labels are not enough evidence to choose one source.
  if (resp && (osap || aid)) return null;
  const match = osap || resp || aid || education;
  if (!match) return null;
  if (resp)
    return {
      kind: 'resp',
      category: 'RESP Funding',
      label: 'RESP',
      detail: 'Education withdrawal',
      explanation:
        'An RESP or educational assistance payment is named in the bank record. Check the RESP statement for contributions and assistance payments; the description does not establish their split.',
      evidence: match.text,
      evidenceField: match.field,
    };
  // The NSLSC provider name itself contains “loans”; it does not prove a loan-only deposit.
  const loan = find(/\bOSAP (?:LOAN|LOANS)\b/) && !find(/\bGRANTS?\b/);
  const grant = find(/\bOSAP (?:GRANT|GRANTS)\b/) && !find(/\bLOANS?\b/);
  return {
    kind: osap ? 'osap' : 'student-aid',
    category: osap ? 'OSAP Funding' : aid ? 'Student Aid Funding' : 'Education Funding',
    label: osap ? 'OSAP' : aid ? 'Student aid' : 'Education',
    detail:
      loan && !grant
        ? 'Loan described'
        : grant && !loan
          ? 'Grant described'
          : 'Loan / grant split unknown',
    explanation:
      loan && !grant
        ? 'The bank description names an OSAP loan. Confirm the amount against your funding assessment.'
        : grant && !loan
          ? 'The bank description names an OSAP grant. Confirm the amount and conditions against your funding assessment.'
          : 'Student aid is named in the bank record. Check your funding assessment for the program and loan/grant split; a combined deposit or NSLSC label does not establish either.',
    evidence: match.text,
    evidenceField: match.field,
  };
}

/** Respect effective categorization: a corrected pay/refund/transfer is not education income. */
export function studentFunding(t: Transaction) {
  if (
    t.cashFlow <= 0 ||
    t.currency !== 'CAD' ||
    t.classification !== 'Income' ||
    t.splits?.length ||
    !studentFundingCategories.includes(t.category as StudentFundingMatch['category'])
  )
    return null;
  const detected = detectStudentFunding(t);
  const matching = detected?.category === t.category ? detected : null;
  const category = t.category as StudentFundingMatch['category'];
  const kind =
    category === 'OSAP Funding' ? 'osap' : category === 'RESP Funding' ? 'resp' : 'student-aid';
  return {
    ...(matching || {
      kind,
      category,
      label:
        kind === 'osap'
          ? 'OSAP'
          : kind === 'resp'
            ? 'RESP'
            : category === 'Education Funding'
              ? 'Education'
              : 'Student aid',
      detail: 'Source assigned',
      explanation:
        'This source follows the saved category. Check the original funding statement for its breakdown.',
      evidence: t.description,
      evidenceField: 'Bank description',
    }),
    automatic: t.categoryOrigin === 'funding' && !!matching && !t.userCorrected,
  };
}
