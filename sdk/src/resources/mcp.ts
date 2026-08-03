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

/**
 * OAuth sub-surface for a Project's own MCP servers. Owner-mode connects
 * the MCP itself (shared across every user); user-mode connects the
 * asserted external user's own per-user token — requires this client to
 * have been constructed with `externalUserId` set.
 */
export class McpOAuthResource {
  constructor(private readonly http: HttpClient) {}

  async getOwnerAuthorizeUrl(mcpId: string): Promise<{ url: string }> {
    return this.http.request<{ url: string }>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/oauth/owner/authorize`
    );
  }

  /** `returnTo` is an optional client-chosen redirect target after the flow completes. */
  async getUserAuthorizeUrl(mcpId: string, returnTo?: string): Promise<{ url: string }> {
    return this.http.request<{ url: string }>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/oauth/user/authorize`,
      { query: { returnTo } }
    );
  }

  async getUserConnectionStatus(mcpId: string): Promise<McpUserConnectionStatus> {
    return this.http.request<McpUserConnectionStatus>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/oauth/user/status`
    );
  }

  async disconnectUserConnection(mcpId: string): Promise<void> {
    await this.http.request<unknown>(
      'DELETE',
      `/api/v1/developer/mcps/${mcpId}/oauth/user/connection`
    );
  }

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
  readonly oauth: McpOAuthResource;

  constructor(private readonly http: HttpClient) {
    this.oauth = new McpOAuthResource(http);
  }

  async create(input: CreateMcpInput): Promise<Mcp> {
    return this.http.request<Mcp>('POST', '/api/v1/developer/mcps', { body: input });
  }

  /** Note: returns a bare array — this endpoint has no pagination envelope. */
  async list(params: DiscoverMcpsParams = {}): Promise<Mcp[]> {
    return this.http.request<Mcp[]>('GET', '/api/v1/developer/mcps', { query: { ...params } });
  }

  async get(mcpId: string): Promise<Mcp> {
    return this.http.request<Mcp>('GET', `/api/v1/developer/mcps/${mcpId}`);
  }

  async update(mcpId: string, input: UpdateMcpInput): Promise<Mcp> {
    return this.http.request<Mcp>('PATCH', `/api/v1/developer/mcps/${mcpId}`, { body: input });
  }

  async delete(mcpId: string): Promise<void> {
    await this.http.request<unknown>('DELETE', `/api/v1/developer/mcps/${mcpId}`);
  }

  /** Agents referencing this MCP — check before `delete()` to avoid a blocked-delete error. */
  async getUsage(mcpId: string): Promise<ResourceUsage> {
    return this.http.request<ResourceUsage>('GET', `/api/v1/developer/mcps/${mcpId}/usage`);
  }

  /** Connects, lists tools/resources/templates, and persists the summary onto the MCP document. */
  async testConnection(mcpId: string): Promise<McpTestConnectionResult> {
    return this.http.request<McpTestConnectionResult>(
      'POST',
      `/api/v1/developer/mcps/${mcpId}/test`
    );
  }

  async readResource(mcpId: string, uri: string): Promise<McpReadResourceResult> {
    return this.http.request<McpReadResourceResult>(
      'GET',
      `/api/v1/developer/mcps/${mcpId}/resource`,
      { query: { uri } }
    );
  }

  /** Return shape is whatever the underlying MCP tool returns — inherently dynamic. */
  async callTool(mcpId: string, name: string, args?: Record<string, unknown>): Promise<unknown> {
    return this.http.request<unknown>('POST', `/api/v1/developer/mcps/${mcpId}/call-tool`, {
      body: { name, arguments: args },
    });
  }
}
