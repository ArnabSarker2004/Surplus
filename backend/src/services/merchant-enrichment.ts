import { createHash } from 'node:crypto';
import { z } from 'zod';
import { categorySchema, type Transaction } from '../../../shared/schema';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { intelligenceToken } from '../config/intelligence';
import { automaticMerchant, merchantDetails } from '../../../shared/merchants';
import { applyAutomaticCleanup } from '../../../shared/transaction-cleanup';
import { merchantCleanupVersion } from '../../../shared/local-merchants';

const version = merchantCleanupVersion;
const rowSchema = z
  .object({
    key: z.string().regex(/^[a-f0-9]{64}$/),
    cleaned: z.string().max(250),
    merchant: z.string().min(1).max(120).nullable(),
    category: categorySchema.nullable(),
    method: z.enum(['local', 'groq', 'unresolved']),
    model: z.string().max(120).nullable(),
    attempted: z.boolean(),
    externalEligible: z.boolean(),
  })
  .strict();
const responseSchema = z
  .object({
    version: z.literal(version),
    items: z.array(rowSchema).max(1000),
    status: z.enum(['local', 'not_configured', 'rate_limited', 'suggestions', 'unavailable']),
    configured: z.boolean(),
  })
  .strict();
type Cache = { entries: Record<string, NonNullable<Transaction['enrichment']>>; status?: string };
function reusable(entry: Transaction['enrichment'], external: boolean) {
  if (!entry) return false;
  // Unsent eligible descriptors stay queued, even after a provider cooldown.
  const lifetime =
    !external || entry.externalEligible === false || entry.method !== 'unresolved'
      ? 90 * 86400000
      : entry.attempted
        ? 86400000
        : 0;
  return Date.now() - Date.parse(entry.updatedAt) < lifetime;
}
export function enrichmentKey(t: Transaction, external: boolean) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        version,
        t.source,
        t.description,
        external,
        external ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b' : null,
      ]),
    )
    .digest('hex');
}
export function enrichmentSnapshot(repo: WorkspaceRepository) {
  const source = repo.workspace()?.source;
  const external =
    repo.workspace()?.intelligenceSettings?.groqEnrichment === true && source === 'live';
  const cache = repo.store.get<Cache>('merchantEnrichment', { entries: {} });
  const candidates = repo
    .transactions()
    .filter(
      (t) =>
        t.source === source &&
        t.description.trim().length > 0 &&
        !t.pending &&
        t.cashFlow < 0 &&
        t.classification !== 'Transfer' &&
        !t.merchantOverride &&
        !t.userCorrected &&
        t.categoryOrigin !== 'rule' &&
        automaticMerchant(t)?.method !== 'local' &&
        (!['HIGH', 'VERY_HIGH'].includes(merchantDetails(t).confidence) ||
          /^[a-z]{2,4}$/i.test(merchantDetails(t).name || '') ||
          (t.category === 'Other' && !['HIGH', 'VERY_HIGH'].includes(t.confidence))) &&
        !/\b(?:INTERAC|E[ -]?TRANSFER|ETRNSFR|PAYROLL|DIRECT DEPOSIT|ACCOUNT|ACCT|IBAN)\b/i.test(
          t.description,
        ),
    );
  const unique = new Map(candidates.map((t) => [enrichmentKey(t, external), t.description]));
  const items = [...unique]
    .filter(([key]) => {
      return !reusable(cache.entries[key], external);
    })
    // First-time lookups precede expired misses, avoiding backlog starvation.
    .sort(
      ([a], [b]) =>
        Number(Boolean(cache.entries[a]?.attempted)) - Number(Boolean(cache.entries[b]?.attempted)),
    )
    .slice(0, 1000)
    .map(([key, raw]) => ({ key, raw: raw.slice(0, 250) }));
  return { source, external, cache, items };
}
export async function requestEnrichment(snapshot: ReturnType<typeof enrichmentSnapshot>) {
  if (!snapshot.items.length) return null;
  const url = new URL(process.env.INTELLIGENCE_SERVICE_URL || 'http://127.0.0.1:8001');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    return null;
  try {
    const response = await fetch(new URL('/v1/enrich', url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${intelligenceToken()}`,
      },
      body: JSON.stringify({ items: snapshot.items, allowExternal: snapshot.external }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const parsed = responseSchema.parse(await response.json());
    const keys = new Set(snapshot.items.map((i) => i.key));
    if (
      new Set(parsed.items.map((i) => i.key)).size !== parsed.items.length ||
      parsed.items.length !== keys.size ||
      parsed.items.some((i) => !keys.has(i.key))
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
export function applyEnrichment(
  repo: WorkspaceRepository,
  snapshot: ReturnType<typeof enrichmentSnapshot>,
  response: Awaited<ReturnType<typeof requestEnrichment>>,
) {
  if (
    repo.workspace()?.source !== snapshot.source ||
    (repo.workspace()?.intelligenceSettings?.groqEnrichment === true &&
      snapshot.source === 'live') !== snapshot.external
  )
    return;
  const current = repo.store.get<Cache>('merchantEnrichment', { entries: {} });
  const entries = { ...current.entries };
  for (const row of response?.items || []) {
    // A transient outage or cooldown must not erase a previously useful result.
    if (row.method === 'unresolved' && !row.attempted && entries[row.key]?.merchant) continue;
    entries[row.key] = {
      descriptorHash: row.key,
      cleaned: row.cleaned,
      merchant: row.merchant,
      category: row.category,
      method: row.method,
      model: row.model,
      attempted: row.attempted,
      externalEligible: row.externalEligible,
      updatedAt: new Date().toISOString(),
    };
  }
  const bounded = Object.fromEntries(
    Object.entries(entries)
      .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
      .slice(0, 2000),
  );
  repo.store.transaction(() => {
    repo.store.set('merchantEnrichment', {
      entries: bounded,
      status: response?.status || (snapshot.items.length ? 'unavailable' : 'cached'),
    });
    repo.store.set(
      'transactions',
      repo.transactions().map((t) => {
        if (
          t.source !== snapshot.source ||
          t.merchantOverride ||
          t.userCorrected ||
          t.categoryOrigin === 'rule'
        )
          return t;
        const entry = bounded[enrichmentKey(t, snapshot.external)];
        return applyAutomaticCleanup(entry ? { ...t, enrichment: entry } : t);
      }),
    );
  });
}
export async function enrichWorkspace(repo: WorkspaceRepository) {
  const snapshot = enrichmentSnapshot(repo);
  applyEnrichment(repo, snapshot, await requestEnrichment(snapshot));
}
export function enrichmentStatus(repo: WorkspaceRepository) {
  return {
    configured: Boolean(process.env.GROQ_API_KEY),
    status: repo.store.get<Cache>('merchantEnrichment', { entries: {} }).status || 'idle',
    remaining: enrichmentSnapshot(repo).items.length,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  };
}
