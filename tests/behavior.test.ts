import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalize } from '../shared/finance';
import {
  cpiGroups,
  parseCpiResponse,
  StatisticsCanadaCpi,
} from '../backend/src/integrations/statistics-canada';
import fixture from '../shared/data/cpi-demo-ontario.json';
import { MemoryDocuments } from '../backend/src/infrastructure/document-store';
import { WorkspaceRepository } from '../backend/src/repositories/workspace-repository';
import { recordForecast } from '../backend/src/services/forecast-history';
import { defaultForecastOptions, type ForecastReport } from '../shared/intelligence';

function cpiRows() {
  return cpiGroups.map((g, i) => ({
    status: 'SUCCESS',
    object: {
      productId: 18100004,
      coordinate: `14.${g.id}.0.0.0.0.0.0.0.0`,
      vectorId: i + 1,
      vectorDataPoint: fixture.series[0].points.map((p) => ({
        refPer: p.period,
        value: p.value,
        scalarFactorCode: 0,
        securityLevelCode: 0,
        frequencyCode: 6,
        statusCode: 0,
        releaseTime: p.releasedAt,
      })),
    },
  }));
}

test('Plaid metadata preserves purchase time and city, excludes exact location, keeps user intent', () => {
  const raw = {
    transaction_id: 'one',
    account_id: 'cash',
    date: '2026-09-15',
    name: 'Coffee',
    amount: 12,
    pending: false,
    authorized_datetime: '2026-09-14T20:15:00-04:00',
    payment_channel: 'in store',
    location: {
      city: 'Toronto',
      region: 'ON',
      country: 'CA',
      address: 'not retained',
      lat: 43,
      lon: -79,
    },
  };
  const first = normalize(raw);
  assert.equal(first.authorizedAt, raw.authorized_datetime);
  assert.deepEqual(first.location, { city: 'Toronto', region: 'ON', country: 'CA' });
  assert.equal(first.paymentChannel, 'in store');
  assert.equal(
    normalize(raw, [], { ...first, habitTreatment: 'routine' }).habitTreatment,
    'routine',
  );
  assert.equal(normalize({ ...raw, authorized_datetime: '2026-09-14' }).authorizedAt, null);
});

test('CPI coordinates, not response order, select series; reject mismatches and suppressed observations', () => {
  const rows = cpiRows();
  assert.equal(
    parseCpiResponse(rows.reverse(), 'Ontario', new Date().toISOString()).series[0].key,
    'all',
  );
  assert.throws(() => parseCpiResponse(rows, 'Canada', new Date().toISOString()));
  assert.throws(() => parseCpiResponse([...rows, rows[0]], 'Ontario', new Date().toISOString()));
  rows[0].object.vectorDataPoint.forEach((p) => {
    p.securityLevelCode = 1;
  });
  assert.throws(() => parseCpiResponse(rows, 'Ontario', new Date().toISOString()));
});

test('CPI request is public-only, coalesced and cached; network failure falls back without blocking', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'surplus-cpi-'));
  try {
    let calls = 0;
    const client = new StatisticsCanadaCpi(async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options?.body));
      assert.deepEqual(Object.keys(body[0]).sort(), ['coordinate', 'latestN', 'productId']);
      return Response.json(cpiRows());
    }, directory);
    const [a, b] = await Promise.all([client.load('Ontario'), client.load('Ontario')]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
    assert.equal((await client.load('Ontario')).status, 'cached');
    assert.equal(calls, 1);
    await writeFile(
      join(directory, 'cpi-ontario.json'),
      JSON.stringify({ ...a, fetchedAt: '2025-01-01T00:00:00Z' }),
    );
    const failed = new StatisticsCanadaCpi(async () => {
      throw new Error('offline');
    }, directory);
    assert.equal((await failed.load('Ontario')).status, 'cached');
    assert.equal((await failed.load('Canada')).status, 'unavailable');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('goal history compares changed data, ignores what-if overrides, rejects races and clears with workspace', () => {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  const state = repo.state();
  const report = {
    version: 'surplus-forecast-1.0',
    source: 'demo',
    horizonDays: 180,
    asOf: '2026-09-18',
    goals: [{ id: 'g', projectedDate: '2026-11-01' }],
  } as ForecastReport;
  assert.equal(recordForecast(repo, state, {}, report).goalChanges?.status, 'first');
  const before = structuredClone(store.get('forecastHistory', {}));
  recordForecast(repo, state, { openingCash: 100 }, report);
  assert.deepEqual(store.get('forecastHistory', {}), before);
  repo.save({
    ...state.workspace!,
    semester: { ...state.workspace!.semester, minimumBalance: 999 },
  });
  assert.equal(recordForecast(repo, state, {}, report).goalChanges?.status, 'changed_during_run');
  const next = repo.state();
  const updated = { ...report, goals: [{ ...report.goals[0], projectedDate: '2026-11-05' }] };
  assert.equal(
    recordForecast(repo, next, defaultForecastOptions, updated).goalChanges?.goals[0].shiftDays,
    4,
  );
  assert.equal(recordForecast(repo, next, {}, updated).goalChanges?.goals[0].shiftDays, 4);
  // Snapshots contain dates/IDs/hashes only, not merchant or bank data.
  assert.ok(!JSON.stringify(store.get('forecastHistory', {})).includes('merchant'));
  repo.clear();
  assert.deepEqual(store.get('forecastHistory', {}), {});
});

test('habit corrections only affect the selected workspace source and preserve monetary fields', () => {
  const store = new MemoryDocuments({});
  const repo = new WorkspaceRepository(store);
  repo.seedDemo();
  const original = repo.transactions()[0];
  store.set('transactions', [original, { ...original, id: 'live-only', source: 'live' }]);
  assert.equal(repo.setHabitTreatment('live-only', 'routine'), false);
  assert.equal(repo.setHabitTreatment(original.id, 'routine'), true);
  assert.deepEqual(repo.transactions()[0], { ...original, habitTreatment: 'routine' });
});
