"""Agents (``/api/v1/developer/agents``) — Project-owned, or, when this
client asserts an external user, owned by that end user. Ported from
``sdk/src/resources/agents.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, cast

from ..types.agent import Agent, CreateAgentInput, DiscoverAgentsParams, UpdateAgentInput
from ..types.bulk_delete import BulkDeleteResult
from ..types.pagination import PaginatedResult

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Agents:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateAgentInput, idempotency_key: str | None = None) -> Agent:
        """``idempotency_key``, if provided, is sent as the ``Idempotency-Key``
        header — a safe retry with the same key replays the original
        response instead of creating a duplicate Agent."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Agent,
            self._transport.request(
                "POST", "/api/v1/developer/agents", json=input, headers=headers
            ),
        )

    def list(self, params: DiscoverAgentsParams | None = None) -> PaginatedResult[Agent]:
        return cast(
            PaginatedResult[Agent],
            self._transport.request("GET", "/api/v1/developer/agents", query=params),
        )

    def get(self, agent_id: str) -> Agent:
        """Populates ``skills``/``mcps``/``knowledgeBases`` as objects
        (unlike ``create``/``update``/``list``)."""
        return cast(Agent, self._transport.request("GET", f"/api/v1/developer/agents/{agent_id}"))

    def update(self, agent_id: str, input: UpdateAgentInput) -> Agent:
        return cast(
            Agent,
            self._transport.request("PATCH", f"/api/v1/developer/agents/{agent_id}", json=input),
        )

    def delete(self, agent_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/agents/{agent_id}")

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — up to 100 ids per call; partial failures don't raise."""
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/agents/bulk-delete", json={"ids": ids}
            ),
        )


class AsyncAgents:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateAgentInput, idempotency_key: str | None = None) -> Agent:
        """``idempotency_key``, if provided, is sent as the ``Idempotency-Key``
        header — a safe retry with the same key replays the original
        response instead of creating a duplicate Agent."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Agent,
            await self._transport.request(
                "POST", "/api/v1/developer/agents", json=input, headers=headers
            ),
        )

    async def list(self, params: DiscoverAgentsParams | None = None) -> PaginatedResult[Agent]:
        return cast(
            PaginatedResult[Agent],
            await self._transport.request("GET", "/api/v1/developer/agents", query=params),
        )

    async def get(self, agent_id: str) -> Agent:
        """Populates ``skills``/``mcps``/``knowledgeBases`` as objects
        (unlike ``create``/``update``/``list``)."""
        return cast(
            Agent, await self._transport.request("GET", f"/api/v1/developer/agents/{agent_id}")
        )

    async def update(self, agent_id: str, input: UpdateAgentInput) -> Agent:
        return cast(
            Agent,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/agents/{agent_id}", json=input
            ),
        )

    async def delete(self, agent_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/agents/{agent_id}")

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — up to 100 ids per call; partial failures don't raise."""
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/agents/bulk-delete", json={"ids": ids}
            ),
        )
