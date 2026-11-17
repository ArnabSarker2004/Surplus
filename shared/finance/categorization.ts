import type { Category, Classification, MerchantRule, Transaction } from '../schema';
import { categoryFromPlaid } from '../merchants';
import { detectStudentFunding } from '../student-funding';

export function classify(category: Category, cashFlow: number): Classification {
  if (
    ['OSAP Funding', 'RESP Funding', 'Student Aid Funding', 'Education Funding'].includes(
      category,
    ) &&
    cashFlow <= 0
  )
    return 'Review';
  if (['Debt Payments', 'Savings Transfer', 'Investing'].includes(category)) return 'Transfer';
  if (
    [
      'Employment Income',
      'OSAP Funding',
      'RESP Funding',
      'Student Aid Funding',
      'Education Funding',
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
  cashFlow = 1,
  currency = 'CAD',
  description = merchant,
): Category {
  const rule = rules.find(
    (r) => r.merchant.toLowerCase() === merchant.toLowerCase() && r.source === source,
  );
  if (rule) return rule.category;
  const funding = detectStudentFunding({ merchant, description, cashFlow, currency });
  if (funding) return funding.category;
  if (cashFlow > 0 && /\b(?:PAYROLL|SALARY|WAGES)\b/i.test(description)) return 'Employment Income';
  const name = merchant.toLowerCase();
  const known: [RegExp, Category][] = [
    [/bursary|grant/, 'Grants and Bursaries'],
    [/scholarship/, 'Scholarships'],
    [/stipend|learning zone/, 'Stipends and Opportunities'],
    [/\btuition\b|\btmu fees\b/, 'Tuition and School'],
    [/textbook|campus bookstore/, 'Textbooks and Supplies'],
    [/spotify|netflix|icloud|adobe|youtube premium/, 'Subscriptions'],
    [/coffee|tim hortons|starbucks|balzac/, 'Coffee'],
    [/payroll/, 'Employment Income'],
    [/credit card payment|visa payment|mastercard payment/, 'Debt Payments'],
    [/savings transfer|internal transfer/, 'Savings Transfer'],
  ];
  for (const [match, category] of known) if (match.test(name)) return category;
  if (!['HIGH', 'VERY_HIGH'].includes(confidence)) return 'Other';
  return categoryFromPlaid(primary, detailed);
}
