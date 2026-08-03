"""Audit log (``/api/v1/developer/audit-logs``) — read-only, control-plane
only (mirrors Providers: no ``ExternalUser`` ownership concept). Ported
from ``sdk/src/resources/auditLogs.ts``.

A client constructed with ``external_user_id`` gets an empty
``PaginatedResult`` back, not an error — the same existence-hiding-style
precedent ``providers.list()`` established.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..types.audit_log import AuditLogEntry, ListAuditLogsParams
from ..types.pagination import PaginatedResult

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class AuditLogs:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def list(self, params: ListAuditLogsParams | None = None) -> PaginatedResult[AuditLogEntry]:
        return cast(
            PaginatedResult[AuditLogEntry],
            self._transport.request("GET", "/api/v1/developer/audit-logs", query=params),
        )


class AsyncAuditLogs:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def list(
        self, params: ListAuditLogsParams | None = None
    ) -> PaginatedResult[AuditLogEntry]:
        return cast(
            PaginatedResult[AuditLogEntry],
            await self._transport.request("GET", "/api/v1/developer/audit-logs", query=params),
        )
