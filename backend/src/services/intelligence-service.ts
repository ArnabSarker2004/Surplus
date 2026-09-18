import type { AppState } from '../../../shared/schema';
import { asOf } from '../../../shared/finance';
import {
  forecastOptionsSchema,
  type ForecastOptions,
  type ForecastReport,
} from '../../../shared/intelligence';
import { intelligenceToken } from '../config/intelligence';
import { AuthError } from './auth-service';
import { CPI_SOURCE, type EconomicContext } from '../../../shared/economy';
import { statisticsCanadaCpi } from '../integrations/statistics-canada';
import demoOntario from '../../../shared/data/cpi-demo-ontario.json';
import demoCanada from '../../../shared/data/cpi-demo-canada.json';

/** Whitelist only financial fields: no user identity, credentials, descriptions, or Plaid tokens. */
export function forecastPayload(
  state: AppState,
  options: ForecastOptions,
  syncedAt: string | null = null,
  economy?: EconomicContext,
) {
  const w = state.workspace;
  if (!w) throw new AuthError('Finish your semester setup before creating a forecast.', 409);
  const date = asOf(w);
  if (options.tuition && options.tuition.dueDate <= date)
    throw new AuthError('Choose a future tuition deadline.', 400);
  return {
    asOf: date,
    source: w.source,
    syncedAt,
    minimumBalance: w.semester.minimumBalance,
    options,
    economy: economy || { region: options.inflation.region, status: 'unavailable', fetchedAt: null, sourceUrl: CPI_SOURCE, series: [] },
    accounts: state.accounts
      .filter((a) => a.source === w.source)
      .map(({ id, type, balance, currency, source }) => ({ id, type, balance, currency, source })),
    transactions: state.transactions
      .filter((t) => t.source === w.source)
      .map(
        ({
          id,
          accountId,
          date,
          merchant,
          cashFlow,
          category,
          classification,
          currency,
          pending,
          source,
          habitTreatment,
        }) => ({
          id,
          accountId,
          date,
          merchant,
          cashFlow,
          category,
          classification,
          currency,
          pending,
          source,
          habitTreatment: habitTreatment || 'automatic',
        }),
      ),
    expenses: w.expenses.map(({ id, name, amount, date, category, frequency }) => ({
      id,
      name,
      amount,
      date,
      category,
      frequency,
    })),
    funding: w.funding.map(({ id, name, amount, date, endDate, type, status, frequency }) => ({
      id,
      name,
      amount,
      date,
      endDate,
      type,
      status,
      frequency,
    })),
    goals: w.goals.map(({ id, name, target, current, date, priority }) => ({
      id,
      name,
      target,
      current,
      date,
      priority,
    })),
  };
}

export async function forecast(
  state: AppState,
  input: unknown,
  syncedAt: string | null = null,
): Promise<ForecastReport> {
  const options = forecastOptionsSchema.parse(input);
  const payload = forecastPayload(state, options, syncedAt);
  if (options.inflation.mode === 'observed') {
    if (payload.source === 'demo') payload.economy = (options.inflation.region === 'Ontario' ? demoOntario : demoCanada) as EconomicContext;
    else if (payload.transactions.length) payload.economy = await statisticsCanadaCpi.load(options.inflation.region);
  }
  const url = new URL(process.env.INTELLIGENCE_SERVICE_URL || 'http://127.0.0.1:8001');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:')
    throw new AuthError('The intelligence service must use a local loopback address.', 503);
  try {
    const response = await fetch(new URL('/v1/forecast', url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${intelligenceToken()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error('Forecast service rejected the request');
    const report = (await response.json()) as ForecastReport;
    if (
      report.version !== 'surplus-forecast-1.0' ||
      report.asOf !== payload.asOf ||
      report.source !== payload.source ||
      !Array.isArray(report.timeline)
    )
      throw new Error('Invalid forecast response');
    return report;
  } catch {
    throw new AuthError(
      'The forecasting service is unavailable or busy. Start it with npm run intelligence:dev, then try again. Your plan and bank data are unchanged.',
      503,
    );
  }
}
