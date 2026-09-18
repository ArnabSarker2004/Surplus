import { createHash } from 'node:crypto';
import { defaultForecastOptions, forecastOptionsSchema, type ForecastReport, type GoalChanges } from '../../../shared/intelligence';
import type { AppState } from '../../../shared/schema';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { forecastPayload } from './intelligence-service';

type Snapshot = {
  fingerprint: string; savedAt: string; asOf: string;
  goals: { id: string; date: string | null }[];
};
type Bucket = { current: Snapshot; previous: Snapshot | null };
type History = Record<string, Bucket>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function financialFingerprint(state: AppState) {
  const payload = forecastPayload(state, defaultForecastOptions);
  payload.transactions.sort((a, b) => a.id.localeCompare(b.id));
  payload.accounts.sort((a, b) => a.id.localeCompare(b.id));
  return hash(payload);
}

export function recordForecast(repository: WorkspaceRepository, original: AppState, input: unknown, report: ForecastReport): ForecastReport {
  const options = forecastOptionsSchema.parse(input);
  const changes: GoalChanges = { previousAt: null, savedAt: null, status: 'first', summary: 'First comparable forecast. Future data updates can move these dates earlier or later.', goals: [] };
  // Manual cash/tuition overrides are exploratory and must not replace the saved-plan baseline.
  if (options.openingCash !== null || options.tuition) return { ...report, goalChanges: { ...changes, status: 'scenario', summary: 'Exploring custom cash or tuition. This scenario does not replace your saved-plan comparison.' } };
  if (!repository.workspace() || financialFingerprint(repository.state()) !== financialFingerprint(original))
    return { ...report, goalChanges: { ...changes, status: 'changed_during_run', summary: 'Your data changed during this calculation. Refresh for a current goal comparison.' } };
  const key = hash({ version: report.version, source: report.source, horizon: report.horizonDays, inflation: options.inflation });
  const fingerprint = hash({ financial: financialFingerprint(original), economy: report.economy ? { period: report.economy.period, status: report.economy.status === 'unavailable' ? 'unavailable' : 'available', categories: report.economy.categories } : null });
  const history = repository.store.get<History>('forecastHistory', {});
  const previousBucket = history[key];
  const same = previousBucket?.current.fingerprint === fingerprint;
  const current: Snapshot = same ? previousBucket.current : { fingerprint, savedAt: new Date().toISOString(), asOf: report.asOf, goals: (report.goals || []).map((g) => ({ id: g.id, date: g.projectedDate })) };
  const previous = same ? previousBucket.previous : previousBucket?.current || null;
  changes.savedAt = current.savedAt;
  changes.previousAt = previous?.savedAt || null;
  if (previous) {
    changes.status = 'compared';
    changes.summary = 'Compared with your previous saved-plan forecast using the same horizon and inflation settings. Spending, balances, plans and published prices can all affect the dates.';
  }
  changes.goals = (report.goals || []).map((goal) => {
    const older = previous?.goals.find((g) => g.id === goal.id);
    const shift = older?.date && goal.projectedDate ? Math.round((Date.parse(goal.projectedDate) - Date.parse(older.date)) / 86400000) : null;
    const change = !older ? 'new' : shift !== null ? shift > 0 ? 'later' : shift < 0 ? 'earlier' : 'unchanged' : !older.date && goal.projectedDate ? 'now_reachable' : older.date && !goal.projectedDate ? 'outside_horizon' : 'unchanged';
    return { id: goal.id, previousDate: older?.date || null, currentDate: goal.projectedDate, shiftDays: shift, change };
  });
  if (!same) {
    history[key] = { current, previous };
    const bounded = Object.fromEntries(Object.entries(history).sort((a, b) => b[1].current.savedAt.localeCompare(a[1].current.savedAt)).slice(0, 8));
    repository.store.transaction(() => repository.store.set('forecastHistory', bounded));
  }
  return { ...report, goalChanges: changes };
}
