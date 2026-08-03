"""Skills (``/api/v1/developer/skills``) — Project-owned or, when this
client asserts an external user, owned by that end user. Ported from
``sdk/src/resources/skills.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, cast

from ..types.bulk_delete import BulkDeleteResult
from ..types.pagination import PaginatedResult
from ..types.skill import CreateSkillInput, DiscoverSkillsParams, Skill, UpdateSkillInput
from ..types.usage import ResourceUsage

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Skills:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateSkillInput, idempotency_key: str | None = None) -> Skill:
        """Creates a new Skill (a reusable instruction + optional file
        bundle an Agent can be given).

        Args:
            input: ``name``/``description``/``instructions`` are required.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Skill.

        Returns:
            The created :class:`Skill` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Skill,
            self._transport.request(
                "POST", "/api/v1/developer/skills", json=input, headers=headers
            ),
        )

    def list(self, params: DiscoverSkillsParams | None = None) -> PaginatedResult[Skill]:
        """Lists/searches Skills visible to this credential (this Project's
        own, plus any public Skills).

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text), ``scope="mine"`` (restricts to the
                asserted external user's own Skills — runtime context only).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.

        Example:
            >>> result = client.skills.list({"search": "summarize", "limit": 50})
        """
        return cast(
            PaginatedResult[Skill],
            self._transport.request("GET", "/api/v1/developer/skills", query=params),
        )

    def get(self, skill_id: str) -> Skill:
        """Fetches a single Skill by id.

        Args:
            skill_id: The Skill's ``_id``.
        """
        return cast(Skill, self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}"))

    def update(self, skill_id: str, input: UpdateSkillInput) -> Skill:
        """Partially updates a Skill — only the fields you pass are changed.

        Args:
            skill_id: The Skill's ``_id``.
            input: Any subset of ``name``/``description``/``instructions``/``isPublic``/``files``.
        """
        return cast(
            Skill,
            self._transport.request("PATCH", f"/api/v1/developer/skills/{skill_id}", json=input),
        )

    def delete(self, skill_id: str) -> None:
        """Deletes a Skill. Raises ``PersonaApiError`` if any Agent still
        references it — call ``get_usage()`` first to check.

        Args:
            skill_id: The Skill's ``_id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/skills/{skill_id}")

    def get_usage(self, skill_id: str) -> ResourceUsage:
        """Agents referencing this Skill — check before ``delete()`` to avoid a blocked delete.

        Args:
            skill_id: The Skill's ``_id``.

        Returns:
            ``agentCount`` is the real total; ``agents`` is a preview capped at 20.
        """
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}/usage"),
        )

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures (e.g. a Skill still
        referenced by an Agent) don't raise or abort the rest of the batch.

        Args:
            ids: Up to 100 Skill ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/skills/bulk-delete", json={"ids": ids}
            ),
        )


class AsyncSkills:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateSkillInput, idempotency_key: str | None = None) -> Skill:
        """Creates a new Skill (a reusable instruction + optional file
        bundle an Agent can be given).

        Args:
            input: ``name``/``description``/``instructions`` are required.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Skill.

        Returns:
            The created :class:`Skill` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Skill,
            await self._transport.request(
                "POST", "/api/v1/developer/skills", json=input, headers=headers
            ),
        )

    async def list(self, params: DiscoverSkillsParams | None = None) -> PaginatedResult[Skill]:
        """Lists/searches Skills visible to this credential (this Project's
        own, plus any public Skills).

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text), ``scope="mine"`` (restricts to the
                asserted external user's own Skills — runtime context only).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[Skill],
            await self._transport.request("GET", "/api/v1/developer/skills", query=params),
        )

    async def get(self, skill_id: str) -> Skill:
        """Fetches a single Skill by id.

        Args:
            skill_id: The Skill's ``_id``.
        """
        return cast(
            Skill, await self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}")
        )

    async def update(self, skill_id: str, input: UpdateSkillInput) -> Skill:
        """Partially updates a Skill — only the fields you pass are changed.

        Args:
            skill_id: The Skill's ``_id``.
            input: Any subset of ``name``/``description``/``instructions``/``isPublic``/``files``.
        """
        return cast(
            Skill,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/skills/{skill_id}", json=input
            ),
        )

    async def delete(self, skill_id: str) -> None:
        """Deletes a Skill. Raises ``PersonaApiError`` if any Agent still
        references it — call ``get_usage()`` first to check.

        Args:
            skill_id: The Skill's ``_id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/skills/{skill_id}")

    async def get_usage(self, skill_id: str) -> ResourceUsage:
        """Agents referencing this Skill — check before ``delete()`` to avoid a blocked delete.

        Args:
            skill_id: The Skill's ``_id``.

        Returns:
            ``agentCount`` is the real total; ``agents`` is a preview capped at 20.
        """
        return cast(
            ResourceUsage,
            await self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}/usage"),
        )

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures (e.g. a Skill still
        referenced by an Agent) don't raise or abort the rest of the batch.

        Args:
            ids: Up to 100 Skill ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/skills/bulk-delete", json={"ids": ids}
            ),
        )
