const test = require('node:test');
const assert = require('node:assert/strict');
const { TtlCache } = require('../server/cache');

test('entries expire after their TTL', () => {
  let now = 1000;
  const cache = new TtlCache({ now: () => now });
  cache.set('a', 1, 500);
  assert.equal(cache.get('a'), 1);
  now += 499;
  assert.equal(cache.get('a'), 1);
  now += 1;
  assert.equal(cache.get('a'), undefined);
});

test('wrap() calls the fetcher once while the value is fresh', async () => {
  let now = 0;
  const cache = new TtlCache({ now: () => now });
  let calls = 0;
  const fetcher = async () => ++calls;

  assert.equal(await cache.wrap('k', 1000, fetcher), 1);
  assert.equal(await cache.wrap('k', 1000, fetcher), 1);
  assert.equal(calls, 1);
  assert.deepEqual(cache.stats, { hits: 1, misses: 1 });

  now += 1000;
  assert.equal(await cache.wrap('k', 1000, fetcher), 2);
  assert.equal(calls, 2);
});

test('wrap() de-duplicates concurrent requests for the same key', async () => {
  const cache = new TtlCache();
  let calls = 0;
  const fetcher = () => new Promise((resolve) => setTimeout(() => resolve(++calls), 10));
  const results = await Promise.all([1, 2, 3].map(() => cache.wrap('k', 1000, fetcher)));
  assert.deepEqual(results, [1, 1, 1]);
  assert.equal(calls, 1);
});

test('failed fetches are not cached', async () => {
  const cache = new TtlCache();
  await assert.rejects(cache.wrap('k', 1000, async () => { throw new Error('boom'); }));
  assert.equal(await cache.wrap('k', 1000, async () => 'ok'), 'ok');
});
