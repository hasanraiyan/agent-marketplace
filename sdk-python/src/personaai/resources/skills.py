"""Skills (``/api/v1/developer/skills``) — Project-owned or, when this
client asserts an external user, owned by that end user. Ported from
``sdk/src/resources/skills.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..types.skill import CreateSkillInput, DiscoverSkillsParams, Skill, UpdateSkillInput
from ..types.usage import ResourceUsage

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Skills:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateSkillInput) -> Skill:
        return cast(Skill, self._transport.request("POST", "/api/v1/developer/skills", json=input))

    def list(self, params: DiscoverSkillsParams | None = None) -> list[Skill]:
        """Note: returns a bare list — this endpoint has no pagination envelope."""
        return cast(
            list[Skill],
            self._transport.request("GET", "/api/v1/developer/skills", query=params),
        )

    def get(self, skill_id: str) -> Skill:
        return cast(Skill, self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}"))

    def update(self, skill_id: str, input: UpdateSkillInput) -> Skill:
        return cast(
            Skill,
            self._transport.request("PATCH", f"/api/v1/developer/skills/{skill_id}", json=input),
        )

    def delete(self, skill_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/skills/{skill_id}")

    def get_usage(self, skill_id: str) -> ResourceUsage:
        """Agents referencing this Skill — check before ``delete()`` to avoid a blocked delete."""
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}/usage"),
        )


class AsyncSkills:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateSkillInput) -> Skill:
        return cast(
            Skill, await self._transport.request("POST", "/api/v1/developer/skills", json=input)
        )

    async def list(self, params: DiscoverSkillsParams | None = None) -> list[Skill]:
        """Note: returns a bare list — this endpoint has no pagination envelope."""
        return cast(
            list[Skill],
            await self._transport.request("GET", "/api/v1/developer/skills", query=params),
        )

    async def get(self, skill_id: str) -> Skill:
        return cast(
            Skill, await self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}")
        )

    async def update(self, skill_id: str, input: UpdateSkillInput) -> Skill:
        return cast(
            Skill,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/skills/{skill_id}", json=input
            ),
        )

    async def delete(self, skill_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/skills/{skill_id}")

    async def get_usage(self, skill_id: str) -> ResourceUsage:
        """Agents referencing this Skill — check before ``delete()`` to avoid a blocked delete."""
        return cast(
            ResourceUsage,
            await self._transport.request("GET", f"/api/v1/developer/skills/{skill_id}/usage"),
        )
