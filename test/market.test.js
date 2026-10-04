const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketClient } = require('../server/market');
const { createFakeUpstream } = require('./helpers');

function setup(prices) {
  const upstream = createFakeUpstream(prices);
  const market = createMarketClient({
    finnhubApiKey: 'test-finnhub',
    polygonApiKey: 'test-polygon',
    httpGet: upstream.httpGet,
  });
  return { upstream, market };
}

test('a cache hit avoids a second upstream call', async () => {
  const { upstream, market } = setup({ AAPL: 190 });
  const first = await market.quote('AAPL');
  const second = await market.quote('aapl');
  assert.equal(first.c, 190);
  assert.deepEqual(second, first);
  assert.equal(upstream.callsTo('/quote'), 1);

  await market.profile('AAPL');
  await market.profile('AAPL');
  assert.equal(upstream.callsTo('/stock/profile2'), 1);
});

test('quotes() fetches each distinct symbol once', async () => {
  const { upstream, market } = setup({ AAPL: 190, MSFT: 420 });
  const quotes = await market.quotes(['AAPL', 'MSFT', 'AAPL']);
  assert.equal(quotes.get('AAPL').c, 190);
  assert.equal(quotes.get('MSFT').c, 420);
  assert.equal(upstream.callsTo('/quote'), 2);
});

test('refreshQuote() bypasses the cache and updates it', async () => {
  const prices = { AAPL: 190 };
  const { upstream, market } = setup(prices);
  await market.quote('AAPL');
  prices.AAPL = 191;
  assert.equal((await market.refreshQuote('AAPL')).c, 191);
  assert.equal((await market.quote('AAPL')).c, 191);
  assert.equal(upstream.callsTo('/quote'), 2);
});
