"""Mirrors ``sdk/src/types/auditLog.ts``."""

from __future__ import annotations

from typing import Any, TypedDict


class AuditLogEntry(TypedDict):
    """Mirrors ``agent-backend/src/modules/audit/auditLog.model.js``. Covers
    Project-lifecycle events only (credential minted/revoked, membership
    changes, suspend/restore) — NOT resource CRUD (Agent/Skill/Knowledge/
    Provider/MCP create/update/delete aren't logged here yet)."""

    eventType: str
    timestamp: str
    actorContextType: str
    actorIdentity: str | None
    targetDomain: str
    targetResourceId: str | None
    metadata: dict[str, Any]


class ListAuditLogsParams(TypedDict, total=False):
    page: int
    limit: int
    eventType: str
