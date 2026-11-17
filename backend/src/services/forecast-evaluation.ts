import { createHash } from 'node:crypto';
import type { Account, AppState } from '../../../shared/schema';
import type { ForecastReport } from '../../../shared/intelligence';
import type { ForecastEvaluation } from '../../../shared/action-plan';
import type { WorkspaceRepository } from '../repositories/workspace-repository';

type Observation = {
  date: string;
  source: string;
  signature: string;
  cash: number;
  capturedAt: string;
};
type Prediction = {
  date: string;
  source: string;
  signature: string;
  targets: { days: number; date: string; median: number; low: number; high: number }[];
};
type Journal = { observations: Observation[]; predictions: Prediction[] };
const blank = (): Journal => ({ observations: [], predictions: [] });
const round = (x: number) => Math.round(x * 100) / 100;
const signature = (accounts: Account[]) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        accounts
          .filter((a) => a.currency === 'CAD' && ['depository', 'credit'].includes(a.type))
          .map((a) => [a.id, a.type, a.balanceKnown !== false])
          .sort(),
      ),
    )
    .digest('hex');
export const torontoDate = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export function observeBalances(repository: WorkspaceRepository, source: string, now = new Date()) {
  const accounts = repository.accounts().filter((a) => a.source === source);
  if (
    !accounts.some((a) => a.currency === 'CAD' && a.type === 'depository') ||
    accounts.some(
      (a) =>
        a.currency === 'CAD' &&
        ['depository', 'credit'].includes(a.type) &&
        a.balanceKnown === false,
    )
  )
    return;
  const date = torontoDate(now);
  const cash =
    accounts
      .filter((a) => a.currency === 'CAD')
      .reduce(
        (s, a) =>
          s +
          (a.type === 'depository' ? a.balance : a.type === 'credit' ? -Math.max(0, a.balance) : 0),
        0,
      ) -
    repository
      .transactions()
      .filter(
        (t) =>
          t.source === source &&
          t.currency === 'CAD' &&
          t.pending &&
          t.cashFlow < 0 &&
          t.classification !== 'Transfer',
      )
      .reduce((s, t) => s - t.cashFlow, 0);
  const journal = {
    ...blank(),
    ...repository.store.get<Partial<Journal>>('intelligenceJournal', {}),
  };
  journal.observations = [
    ...journal.observations.filter((o) => o.date !== date || o.source !== source),
    {
      date,
      source,
      cash: round(cash),
      signature: signature(accounts),
      capturedAt: now.toISOString(),
    },
  ].slice(-800);
  repository.store.set('intelligenceJournal', journal);
}

export function evaluateForecast(
  repository: WorkspaceRepository,
  state: AppState,
  report: ForecastReport,
  baseline: boolean,
): ForecastEvaluation {
  const journal = {
    ...blank(),
    ...repository.store.get<Partial<Journal>>('intelligenceJournal', {}),
  };
  const matches: ForecastEvaluation['latest'] = [];
  for (const p of journal.predictions.filter((p) => p.source === report.source)) {
    for (const t of p.targets) {
      const o = journal.observations.find(
        (o) => o.date === t.date && o.source === p.source && o.signature === p.signature,
      );
      if (o)
        matches.push({
          predictedOn: p.date,
          observedOn: o.date,
          days: t.days,
          predicted: t.median,
          actual: o.cash,
          low: t.low,
          high: t.high,
          error: round(o.cash - t.median),
          covered: o.cash >= t.low && o.cash <= t.high,
        });
    }
  }
  if (
    baseline &&
    report.source !== 'demo' &&
    report.quality?.cashKnown &&
    journal.observations.some(
      (o) =>
        o.date === report.asOf &&
        o.source === report.source &&
        o.signature === signature(state.accounts),
    ) &&
    !journal.predictions.some((p) => p.date === report.asOf && p.source === report.source)
  ) {
    // Keep the first issued baseline of the day. Later knowledge cannot revise its predictions.
    const targets = [7, 30, 90].flatMap((days) => {
      const point = report.timeline?.[days];
      return point?.median != null && point.low != null && point.high != null
        ? [{ days, date: point.date, median: point.median, low: point.low, high: point.high }]
        : [];
    });
    if (targets.length) {
      journal.predictions = [
        ...journal.predictions,
        { date: report.asOf, source: report.source, signature: signature(state.accounts), targets },
      ].slice(-540);
      repository.store.transaction(() => repository.store.set('intelligenceJournal', journal));
    }
  }
  return {
    status: !baseline ? 'scenario' : matches.length ? 'available' : 'collecting',
    note: 'Compares previously issued baseline forecasts with same-date synced CAD balances after credit and pending reserves. Cached bank balances are observations, not verified daily closing balances. Changed account coverage and dates without a sync are not scored. Small or overlapping samples do not establish calibrated probabilities.',
    checkpoints: [7, 30, 90].map((days) => {
      const rows = matches.filter((m) => m.days === days);
      return {
        days,
        count: rows.length,
        mae: rows.length
          ? round(rows.reduce((s, m) => s + Math.abs(m.error), 0) / rows.length)
          : null,
        coverage: rows.length
          ? round((rows.filter((m) => m.covered).length / rows.length) * 100)
          : null,
      };
    }),
    latest: matches.sort((a, b) => b.observedOn.localeCompare(a.observedOn)).slice(0, 9),
  };
}
