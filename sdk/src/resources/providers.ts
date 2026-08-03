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

  async create(input: CreateProviderInput): Promise<Provider> {
    return this.http.request<Provider>('POST', '/api/v1/developer/providers', { body: input });
  }

  /**
   * Every Provider in this credential's Domain. No pagination envelope, no
   * `page`/`limit`/`search` params — Providers have no discovery concept
   * (control-plane only), so this is a plain bare-array list, same result
   * whether this client asserts an external user or not.
   */
  async list(): Promise<Provider[]> {
    return this.http.request<Provider[]>('GET', '/api/v1/developer/providers');
  }

  async get(providerId: string): Promise<Provider> {
    return this.http.request<Provider>('GET', `/api/v1/developer/providers/${providerId}`);
  }

  async update(providerId: string, input: UpdateProviderInput): Promise<Provider> {
    return this.http.request<Provider>('PATCH', `/api/v1/developer/providers/${providerId}`, {
      body: input,
    });
  }

  async delete(providerId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/providers/${providerId}`);
  }

  async testConnection(providerId: string): Promise<ProviderTestConnectionResult> {
    return this.http.request<ProviderTestConnectionResult>(
      'POST',
      `/api/v1/developer/providers/${providerId}/test-connection`
    );
  }

  async getModels(providerId: string): Promise<ProviderModel[]> {
    return this.http.request<ProviderModel[]>(
      'GET',
      `/api/v1/developer/providers/${providerId}/models`
    );
  }

  /** Agents referencing this Provider — check before `delete()` to avoid a blocked-delete error. */
  async getUsage(providerId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>(
      'GET',
      `/api/v1/developer/providers/${providerId}/usage`
    );
  }

  /** Best-effort batch delete — up to 100 ids per call; partial failures don't throw. */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/providers/bulk-delete', {
      body: { ids },
    });
  }
}
