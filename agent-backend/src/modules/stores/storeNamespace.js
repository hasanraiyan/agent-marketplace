/**
 * Namespace builders for named Stores, backed by the same `memoryFilesStore`
 * singleton (`agent-backend/src/modules/memory/memory-files-store.js`) that
 * already backs `/memories/user/`/`/memories/agent/` — its batch/get/put/
 * search/listNamespaces logic is fully generic over namespace array shape,
 * so a `'stores'`-prefixed namespace works unmodified alongside the
 * existing `'users'`-prefixed ones (they never collide: different first
 * element).
 *
 * `domain`-scope stores get one shared namespace for the whole Project.
 * `externalUser`-scope stores get one namespace per external user,
 * resolved at agent-build time from whichever founder is actually running
 * the agent — mirrors `userMemoryNamespace`'s own "the caller's identity is
 * baked into the namespace, not looked up dynamically inside the store"
 * design exactly.
 */

export function domainStoreNamespace(domain, storeName) {
  return ['stores', String(domain), String(storeName)];
}

export function externalUserStoreNamespace(domain, externalUserId, storeName) {
  return ['stores', String(domain), String(externalUserId), String(storeName)];
}
