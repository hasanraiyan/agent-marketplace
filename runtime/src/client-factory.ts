import { PersonaClient } from '@personaai/sdk';
import type { CreateRuntimeOptions } from './types/options.js';

/**
 * One `PersonaClient` per request, scoped to the resolved user — the
 * pattern `@personaai/sdk`'s own README documents. Constructing a
 * `PersonaClient` does no I/O, so per-request construction has no
 * meaningful cost.
 */
export function createClientForRequest(
  options: CreateRuntimeOptions,
  userId: string | null
): PersonaClient {
  return new PersonaClient({
    baseUrl: options.baseUrl,
    credential: options.credential,
    externalUserId: userId ?? undefined,
    fetch: options.fetch,
  });
}
