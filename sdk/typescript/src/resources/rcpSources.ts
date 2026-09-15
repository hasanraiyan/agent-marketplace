import type { HttpClient } from '../http.js';
import type {
  CreateRcpSourceInput,
  DiscoverRcpSourcesParams,
  RcpSource,
  RcpSourceTestConnectionResult,
  UpdateRcpSourceInput,
} from '../types/rcpSource.js';
import type { ResourceUsage } from '../types/usage.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * RCP Sources (`/api/v1/developer/rcp-sources`) — Project-owned or, when
 * this client asserts an external user, owned by that end user.
 */
export class RcpSourcesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Registers a new RCP source — a hosted manifest URL Persona discovers
   * tools from live via `rcp-sdk`.
   * @param input - `name`/`url` are required.
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate source.
   */
  async create(input: CreateRcpSourceInput, idempotencyKey?: string): Promise<RcpSource> {
    return this.http.request<RcpSource>('POST', '/api/v1/developer/rcp-sources', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists/searches RCP sources visible to this credential.
   * @returns `{ items, pagination: { total, page, limit, pages } }`.
   */
  async list(params: DiscoverRcpSourcesParams = {}): Promise<PaginatedResult<RcpSource>> {
    return this.http.request<PaginatedResult<RcpSource>>('GET', '/api/v1/developer/rcp-sources', {
      query: { ...params },
    });
  }

  /** Fetches a single RCP source by id. */
  async get(sourceId: string): Promise<RcpSource> {
    return this.http.request<RcpSource>('GET', `/api/v1/developer/rcp-sources/${sourceId}`);
  }

  /** Partially updates an RCP source (owner only) — only the fields you pass are changed. */
  async update(sourceId: string, input: UpdateRcpSourceInput): Promise<RcpSource> {
    return this.http.request<RcpSource>('PATCH', `/api/v1/developer/rcp-sources/${sourceId}`, {
      body: input,
    });
  }

  /** Deletes an RCP source (owner only) — detaches it from every Agent using it. */
  async delete(sourceId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/rcp-sources/${sourceId}`);
  }

  /**
   * Agents referencing this source — check before {@link RcpSourcesResource.delete}
   * to see the blast radius (delete always succeeds; it just detaches).
   * @returns `agentCount` is the real total; `agents` is a preview capped at 20.
   */
  async getUsage(sourceId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>(
      'GET',
      `/api/v1/developer/rcp-sources/${sourceId}/usage`,
    );
  }

  /**
   * Discovers the source's manifest live via `rcp-sdk` and persists the
   * result as the new display-only tool cache (`RcpSource.tools`).
   * @throws `PersonaApiError` (400) if the manifest is unreachable, non-2xx,
   *   an invalid payload, or an unsupported `rcpVersion`.
   */
  async testConnection(sourceId: string): Promise<RcpSourceTestConnectionResult> {
    return this.http.request<RcpSourceTestConnectionResult>(
      'POST',
      `/api/v1/developer/rcp-sources/${sourceId}/test`,
    );
  }

  /**
   * Best-effort batch delete — partial failures don't throw or abort the
   * rest of the batch.
   * @param ids - Up to 100 source ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>(
      'POST',
      '/api/v1/developer/rcp-sources/bulk-delete',
      { body: { ids } },
    );
  }
}
