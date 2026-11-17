import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  applySync,
  collectSync,
  decrypt,
  encrypt,
  PlaidError,
  type SyncPage,
} from '../backend/src/integrations/plaid';
import { normalize, type PlaidTransaction } from '../shared/finance';

const tx = (id: string, amount = 10): PlaidTransaction => ({
  transaction_id: id,
  account_id: 'test',
  date: '2026-09-16',
  name: 'Test merchant',
  amount,
  pending: false,
  iso_currency_code: 'CAD',
});
const page = (
  added: PlaidTransaction[] = [],
  next_cursor = 'next',
  has_more = false,
): SyncPage => ({ added, modified: [], removed: [], next_cursor, has_more });
describe('Plaid synchronization and token protection', () => {
  it('consumes all pages before returning the cursor', async () => {
    const cursors: string[] = [];
    const result = await collectSync('', async (c) => {
      cursors.push(c);
      return c === '' ? page([tx('a')], 'p1', true) : page([tx('b')], 'p2');
    });
    assert.deepEqual(cursors, ['', 'p1']);
    assert.equal(result.pages.length, 2);
    assert.equal(result.cursor, 'p2');
  });
  it('restarts from the ORIGINAL cursor after a mutation', async () => {
    const calls: string[] = [];
    let failed = false;
    const result = await collectSync('original', async (c) => {
      calls.push(c);
      if (c === 'p1' && !failed) {
        failed = true;
        throw new PlaidError('TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION');
      }
      return c === 'original' ? page([tx('a')], 'p1', true) : page([tx('b')], 'p2');
    });
    assert.deepEqual(calls, ['original', 'p1', 'original', 'p1']);
    assert.equal(result.pages.length, 2);
  });
  it('does not return partial results on a page failure', async () => {
    await assert.rejects(
      collectSync('', async (c) => {
        if (c) throw new PlaidError('NETWORK');
        return page([tx('a')], 'p1', true);
      }),
      PlaidError,
    );
  });
  it('limits pagination restarts', async () => {
    let count = 0;
    await assert.rejects(
      collectSync('', async () => {
        count++;
        throw new PlaidError('TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION');
      }),
    );
    assert.equal(count, 3);
  });
  it('rejects a non-advancing pagination cursor', async () =>
    assert.rejects(collectSync('a', async () => page([], 'a', true))));
  it('deduplicates added transactions and applies modifications and removals', () => {
    const first = page([tx('a'), tx('a'), tx('b')]);
    const second = page();
    second.modified = [tx('a', 25)];
    second.removed = [{ transaction_id: 'b' }];
    const result = applySync([], [first, second], []);
    assert.equal(result.length, 1);
    assert.equal(result[0].cashFlow, -25);
  });
  it('preserves corrections when pending transactions become posted', () => {
    const previous = {
      ...normalize(tx('pending')),
      pending: true,
      category: 'Coffee' as const,
      classification: 'Discretionary' as const,
      userCorrected: true,
    };
    const result = applySync(
      [previous],
      [page([{ ...tx('posted'), pending_transaction_id: 'pending' }])],
      [],
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'posted');
    assert.equal(result[0].category, 'Coffee');
    assert.equal(result[0].userCorrected, true);
  });
  it('leaves unrelated demo transactions intact', () => {
    const demo = { ...normalize(tx('demo')), source: 'demo' as const };
    assert.equal(applySync([demo], [page([tx('plaid')])], []).length, 2);
  });
  it('retains bank authorization time when pending removal precedes posting on another page', () => {
    const pending = normalize({
      ...tx('pending'),
      pending: true,
      authorized_date: '2026-09-15',
      authorized_datetime: '2026-09-15T20:45:00-04:00',
    });
    const removal = { ...page(), removed: [{ transaction_id: 'pending' }] };
    const posted = {
      ...tx('posted'),
      pending_transaction_id: 'pending',
      authorized_date: null,
      authorized_datetime: null,
    };
    const result = applySync([pending], [removal, page([posted])], []);
    assert.equal(result.length, 1);
    assert.equal(result[0].authorizedAt, pending.authorizedAt);
    assert.equal(result[0].authorizedDate, pending.authorizedDate);
    assert.equal(result[0].date, posted.date);
    assert.equal(result[0].pending, false);
    const resynced = applySync(result, [{ ...page(), modified: [posted] }], []);
    assert.equal(resynced[0].authorizedAt, pending.authorizedAt);
    const corrected = normalize(
      { ...posted, authorized_datetime: '2026-09-15T21:00:00-04:00' },
      [],
      result[0],
    );
    assert.equal(corrected.authorizedAt, '2026-09-15T21:00:00-04:00');
    assert.equal(normalize(tx('unrelated'), [], pending).authorizedAt, null);
    assert.equal(normalize(posted, [], { ...pending, accountId: 'another' }).authorizedAt, null);
    assert.equal(normalize(posted, [], { ...pending, source: 'demo' }).authorizedAt, null);
  });
  it('encrypts access tokens with authenticated, randomized encryption', () => {
    const key = randomBytes(32);
    const token = 'access-sandbox-test-only';
    const a = encrypt(token, key);
    const b = encrypt(token, key);
    assert.notEqual(a, b);
    assert.ok(!a.includes(token));
    assert.equal(decrypt(a, key), token);
    assert.throws(() => decrypt(a, randomBytes(32)));
    const tampered = Buffer.from(a, 'base64');
    tampered[29] ^= 1;
    assert.throws(() => decrypt(tampered.toString('base64'), key));
  });
});
