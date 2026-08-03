import type { HttpClient } from '../http.js';
import type {
  CreateMcpInput,
  DiscoverMcpsParams,
  Mcp,
  McpReadResourceResult,
  McpTestConnectionResult,
  McpUserConnectionStatus,
  UpdateMcpInput,
} from '../types/mcp.js';
import type { ResourceUsage } from '../types/usage.js';
import type { BulkDeleteResult } from '../types/bulkDelete.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * OAuth sub-surface for a Project's own MCP servers. Owner-mode connects
 * the MCP itself (shared across every user); user-mode connects the
 * asserted external user's own per-user token — requires this client to
 * have been constructed with `externalUserId` set.
 */
export class McpOAuthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Gets the URL to redirect the Project owner/admin to, to complete the
   * shared owner-mode OAuth connection for this MCP server.
   * @param mcpId - The MCP server's `_id`.
   * @returns `{ url }` — redirect the owner's browser here.
   */
  async getOwnerAuthorizeUrl(mcpId: string): Promise<{ url: string }> {
    return this.http.request<{ url: string }>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/oauth/owner/authorize`
    );
  }

  /**
   * Gets the URL to redirect the asserted external user to, to complete
   * their own per-user OAuth connection for this MCP server.
   * @param mcpId - The MCP server's `_id`.
   * @param returnTo - Optional client-chosen redirect target after the flow completes.
   * @returns `{ url }` — redirect the end user's browser here.
   */
  async getUserAuthorizeUrl(mcpId: string, returnTo?: string): Promise<{ url: string }> {
    return this.http.request<{ url: string }>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/oauth/user/authorize`,
      { query: { returnTo } }
    );
  }

  /**
   * Checks whether the asserted external user has completed their own
   * per-user OAuth connection for this MCP server.
   * @param mcpId - The MCP server's `_id`.
   */
  async getUserConnectionStatus(mcpId: string): Promise<McpUserConnectionStatus> {
    return this.http.request<McpUserConnectionStatus>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/oauth/user/status`
    );
  }

  /**
   * Revokes the asserted external user's own per-user OAuth connection for
   * this MCP server.
   * @param mcpId - The MCP server's `_id`.
   */
  async disconnectUserConnection(mcpId: string): Promise<void> {
    await this.http.request<unknown>(
      'DELETE',
      `/api/v1/developer/mcps/${mcpId}/oauth/user/connection`
    );
  }

  /**
   * Revokes the shared owner-mode OAuth connection for this MCP server.
   * @param mcpId - The MCP server's `_id`.
   */
  async disconnectOwnerConnection(mcpId: string): Promise<void> {
    await this.http.request<unknown>(
      'DELETE',
      `/api/v1/developer/mcps/${mcpId}/oauth/owner/connection`
    );
  }
}

/**
 * MCP servers (`/api/v1/developer/mcps`) — Project-owned, or, when this
 * client asserts an external user, owned by that end user.
 */
export class McpsResource {
  /** OAuth connect/disconnect/status calls for MCP servers — see {@link McpOAuthResource}. */
  readonly oauth: McpOAuthResource;

  constructor(private readonly http: HttpClient) {
    this.oauth = new McpOAuthResource(http);
  }

  /**
   * Registers a new MCP server connection.
   * @param input - `name`, `transport`, `url` are required; set `authType`/
   *   `authMode`/`oauth`/`apiKey` if the server needs authentication.
   * @param idempotencyKey - Optional. Sent as the `Idempotency-Key` header —
   *   a safe retry with the same key replays the original response instead
   *   of creating a duplicate MCP server.
   * @returns The created {@link Mcp} (raw Mongo shape — `_id`, not `id`).
   */
  async create(input: CreateMcpInput, idempotencyKey?: string): Promise<Mcp> {
    return this.http.request<Mcp>('POST', '/api/v1/developer/mcps', {
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /**
   * Lists/searches MCP servers visible to this credential (this Project's
   * own, plus any public ones).
   * @param params - `page` (default `1`), `limit` (default `20`), `search`
   *   (free-text), `scope: 'mine'` (restricts to the asserted external
   *   user's own MCPs — `ProjectRuntimeContext` only).
   * @returns `{ items, pagination: { total, page, limit, pages } }`.
   */
  async list(params: DiscoverMcpsParams = {}): Promise<PaginatedResult<Mcp>> {
    return this.http.request<PaginatedResult<Mcp>>('GET', '/api/v1/developer/mcps', {
      query: { ...params },
    });
  }

  /**
   * Fetches a single MCP server by id.
   * @param mcpId - The MCP server's `_id`.
   */
  async get(mcpId: string): Promise<Mcp> {
    return this.http.request<Mcp>('GET', `/api/v1/developer/mcps/${mcpId}`);
  }

  /**
   * Partially updates an MCP server — only the fields you pass are changed.
   * @param mcpId - The MCP server's `_id`.
   */
  async update(mcpId: string, input: UpdateMcpInput): Promise<Mcp> {
    return this.http.request<Mcp>('PATCH', `/api/v1/developer/mcps/${mcpId}`, { body: input });
  }

  /**
   * Deletes an MCP server. Rejects with `PersonaApiError` if any Agent
   * still references it — call {@link McpsResource.getUsage} first to check.
   * @param mcpId - The MCP server's `_id`.
   */
  async delete(mcpId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/mcps/${mcpId}`);
  }

  /**
   * Agents referencing this MCP — check before {@link McpsResource.delete}
   * to avoid a blocked-delete error.
   * @param mcpId - The MCP server's `_id`.
   * @returns `agentCount` is the real total; `agents` is a preview capped at 20.
   */
  async getUsage(mcpId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/mcps/${mcpId}/usage`);
  }

  /**
   * Best-effort batch delete — partial failures (e.g. an MCP server still
   * referenced by an Agent) don't throw or abort the rest of the batch.
   * @param ids - Up to 100 MCP server ids per call.
   * @returns `{ deleted, failed }` — check `failed` for per-id reasons.
   */
  async bulkDelete(ids: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('POST', '/api/v1/developer/mcps/bulk-delete', {
      body: { ids },
    });
  }

  /**
   * Connects to the MCP server right now, lists its tools/resources/
   * resource templates, and persists that summary onto the stored MCP
   * document (so `get()`/`list()` reflect it afterward).
   * @param mcpId - The MCP server's `_id`.
   */
  async testConnection(mcpId: string): Promise<McpTestConnectionResult> {
    return this.http.request<McpTestConnectionResult>(
      'POST',
      `/api/v1/developer/mcps/${mcpId}/test`
    );
  }

  /**
   * Reads one MCP resource by URI (as opposed to calling a tool).
   * @param mcpId - The MCP server's `_id`.
   * @param uri - A resource `uri`, from `mcp.resources`/`resourceTemplates` (after filling any template params).
   */
  async readResource(mcpId: string, uri: string): Promise<McpReadResourceResult> {
    return this.http.request<McpReadResourceResult>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/resource`,
      { query: { uri } }
    );
  }

  /**
   * Invokes one tool exposed by this MCP server.
   * @param mcpId - The MCP server's `_id`.
   * @param name - Tool name, from `mcp.tools`.
   * @param args - Arguments matching that tool's own input schema.
   * @returns Return shape is whatever the underlying MCP tool returns — inherently dynamic.
   */
  async callTool(mcpId: string, name: string, args?: Record<string, unknown>): Promise<unknown> {
    return this.http.request<unknown>('POST', `/api/v1/developer/mcps/${mcpId}/call-tool`, {
      body: { name, arguments: args },
    });
  }
}
