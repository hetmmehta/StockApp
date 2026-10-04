// Test doubles: a fake Finnhub/Polygon HTTP layer and an in-memory store with
// the same interface as server/store.js.

function createFakeUpstream(prices = {}) {
  const calls = [];
  async function httpGet(url) {
    calls.push(url);
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith('/quote')) {
      const symbol = searchParams.get('symbol');
      const c = prices[symbol] ?? 0;
      return { c, d: 1, dp: 0.5, t: Math.floor(Date.now() / 1000) };
    }
    if (pathname.endsWith('/stock/profile2')) {
      return { ticker: searchParams.get('symbol'), name: 'Test Co' };
    }
    throw new Error(`Unexpected upstream URL in test: ${pathname}`);
  }
  const callsTo = (path) => calls.filter((u) => new URL(u).pathname.endsWith(path)).length;
  return { httpGet, calls, callsTo };
}

function createMemoryStore({ balance = 25000, stocks = [], watchlist = [] } = {}) {
  const portfolio = { _id: 'p1', Balance: balance, Stocks: stocks.map((s) => ({ ...s })) };
  const watch = { _id: 'w1', stock: watchlist.map((s) => ({ ...s })) };
  const clone = (doc) => JSON.parse(JSON.stringify(doc));

  return {
    portfolio,
    async listPortfolios() { return [clone(portfolio)]; },
    async getPortfolio() { return clone(portfolio); },
    async buy(_p, { symbol, name, quantity, totalCost }) {
      const stock = portfolio.Stocks.find((s) => s.symbol === symbol);
      if (stock) {
        const q = stock.quantity + quantity;
        stock.buyPrice = (stock.buyPrice * stock.quantity + totalCost) / q;
        stock.quantity = q;
      } else {
        portfolio.Stocks.push({ symbol, name, quantity, buyPrice: totalCost / quantity });
      }
      portfolio.Balance -= totalCost;
    },
    async sell(_p, { symbol, quantity, proceeds }) {
      const stock = portfolio.Stocks.find((s) => s.symbol === symbol);
      stock.quantity -= quantity;
      if (stock.quantity <= 0) portfolio.Stocks = portfolio.Stocks.filter((s) => s !== stock);
      portfolio.Balance += proceeds;
    },
    async listWatchlists() { return [clone(watch)]; },
    async addToWatchlist(symbol, companyName) {
      if (watch.stock.some((s) => s.symbol === symbol)) return false;
      watch.stock.push({ symbol, companyName });
      return true;
    },
    async removeFromWatchlist(symbol) {
      const before = watch.stock.length;
      watch.stock = watch.stock.filter((s) => s.symbol !== symbol);
      return watch.stock.length < before;
    },
    async trackedSymbols() {
      return [...new Set([...portfolio.Stocks, ...watch.stock].map((s) => s.symbol))];
    },
  };
}

// Start an app on a random port and return a small fetch helper.
async function listen(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  return { server, request, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { createFakeUpstream, createMemoryStore, listen };
