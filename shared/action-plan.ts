export interface WeeklyPlan {
  endDate: string;
  variableSpending: number;
  scheduledBills: number;
  scheduledIncome: number;
  extraRoom: number | null;
  upcoming: {
    date: string;
    label: string;
    amount: number;
    direction: string;
    origin: string;
    accountId?: string | null;
  }[];
  actions: { id: string; title: string; detail: string; page: string; priority: string }[];
  note: string;
}
export interface AccountOutlooks {
  days: number;
  note: string;
  accounts: {
    accountId: string;
    minimum: number;
    ending: number;
    firstNegativeDate: string | null;
    dailyVariableOutflow: number;
    historyDays: number;
    unassignedPayments: number;
    status: string;
  }[];
}
export interface ForecastEvaluation {
  status: 'collecting' | 'available' | 'scenario';
  note: string;
  checkpoints: { days: number; count: number; mae: number | null; coverage: number | null }[];
  latest: {
    predictedOn: string;
    observedOn: string;
    days: number;
    predicted: number;
    actual: number;
    low: number;
    high: number;
    error: number;
    covered: boolean;
  }[];
}
export interface ChangeDriver {
  kind: string;
  label: string;
  detail: string;
  amount?: number;
}
