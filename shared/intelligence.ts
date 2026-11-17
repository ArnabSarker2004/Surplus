import { z } from 'zod';
import type { EconomyReport } from './economy';
import type { WeeklyPlan, AccountOutlooks, ForecastEvaluation, ChangeDriver } from './action-plan';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const forecastOptionsSchema = z
  .object({
    horizonDays: z.number().int().min(30).max(730).default(180),
    inflation: z
      .object({
        mode: z.enum(['observed', 'custom', 'off']).default('observed'),
        region: z.enum(['Ontario', 'Canada']).default('Ontario'),
        annualRate: z.number().finite().min(-5).max(20).default(2),
      })
      .strict()
      .default({}),
    habitAdjustment: z
      .object({
        weekday: z.number().int().min(0).max(6),
        category: z.enum(['Eating Out', 'Coffee', 'Shopping', 'Entertainment', 'Rideshare']),
        reductionPercent: z.number().finite().min(0).max(100),
      })
      .strict()
      .nullable()
      .default(null),
    openingCash: z.number().finite().min(0).max(10_000_000).nullable().default(null),
    monthlyExtraIncome: z.number().finite().min(0).max(100_000).default(0),
    flexibleReductionPercent: z.number().finite().min(0).max(80).default(0),
    tuition: z
      .object({ amount: z.number().finite().positive().max(10_000_000), dueDate: date })
      .nullable()
      .default(null),
    cardPreferences: z
      .object({
        paidInFull: z.enum(['unknown', 'yes', 'no']).default('unknown'),
        tangerineSavings: z.boolean().default(false),
        recurringBills: z.boolean().default(false),
        amexAcceptancePercent: z.number().int().min(0).max(100).default(100),
      })
      .strict()
      .default({}),
  })
  .strict();
export type ForecastOptions = z.infer<typeof forecastOptionsSchema>;
export const defaultForecastOptions = forecastOptionsSchema.parse({});
export interface StudentOutlook {
  incomeBasis: 'schedule' | 'history';
  scheduledEarnings: number;
  semester: {
    name: string;
    end: string;
    balance: number | null;
    afterReserves: number | null;
    inHorizon: boolean;
  } | null;
  jobs: {
    id: string;
    name: string;
    kind: string;
    start: string;
    end: string | null;
    firstPayday: string;
    lastPayday: string | null;
    nextPayday: string | null;
    remainingPay: number;
    paydaysLeft: number;
    amount: number;
    frequency: string;
    status: string;
  }[];
  gaps: {
    start: string;
    end: string;
    days: number;
    cashNeeded: number;
    endingCash: number | null;
    firstPressureDate: string | null;
  }[];
  months: {
    month: string;
    start: string;
    end: string;
    income: number;
    spending: number;
    endingCash: number | null;
  }[];
}
export interface ForecastReport {
  student?: StudentOutlook;
  weeklyPlan?: WeeklyPlan;
  accountOutlooks?: AccountOutlooks;
  evaluation?: ForecastEvaluation;
  behavior: BehaviorReport;
  liquidity: LiquidityReport;
  economy: EconomyReport;
  habits: HabitReport;
  goalChanges?: GoalChanges;
  creditCards: CreditCardComparison;
  version: string;
  asOf: string;
  source: string;
  horizonDays: number;
  syncedAt: string | null;
  quality: {
    historyDays: number;
    completeWeeks: number;
    transactionCount: number;
    excludedCount: number;
    cashKnown: boolean;
    level: string;
    warnings: string[];
  };
  summary: {
    cash: number | null;
    creditReserve: number;
    pendingReserve: number;
    goalReserve: number;
    buffer: number;
    startingUsableCash: number | null;
    incomeNext30: number;
    spendingNext30: number;
    netNext30: number;
    endingMedian: number | null;
    scenarioEndingMedian: number | null;
    bufferBreachDate: string | null;
    bufferBreachRate: number | null;
    safeWeeklyRoom: number | null;
  };
  timeline: {
    date: string;
    low: number | null;
    median: number | null;
    high: number | null;
    scenario: number | null;
    netChange: number;
    constantPrices: number | null;
  }[];
  tuition: {
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    status: string;
    firstCashCoverageDate: string | null;
    gapAtDeadline: number | null;
    extraPerWeek: number | null;
    successRate: number | null;
    scenarioSuccessRate: number | null;
  }[];
  goals: {
    id: string;
    name: string;
    target: number;
    current: number;
    deadline: string;
    priority: string;
    projectedDate: string | null;
    status: string;
    projectedAmount: number | null;
    successRate: number | null;
    extraPerMonth: number | null;
    scenarioDate: string | null;
    constantPriceDate: string | null;
    earliestDate: string | null;
    cautiousDate: string | null;
    scenarioAmount: number | null;
    trajectory: { date: string; amount: number; scenario: number; low: number; high: number }[];
  }[];
  models: {
    series: string;
    selected: string;
    trainingWeeks: number;
    validationWeeks: number;
    mae: number | null;
    candidates: { name: string; mae: number | null }[];
    reason: string;
  }[];
  recurring: {
    merchant: string;
    category: string;
    amount: number;
    direction: string;
    frequency: string;
    nextDate: string | null;
    observations: number;
    confidence: string;
    included: boolean;
  }[];
  categories: {
    category: string;
    last30: number;
    previous30: number;
    changePercent: number | null;
  }[];
  anomalies: {
    id: string;
    merchant: string;
    date: string;
    amount: number;
    category: string;
    typicalAmount: number;
    reason: string;
  }[];
  upcoming: { date: string; label: string; amount: number; direction: string; origin: string }[];
  recommendations: { title: string; detail: string; action: string }[];
  assumptions: string[];
  assistant: { id: string; question: string; answers: string[] }[];
}

export interface BehaviorReport {
  detailSpending: { category: string; detail: string; amount: number; purchases: number }[];
  frequency: {
    method: string;
    weeks: number;
    events: number;
    validation: { days: number; baselineDeviance: number; weekdayDeviance: number } | null;
    days: { weekday: number; label: string; observed: number; expected: number }[];
    note: string;
  };
  timezone: string;
  coverage: { purchases: number; timestamped: number; located: number; purchaseDateKnown: number };
  windows: {
    weekday: number;
    day: string;
    startHour: number;
    endHour: number;
    events: number;
    distinctDays: number;
    shareOfTimed: number;
    total: number;
  }[];
  sequences: { from: string; to: string; occurrences: number; distinctDays: number }[];
  locations: {
    city: string;
    region: string | null;
    country: string | null;
    visits: number;
    total: number;
  }[];
  merchants: { merchant: string; category: string; visits: number; total: number }[];
  payday: {
    status: string;
    cycles: number;
    after: number | null;
    comparison: number | null;
    changePercent: number | null;
    note: string;
  };
  risingCharges: {
    merchant: string;
    category: string;
    before: number;
    after: number;
    annualExtra: number;
    observations: number;
    correlation: number;
    lastDate: string;
  }[];
  ticketTrends: {
    merchant: string;
    category: string;
    before: number;
    after: number;
    changePercent: number;
    earlierCount: number;
    recentCount: number;
  }[];
  research: { title: string; url: string; detail: string }[];
  notes: string[];
}
export interface LiquidityReport {
  method: string;
  horizons: {
    days: number;
    minimumMedian: number | null;
    bufferBreachShare: number | null;
    negativeShare: number | null;
    firstPressureDate: string | null;
  }[];
  protectedBalance: number;
  fiveDayOutflowPerDay: number;
  nextIncome: ForecastReport['upcoming'][number] | null;
  safeToSetAside: number | null;
  protectedDays: number;
  status: string;
  notes: string[];
}

export interface HabitReport {
  weeks: number;
  start: string | null;
  end: string | null;
  days: {
    weekday: number;
    label: string;
    optional: number;
    groceries: number;
    routine: number;
    occurrences: number;
  }[];
  patterns: {
    id: string;
    weekday: number;
    day: string;
    category: 'Eating Out' | 'Coffee' | 'Shopping' | 'Entertainment' | 'Rideshare';
    weeklyAverage: number;
    activeWeeks: number;
    totalWeeks: number;
    ratio: number;
    monthlyChangeAt25: number;
    transactionIds: string[];
    explanation: string;
  }[];
  review: {
    id: string;
    merchant: string;
    date: string;
    amount: number;
    category: string;
    treatment: 'automatic' | 'routine' | 'optional';
  }[];
  unknownCount: number;
  notes: string[];
  interventionMonthlySavings: number;
}
export interface GoalChanges {
  drivers?: ChangeDriver[];
  previousAt: string | null;
  savedAt: string | null;
  status: 'first' | 'compared' | 'scenario' | 'changed_during_run';
  summary: string;
  goals: {
    id: string;
    previousDate: string | null;
    currentDate: string | null;
    shiftDays: number | null;
    change: 'earlier' | 'later' | 'unchanged' | 'now_reachable' | 'outside_horizon' | 'new';
  }[];
}

export interface CreditCardComparison {
  reviewedAt: string;
  stale: boolean;
  observedDays: number;
  enoughHistory: boolean;
  monthlyEligibleSpend: number;
  excludedOutflows: number;
  paidInFull: 'unknown' | 'yes' | 'no';
  recommendedId: string | null;
  warnings: string[];
  cards: {
    id: string;
    name: string;
    kind: string;
    network: string;
    annualFee: number;
    url: string;
    terms: string;
    benefits: string[];
    eligibility: string;
    sources: string[];
    annualRewards: number | null;
    annualNet: number | null;
    annualPoints: number | null;
    chosenCategories: string[];
    breakdown: { category: string; monthlySpend: number; annualRewards: number }[];
  }[];
}
