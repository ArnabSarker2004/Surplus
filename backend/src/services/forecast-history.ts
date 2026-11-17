import { createHash } from 'node:crypto';
import {
  defaultForecastOptions,
  forecastOptionsSchema,
  type ForecastReport,
  type GoalChanges,
} from '../../../shared/intelligence';
import type { AppState } from '../../../shared/schema';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { forecastPayload } from './intelligence-service';
import { evaluateForecast } from './forecast-evaluation';
import type { ChangeDriver } from '../../../shared/action-plan';

type Snapshot = {
  fingerprint: string;
  savedAt: string;
  asOf: string;
  goals: { id: string; date: string | null }[];
  facts?: {
    cash: number | null;
    spending: number;
    income: number;
    plan: string;
    transactions: string;
    prices: string;
    count: number;
  };
};
type Bucket = { current: Snapshot; previous: Snapshot | null };
type History = Record<string, Bucket>;
const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(value) ?? 'null')
    .digest('hex');
export function financialFingerprint(state: AppState) {
  const payload = forecastPayload(state, defaultForecastOptions);
  payload.transactions.sort((a, b) => a.id.localeCompare(b.id));
  payload.accounts.sort((a, b) => a.id.localeCompare(b.id));
  return hash(payload);
}

export function recordForecast(
  repository: WorkspaceRepository,
  original: AppState,
  input: unknown,
  report: ForecastReport,
): ForecastReport {
  const options = forecastOptionsSchema.parse(input);
  const changes: GoalChanges = {
    previousAt: null,
    savedAt: null,
    status: 'first',
    summary:
      'First comparable forecast. Future data updates can move these dates earlier or later.',
    goals: [],
  };
  // Manual cash/tuition overrides are exploratory and must not replace the saved-plan baseline.
  const baseline =
    options.openingCash === null &&
    !options.tuition &&
    !options.monthlyExtraIncome &&
    !options.flexibleReductionPercent &&
    !options.habitAdjustment;
  if (!baseline)
    return {
      ...report,
      evaluation: evaluateForecast(repository, original, report, false),
      goalChanges: {
        ...changes,
        status: 'scenario',
        summary:
          'Exploring a what-if. This scenario does not replace your saved-plan comparison or accuracy checkpoints.',
      },
    };
  if (
    !repository.workspace() ||
    financialFingerprint(repository.state()) !== financialFingerprint(original)
  )
    return {
      ...report,
      goalChanges: {
        ...changes,
        status: 'changed_during_run',
        summary:
          'Your data changed during this calculation. Refresh for a current goal comparison.',
      },
    };
  const key = hash({
    version: report.version,
    source: report.source,
    horizon: report.horizonDays,
    inflation: options.inflation,
  });
  const fingerprint = hash({
    financial: financialFingerprint(original),
    economy: report.economy
      ? {
          period: report.economy.period,
          status: report.economy.status === 'unavailable' ? 'unavailable' : 'available',
          categories: report.economy.categories,
        }
      : null,
  });
  const history = repository.store.get<History>('forecastHistory', {});
  const previousBucket = history[key];
  const facts: NonNullable<Snapshot['facts']> = {
    cash: report.summary?.startingUsableCash ?? null,
    spending: report.summary?.spendingNext30 ?? 0,
    income: report.summary?.incomeNext30 ?? 0,
    plan: hash([
      original.workspace?.funding,
      original.workspace?.expenses,
      original.workspace?.goals,
      original.workspace?.semester,
      original.workspace?.lifeEvents,
      original.workspace?.workScheduleConfirmed,
      original.workspace?.cashAllocations,
    ]),
    transactions: hash(
      original.transactions
        .map((t) => [t.id, t.cashFlow, t.category, t.classification, t.forecastTreatment, t.splits])
        .sort(),
    ),
    prices: hash(report.economy?.categories),
    count: original.transactions.length,
  };
  const same = previousBucket?.current.fingerprint === fingerprint;
  const current: Snapshot = same
    ? previousBucket.current
    : {
        fingerprint,
        facts,
        savedAt: new Date().toISOString(),
        asOf: report.asOf,
        goals: (report.goals || []).map((g) => ({ id: g.id, date: g.projectedDate })),
      };
  const previous = same ? previousBucket.previous : previousBucket?.current || null;
  changes.savedAt = current.savedAt;
  changes.previousAt = previous?.savedAt || null;
  if (previous) {
    changes.status = 'compared';
    changes.summary =
      'Compared with your previous saved-plan forecast using the same horizon and inflation settings. Spending, balances, plans and published prices can all affect the dates.';
  }
  const drivers: ChangeDriver[] = [];
  const prior = previous?.facts;
  const moneyDelta = (kind: string, label: string, a: number | null, b: number | null) => {
    if (a !== null && b !== null && Math.abs(b - a) >= 0.01)
      drivers.push({
        kind,
        label,
        amount: Math.round((b - a) * 100) / 100,
        detail:
          'Change since the comparable forecast; this is not an isolated causal contribution to the goal date.',
      });
  };
  if (prior) {
    moneyDelta('cash', 'Usable opening cash', prior.cash, facts.cash);
    moneyDelta('spending', 'Projected next-30-day spending', prior.spending, facts.spending);
    moneyDelta('income', 'Projected next-30-day incoming money', prior.income, facts.income);
    if (prior.transactions !== facts.transactions)
      drivers.push({
        kind: 'transactions',
        label: 'Transaction history updated',
        detail: `Now ${facts.count} entries, previously ${prior.count}. Imports, refunds, removals and your category/context corrections can change the forecast.`,
      });
    if (prior.plan !== facts.plan)
      drivers.push({
        kind: 'plan',
        label: 'Saved plan changed',
        detail:
          'Bills, funding, account money allocations, goals, buffers or dated life changes were updated.',
      });
    if (prior.prices !== facts.prices)
      drivers.push({
        kind: 'prices',
        label: 'Inflation inputs changed',
        detail: 'Published prices or the spending mix used to weight them changed.',
      });
    if (previous.asOf !== report.asOf)
      drivers.push({
        kind: 'time',
        label: 'The forecast window moved',
        detail: `The comparison starts on ${previous.asOf}; this forecast starts on ${report.asOf}. Different days enter the horizon.`,
      });
  }
  changes.drivers = drivers;
  changes.goals = (report.goals || []).map((goal) => {
    const older = previous?.goals.find((g) => g.id === goal.id);
    const shift =
      older?.date && goal.projectedDate
        ? Math.round((Date.parse(goal.projectedDate) - Date.parse(older.date)) / 86400000)
        : null;
    const change = !older
      ? 'new'
      : shift !== null
        ? shift > 0
          ? 'later'
          : shift < 0
            ? 'earlier'
            : 'unchanged'
        : !older.date && goal.projectedDate
          ? 'now_reachable'
          : older.date && !goal.projectedDate
            ? 'outside_horizon'
            : 'unchanged';
    return {
      id: goal.id,
      previousDate: older?.date || null,
      currentDate: goal.projectedDate,
      shiftDays: shift,
      change,
    };
  });
  if (!same) {
    history[key] = { current, previous };
    const bounded = Object.fromEntries(
      Object.entries(history)
        .sort((a, b) => b[1].current.savedAt.localeCompare(a[1].current.savedAt))
        .slice(0, 8),
    );
    repository.store.transaction(() => repository.store.set('forecastHistory', bounded));
  }
  return {
    ...report,
    goalChanges: changes,
    evaluation: evaluateForecast(
      repository,
      original,
      report,
      baseline && options.inflation.mode === 'observed',
    ),
  };
}
