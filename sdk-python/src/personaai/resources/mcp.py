"""MCP servers (``/api/v1/developer/mcps``) — Project-owned, or, when this
client asserts an external user, owned by that end user. Ported from
``sdk/src/resources/mcp.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, cast

from ..types.bulk_delete import BulkDeleteResult
from ..types.mcp import (
    CreateMcpInput,
    DiscoverMcpsParams,
    Mcp,
    McpAuthorizeUrl,
    McpReadResourceResult,
    McpTestConnectionResult,
    McpUserConnectionStatus,
    UpdateMcpInput,
)
from ..types.pagination import PaginatedResult
from ..types.usage import ResourceUsage

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class McpOAuth:
    """OAuth sub-surface for a Project's own MCP servers. Owner-mode connects
    the MCP itself (shared across every user); user-mode connects the
    asserted external user's own per-user token — requires this client to
    have been constructed with ``external_user_id`` set."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_owner_authorize_url(self, mcp_id: str) -> McpAuthorizeUrl:
        return cast(
            McpAuthorizeUrl,
            self._transport.request(
                "GET", f"/api/v1/developer/mcps/{mcp_id}/oauth/owner/authorize"
            ),
        )

    def get_user_authorize_url(self, mcp_id: str, return_to: str | None = None) -> McpAuthorizeUrl:
        """``return_to`` is an optional client-chosen redirect target after
        the flow completes."""
        return cast(
            McpAuthorizeUrl,
            self._transport.request(
                "GET",
                f"/api/v1/developer/mcps/{mcp_id}/oauth/user/authorize",
                query={"returnTo": return_to},
            ),
        )

    def get_user_connection_status(self, mcp_id: str) -> McpUserConnectionStatus:
        return cast(
            McpUserConnectionStatus,
            self._transport.request("GET", f"/api/v1/developer/mcps/{mcp_id}/oauth/user/status"),
        )

    def disconnect_user_connection(self, mcp_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/mcps/{mcp_id}/oauth/user/connection")

    def disconnect_owner_connection(self, mcp_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/mcps/{mcp_id}/oauth/owner/connection")


class AsyncMcpOAuth:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_owner_authorize_url(self, mcp_id: str) -> McpAuthorizeUrl:
        return cast(
            McpAuthorizeUrl,
            await self._transport.request(
                "GET", f"/api/v1/developer/mcps/{mcp_id}/oauth/owner/authorize"
            ),
        )

    async def get_user_authorize_url(
        self, mcp_id: str, return_to: str | None = None
    ) -> McpAuthorizeUrl:
        """``return_to`` is an optional client-chosen redirect target after
        the flow completes."""
        return cast(
            McpAuthorizeUrl,
            await self._transport.request(
                "GET",
                f"/api/v1/developer/mcps/{mcp_id}/oauth/user/authorize",
                query={"returnTo": return_to},
            ),
        )

    async def get_user_connection_status(self, mcp_id: str) -> McpUserConnectionStatus:
        return cast(
            McpUserConnectionStatus,
            await self._transport.request(
                "GET", f"/api/v1/developer/mcps/{mcp_id}/oauth/user/status"
            ),
        )

    async def disconnect_user_connection(self, mcp_id: str) -> None:
        await self._transport.request(
            "DELETE", f"/api/v1/developer/mcps/{mcp_id}/oauth/user/connection"
        )

    async def disconnect_owner_connection(self, mcp_id: str) -> None:
        await self._transport.request(
            "DELETE", f"/api/v1/developer/mcps/{mcp_id}/oauth/owner/connection"
        )


class Mcps:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport
        self.oauth = McpOAuth(transport)

    def create(self, input: CreateMcpInput, idempotency_key: str | None = None) -> Mcp:
        """``idempotency_key``, if provided, is sent as the ``Idempotency-Key``
        header — a safe retry with the same key replays the original
        response instead of creating a duplicate MCP server."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Mcp,
            self._transport.request("POST", "/api/v1/developer/mcps", json=input, headers=headers),
        )

    def list(self, params: DiscoverMcpsParams | None = None) -> PaginatedResult[Mcp]:
        return cast(
            PaginatedResult[Mcp],
            self._transport.request("GET", "/api/v1/developer/mcps", query=params),
        )

    def get(self, mcp_id: str) -> Mcp:
        return cast(Mcp, self._transport.request("GET", f"/api/v1/developer/mcps/{mcp_id}"))

    def update(self, mcp_id: str, input: UpdateMcpInput) -> Mcp:
        return cast(
            Mcp,
            self._transport.request("PATCH", f"/api/v1/developer/mcps/{mcp_id}", json=input),
        )

    def delete(self, mcp_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/mcps/{mcp_id}")

    def get_usage(self, mcp_id: str) -> ResourceUsage:
        """Agents referencing this MCP — check before ``delete()`` to avoid a blocked delete."""
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/mcps/{mcp_id}/usage"),
        )

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — up to 100 ids per call; partial failures don't raise."""
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/mcps/bulk-delete", json={"ids": ids}
            ),
        )

    def test_connection(self, mcp_id: str) -> McpTestConnectionResult:
        """Connects, lists tools/resources/templates, and persists the
        summary onto the MCP document."""
        return cast(
            McpTestConnectionResult,
            self._transport.request("POST", f"/api/v1/developer/mcps/{mcp_id}/test"),
        )

    def read_resource(self, mcp_id: str, uri: str) -> McpReadResourceResult:
        return cast(
            McpReadResourceResult,
            self._transport.request(
                "GET", f"/api/v1/developer/mcps/{mcp_id}/resource", query={"uri": uri}
            ),
        )

    def call_tool(self, mcp_id: str, name: str, arguments: dict[str, Any] | None = None) -> Any:
        """Return shape is whatever the underlying MCP tool returns —
        inherently dynamic."""
        return self._transport.request(
            "POST",
            f"/api/v1/developer/mcps/{mcp_id}/call-tool",
            json={"name": name, "arguments": arguments},
        )


class AsyncMcps:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport
        self.oauth = AsyncMcpOAuth(transport)

    async def create(self, input: CreateMcpInput, idempotency_key: str | None = None) -> Mcp:
        """``idempotency_key``, if provided, is sent as the ``Idempotency-Key``
        header — a safe retry with the same key replays the original
        response instead of creating a duplicate MCP server."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Mcp,
            await self._transport.request(
                "POST", "/api/v1/developer/mcps", json=input, headers=headers
            ),
        )

    async def list(self, params: DiscoverMcpsParams | None = None) -> PaginatedResult[Mcp]:
        return cast(
            PaginatedResult[Mcp],
            await self._transport.request("GET", "/api/v1/developer/mcps", query=params),
        )

    async def get(self, mcp_id: str) -> Mcp:
        return cast(Mcp, await self._transport.request("GET", f"/api/v1/developer/mcps/{mcp_id}"))

    async def update(self, mcp_id: str, input: UpdateMcpInput) -> Mcp:
        return cast(
            Mcp,
            await self._transport.request("PATCH", f"/api/v1/developer/mcps/{mcp_id}", json=input),
        )

    async def delete(self, mcp_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/mcps/{mcp_id}")

    async def get_usage(self, mcp_id: str) -> ResourceUsage:
        """Agents referencing this MCP — check before ``delete()`` to avoid a blocked delete."""
        return cast(
            ResourceUsage,
            await self._transport.request("GET", f"/api/v1/developer/mcps/{mcp_id}/usage"),
        )

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — up to 100 ids per call; partial failures don't raise."""
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/mcps/bulk-delete", json={"ids": ids}
            ),
        )

    async def test_connection(self, mcp_id: str) -> McpTestConnectionResult:
        """Connects, lists tools/resources/templates, and persists the
        summary onto the MCP document."""
        return cast(
            McpTestConnectionResult,
            await self._transport.request("POST", f"/api/v1/developer/mcps/{mcp_id}/test"),
        )

    async def read_resource(self, mcp_id: str, uri: str) -> McpReadResourceResult:
        return cast(
            McpReadResourceResult,
            await self._transport.request(
                "GET", f"/api/v1/developer/mcps/{mcp_id}/resource", query={"uri": uri}
            ),
        )

    async def call_tool(
        self, mcp_id: str, name: str, arguments: dict[str, Any] | None = None
    ) -> Any:
        """Return shape is whatever the underlying MCP tool returns —
        inherently dynamic."""
        return await self._transport.request(
            "POST",
            f"/api/v1/developer/mcps/{mcp_id}/call-tool",
            json={"name": name, "arguments": arguments},
        )
