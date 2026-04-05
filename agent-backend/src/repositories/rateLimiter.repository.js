/**
 * InMemoryRateLimitStore - Stores rate limit counters in memory
 * Liskov Substitution: Any store implementing get/set/delete can replace this
 */
class InMemoryRateLimitStore {
  #store = new Map();
  #cleanupInterval;

  constructor(cleanupIntervalMs = 60_000) {
    this.#cleanupInterval = setInterval(() => this.#cleanup(), cleanupIntervalMs);
    this.#cleanupInterval.unref();
  }

  async get(key) {
    const entry = this.#store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.resetTime) {
      this.#store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key, data) {
    this.#store.set(key, data);
  }

  async increment(key, windowMs) {
    const now = Date.now();
    const entry = this.#store.get(key);

    if (!entry || now > entry.resetTime) {
      const data = { count: 1, resetTime: now + windowMs };
      this.#store.set(key, data);
      return data;
    }

    entry.count += 1;
    this.#store.set(key, entry);
    return entry;
  }

  async delete(key) {
    this.#store.delete(key);
  }

  #cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.#store) {
      if (now > entry.resetTime) {
        this.#store.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.#cleanupInterval);
    this.#store.clear();
  }
}

export default InMemoryRateLimitStore;
