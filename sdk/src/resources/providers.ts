import type { HttpClient } from '../http.js';
import type {
  CreateProviderInput,
  Provider,
  ProviderModel,
  ProviderTestConnectionResult,
  UpdateProviderInput,
} from '../types/provider.js';

/**
 * Providers this Project owns (`/api/v1/developer/providers`). Control-plane
 * only — no `ExternalUser` ownership exists for Providers, and there is no
 * list/discover endpoint (the API surface has none; this client mirrors it
 * 1:1).
 */
export class ProvidersResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateProviderInput): Promise<Provider> {
    return this.http.request<Provider>('POST', '/api/v1/developer/providers', { body: input });
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
}
