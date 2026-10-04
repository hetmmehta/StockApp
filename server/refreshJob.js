// Background job that keeps quotes for every watched / held symbol warm in
// the cache, so the watchlist and portfolio endpoints are served from memory
// instead of calling Finnhub once per symbol on every page load.

const DEFAULT_INTERVAL_MS = 12 * 1000; // a little under the 15s quote TTL

function startQuoteRefreshJob({ market, store, intervalMs = DEFAULT_INTERVAL_MS, logger = console }) {
  let running = false;
  let timer = null;

  async function runOnce() {
    if (running) return { refreshed: 0, skipped: true };
    running = true;
    try {
      const symbols = await store.trackedSymbols();
      const results = await Promise.allSettled(symbols.map((s) => market.refreshQuote(s)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error(`Quote refresh: ${failed.length}/${symbols.length} symbols failed (${failed[0].reason.message})`);
      }
      return { refreshed: results.length - failed.length, failed: failed.length };
    } catch (error) {
      logger.error('Quote refresh job failed:', error.message);
      return { refreshed: 0, failed: 0, error };
    } finally {
      running = false;
    }
  }

  timer = setInterval(runOnce, intervalMs);
  // Don't keep the process alive just for this timer.
  if (typeof timer.unref === 'function') timer.unref();
  runOnce();

  return {
    runOnce,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { startQuoteRefreshJob, DEFAULT_INTERVAL_MS };
