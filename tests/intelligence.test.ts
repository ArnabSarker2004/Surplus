import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { createApp } from '../backend/src/app';
import { Store } from '../backend/src/infrastructure/sqlite-store';
import { forecastPayload } from '../backend/src/services/intelligence-service';
import { defaultForecastOptions } from '../shared/intelligence';
import { demoAccounts, demoTransactions, demoWorkspace } from '../shared/demo';

describe('Private intelligence gateway', () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;
  let agent: ReturnType<typeof request.agent>;
  const fetchBefore = global.fetch;
  const tokenBefore = process.env.INTELLIGENCE_SERVICE_TOKEN;
  before(async () => {
    store = await Store.open();
    app = createApp(store, randomBytes(32));
    agent = request.agent(app);
    await agent
      .post('/api/auth/setup')
      .send({ username: 'forecast-test', password: 'forecast-test-passphrase' })
      .expect(201);
    process.env.INTELLIGENCE_SERVICE_TOKEN = 'fixture-only-service-token-32-characters';
  });
  after(() => {
    store.close();
    global.fetch = fetchBefore;
    if (tokenBefore === undefined) delete process.env.INTELLIGENCE_SERVICE_TOKEN;
    else process.env.INTELLIGENCE_SERVICE_TOKEN = tokenBefore;
  });
  it('requires a session and a completed workspace', async () => {
    await request(app).post('/api/intelligence/forecast').send({}).expect(401);
    await agent.post('/api/intelligence/forecast').send({}).expect(409);
  });
  it('selects the saved workspace, whitelists fields, and rejects client-supplied data', async () => {
    await agent.post('/api/demo').send({}).expect(200);
    await agent
      .post('/api/intelligence/forecast')
      .send({ userId: 'another-user', transactions: [] })
      .expect(400);
    global.fetch = async (_url, options) => {
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.source, 'demo');
      assert.ok(payload.transactions.length > 0);
      assert.equal(payload.profile, undefined);
      assert.equal(payload.transactions[0].description, undefined);
      assert.equal(payload.accounts[0].name, undefined);
      assert.match(String((options?.headers as Record<string, string>).Authorization), /^Bearer /);
      return Response.json({
        version: 'surplus-forecast-1.0',
        asOf: payload.asOf,
        source: payload.source,
        timeline: [],
      });
    };
    const response = await agent
      .post('/api/intelligence/forecast')
      .send({ horizonDays: 90 })
      .expect(200);
    assert.equal(response.headers['cache-control'], 'no-store');
  });
  it('filters mixed sources before Python and never includes bank tokens', () => {
    const payload = forecastPayload(
      {
        workspace: demoWorkspace(),
        accounts: [...demoAccounts, { ...demoAccounts[0], source: 'live' }],
        transactions: [...demoTransactions(), { ...demoTransactions()[0], source: 'live' }],
        rules: [],
        opportunities: [],
      },
      defaultForecastOptions,
    );
    assert.ok(payload.transactions.every((t) => t.source === 'demo'));
    assert.ok(payload.accounts.every((a) => a.source === 'demo'));
    assert.equal(payload.savingsEligibleCash, 0);
    assert.equal(JSON.stringify(payload).includes('access_token'), false);
  });
  it('uses unflagged bank cash as personal while keeping what-if cash out of goal forecasts', () => {
    const state = {
      workspace: demoWorkspace(),
      accounts: demoAccounts,
      transactions: [],
      rules: [],
      opportunities: [],
    };
    assert.equal(
      forecastPayload(state, { ...defaultForecastOptions, openingCash: 9000 }).savingsEligibleCash,
      0,
    );
    delete state.workspace.cashAllocations;
    assert.equal(forecastPayload(state, defaultForecastOptions).savingsEligibleCash, 6075.4);
  });
  it('persists work terms and sends their pay boundaries to the forecast', async () => {
    const workspace = demoWorkspace();
    workspace.workScheduleConfirmed = true;
    workspace.funding = [
      {
        id: 'coop',
        name: 'Winter co-op',
        type: 'Earned',
        status: 'Expected',
        amount: 1600,
        frequency: 'Biweekly',
        date: '2027-01-15',
        endDate: '2027-05-07',
        workKind: 'Co-op',
        workStart: '2027-01-04',
        workEnd: '2027-04-30',
      },
    ];
    await agent.put('/api/workspace').send(workspace).expect(200);
    const state = (await agent.get('/api/state')).body;
    assert.equal(state.workspace.workScheduleConfirmed, true);
    assert.deepEqual(state.workspace.funding, workspace.funding);
    const payload = forecastPayload(state, defaultForecastOptions);
    assert.equal(payload.workScheduleConfirmed, true);
    assert.equal(payload.funding[0].workEnd, '2027-04-30');
    assert.equal(payload.funding[0].endDate, '2027-05-07');
    assert.equal(payload.semester.end, workspace.semester.end);
    await agent
      .put('/api/workspace')
      .send({ ...workspace, funding: [{ ...workspace.funding[0], endDate: '2027-01-01' }] })
      .expect(400);
    assert.deepEqual((await agent.get('/api/state')).body.workspace.funding, workspace.funding);
    await agent.post('/api/demo').send({}).expect(200);
  });
  it('fails gracefully without exposing internal errors or changing saved data', async () => {
    global.fetch = async () => {
      throw new Error('sensitive-internal-detail');
    };
    const result = await agent.post('/api/intelligence/forecast').send({}).expect(503);
    assert.ok(!JSON.stringify(result.body).includes('sensitive-internal-detail'));
    assert.equal((await agent.get('/api/state')).body.workspace.source, 'demo');
  });
  it('requires authentication and validates routine-purchase corrections', async () => {
    const state = (await agent.get('/api/state')).body;
    const item = state.transactions[0];
    await request(app)
      .patch(`/api/intelligence/habits/${item.id}`)
      .send({ treatment: 'routine' })
      .expect(401);
    await agent
      .patch(`/api/intelligence/habits/${item.id}`)
      .send({ treatment: 'anything' })
      .expect(400);
    await agent
      .patch('/api/intelligence/habits/missing')
      .send({ treatment: 'routine' })
      .expect(404);
    const updated = await agent
      .patch(`/api/intelligence/habits/${item.id}`)
      .send({ treatment: 'routine' })
      .expect(200);
    assert.deepEqual(
      updated.body.transactions.find((t: { id: string }) => t.id === item.id),
      { ...item, habitTreatment: 'routine' },
    );
  });
});
