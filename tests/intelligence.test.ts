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
    assert.equal(JSON.stringify(payload).includes('access_token'), false);
  });
  it('fails gracefully without exposing internal errors or changing saved data', async () => {
    global.fetch = async () => {
      throw new Error('sensitive-internal-detail');
    };
    const result = await agent.post('/api/intelligence/forecast').send({}).expect(503);
    assert.ok(!JSON.stringify(result.body).includes('sensitive-internal-detail'));
    assert.equal((await agent.get('/api/state')).body.workspace.source, 'demo');
  });
});
