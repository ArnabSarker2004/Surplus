import { z } from 'zod';
import { resourceProgressSchema } from './resources';
import type { MerchantDetails } from './merchants';

export const categories = [
  'Employment Income',
  'OSAP Funding',
  'RESP Funding',
  'Student Aid Funding',
  'Education Funding',
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
  reduceCategories: z.array(categorySchema).max(categories.length),
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
  workKind: z.enum(['Co-op', 'Campus job', 'Part-time job', 'Summer job']).optional(),
  workStart: date.optional(),
  workEnd: date.optional(),
  type: z.enum(['Non-repayable', 'Repayable', 'Earned', 'Personal']),
  status: z.enum(['Expected', 'Applied', 'Confirmed', 'Received']),
  frequency: z.enum(['Once', 'Weekly', 'Biweekly', 'Monthly']),
  accountId: z.string().max(160).nullable().optional(),
});
export const expenseSchema = z.object({
  id: text,
  name: text,
  amount: moneySchema,
  date,
  category: categorySchema,
  frequency: z.enum(['Once', 'Monthly']),
  essential: z.boolean(),
  accountId: z.string().max(160).nullable().optional(),
});
export const lifeEventSchema = z
  .object({
    id: text,
    name: text,
    start: date,
    end: date,
    weeklyIncomeChange: z.number().finite().min(-10000).max(10000),
    weeklyExpenseChange: z.number().finite().min(-10000).max(10000),
  })
  .refine((v) => v.end >= v.start, 'End date must be on or after start date.');
export const intelligenceSettingsSchema = z
  .object({
    autoSync: z.boolean().default(false),
    groqEnrichment: z.boolean().optional(),
    alerts: z.boolean().default(true),
    dismissed: z.array(z.string().max(200)).max(100).default([]),
  })
  .strict();
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
    lifeEvents: z.array(lifeEventSchema).max(30).optional(),
    intelligenceSettings: intelligenceSettingsSchema.optional(),
    workScheduleConfirmed: z.boolean().optional(),
    cashAllocations: z
      .array(
        z
          .object({
            accountId: text,
            own: moneySchema,
            loans: moneySchema,
            education: moneySchema,
            reviewedBalance: moneySchema,
            reviewedDeposits: z
              .array(
                z
                  .object({
                    id: text,
                    amount: moneySchema,
                    bucket: z.enum(['own', 'loans', 'education', 'unassigned']),
                  })
                  .strict(),
              )
              .max(10000)
              .optional(),
          })
          .strict()
          .refine(
            (v) => v.own + v.loans + v.education <= v.reviewedBalance + 0.001,
            'Assigned money cannot exceed the reviewed account balance.',
          ),
      )
      .max(100)
      .optional(),
  })
  .superRefine((v, ctx) => {
    const allocationIds = (v.cashAllocations || []).map((a) => a.accountId);
    if (new Set(allocationIds).size !== allocationIds.length)
      ctx.addIssue({
        code: 'custom',
        path: ['cashAllocations'],
        message: 'Review each account only once.',
      });
    for (const [index, fund] of v.funding.entries()) {
      if (fund.endDate && fund.endDate < fund.date)
        ctx.addIssue({
          code: 'custom',
          path: ['funding', index, 'endDate'],
          message: 'Last payday must be on or after the first payday.',
        });
      if (fund.workStart && fund.workEnd && fund.workEnd < fund.workStart)
        ctx.addIssue({
          code: 'custom',
          path: ['funding', index, 'workEnd'],
          message: 'Work must end on or after it starts.',
        });
      if (fund.workStart && fund.date < fund.workStart)
        ctx.addIssue({
          code: 'custom',
          path: ['funding', index, 'date'],
          message: 'First payday must be on or after work starts.',
        });
    }
    for (const key of ['funding', 'expenses', 'goals', 'budgets'] as const) {
      if (new Set(v[key].map((x) => x.id)).size !== v[key].length)
        ctx.addIssue({ code: 'custom', path: [key], message: 'IDs must be unique.' });
    }
    if (v.lifeEvents && new Set(v.lifeEvents.map((e) => e.id)).size !== v.lifeEvents.length)
      ctx.addIssue({ code: 'custom', path: ['lifeEvents'], message: 'IDs must be unique.' });
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
  depositPurpose?:
    | 'salary'
    | 'personal'
    | 'education'
    | 'loan'
    | 'osap'
    | 'resp'
    | 'grant'
    | 'scholarship'
    | 'refund'
    | 'transfer'
    | 'unknown';
  fundingCounterparty?: string | null;
  bankTransactionId?: string;
  id: string;
  accountId: string;
  date: string;
  authorizedDate: string | null;
  authorizedAt?: string | null;
  location?: { city: string | null; region: string | null; country: string | null } | null;
  paymentChannel?: 'online' | 'in store' | 'other' | null;
  merchant: string;
  merchantDetails?: MerchantDetails;
  merchantOverride?: string | null;
  enrichment?: {
    descriptorHash: string;
    attempted?: boolean;
    externalEligible?: boolean;
    cleaned: string;
    merchant: string | null;
    category: Category | null;
    method: 'local' | 'groq' | 'unresolved';
    model: string | null;
    updatedAt: string;
  };
  merchantCorrected?: boolean;
  categoryOrigin?: 'user' | 'rule' | 'merchant' | 'plaid' | 'review' | 'enrichment' | 'funding';
  detailCategory?: string | null;
  detailCategoryCorrected?: boolean;
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
  forecastTreatment?: 'automatic' | 'one_off' | 'reimbursement';
  splits?: { category: Category; amount: number }[];
  source: Source;
}
export interface Account {
  id: string;
  name: string;
  type: 'depository' | 'credit' | 'investment' | 'loan' | 'other';
  subtype: string;
  balance: number;
  balanceKnown?: boolean;
  available?: number | null;
  balanceObservedAt?: string | null;
  currency: string;
  source: Source;
}
export interface MerchantRule {
  merchant: string;
  category: Category;
  classification: Classification;
  source: Source;
  merchantKey?: string;
  merchantOverride?: string | null;
  detailCategory?: string | null;
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
