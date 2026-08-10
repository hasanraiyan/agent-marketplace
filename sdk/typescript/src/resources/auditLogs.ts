import type { HttpClient } from '../http.js';
import type { AuditLogEntry, ListAuditLogsParams } from '../types/auditLog.js';
import type { PaginatedResult } from '../types/pagination.js';

/**
 * Audit log (`/api/v1/developer/audit-logs`) — read-only, control-plane
 * only (mirrors Providers: no `ExternalUser` ownership concept). A client
 * constructed with `externalUserId` gets an empty `PaginatedResult` back,
 * not an error — the same existence-hiding-style precedent
 * `providers.list()` established.
 */
export class AuditLogsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists Project-lifecycle audit events for this credential's Domain
   * (credential minted/revoked, membership changes, suspend/restore) —
   * NOT resource CRUD (Agent/Skill/Knowledge/Provider/MCP create/update/
   * delete aren't logged here yet).
   * @param params - `page` (default `1`), `limit` (default `20`), optional
   *   exact-match `eventType` filter.
   * @returns `{ items, pagination: { total, page, limit, pages} }` — empty
   *   (not an error) when called from a `ProjectRuntimeContext` client.
   */
  async list(params: ListAuditLogsParams = {}): Promise<PaginatedResult<AuditLogEntry>> {
    return this.http.request<PaginatedResult<AuditLogEntry>>(
      'GET',
      '/api/v1/developer/audit-logs',
      { query: { ...params } }
    );
  }
}
