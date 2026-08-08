import type { HttpClient } from '../http.js';
import type {
  CreateProviderInput,
  Provider,
  ProviderModel,
  ProviderTestConnectionResult,
  UpdateProviderInput,
} from '../types/provider.js';
import type { ResourceUsage } from '../types/usage.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';

/**
 * Providers this Project owns (`/api/v1/developer/providers`). Control-plane
 * only — no `ExternalUser` ownership exists for Providers.
 */
export class ProvidersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new Provider (an OpenAI-compatible endpoint + API key) that
   * Agents in this Project can reference.
   *
   * @param input - `label`, `baseURL`, `apiKey`, `defaultModel` are required;
   *   `isDefault` is optional (defaults to `false` server-side).
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate Provider.
   * @returns The created {@link Provider}.
   * @example
   * ```ts
   * const provider = await client.providers.create({
   *   label: 'OpenAI (prod)',
   *   baseURL: 'https://api.openai.com/v1',
   *   apiKey: process.env.OPENAI_API_KEY!,
   *   defaultModel: 'gpt-4o-mini',
   * });
   * ```
   */
  async create(input: CreateProviderInput, idempotencyKey?: string): Promise<Provider> {
    return this.http.request<Provider>('POST', '/api/v1/developer/providers', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Every Provider in this credential's Domain. No pagination envelope, no
   * `page`/`limit`/`search` params — Providers have no discovery concept
   * (control-plane only), so this is a plain bare-array list.
   *
   * On a control-plane client (no `externalUserId`), this returns every
   * Provider in the Domain. On a runtime-plane client (`externalUserId`
   * set, a `ProjectRuntimeContext`), the server short-circuits the call and
   * returns an **empty array** — a Provider's ownership can only ever be
   * `'PersonaUser'` or `'Project'`, never `'ExternalUser'`, so this
   * credential can never own any. Same existence-hiding precedent as
   * `get()`/`update()`/`delete()`, which 404 for non-owners: silent empty
   * result, not an error.
   *
   * @returns A plain `Provider[]` (not a `PaginatedResult`, unlike every
   *   other resource's `list()`).
   */
  async list(): Promise<Provider[]> {
    return this.http.request<Provider[]>('GET', '/api/v1/developer/providers');
  }

  /**
   * Fetches a single Provider by id.
   * @param providerId - The Provider's `id`.
   * @returns The {@link Provider}, or throws `PersonaApiError` (404) if it
   *   doesn't exist or isn't owned by this credential's Domain.
   */
  async get(providerId: string): Promise<Provider> {
    return this.http.request<Provider>('GET', `/api/v1/developer/providers/${providerId}`);
  }

  /**
   * Partially updates a Provider — only the fields you pass are changed.
   * @param providerId - The Provider's `id`.
   * @param input - Any subset of `label`/`baseURL`/`apiKey`/`defaultModel`/`isDefault`.
   * @returns The updated {@link Provider}.
   */
  async update(providerId: string, input: UpdateProviderInput): Promise<Provider> {
    return this.http.request<Provider>('PATCH', `/api/v1/developer/providers/${providerId}`, {
      body: input,
    });
  }

  /**
   * Deletes a Provider. Rejects with `PersonaApiError` if any Agent still
   * references it — call {@link ProvidersResource.getUsage} first to check.
   * @param providerId - The Provider's `id`.
   */
  async delete(providerId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/providers/${providerId}`);
  }

  /**
   * Verifies this Provider's `baseURL`/`apiKey` actually work by making a
   * live call to the underlying endpoint.
   * @param providerId - The Provider's `id`.
   * @returns `{ success, message }` — `success: false` means the call
   *   reached the endpoint but it rejected the credentials/URL, not that
   *   this SDK call itself failed.
   */
  async testConnection(providerId: string): Promise<ProviderTestConnectionResult> {
    return this.http.request<ProviderTestConnectionResult>(
      'POST',
      `/api/v1/developer/providers/${providerId}/test-connection`
    );
  }

  /**
   * Lists the models this Provider's endpoint reports as available (e.g.
   * for populating a model-picker in your own UI).
   * @param providerId - The Provider's `id`.
   */
  async getModels(providerId: string): Promise<ProviderModel[]> {
    return this.http.request<ProviderModel[]>(
      'GET',
      `/api/v1/developer/providers/${providerId}/models`
    );
  }

  /**
   * Agents referencing this Provider — check before {@link ProvidersResource.delete}
   * to avoid a blocked-delete error.
   * @param providerId - The Provider's `id`.
   * @returns `agentCount` is the real total; `agents` is a preview capped at 20.
   */
  async getUsage(providerId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>(
      'GET',
      `/api/v1/developer/providers/${providerId}/usage`
    );
  }

  /**
   * Best-effort batch delete — partial failures (e.g. a Provider still
   * referenced by an Agent) don't throw or abort the rest of the batch.
   * @param ids - Up to 100 Provider ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/providers/bulk-delete', {
      body: { ids },
    });
  }
}
