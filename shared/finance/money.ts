import type { Workspace } from '../schema';

export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const sum = (a: number[]) => round(a.reduce((s, n) => s + Math.round(n * 100), 0) / 100);
export const cad = (n: number, cents = false) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(n);
export const today = () => new Date().toISOString().slice(0, 10);
export const demoToday = '2026-09-16';
export const asOf = (w: Workspace) => (w.source === 'demo' ? demoToday : today());
export const prettyDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
export function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(start.slice(0, 7) + '-01T12:00:00Z');
  for (let i = 0; cursor.toISOString().slice(0, 7) <= end.slice(0, 7) && i < 24; i++) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}
export function occurrences(date: string, frequency: string, start: string, end: string): string[] {
  if (frequency === 'Once') return date >= start && date <= end ? [date] : [];
  const result: string[] = [];
  const anchor = new Date(date + 'T12:00:00Z');
  for (let i = 0; i < 1100; i++) {
    let d: Date;
    if (frequency === 'Monthly') {
      d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + i, 1, 12));
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(anchor.getUTCDate(), last));
    } else d = new Date(anchor.getTime() + i * (frequency === 'Weekly' ? 7 : 14) * 86400000);
    const value = d.toISOString().slice(0, 10);
    if (value > end) break;
    if (value >= start) result.push(value);
  }
  return result;
}
