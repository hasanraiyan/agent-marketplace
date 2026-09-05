import type { HttpClient } from '../http.js';
import type {
  CreateRestToolInput,
  DiscoverRestToolsParams,
  RestApiTool,
  RestToolTestResult,
  TestRestToolInput,
  UpdateRestToolInput,
} from '../types/restTool.js';
import type { ResourceUsage } from '../types/usage.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * No-code REST API tools (`/api/v1/developer/rest-tools`) — Project-owned,
 * or, when this client asserts an external user, owned by that end user.
 * Mirrors {@link McpsResource}'s shape.
 */
export class RestToolsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new REST API tool.
   * @param input - `name`, `method`, `url` are required.
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate tool.
   * @returns The created {@link RestApiTool}.
   */
  async create(input: CreateRestToolInput, idempotencyKey?: string): Promise<RestApiTool> {
    return this.http.request<RestApiTool>('POST', '/api/v1/developer/rest-tools', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists/searches REST API tools visible to this credential.
   * @param params - `page` (default `1`), `limit` (default `20`), `search`
   *   (free-text), `scope: 'mine'` (restricts to the asserted external
   *   user's own tools — `ProjectRuntimeContext` only).
   * @returns `{ items, pagination: { total, page, limit, pages } }`.
   */
  async list(params: DiscoverRestToolsParams = {}): Promise<PaginatedResult<RestApiTool>> {
    return this.http.request<PaginatedResult<RestApiTool>>('GET', '/api/v1/developer/rest-tools', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single REST API tool by id.
   * @param toolId - The tool's `_id`.
   */
  async get(toolId: string): Promise<RestApiTool> {
    return this.http.request<RestApiTool>('GET', `/api/v1/developer/rest-tools/${toolId}`);
  }

  /**
   * Partially updates a REST API tool — only the fields you pass are changed.
   * @param toolId - The tool's `_id`.
   */
  async update(toolId: string, input: UpdateRestToolInput): Promise<RestApiTool> {
    return this.http.request<RestApiTool>('PATCH', `/api/v1/developer/rest-tools/${toolId}`, {
      body: input,
    });
  }

  /**
   * Deletes a REST API tool.
   * @param toolId - The tool's `_id`.
   */
  async delete(toolId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/rest-tools/${toolId}`);
  }

  /**
   * Agents referencing this tool — check before {@link RestToolsResource.delete}
   * to avoid a blocked-delete error.
   * @param toolId - The tool's `_id`.
   * @returns `agentCount` is the real total; `agents` is a preview capped at 20.
   */
  async getUsage(toolId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/rest-tools/${toolId}/usage`);
  }

  /**
   * Best-effort batch delete — partial failures don't throw or abort the rest of the batch.
   * @param ids - Up to 100 tool ids per call.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/rest-tools/bulk-delete', {
      body: { ids },
    });
  }

  /**
   * Test-calls an unsaved draft or a saved tool by id — never reachable
   * from the agent tool-calling path.
   * @param input - Either `toolId` (a saved tool) or `draft` (unsaved
   *   shape); `testValues` stand in for agent-fillable args (and
   *   `externalUserId`, if referenced) for this call only.
   */
  async test(input: TestRestToolInput): Promise<RestToolTestResult> {
    return this.http.request<RestToolTestResult>('POST', '/api/v1/developer/rest-tools/test', {
      body: input,
    });
  }
}
