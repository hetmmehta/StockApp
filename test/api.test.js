const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, loadConfig } = require('../main');
const { createMarketClient } = require('../server/market');
const { startQuoteRefreshJob } = require('../server/refreshJob');
const { createFakeUpstream, createMemoryStore, listen } = require('./helpers');

async function setup({ prices = { AAPL: 100 }, store = createMemoryStore() } = {}) {
  const upstream = createFakeUpstream(prices);
  const market = createMarketClient({
    finnhubApiKey: 'test-finnhub',
    polygonApiKey: 'test-polygon',
    httpGet: upstream.httpGet,
  });
  const app = createApp({ market, store });
  const http = await listen(app);
  return { upstream, market, store, ...http };
}

test('loadConfig() fails fast when required variables are missing', () => {
  assert.throws(() => loadConfig({ FINNHUB_API_KEY: 'x' }), /POLYGON_API_KEY, MONGODB_URI/);
  const config = loadConfig({ FINNHUB_API_KEY: 'a', POLYGON_API_KEY: 'b', MONGODB_URI: 'c' });
  assert.equal(config.mongoDbName, 'stockapp');
  assert.equal(config.port, 3000);
});

test('GET /api/quote is served from cache on the second request', async (t) => {
  const ctx = await setup();
  t.after(ctx.close);
  const a = await ctx.request('GET', '/api/quote?symbol=AAPL');
  const b = await ctx.request('GET', '/api/quote?symbol=AAPL');
  assert.equal(a.status, 200);
  assert.deepEqual(b.body, a.body);
  assert.equal(ctx.upstream.callsTo('/quote'), 1);
});

test('buy is rejected when it exceeds the wallet balance', async (t) => {
  const store = createMemoryStore({ balance: 500 });
  const ctx = await setup({ prices: { AAPL: 100 }, store });
  t.after(ctx.close);

  // The client claims a price of $1; the server uses the real quote ($100).
  const res = await ctx.request('POST', '/api/portfolio/buy', {
    stockSymbol: 'AAPL', buyQuantity: 6, buyPrice: 6, stockName: 'Apple Inc',
  });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Insufficient balance/);
  assert.equal(store.portfolio.Balance, 500);
  assert.equal(store.portfolio.Stocks.length, 0);
});

test('buy uses the server-side price, then sell rejects more than is held', async (t) => {
  const store = createMemoryStore({ balance: 1000 });
  const ctx = await setup({ prices: { AAPL: 100 }, store });
  t.after(ctx.close);

  const buy = await ctx.request('POST', '/api/portfolio/buy', {
    stockSymbol: 'AAPL', buyQuantity: 3, buyPrice: 1, stockName: 'Apple Inc',
  });
  assert.equal(buy.status, 200);
  assert.equal(store.portfolio.Balance, 700);
  assert.deepEqual(store.portfolio.Stocks[0], { symbol: 'AAPL', name: 'Apple Inc', quantity: 3, buyPrice: 100 });

  const oversell = await ctx.request('POST', '/api/portfolio/sell', { stockSymbol: 'AAPL', sellQuantity: 4 });
  assert.equal(oversell.status, 400);
  assert.match(oversell.body.message, /Not enough stock/);

  const sell = await ctx.request('POST', '/api/portfolio/sell', { stockSymbol: 'AAPL', sellQuantity: 3 });
  assert.equal(sell.status, 200);
  assert.equal(store.portfolio.Balance, 1000);
  assert.equal(store.portfolio.Stocks.length, 0);
});

test('buy rejects a non-positive or fractional quantity', async (t) => {
  const ctx = await setup();
  t.after(ctx.close);
  for (const buyQuantity of [0, -1, 1.5, 'abc']) {
    const res = await ctx.request('POST', '/api/portfolio/buy', { stockSymbol: 'AAPL', buyQuantity });
    assert.equal(res.status, 400, `quantity ${buyQuantity}`);
  }
});

test('watchlist add / list / remove round trip', async (t) => {
  const ctx = await setup({ prices: { AAPL: 100, MSFT: 200 } });
  t.after(ctx.close);

  assert.equal((await ctx.request('POST', '/api/watchlist', { symbol: 'AAPL', companyName: 'Apple Inc' })).status, 200);
  assert.equal((await ctx.request('POST', '/api/watchlist', { symbol: 'MSFT', companyName: 'Microsoft' })).status, 200);

  const list = await ctx.request('GET', '/api/watchlist');
  assert.equal(list.status, 200);
  const stocks = list.body[0].stock;
  assert.deepEqual(stocks.map((s) => s.symbol), ['AAPL', 'MSFT']);
  assert.equal(stocks[0].quote.c, 100);
  assert.equal(stocks[1].quote.c, 200);

  assert.equal((await ctx.request('DELETE', '/api/watchlist/AAPL')).status, 200);
  assert.equal((await ctx.request('DELETE', '/api/watchlist/AAPL')).status, 404);
  const after = await ctx.request('GET', '/api/watchlist');
  assert.deepEqual(after.body[0].stock.map((s) => s.symbol), ['MSFT']);
});

test('background job pre-warms quotes so watchlist and portfolio hit the cache', async (t) => {
  const store = createMemoryStore({
    stocks: [{ symbol: 'NVDA', name: 'NVIDIA', quantity: 2, buyPrice: 100 }],
    watchlist: [{ symbol: 'AAPL', companyName: 'Apple Inc' }, { symbol: 'TSLA', companyName: 'Tesla' }],
  });
  const ctx = await setup({ prices: { AAPL: 100, TSLA: 250, NVDA: 120 }, store });
  t.after(ctx.close);

  const job = startQuoteRefreshJob({ market: ctx.market, store, intervalMs: 60_000, logger: { error() {} } });
  t.after(job.stop);
  const result = await job.firstRun;
  assert.equal(result.refreshed, 3);
  assert.equal(ctx.upstream.callsTo('/quote'), 3);

  await ctx.request('GET', '/api/watchlist');
  await ctx.request('GET', '/api/portfolio');
  assert.equal(ctx.upstream.callsTo('/quote'), 3, 'no extra upstream calls after the job ran');

  await job.runOnce();
  assert.equal(ctx.upstream.callsTo('/quote'), 6);
});
