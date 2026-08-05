/**
 * The identity key used for the compiled-agent-instance cache (agent.factory.js)
 * and for memory namespace roots (memory-files-store.js's userMemoryNamespace/
 * agentMemoryNamespace). Persona callers get exactly `String(userId)` — byte-
 * for-byte what these namespaces already used before Developer Platform
 * existed. A ProjectRuntime caller's `userId` argument is a raw externalUserId
 * string with no Domain qualification of its own, so it's composed with the
 * context's `domain` here — `${domain}:${externalUserId}` — to guarantee two
 * different Projects' external users can never collide on the same key, even
 * if both happen to use the identical externalUserId string.
 *
 * Any code that reads/writes a ProjectRuntime subject's memory outside of a
 * live agent run (e.g. the developer memory API) MUST compute this exact
 * string, not the bare externalUserId — otherwise it silently reads/writes a
 * different namespace than the one a live agent run actually uses.
 */
export function buildIdentityKey(executionContext, userId) {
  return executionContext?.principalType === 'ProjectRuntime'
    ? `${executionContext.domain}:${executionContext.externalUserId}`
    : String(userId);
}
