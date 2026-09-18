import type { Category, Classification, MerchantRule, Transaction } from '../schema';

export function classify(category: Category, _cashFlow: number): Classification {
  if (['Debt Payments', 'Savings Transfer', 'Investing'].includes(category)) return 'Transfer';
  if (
    [
      'Employment Income',
      'OSAP Funding',
      'Grants and Bursaries',
      'Scholarships',
      'Stipends and Opportunities',
    ].includes(category)
  )
    return 'Income';
  if (
    [
      'Tuition and School',
      'Textbooks and Supplies',
      'Housing',
      'Phone and Internet',
      'TTC and PRESTO',
      'Healthcare',
    ].includes(category)
  )
    return 'Essential';
  if (['Groceries', 'Fitness', 'Rideshare'].includes(category)) return 'Flexible';
  if (['Eating Out', 'Coffee', 'Subscriptions', 'Shopping', 'Entertainment'].includes(category))
    return 'Discretionary';
  return 'Review';
}
export function categorize(
  merchant: string,
  primary: string,
  detailed: string,
  confidence: string,
  rules: MerchantRule[],
  source: Transaction['source'],
): Category {
  const rule = rules.find(
    (r) => r.merchant.toLowerCase() === merchant.toLowerCase() && r.source === source,
  );
  if (rule) return rule.category;
  const name = merchant.toLowerCase();
  const known: [RegExp, Category][] = [
    [/osap/, 'OSAP Funding'],
    [/bursary|grant/, 'Grants and Bursaries'],
    [/scholarship/, 'Scholarships'],
    [/stipend|learning zone/, 'Stipends and Opportunities'],
    [/tuition|toronto metropolitan|tmu fees/, 'Tuition and School'],
    [/textbook|campus bookstore/, 'Textbooks and Supplies'],
    [/presto|ttc|go transit/, 'TTC and PRESTO'],
    [/spotify|netflix|icloud|adobe|youtube premium/, 'Subscriptions'],
    [/coffee|tim hortons|starbucks|balzac/, 'Coffee'],
    [/payroll/, 'Employment Income'],
    [/credit card payment|visa payment|mastercard payment/, 'Debt Payments'],
    [/savings transfer|internal transfer/, 'Savings Transfer'],
  ];
  for (const [match, category] of known) if (match.test(name)) return category;
  if (!['HIGH', 'VERY_HIGH'].includes(confidence)) return 'Other';
  const v = `${primary} ${detailed}`;
  const map: [RegExp, Category][] = [
    [/LOAN_PAYMENTS_CREDIT_CARD/, 'Debt Payments'],
    [/TRANSFER.*(INVESTMENT|RETIREMENT)/, 'Investing'],
    [/TRANSFER_IN|TRANSFER_OUT/, 'Savings Transfer'],
    [/INCOME/, 'Employment Income'],
    [/COFFEE/, 'Coffee'],
    [/GROCERIES/, 'Groceries'],
    [/FOOD_AND_DRINK/, 'Eating Out'],
    [/RENT|MORTGAGE/, 'Housing'],
    [/TELEPHONE|INTERNET/, 'Phone and Internet'],
    [/TRANSPORTATION_TAXIS/, 'Rideshare'],
    [/TRANSPORTATION_PUBLIC/, 'TTC and PRESTO'],
    [/MEDICAL/, 'Healthcare'],
    [/GYMS/, 'Fitness'],
    [/ENTERTAINMENT/, 'Entertainment'],
    [/GENERAL_MERCHANDISE/, 'Shopping'],
  ];
  return map.find(([re]) => re.test(v))?.[1] ?? 'Other';
}
