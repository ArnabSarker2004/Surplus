import catalogue from './data/toronto-merchants.json';
import type { Category } from './schema';

export const merchantCleanupVersion = catalogue.version;
const prefix = new RegExp(catalogue.paymentPrefix, 'i');
const entries = catalogue.entries.map((entry) => ({
  ...entry,
  match: new RegExp(`^(?:${entry.pattern})${catalogue.suffix}$`, 'i'),
}));

/** Bounded descriptor matches shared with Python; never infer identity from proximity. */
export function localMerchant(raw: string) {
  // eslint-disable-next-line no-control-regex
  const controls = /[\u0000-\u001f\u007f]/g;
  let value = raw.replace(controls, ' ').trim().slice(0, 250);
  for (let i = 0; i < 4; i++) value = value.replace(prefix, '').trim();
  const entry = entries.find((candidate) => candidate.match.test(value));
  return entry
    ? {
        name: entry.merchant,
        category: entry.category as Category | null,
        method: 'local' as const,
      }
    : null;
}
