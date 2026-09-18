import { z } from 'zod';
import { resourceProgressSchema } from './resources';

export const categories = [
  'Employment Income',
  'OSAP Funding',
  'Grants and Bursaries',
  'Scholarships',
  'Stipends and Opportunities',
  'Tuition and School',
  'Textbooks and Supplies',
  'Groceries',
  'Eating Out',
  'Coffee',
  'TTC and PRESTO',
  'Rideshare',
  'Housing',
  'Phone and Internet',
  'Subscriptions',
  'Fitness',
  'Shopping',
  'Entertainment',
  'Healthcare',
  'Debt Payments',
  'Savings Transfer',
  'Investing',
  'Other',
] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;
export const moneySchema = z.number().finite().min(0).max(10_000_000);
const text = z.string().trim().min(1).max(160);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Enter a valid date.',
  );
export const sourceSchema = z.enum(['demo', 'sandbox', 'live', 'manual']);
export type Source = z.infer<typeof sourceSchema>;
export const profileSchema = z.object({
  name: text,
  institution: text,
  faculty: text,
  program: text,
  year: z.number().int().min(1).max(8),
  residency: z.enum(['Domestic', 'International']),
  study: z.enum(['Full-time', 'Part-time']),
  coop: z.boolean(),
  living: z.enum(['With family', 'Renting', 'Residence']),
  transportation: z.enum(['Public transit', 'Walking / cycling', 'Car']),
  employed: z.boolean(),
  payAmount: moneySchema,
  payFrequency: z.enum(['Weekly', 'Biweekly', 'Monthly']),
  weeklyHours: z.number().min(0).max(40),
  skills: z.array(text).max(30),
  interests: z.array(text).max(30),
  opportunityTypes: z.array(text).max(20),
  workPreference: z.enum(['Either', 'Remote', 'On campus']),
  developSkills: z.array(text).max(30),
  wantsInvesting: z.boolean(),
  highInterestDebt: z.boolean(),
  stableIncome: z.boolean(),
  horizonYears: z.number().min(0).max(50),
  riskComfort: z.enum(['Low', 'Medium', 'High']),
  priorities: z.array(text).max(20),
  reduceCategories: z.array(categorySchema).max(23),
  tfsaRoom: moneySchema.nullable(),
});
export const semesterSchema = z
  .object({
    name: text,
    start: date,
    end: date,
    minimumBalance: moneySchema,
    emergencyTarget: moneySchema,
  })
  .refine((v) => v.end > v.start, {
    message: 'End date must be after the start date.',
    path: ['end'],
  })
  .refine((v) => Date.parse(v.end) - Date.parse(v.start) <= 366 * 86400000, {
    message: 'Plan at most one year at a time.',
    path: ['end'],
  });
export const fundingSchema = z.object({
  id: text,
  name: text,
  amount: moneySchema,
  date,
  endDate: date.optional(),
  type: z.enum(['Non-repayable', 'Repayable', 'Earned', 'Personal']),
  status: z.enum(['Expected', 'Applied', 'Confirmed', 'Received']),
  frequency: z.enum(['Once', 'Weekly', 'Biweekly', 'Monthly']),
});
export const expenseSchema = z.object({
  id: text,
  name: text,
  amount: moneySchema,
  date,
  category: categorySchema,
  frequency: z.enum(['Once', 'Monthly']),
  essential: z.boolean(),
});
export const goalSchema = z.object({
  id: text,
  name: text,
  target: moneySchema.positive(),
  current: moneySchema,
  date,
  priority: z.enum(['High', 'Medium', 'Low']),
  contribution: moneySchema,
  frequency: z.enum(['Weekly', 'Monthly']),
});
export const budgetSchema = z.object({
  id: text,
  category: categorySchema,
  limit: moneySchema.positive(),
});
export const statuses = [
  'Recommended',
  'Saved',
  'Applying',
  'Applied',
  'Awarded',
  'Not selected',
  'Dismissed',
  'Expired',
] as const;
export type OpportunityStatus = (typeof statuses)[number];
export const scenarioSchema = z.object({
  name: text,
  monthlyReduction: moneySchema,
  monthlyIncome: moneySchema,
  oneTimeIncome: moneySchema,
  oneTimeExpense: moneySchema,
  monthlySavings: moneySchema,
  opportunityId: z.string().max(160).nullable(),
});
export const workspaceSchema = z
  .object({
    profile: profileSchema,
    semester: semesterSchema,
    funding: z.array(fundingSchema).max(100),
    expenses: z.array(expenseSchema).max(100),
    goals: z.array(goalSchema).max(30),
    budgets: z.array(budgetSchema).max(30),
    applications: z.record(z.string().max(160), z.enum(statuses)),
    resourceProgress: z.record(z.string().max(160), resourceProgressSchema).default({}),
    scenario: scenarioSchema,
    source: sourceSchema,
    onboarded: z.boolean(),
  })
  .superRefine((v, ctx) => {
    for (const key of ['funding', 'expenses', 'goals', 'budgets'] as const) {
      if (new Set(v[key].map((x) => x.id)).size !== v[key].length)
        ctx.addIssue({ code: 'custom', path: [key], message: 'IDs must be unique.' });
    }
    if (new Set(v.budgets.map((x) => x.category)).size !== v.budgets.length)
      ctx.addIssue({ code: 'custom', path: ['budgets'], message: 'One budget per category.' });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Funding = z.infer<typeof fundingSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Classification =
  'Essential' | 'Flexible' | 'Discretionary' | 'Transfer' | 'Income' | 'Review';
export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  authorizedDate: string | null;
  merchant: string;
  description: string;
  rawAmount: number;
  cashFlow: number;
  currency: string;
  pending: boolean;
  plaidPrimary: string;
  plaidDetailed: string;
  confidence: string;
  category: Category;
  classification: Classification;
  userCorrected: boolean;
  habitTreatment?: 'automatic' | 'routine' | 'optional';
  source: Source;
}
export interface Account {
  id: string;
  name: string;
  type: 'depository' | 'credit' | 'investment' | 'loan' | 'other';
  subtype: string;
  balance: number;
  currency: string;
  source: Source;
}
export interface MerchantRule {
  merchant: string;
  category: Category;
  classification: Classification;
  source: Source;
}
export interface Opportunity {
  id: string;
  title: string;
  provider: string;
  type: string;
  description: string;
  amount: number;
  deadline: string;
  paymentDate: string;
  institution: string;
  programs: string[];
  faculty: string;
  years: number[];
  residency: string[];
  skills: string[];
  interests: string[];
  hours: number;
  duration: string;
  location: string;
  sample: boolean;
  sourceUrl: string | null;
  lastVerified: string | null;
}
export interface AppState {
  workspace: Workspace | null;
  transactions: Transaction[];
  accounts: Account[];
  opportunities: Opportunity[];
  rules: MerchantRule[];
}
export const emptyScenario: Scenario = {
  name: 'My what-if plan',
  monthlyReduction: 0,
  monthlyIncome: 0,
  oneTimeIncome: 0,
  oneTimeExpense: 0,
  monthlySavings: 0,
  opportunityId: null,
};
