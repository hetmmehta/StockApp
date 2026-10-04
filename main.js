const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createMarketClient } = require('./server/market');
const { createMongoStore } = require('./server/store');
const { startQuoteRefreshJob, DEFAULT_INTERVAL_MS } = require('./server/refreshJob');

// Configuration (loaded from environment / .env)
const REQUIRED_ENV = ['FINNHUB_API_KEY', 'POLYGON_API_KEY', 'MONGODB_URI'];

function loadConfig(env = process.env) {
  const missingEnv = REQUIRED_ENV.filter((name) => !env[name]);
  if (missingEnv.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnv.join(', ')}. ` +
      'Copy .env.example to .env and fill them in.'
    );
  }
  return {
    finnhubApiKey: env.FINNHUB_API_KEY,
    polygonApiKey: env.POLYGON_API_KEY,
    mongoUri: env.MONGODB_URI,
    mongoDbName: env.MONGO_DB_NAME || 'stockapp',
    port: Number(env.PORT) || 3000,
    quoteRefreshMs: Number(env.QUOTE_REFRESH_MS) || DEFAULT_INTERVAL_MS,
  };
}

// Attach the (cached) latest quote to every stock in a list of documents.
// Quotes for all symbols are looked up in parallel.
async function attachQuotes(market, docs, stocksField) {
  const symbols = docs.flatMap((doc) => (doc[stocksField] || []).map((s) => s.symbol));
  const quotes = await market.quotes(symbols);
  for (const doc of docs) {
    for (const stock of doc[stocksField] || []) {
      stock.quote = quotes.get(String(stock.symbol).toUpperCase());
    }
  }
  return docs;
}

// Wrap a market lookup that takes ?symbol= into a route handler.
function symbolRoute(lookup) {
  return async (req, res) => {
    const { symbol } = req.query;
    if (!symbol) {
      res.status(400).json({ error: 'Query parameter "symbol" is required.' });
      return;
    }
    try {
      res.json(await lookup(symbol, req.query));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

function createApp({ market, store }) {
  const app = express();

  // Middleware to parse JSON bodies and handle CORS
  app.use(express.json());
  app.use(cors());

  // Market data (proxied to Finnhub / Polygon through the TTL cache)
  app.get('/api/company-profile', symbolRoute((symbol) => market.profile(symbol)));
  app.get('/api/quote', symbolRoute((symbol) => market.quote(symbol)));
  app.get('/api/recommendation-trends', symbolRoute((symbol) => market.recommendations(symbol)));
  app.get('/api/insider-sentiment', symbolRoute((symbol) => market.insiderSentiment(symbol)));
  app.get('/api/company-peers', symbolRoute((symbol) => market.peers(symbol)));
  app.get('/api/company-earnings', symbolRoute((symbol) => market.earnings(symbol)));
  app.get('/api/search', symbolRoute((symbol) => market.search(symbol)));
  app.get('/api/company-news', symbolRoute((symbol) => market.news(symbol)));
  app.get('/api/historical-data', symbolRoute((symbol) => market.historical(symbol)));
  app.get('/api/summary-chart', symbolRoute(
    (symbol, query) => market.summaryChart(symbol, query.lastQuoteTimestamp)
  ));

  // Portfolio
  app.get('/api/portfolio', async (req, res) => {
    try {
      const portfolios = await store.listPortfolios();
      res.json(await attachQuotes(market, portfolios, 'Stocks'));
    } catch (error) {
      console.error('Error retrieving portfolio:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/portfolio/buy', async (req, res) => {
    try {
      const { stockSymbol, buyQuantity, buyPrice, stockName } = req.body;
      const portfolio = await store.getPortfolio();
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }
      await store.buy(portfolio, {
        symbol: stockSymbol,
        name: stockName,
        quantity: buyQuantity,
        totalCost: buyPrice,
      });
      res.json({ message: 'Portfolio updated successfully' });
    } catch (error) {
      console.error('Error processing stock purchase:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/portfolio/sell', async (req, res) => {
    try {
      const { stockSymbol, sellQuantity, sellPrice } = req.body;
      const portfolio = await store.getPortfolio();
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }
      const stock = (portfolio.Stocks || []).find((s) => s.symbol === stockSymbol);
      if (!stock || stock.quantity < sellQuantity) {
        res.status(400).json({ message: 'Not enough stock to sell.' });
        return;
      }
      await store.sell(portfolio, { symbol: stockSymbol, quantity: sellQuantity, proceeds: sellPrice });
      res.json({ message: 'Stock sold successfully' });
    } catch (error) {
      console.error('Error selling stock in portfolio:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Watchlist
  app.get('/api/watchlist', async (req, res) => {
    try {
      const watchlists = await store.listWatchlists();
      res.json(await attachQuotes(market, watchlists, 'stock'));
    } catch (error) {
      console.error('Error retrieving watchlist:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/watchlist', async (req, res) => {
    const { symbol, companyName } = req.body;
    if (!symbol) {
      res.status(400).json({ error: 'Field "symbol" is required.' });
      return;
    }
    try {
      const changed = await store.addToWatchlist(symbol, companyName);
      res.json({ message: changed ? 'Stock added to watchlist.' : 'Stock is already in the watchlist.' });
    } catch (error) {
      console.error('Failed to add stock to watchlist:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/api/watchlist/:symbol', async (req, res) => {
    try {
      const removed = await store.removeFromWatchlist(req.params.symbol);
      if (removed) {
        res.json({ message: 'Stock removed from watchlist.' });
      } else {
        res.status(404).json({ message: 'Stock not found in watchlist.' });
      }
    } catch (error) {
      console.error('Error removing stock from watchlist:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return app;
}

async function start() {
  const config = loadConfig();

  const { MongoClient, ServerApiVersion } = require('mongodb');
  const client = new MongoClient(config.mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();

  const store = createMongoStore(client.db(config.mongoDbName));
  const market = createMarketClient({
    finnhubApiKey: config.finnhubApiKey,
    polygonApiKey: config.polygonApiKey,
  });
  const app = createApp({ market, store });
  const refreshJob = startQuoteRefreshJob({ market, store, intervalMs: config.quoteRefreshMs });

  const server = app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });

  const shutdown = () => {
    refreshJob.stop();
    server.close(() => client.close().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Only start listening when run directly (`node main.js`), not when required by tests.
if (require.main === module) {
  start().catch((error) => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { createApp, loadConfig, attachQuotes };
