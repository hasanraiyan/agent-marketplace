import type { HttpClient } from '../http.js';
import type {
  Agent,
  CreateAgentInput,
  DiscoverAgentsParams,
  McpConnection,
  UpdateAgentInput,
} from '../types/agent.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Agents (`/api/v1/developer/agents`) — Project-owned, or, when this client
 * asserts an external user, owned by that end user.
 */
export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Creates a new Agent.
   * @param input - `name`, `systemPrompt`, `providerId` are required.
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate Agent.
   * @returns The created {@link Agent} (raw Mongo shape — `_id`, not `id`).
   */
  async create(input: CreateAgentInput, idempotencyKey?: string): Promise<Agent> {
    return this.http.request<Agent>('POST', '/api/v1/developer/agents', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists/searches Agents visible to this credential (this Project's own,
   * plus any public Agents).
   * @param params - `page` (default `1`), `limit` (default `20`), `search`
   *   (free-text), `category`, `scope: 'mine'` (restricts to the asserted
   *   external user's own Agents — `ProjectRuntimeContext` only).
   * @returns `{ items, pagination: { total, page, limit, pages } }`. Note:
   *   `skills`/`mcps`/`knowledgeBases` on each item are bare id strings here
   *   (unlike `get()`, which populates them as objects).
   */
  async list(params: DiscoverAgentsParams = {}): Promise<PaginatedResult<Agent>> {
    return this.http.request<PaginatedResult<Agent>>('GET', '/api/v1/developer/agents', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single Agent by id.
   * @param agentId - The Agent's `_id`.
   * @returns The {@link Agent}, with `skills`/`mcps`/`knowledgeBases`
   *   populated as objects (unlike `create`/`update`/`list`).
   */
  async get(agentId: string): Promise<Agent> {
    return this.http.request<Agent>('GET', `/api/v1/developer/agents/${agentId}`);
  }

  /**
   * Partially updates an Agent — only the fields you pass are changed.
   * @param agentId - The Agent's `_id`.
   * @param input - Any subset of the fields on {@link Agent} (excluding server-managed ones).
   */
  async update(agentId: string, input: UpdateAgentInput): Promise<Agent> {
    return this.http.request<Agent>('PATCH', `/api/v1/developer/agents/${agentId}`, {
      body: input,
    });
  }

  /**
   * Deletes an Agent.
   * @param agentId - The Agent's `_id`.
   */
  async delete(agentId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/agents/${agentId}`);
  }

  /**
   * Best-effort batch delete — partial failures don't throw or abort the
   * rest of the batch.
   * @param ids - Up to 100 Agent ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/agents/bulk-delete', {
      body: { ids },
    });
  }

  /**
   * Per-user OAuth connection status for every `authType: 'oauth',
   * authMode: 'user'` MCP this Agent has attached. Requires the client to
   * assert an external user (`ProjectRuntimeContext`) — there's no
   * per-user connection concept for a bare Project credential.
   * @param agentId - The Agent's `_id`.
   * @param returnTo - Where to send the browser after OAuth consent
   *   completes, for any MCP that isn't connected yet. Defaults to this
   *   platform's own site if omitted.
   */
  async getMcpConnections(agentId: string, returnTo?: string): Promise<McpConnection[]> {
    return this.http.request<McpConnection[]>(
      'GET',
      `/api/v1/developer/agents/${agentId}/mcp-connections`,
      { query: returnTo ? { returnTo } : undefined }
    );
  }
}
