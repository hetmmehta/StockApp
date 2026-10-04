// Small in-memory TTL cache used to avoid repeating identical upstream API calls.
//
// - Entries expire after their own TTL (milliseconds).
// - wrap() de-duplicates concurrent requests for the same key, so a burst of
//   requests for one symbol results in a single upstream call.
// - Failed fetches are never cached.

class TtlCache {
  constructor({ now = Date.now, maxEntries = 5000 } = {}) {
    this.now = now;
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.inFlight = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  set(key, value, ttlMs) {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      this.prune();
      if (this.entries.size >= this.maxEntries) {
        // Still full: drop the oldest entry (Map keeps insertion order).
        this.entries.delete(this.entries.keys().next().value);
      }
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    return value;
  }

  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
    this.inFlight.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  // Remove all expired entries.
  prune() {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  // Return the cached value for `key`, or call `fetchFn` once, cache its
  // result for `ttlMs` and return it.
  async wrap(key, ttlMs, fetchFn) {
    const cached = this.get(key);
    if (cached !== undefined) {
      this.stats.hits++;
      return cached;
    }
    if (this.inFlight.has(key)) {
      this.stats.hits++;
      return this.inFlight.get(key);
    }

    this.stats.misses++;
    const pending = (async () => {
      try {
        const value = await fetchFn();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, pending);
    return pending;
  }
}

module.exports = { TtlCache };
