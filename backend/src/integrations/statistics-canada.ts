import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { CPI_SOURCE, economicContextSchema, type EconomicContext } from '../../../shared/economy';

const endpoint = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods';
export const cpiGroups = [
  { id: 2, key: 'all', label: 'All items' },
  { id: 4, key: 'groceries', label: 'Food purchased from stores' },
  { id: 75, key: 'dining', label: 'Food purchased from restaurants' },
  { id: 96, key: 'household', label: 'Household operations, furnishings and equipment' },
  { id: 139, key: 'clothing', label: 'Clothing and footwear' },
  { id: 194, key: 'transit', label: 'Public transportation' },
  { id: 201, key: 'health', label: 'Health and personal care' },
  { id: 219, key: 'recreation', label: 'Recreation, education and reading' },
] as const;
const point = z.object({
  refPer: z.string().regex(/^\d{4}-\d{2}-01$/), value: z.number().finite().positive(),
  scalarFactorCode: z.literal(0), securityLevelCode: z.literal(0), frequencyCode: z.literal(6),
  statusCode: z.literal(0), releaseTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
});

export function parseCpiResponse(input: unknown, region: EconomicContext['region'], fetchedAt: string): EconomicContext {
  const rows = z.array(z.object({ status: z.literal('SUCCESS'), object: z.object({
    productId: z.literal(18100004), coordinate: z.string(), vectorId: z.number().int().positive(),
    vectorDataPoint: z.array(z.unknown()).max(60),
  }) })).parse(input);
  const geo = region === 'Ontario' ? 14 : 2;
  const series = cpiGroups.map((group) => {
    const matches = rows.filter((row) => row.object.coordinate === `${geo}.${group.id}.0.0.0.0.0.0.0.0`);
    if (matches.length !== 1) throw new Error('Incomplete or duplicate public CPI series');
    const row = matches[0].object;
    const points = row.vectorDataPoint.flatMap((raw) => {
      const checked = point.safeParse(raw);
      return checked.success ? [{ period: checked.data.refPer, value: checked.data.value, releasedAt: checked.data.releaseTime }] : [];
    }).sort((a, b) => a.period.localeCompare(b.period));
    if (points.length < 13 || new Set(points.map((p) => p.period)).size !== points.length)
      throw new Error('Not enough valid monthly CPI observations');
    return { key: group.key, label: group.label, vector: row.vectorId, points };
  });
  return economicContextSchema.parse({ region, status: 'live', fetchedAt, sourceUrl: CPI_SOURCE, series });
}

/** Public data only: requests contain fixed table coordinates, never personal spending. */
export class StatisticsCanadaCpi {
  private flights = new Map<string, Promise<EconomicContext>>();
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args), private directory = resolve(process.env.SURPLUS_DATA_DIR || 'data', 'public-data')) {}
  async load(region: EconomicContext['region']): Promise<EconomicContext> {
    const existing = this.flights.get(region);
    if (existing) return existing;
    const work = this.refresh(region);
    this.flights.set(region, work);
    try { return await work; } finally { this.flights.delete(region); }
  }
  private async refresh(region: EconomicContext['region']): Promise<EconomicContext> {
    const file = resolve(this.directory, `cpi-${region.toLowerCase()}.json`);
    let cached: EconomicContext | null = null;
    try {
      const parsed = economicContextSchema.parse(JSON.parse(await readFile(file, 'utf8')));
      if (parsed.region === region && parsed.series.length === cpiGroups.length) cached = parsed;
    } catch { /* Missing or invalid public cache is replaced after a successful fetch. */ }
    const age = cached?.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
    if (cached && age >= 0 && age < 24 * 60 * 60 * 1000) return { ...cached, status: 'cached' };
    const unavailable: EconomicContext = { region, status: 'unavailable', fetchedAt: null, sourceUrl: CPI_SOURCE, series: [] };
    if (process.env.ECONOMIC_DATA_OFFLINE === '1') return cached ? { ...cached, status: 'cached' } : unavailable;
    try {
      const geo = region === 'Ontario' ? 14 : 2;
      const response = await this.fetcher(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cpiGroups.map((group) => ({ productId: 18100004, coordinate: `${geo}.${group.id}.0.0.0.0.0.0.0.0`, latestN: 37 }))),
        signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) throw new Error('Public CPI service unavailable');
      const raw = await response.text();
      if (raw.length > 1_000_000) throw new Error('Public CPI response too large');
      const result = parseCpiResponse(JSON.parse(raw), region, new Date().toISOString());
      try {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file + '.tmp', JSON.stringify(result));
        await rename(file + '.tmp', file);
      } catch { /* A cache write failure must not prevent a current forecast. */ }
      return result;
    } catch { return cached ? { ...cached, status: 'cached' } : unavailable; }
  }
}
export const statisticsCanadaCpi = new StatisticsCanadaCpi();
