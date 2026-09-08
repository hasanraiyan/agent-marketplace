// Simple in-memory cache for GET requests — no external dep.
// Keeps the last successful response for 30s and deduplicates in-flight requests.
// Used to stop the same list (providers, secrets, etc.) from refetching on every tab switch.

type Entry = { data: unknown; ts: number };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

const TTL_MS = 30_000;

export function getCached<T>(key: string, ttl = TTL_MS): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached(key: string, data: unknown) {
  store.set(key, { data, ts: Date.now() });
}

export function deleteCached(key: string) {
  store.delete(key);
}

export function deleteCachedByPrefix(prefix: string) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

export async function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fetcher().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Cache key helpers — keep them stable across pages so switching tabs hits the cache.
export const cacheKey = {
  projects: () => "GET /projects",
  project: (id: string) => `GET /projects/${id}`,
  resource: (projectId: string, resource: string) => `GET /projects/${projectId}/${resource}`,
};
