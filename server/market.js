// Finnhub / Polygon client. Every call goes through the shared TTL cache so
// repeated requests for the same data within its TTL are served from memory.

const axios = require('axios');
const moment = require('moment');
const { TtlCache } = require('./cache');

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const TTL = {
  quote: 15 * SECOND,
  profile: 24 * HOUR,
  recommendations: 24 * HOUR,
  insiderSentiment: 24 * HOUR,
  peers: 24 * HOUR,
  earnings: 24 * HOUR,
  search: HOUR,
  news: 10 * MINUTE,
  historical: HOUR,
  summaryChart: 10 * MINUTE,
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const POLYGON_BASE = 'https://api.polygon.io/v2';

async function defaultHttpGet(url) {
  const response = await axios.get(url);
  return response.data;
}

// The market is considered open if the last quote is less than five minutes old.
function isMarketOpen(lastQuoteTimestamp) {
  const currentTime = new Date().getTime();
  const lastQuoteTime = new Date(lastQuoteTimestamp * 1000);
  const fiveMinutes = 300000;
  return (currentTime - lastQuoteTime.getTime()) <= fiveMinutes;
}

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function createMarketClient({
  finnhubApiKey,
  polygonApiKey,
  httpGet = defaultHttpGet,
  cache = new TtlCache(),
}) {
  const finnhub = (path, params) => {
    const query = new URLSearchParams({ ...params, token: finnhubApiKey });
    return httpGet(`${FINNHUB_BASE}${path}?${query}`);
  };

  const polygonAggregates = async (symbol, timespan, from, to) => {
    const query = new URLSearchParams({ adjusted: 'true', sort: 'asc', apiKey: polygonApiKey });
    const url = `${POLYGON_BASE}/aggs/ticker/${encodeURIComponent(symbol)}/range/1/${timespan}/${from}/${to}?${query}`;
    const data = await httpGet(url);
    return data.results;
  };

  const fetchQuote = (symbol) => finnhub('/quote', { symbol });

  return {
    cache,

    quote(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`quote:${s}`, TTL.quote, () => fetchQuote(s));
    },

    // Fetch a fresh quote from upstream and overwrite the cached copy.
    // Used by the background refresh job.
    async refreshQuote(symbol) {
      const s = normalizeSymbol(symbol);
      const quote = await fetchQuote(s);
      cache.set(`quote:${s}`, quote, TTL.quote);
      return quote;
    },

    // Quotes for several symbols, fetched in parallel (each one cached).
    async quotes(symbols) {
      const unique = [...new Set(symbols.map(normalizeSymbol))];
      const results = await Promise.all(unique.map((s) => this.quote(s)));
      return new Map(unique.map((s, i) => [s, results[i]]));
    },

    profile(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`profile:${s}`, TTL.profile, () => finnhub('/stock/profile2', { symbol: s }));
    },

    recommendations(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`recommendations:${s}`, TTL.recommendations,
        () => finnhub('/stock/recommendation', { symbol: s }));
    },

    insiderSentiment(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`insider:${s}`, TTL.insiderSentiment,
        () => finnhub('/stock/insider-sentiment', { symbol: s, from: '2022-01-01' }));
    },

    peers(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`peers:${s}`, TTL.peers, () => finnhub('/stock/peers', { symbol: s }));
    },

    earnings(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`earnings:${s}`, TTL.earnings, () => finnhub('/stock/earnings', { symbol: s }));
    },

    // Autocomplete: only common stocks listed on US exchanges (no '.' suffix).
    search(query) {
      const q = String(query || '').trim();
      return cache.wrap(`search:${q.toLowerCase()}`, TTL.search, async () => {
        const data = await finnhub('/search', { q });
        return (data.result || []).filter((item) =>
          item.type === 'Common Stock' && !item.symbol.includes('.')
        );
      });
    },

    // Top 20 complete news items from the last 30 days.
    news(symbol) {
      const s = normalizeSymbol(symbol);
      return cache.wrap(`news:${s}`, TTL.news, async () => {
        const to = moment().format('YYYY-MM-DD');
        const from = moment().subtract(30, 'days').format('YYYY-MM-DD');
        const data = await finnhub('/company-news', { symbol: s, from, to });
        return data
          .filter((newsItem) =>
            newsItem.headline && newsItem.image && newsItem.source &&
            newsItem.datetime && newsItem.summary && newsItem.url
          )
          .slice(0, 20);
      });
    },

    // Daily bars for roughly the last six months.
    historical(symbol) {
      const s = normalizeSymbol(symbol);
      const toDate = new Date();
      const fromDate = new Date(toDate.getFullYear(), toDate.getMonth() - 6, toDate.getDate() - 2);
      const to = toDate.toISOString().split('T')[0];
      const from = fromDate.toISOString().split('T')[0];
      return cache.wrap(`historical:${s}:${from}:${to}`, TTL.historical,
        () => polygonAggregates(s, 'day', from, to));
    },

    // Hourly bars for the latest trading day.
    summaryChart(symbol, lastQuoteTimestamp) {
      const s = normalizeSymbol(symbol);
      const toDate = new Date();
      const fromDate = new Date();
      if (isMarketOpen(lastQuoteTimestamp)) {
        fromDate.setDate(fromDate.getDate() - 1);
      } else {
        fromDate.setDate(fromDate.getDate() - 2);
        toDate.setDate(toDate.getDate() - 1);
      }
      const from = fromDate.toISOString().split('T')[0];
      const to = toDate.toISOString().split('T')[0];
      return cache.wrap(`summary:${s}:${from}:${to}`, TTL.summaryChart,
        () => polygonAggregates(s, 'hour', from, to));
    },
  };
}

module.exports = { createMarketClient, normalizeSymbol, isMarketOpen, TTL };
