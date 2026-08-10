/**
 * Mirrors `agent-backend/src/modules/audit/auditLog.model.js`. Covers
 * Project-lifecycle events only (credential minted/revoked, membership
 * changes, suspend/restore) — NOT resource CRUD (Agent/Skill/Knowledge/
 * Provider/MCP create/update/delete aren't logged here yet).
 */
export interface AuditLogEntry {
  eventType: string;
  timestamp: string;
  actorContextType: string;
  actorIdentity: string | null;
  targetDomain: string;
  targetResourceId: string | null;
  metadata: Record<string, unknown>;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  /** Optional exact-match filter, e.g. `"credential.created"`. */
  eventType?: string;
}
