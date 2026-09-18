import { z } from 'zod';

export const cpiSeriesSchema = z.object({
  key: z.enum(['all', 'groceries', 'dining', 'household', 'clothing', 'transit', 'health', 'recreation']),
  label: z.string().max(120),
  vector: z.number().int().positive(),
  points: z.array(z.object({
    period: z.string().regex(/^\d{4}-\d{2}-01$/),
    value: z.number().finite().positive(),
    releasedAt: z.string().max(40),
  })).max(60),
});
export const economicContextSchema = z.object({
  region: z.enum(['Ontario', 'Canada']),
  status: z.enum(['live', 'cached', 'unavailable', 'demo']),
  fetchedAt: z.string().nullable(),
  sourceUrl: z.literal('https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401'),
  series: z.array(cpiSeriesSchema).max(8),
});
export type EconomicContext = z.infer<typeof economicContextSchema>;
export const CPI_SOURCE = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401';

export interface EconomyReport {
  status: string;
  mode: 'observed' | 'custom' | 'off';
  region: string;
  period: string | null;
  fetchedAt: string | null;
  sourceUrl: string;
  weightedAnnualRate: number | null;
  extraCost: number;
  extraCostNext30: number;
  historicalNormalization: boolean;
  categories: { category: string; sourceLabel: string; annualRate: number; monthlySpend: number }[];
  notes: string[];
}
