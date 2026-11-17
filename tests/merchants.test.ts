import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, type PlaidTransaction } from '../shared/finance';
import {
  categoryFromPlaid,
  merchantName,
  merchantRuleKey,
  merchantWebsite,
  modelMerchantKey,
  resolveMerchant,
  transactionDetail,
  validDetail,
} from '../shared/merchants';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { TransactionService } from '../backend/src/services/transaction-service';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import { defaultForecastOptions } from '../shared/intelligence';

const raw: PlaidTransaction = {
  transaction_id: 'one',
  account_id: 'cash',
  date: '2026-09-15',
  name: 'SQ * NORTH COFFEE 004',
  amount: 12,
  iso_currency_code: 'CAD',
  pending: false,
  personal_finance_category: {
    primary: 'FOOD_AND_DRINK',
    detailed: 'FOOD_AND_DRINK_COFFEE',
    confidence_level: 'VERY_HIGH',
  },
  counterparties: [
    { name: 'Square', type: 'payment_terminal', confidence_level: 'VERY_HIGH' },
    {
      name: 'North Coffee',
      entity_id: 'north',
      type: 'merchant',
      confidence_level: 'HIGH',
      website: 'north.example/menu',
    },
  ],
};

test('merchant evidence separates seller, processor, category confidence and safe website', () => {
  const result = normalize(raw);
  assert.equal(merchantName(result), 'North Coffee');
  assert.equal(result.merchantDetails?.confidence, 'HIGH');
  assert.equal(result.confidence, 'VERY_HIGH');
  assert.deepEqual(result.merchantDetails?.intermediaries, [
    { name: 'Square', type: 'payment_terminal' },
  ]);
  assert.equal(result.merchantDetails?.website, 'https://north.example/');
  assert.equal(transactionDetail(result)?.code, 'FOOD_AND_DRINK_COFFEE');
  assert.equal(result.description, raw.name);
  assert.equal(
    resolveMerchant({ name: 'NORTH', merchant_name: 'North Coffee' }).confidence,
    'UNKNOWN',
  );
  for (const url of [
    'javascript:alert(1)',
    'http://shop.example',
    'https://localhost/',
    'https://127.0.0.1',
    'https://name:password@shop.example',
    'https://x.internal',
  ])
    assert.equal(merchantWebsite(url), null);
});

test('ambiguous counterparties and processor-only purchases never invent one company or shared model identity', () => {
  const processor = normalize({ ...raw, counterparties: undefined, name: 'PAYPAL * UNKNOWN' });
  const other = { ...processor, id: 'two' };
  assert.equal(processor.merchantDetails?.source, 'unresolved');
  assert.equal(merchantRuleKey(processor), null);
  assert.notEqual(modelMerchantKey(processor), modelMerchantKey(other));
  const many = {
    ...raw,
    counterparties: [
      ...raw.counterparties!,
      {
        name: 'Different Shop',
        entity_id: 'different',
        type: 'merchant',
        confidence_level: 'HIGH',
      },
    ],
  };
  assert.equal(resolveMerchant(many).source, 'unresolved');
  assert.equal(resolveMerchant({ ...many, merchant_entity_id: 'north' }).name, 'North Coffee');
  const seller = (name: string) =>
    normalize({
      ...raw,
      merchant_name: 'Square',
      counterparties: [{ type: 'merchant', name, confidence_level: 'MEDIUM' }],
    });
  assert.notEqual(
    modelMerchantKey(seller('North Coffee')),
    modelMerchantKey(seller('South Bakery')),
  );
});

test('details require compatible parent and independent category evidence; phone and non-wage income map correctly', () => {
  const tx = normalize(raw);
  assert.equal(transactionDetail({ ...tx, confidence: 'LOW' }), null);
  assert.equal(transactionDetail({ ...tx, category: 'Groceries' }), null);
  assert.equal(
    transactionDetail({ ...tx, detailCategoryCorrected: true, detailCategory: null }),
    null,
  );
  assert.equal(
    transactionDetail({
      ...tx,
      confidence: 'LOW',
      detailCategoryCorrected: true,
      detailCategory: 'FOOD_AND_DRINK_COFFEE',
    })?.label,
    'Coffee',
  );
  assert.equal(validDetail('Coffee', 'FOOD_AND_DRINK_GROCERIES'), false);
  assert.equal(validDetail('Coffee', 'invented'), false);
  assert.equal(
    categoryFromPlaid('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_TELEPHONE'),
    'Phone and Internet',
  );
  assert.equal(categoryFromPlaid('INCOME', 'INCOME_SALARY'), 'Employment Income');
  assert.equal(categoryFromPlaid('INCOME', 'INCOME_DIVIDENDS'), 'Other');
});

test('entity-based correction survives bank aliases and resync, respects source and individual corrections', () => {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  const first = normalize(raw, [], undefined, 'demo');
  const alias = normalize(
    { ...raw, transaction_id: 'alias', name: 'NORTH 02' },
    [],
    undefined,
    'demo',
  );
  const protectedRow = {
    ...alias,
    id: 'individual',
    userCorrected: true,
    merchantOverride: 'My own label',
    merchantCorrected: true,
  };
  store.set('transactions', [
    first,
    alias,
    protectedRow,
    { ...alias, id: 'foreign', source: 'live' },
  ]);
  new TransactionService(repo).correct(first.id, {
    category: 'Coffee',
    saveRule: true,
    merchantOverride: 'North Coffee Co.',
    detailCategory: 'FOOD_AND_DRINK_COFFEE',
  });
  assert.equal(merchantName(repo.transactions()[1]), 'North Coffee Co.');
  assert.deepEqual(repo.transactions()[2], protectedRow);
  assert.equal(repo.transactions()[3].merchantOverride, null);
  const updated = normalize(
    { ...raw, transaction_id: 'posted', name: 'NEW BANK ALIAS', pending: false },
    repo.rules(),
    repo.transactions()[0],
    'demo',
  );
  assert.equal(merchantName(updated), 'North Coffee Co.');
  assert.equal(transactionDetail(updated)?.code, 'FOOD_AND_DRINK_COFFEE');
  assert.equal(updated.cashFlow, -12);
  assert.equal(
    normalize({ ...raw, name: 'FUTURE ALIAS' }, repo.rules(), undefined, 'demo').merchantOverride,
    'North Coffee Co.',
  );
  const processor = normalize(
    { ...raw, transaction_id: 'processor', counterparties: undefined, name: 'PAYPAL *UNKNOWN' },
    [],
    undefined,
    'demo',
  );
  store.set('transactions', [...repo.transactions(), processor]);
  assert.throws(() =>
    new TransactionService(repo).correct('processor', {
      category: 'Coffee',
      saveRule: true,
      merchantOverride: 'One seller',
    }),
  );
  new TransactionService(repo).correct('processor', {
    category: 'Coffee',
    saveRule: false,
    merchantOverride: 'One seller',
  });
  assert.equal(merchantName(repo.transactions().at(-1)!), 'One seller');
});

test('model input uses resolved labels and detail with provenance; raw bank evidence stays out', () => {
  const repo = new WorkspaceRepository(new MemoryDocuments({}));
  repo.seedDemo();
  const state = repo.state();
  state.transactions = [normalize(raw, [], undefined, 'demo')];
  const tx = forecastPayload(state, defaultForecastOptions).transactions[0];
  assert.equal(tx.merchant, 'North Coffee');
  assert.equal(tx.merchantKey, 'entity:north');
  assert.equal(tx.detailCategory, 'FOOD_AND_DRINK_COFFEE');
  assert.equal(tx.merchantSource, 'plaid_counterparty');
  assert.equal(tx.merchantConfidence, 'HIGH');
  for (const field of ['description', 'counterparties', 'website', 'merchantDetails'])
    assert.ok(!(field in tx));
  assert.ok(!JSON.stringify(tx).includes(raw.name));
});
