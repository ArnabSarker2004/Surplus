import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import {
  enrichmentSnapshot,
  applyEnrichment,
  requestEnrichment,
} from '../backend/src/services/merchant-enrichment';
import { TransactionService } from '../backend/src/services/transaction-service';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import { defaultForecastOptions } from '../shared/intelligence';
import { normalize } from '../shared/finance';
import { applyAutomaticCleanup } from '../shared/transaction-cleanup';
import { merchantName, merchantEvidence } from '../shared/merchants';
import { localMerchant, merchantCleanupVersion } from '../shared/local-merchants';
import regionalFixtures from './fixtures/toronto-merchants.json';
import { categories } from '../shared/schema';

test('Toronto descriptor cases resolve identically to the Python fixture and reject lookalikes', () => {
  for (const { raw, merchant, category } of regionalFixtures.positive) {
    assert.deepEqual(localMerchant(raw), { name: merchant, category, method: 'local' }, raw);
    if (category) assert.ok(categories.includes(category as (typeof categories)[number]));
  }
  for (const raw of regionalFixtures.negative) assert.equal(localMerchant(raw), null, raw);
});

test('PRES and regional cleanup repair history and forecast inputs without Groq or resync', () => {
  const raw = {
    transaction_id: 'presto',
    account_id: 'cash',
    date: '2026-09-04',
    name: 'PRES/A1B2C3D4E5 TORONTO ON CAN',
    merchant_name: 'PRES/A1B2C3D4E5 TORONTO ON CAN',
    amount: 3.3,
    pending: false,
    iso_currency_code: 'CAD',
  };
  const t = normalize(raw, [], undefined, 'live');
  assert.equal(t.category, 'TTC and PRESTO');
  assert.equal(t.classification, 'Essential');
  assert.equal(merchantName(t), 'PRESTO');
  const repo = new WorkspaceRepository(new MemoryDocuments({}));
  repo.seedDemo();
  repo.save({ ...repo.workspace()!, source: 'live' });
  repo.store.set('transactions', [
    { ...t, category: 'Other', categoryOrigin: 'review', classification: 'Review' },
  ]);
  assert.equal(enrichmentSnapshot(repo).items.length, 0);
  const payload = forecastPayload(repo.state(), defaultForecastOptions).transactions[0];
  assert.equal(payload.category, 'TTC and PRESTO');
  assert.equal(payload.merchant, 'PRESTO');
  assert.equal(payload.merchantKey, 'auto:local:presto');
  assert.equal(payload.merchantConfidence, 'LOCAL_RULE');
  assert.equal(payload.cashFlow, -3.3);
  assert.equal(repo.state().transactions[0].description, raw.name);
  const previous = {
    ...t,
    category: 'Eating Out' as const,
    categoryOrigin: 'enrichment' as const,
    enrichment: {
      descriptorHash: 'old',
      cleaned: 'PRES',
      merchant: 'Wrong old AI guess',
      category: 'Eating Out' as const,
      method: 'groq' as const,
      model: 'old',
      updatedAt: new Date().toISOString(),
    },
  };
  assert.equal(merchantName(previous), 'PRESTO');
  assert.equal(applyAutomaticCleanup(previous).category, 'TTC and PRESTO');
  for (const protectedRow of [
    { ...previous, userCorrected: true },
    { ...previous, categoryOrigin: 'rule' as const },
    { ...previous, pending: true },
    { ...previous, cashFlow: 3.3 },
    { ...previous, classification: 'Transfer' as const },
    { ...previous, splits: [{ category: 'Eating Out' as const, amount: 3.3 }] },
  ])
    assert.equal(applyAutomaticCleanup(protectedRow), protectedRow);
  const corrected = {
    ...previous,
    userCorrected: true,
    merchantCorrected: true,
    merchantOverride: 'My edit',
  };
  assert.equal(merchantName(corrected), 'My edit');
  assert.equal(merchantName(normalize(raw, [], corrected, 'live')), 'My edit');
  assert.equal(merchantCleanupVersion, 'merchant-cleanup-3');
});

test('campus and retailer recognition leaves ambiguous purpose and strong bank categories intact', () => {
  const make = (name: string) =>
    normalize({
      transaction_id: name,
      account_id: 'a',
      date: '2026-09-04',
      name,
      amount: 12,
      pending: false,
      iso_currency_code: 'CAD',
    });
  for (const name of [
    'TMU',
    'TMU ONECARD LOAD TORONTO ON',
    'TELEPHONE ORDER 28JUL2026TMU FIN SERVICES ON',
    'PRESTO PIZZA',
    'TTC TREASURY SERVICES',
  ])
    assert.equal(make(name).category, 'Other', name);
  assert.equal(make('TMU FOOD SERVICES TORONTO ON').category, 'Eating Out');
  assert.equal(make('RYERSON UNIVERSITY PRINTING TORONTO ON').category, 'Textbooks and Supplies');
  const foody = {
    ...make('FOODY WORLD SCARBOROUGH ON CAN'),
    category: 'Eating Out' as const,
    categoryOrigin: 'enrichment' as const,
  };
  assert.equal(applyAutomaticCleanup(foody).category, 'Groceries');
  const specific = { ...foody, categoryOrigin: 'plaid' as const, confidence: 'HIGH' };
  assert.equal(applyAutomaticCleanup(specific), specific);
  const oldCampusGuess = {
    ...make('TMU ONECARD LOAD'),
    category: 'Tuition and School' as const,
    categoryOrigin: 'enrichment' as const,
  };
  const reviewed = applyAutomaticCleanup(oldCampusGuess);
  assert.equal(reviewed.category, 'Other');
  assert.equal(reviewed.classification, 'Review');
  assert.equal(applyAutomaticCleanup(reviewed), reviewed);
});

test('remembered PRESTO edits follow changing bank references and preserve legacy saved rules', () => {
  const make = (id: string, reference: string) => ({
    transaction_id: id,
    account_id: 'a',
    date: '2026-09-04',
    name: `PRES/${reference} TORONTO ON CAN`,
    amount: 3.3,
    pending: false,
    iso_currency_code: 'CAD',
  });
  const a = make('a', 'A1B2C3D4E5'),
    b = make('b', 'B1C2D3E4F5'),
    c = make('c', 'C1D2E3F4G5');
  const repo = new WorkspaceRepository(new MemoryDocuments({}));
  repo.seedDemo();
  repo.save({ ...repo.workspace()!, source: 'live' });
  repo.store.set('transactions', [
    normalize(a, [], undefined, 'live'),
    normalize(b, [], undefined, 'live'),
  ]);
  new TransactionService(repo).correct('a', {
    category: 'Other',
    saveRule: true,
    merchantOverride: 'My transit',
  });
  assert.ok(
    repo
      .state()
      .transactions.every((t) => t.category === 'Other' && merchantName(t) === 'My transit'),
  );
  assert.equal(repo.rules()[0].merchantKey, 'local:presto');
  const next = normalize(c, repo.rules(), undefined, 'live');
  assert.equal(next.category, 'Other');
  assert.equal(merchantName(next), 'My transit');
  const legacy = normalize(
    a,
    [
      {
        merchant: a.name,
        merchantKey: `name:${a.name.toLowerCase()}`,
        category: 'Other',
        classification: 'Review',
        source: 'live',
      },
    ],
    undefined,
    'live',
  );
  assert.equal(legacy.category, 'Other');
  assert.equal(legacy.categoryOrigin, 'rule');
});

test('enrichment caches exact descriptors per source and never overwrites bank data or user choices', () => {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  const original = repo.transactions().find((t) => t.cashFlow < 0)!;
  const row = {
    ...original,
    description: 'SQ * UNKNOWN SHOP #22 ON',
    merchantDetails: undefined,
    merchantOverride: null,
    userCorrected: false,
    categoryOrigin: 'review' as const,
    classification: 'Review' as const,
  };
  store.set('transactions', [row, { ...row, id: row.id + 'other' }]);
  const snapshot = enrichmentSnapshot(repo);
  assert.equal(snapshot.items.length, 1);
  const key = snapshot.items[0].key;
  const result = {
    version: 'merchant-cleanup-3' as const,
    status: 'suggestions' as const,
    configured: true,
    items: [
      {
        key,
        cleaned: 'UNKNOWN SHOP',
        merchant: 'Suggested Shop',
        category: 'Shopping' as const,
        method: 'groq' as const,
        model: 'test',
        attempted: true,
        externalEligible: true,
      },
    ],
  };
  applyEnrichment(repo, snapshot, result);
  assert.equal(repo.transactions()[0].description, row.description);
  assert.equal(repo.transactions()[0].category, row.category);
  assert.equal(repo.transactions()[0].cashFlow, row.cashFlow);
  assert.equal(enrichmentSnapshot(repo).items.length, 0);
  new TransactionService(repo).correct(row.id, {
    category: 'Groceries',
    merchantOverride: 'My correction',
    saveRule: false,
  });
  applyEnrichment(repo, snapshot, result);
  assert.equal(repo.transactions()[0].merchantOverride, 'My correction');
  assert.equal(repo.transactions()[0].category, 'Groceries');
  const payload = forecastPayload(repo.state(), defaultForecastOptions).transactions[0];
  assert.equal(payload.merchant, 'My correction');
  assert.equal(payload.merchantKey, 'user:my correction');
  assert.equal(payload.category, 'Groceries');
  assert.equal(payload.categoryOrigin, 'user');
  assert.equal(payload.cashFlow, row.cashFlow);
  assert.equal(payload.merchantConfidence, 'USER');
  repo.clear();
  assert.deepEqual(store.get('merchantEnrichment', {}), {});
});

test('enrichment advances beyond a batch, caches ineligible descriptors and survives cooldowns', () => {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  repo.save({
    ...repo.workspace()!,
    source: 'live',
    intelligenceSettings: {
      autoSync: false,
      alerts: true,
      dismissed: [],
      groqEnrichment: true,
    },
  });
  const row = repo.transactions().find((t) => t.cashFlow < 0)!;
  store.set(
    'transactions',
    Array.from({ length: 25 }, (_, i) => ({
      ...row,
      id: `unresolved-${i}`,
      source: 'live',
      description: `SQ * UNKNOWN STORE ${i}`,
      merchantDetails: undefined,
      merchantOverride: null,
      userCorrected: false,
      categoryOrigin: 'review',
      classification: 'Review',
    })),
  );
  const snapshot = enrichmentSnapshot(repo);
  assert.equal(snapshot.items.length, 25);
  const response = {
    version: 'merchant-cleanup-3' as const,
    status: 'suggestions' as const,
    configured: true,
    items: snapshot.items.map((item, i) => ({
      key: item.key,
      cleaned: item.raw,
      merchant: i < 20 ? `Shop ${i}` : null,
      category: i < 20 ? ('Shopping' as const) : null,
      method: i < 20 ? ('groq' as const) : ('unresolved' as const),
      model: i < 20 ? 'test' : null,
      attempted: i < 20,
      externalEligible: i !== 24,
    })),
  };
  applyEnrichment(repo, snapshot, response);
  const remaining = enrichmentSnapshot(repo);
  assert.deepEqual(
    remaining.items.map((item) => item.key),
    snapshot.items.slice(20, 24).map((item) => item.key),
  );
  applyEnrichment(repo, remaining, {
    ...response,
    status: 'rate_limited',
    items: response.items.slice(20, 24),
  });
  assert.equal(enrichmentSnapshot(repo).items.length, 4);
  const prior = repo.transactions()[0].enrichment;
  applyEnrichment(repo, snapshot, {
    ...response,
    status: 'unavailable',
    items: [
      {
        ...response.items[0],
        merchant: null,
        category: null,
        method: 'unresolved',
        attempted: false,
      },
    ],
  });
  assert.deepEqual(repo.transactions()[0].enrichment, prior);
  // Opting out while a request is in flight discards it entirely.
  repo.save({
    ...repo.workspace()!,
    intelligenceSettings: { ...repo.workspace()!.intelligenceSettings!, groqEnrichment: false },
  });
  const before = repo.transactions();
  applyEnrichment(repo, snapshot, response);
  assert.deepEqual(repo.transactions(), before);
});

test('backend rejects incomplete or duplicate Python mappings before caching suggestions', async () => {
  const repo = new WorkspaceRepository(new MemoryDocuments({}));
  repo.seedDemo();
  const snapshot = enrichmentSnapshot(repo);
  const original = globalThis.fetch;
  try {
    const row = {
      key: snapshot.items[0].key,
      cleaned: 'Shop',
      merchant: 'Shop',
      category: 'Shopping',
      method: 'groq',
      model: 'test',
      attempted: true,
      externalEligible: true,
    };
    for (const items of [[], [row, row], [{ ...row, key: 'f'.repeat(64) }]]) {
      globalThis.fetch = async () =>
        Response.json({
          version: 'merchant-cleanup-3',
          status: 'suggestions',
          configured: true,
          items,
        });
      assert.equal(await requestEnrichment(snapshot), null);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('provider failure and changed-source responses leave original financial data intact', async () => {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  const snapshot = enrichmentSnapshot(repo);
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    assert.equal(await requestEnrichment(snapshot), null);
  } finally {
    globalThis.fetch = old;
  }
  repo.save({ ...repo.workspace()!, source: 'manual' });
  const before = repo.transactions();
  applyEnrichment(repo, snapshot, null);
  assert.deepEqual(repo.transactions(), before);
  assert.deepEqual(store.get('merchantEnrichment', {}), {});
});

test('SDM retail descriptors expand on import and existing history without a provider call', () => {
  const raw = {
    transaction_id: 'sdm',
    account_id: 'chequing',
    name: 'SDM1382 SCARBOROUGH ON CAN',
    merchant_name: 'Sdm',
    date: '2026-09-04',
    amount: 19.76,
    iso_currency_code: 'CAD',
    pending: false,
    counterparties: [
      { name: 'Sdm', type: 'merchant', confidence_level: 'HIGH', entity_id: 'sdm-entity' },
    ],
    personal_finance_category: {
      primary: 'GENERAL_MERCHANDISE',
      detailed: 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE',
      confidence_level: 'LOW',
    },
  };
  const t = normalize(raw, [], undefined, 'live');
  assert.equal(merchantName(t), 'Shoppers Drug Mart');
  assert.equal(merchantEvidence(t), 'Automatically cleaned');
  assert.equal(t.category, 'Shopping');
  assert.equal(t.categoryOrigin, 'enrichment');
  assert.equal(t.merchant, 'Sdm');
  assert.equal(t.description, raw.name);
  assert.equal(t.cashFlow, -19.76);
  assert.equal(t.userCorrected, false);
  assert.equal(applyAutomaticCleanup(t), t);
  const repo = new WorkspaceRepository(new MemoryDocuments({}));
  repo.seedDemo();
  repo.save({ ...repo.workspace()!, source: 'live' });
  repo.store.set('transactions', [
    { ...t, category: 'Other', classification: 'Review', categoryOrigin: 'review' },
  ]);
  assert.equal(repo.state().transactions[0].category, 'Shopping');
  assert.equal(enrichmentSnapshot(repo).items.length, 0);
  const payload = forecastPayload(repo.state(), defaultForecastOptions).transactions[0];
  assert.equal(payload.merchant, 'Shoppers Drug Mart');
  assert.equal(payload.merchantConfidence, 'LOCAL_RULE');
  assert.equal(payload.cashFlow, -19.76);
  for (const name of ['SDM', 'SDM Consulting', 'SDM1382 SCARBOROUGH NY USA']) {
    assert.equal(merchantName(normalize({ ...raw, name })), 'Sdm');
  }
  const corrected = {
    ...t,
    userCorrected: true,
    merchantOverride: 'My pharmacy',
    merchantCorrected: true,
    category: 'Healthcare' as const,
  };
  const synced = normalize(raw, [], corrected, 'live');
  assert.equal(merchantName(synced), 'My pharmacy');
  assert.equal(synced.category, 'Healthcare');
  const specific = normalize({
    ...raw,
    personal_finance_category: {
      primary: 'MEDICAL',
      detailed: 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS',
      confidence_level: 'HIGH',
    },
  });
  assert.equal(specific.category, 'Healthcare');
});

test('automatic estimates feed the models while protecting corrections, transfers and strong categories', () => {
  const original = normalize(
    {
      transaction_id: 'auto',
      account_id: 'cash',
      date: '2026-09-04',
      name: 'SQ * UNKNOWN SHOP',
      amount: 12,
      pending: false,
      iso_currency_code: 'CAD',
    },
    [],
    undefined,
    'demo',
  );
  const enrichment = {
    descriptorHash: 'test',
    cleaned: 'UNKNOWN SHOP',
    merchant: 'Neighbourhood Coffee',
    category: 'Coffee' as const,
    method: 'groq' as const,
    model: 'test',
    updatedAt: new Date().toISOString(),
  };
  const row = { ...original, enrichment };
  const applied = applyAutomaticCleanup(row);
  assert.equal(applied.category, 'Coffee');
  assert.equal(applied.classification, 'Discretionary');
  assert.equal(applied.categoryOrigin, 'enrichment');
  assert.equal(merchantName(applied), enrichment.merchant);
  assert.equal(merchantEvidence(applied), 'AI name · editable');
  assert.equal(applied.description, original.description);
  assert.equal(applied.merchantOverride, null);
  assert.equal(applyAutomaticCleanup(applied), applied);
  for (const protectedRow of [
    { ...row, userCorrected: true },
    { ...row, categoryOrigin: 'rule' as const },
    { ...row, category: 'Housing' as const },
    { ...row, confidence: 'HIGH' },
    { ...row, cashFlow: 12 },
    { ...row, classification: 'Transfer' as const },
    { ...row, pending: true },
    { ...row, splits: [{ category: 'Coffee' as const, amount: 12 }] },
  ])
    assert.equal(applyAutomaticCleanup(protectedRow), protectedRow);
  const bad = { ...row, enrichment: { ...enrichment, merchant: 'PAYPAL' } };
  assert.equal(applyAutomaticCleanup(bad), bad);
  const conflicting = {
    ...row,
    merchantDetails: {
      ...row.merchantDetails!,
      name: 'Trusted shop',
      source: 'plaid_counterparty' as const,
      confidence: 'HIGH' as const,
    },
  };
  assert.equal(applyAutomaticCleanup(conflicting), conflicting);
  const repo = new WorkspaceRepository(new MemoryDocuments({}));
  repo.seedDemo();
  repo.store.set('transactions', [row]);
  const payload = forecastPayload(repo.state(), defaultForecastOptions).transactions[0];
  assert.equal(payload.category, 'Coffee');
  assert.equal(payload.merchantSource, 'groq');
  assert.equal(payload.merchantConfidence, 'AI_ESTIMATE');
  assert.equal(payload.categoryOrigin, 'enrichment');
});
