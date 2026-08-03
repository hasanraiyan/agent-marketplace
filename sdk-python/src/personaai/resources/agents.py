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
        """Creates a new Agent.

        Args:
            input: ``name``, ``systemPrompt``, ``providerId`` are required.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Agent.

        Returns:
            The created :class:`Agent` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Agent,
            self._transport.request(
                "POST", "/api/v1/developer/agents", json=input, headers=headers
            ),
        )

    def list(self, params: DiscoverAgentsParams | None = None) -> PaginatedResult[Agent]:
        """Lists/searches Agents visible to this credential (this Project's
        own, plus any public Agents).

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text), ``category``, ``scope="mine"``
                (restricts to the asserted external user's own Agents —
                runtime context only).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
            Note: ``skills``/``mcps``/``knowledgeBases`` on each item are
            bare id strings here (unlike ``get()``, which populates them
            as objects).
        """
        return cast(
            PaginatedResult[Agent],
            self._transport.request("GET", "/api/v1/developer/agents", query=params),
        )

    def get(self, agent_id: str) -> Agent:
        """Fetches a single Agent by id.

        Args:
            agent_id: The Agent's ``_id``.

        Returns:
            The :class:`Agent`, with ``skills``/``mcps``/``knowledgeBases``
            populated as objects (unlike ``create``/``update``/``list``).
        """
        return cast(Agent, self._transport.request("GET", f"/api/v1/developer/agents/{agent_id}"))

    def update(self, agent_id: str, input: UpdateAgentInput) -> Agent:
        """Partially updates an Agent — only the fields you pass are changed.

        Args:
            agent_id: The Agent's ``_id``.
            input: Any subset of the fields on :class:`Agent` (excluding server-managed ones).
        """
        return cast(
            Agent,
            self._transport.request("PATCH", f"/api/v1/developer/agents/{agent_id}", json=input),
        )

    def delete(self, agent_id: str) -> None:
        """Deletes an Agent.

        Args:
            agent_id: The Agent's ``_id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/agents/{agent_id}")

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 Agent ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
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
        """Creates a new Agent.

        Args:
            input: ``name``, ``systemPrompt``, ``providerId`` are required.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Agent.

        Returns:
            The created :class:`Agent` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Agent,
            await self._transport.request(
                "POST", "/api/v1/developer/agents", json=input, headers=headers
            ),
        )

    async def list(self, params: DiscoverAgentsParams | None = None) -> PaginatedResult[Agent]:
        """Lists/searches Agents visible to this credential (this Project's
        own, plus any public Agents).

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text), ``category``, ``scope="mine"``
                (restricts to the asserted external user's own Agents —
                runtime context only).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
            Note: ``skills``/``mcps``/``knowledgeBases`` on each item are
            bare id strings here (unlike ``get()``, which populates them
            as objects).
        """
        return cast(
            PaginatedResult[Agent],
            await self._transport.request("GET", "/api/v1/developer/agents", query=params),
        )

    async def get(self, agent_id: str) -> Agent:
        """Fetches a single Agent by id.

        Args:
            agent_id: The Agent's ``_id``.

        Returns:
            The :class:`Agent`, with ``skills``/``mcps``/``knowledgeBases``
            populated as objects (unlike ``create``/``update``/``list``).
        """
        return cast(
            Agent, await self._transport.request("GET", f"/api/v1/developer/agents/{agent_id}")
        )

    async def update(self, agent_id: str, input: UpdateAgentInput) -> Agent:
        """Partially updates an Agent — only the fields you pass are changed.

        Args:
            agent_id: The Agent's ``_id``.
            input: Any subset of the fields on :class:`Agent` (excluding server-managed ones).
        """
        return cast(
            Agent,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/agents/{agent_id}", json=input
            ),
        )

    async def delete(self, agent_id: str) -> None:
        """Deletes an Agent.

        Args:
            agent_id: The Agent's ``_id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/agents/{agent_id}")

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 Agent ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/agents/bulk-delete", json={"ids": ids}
            ),
        )
