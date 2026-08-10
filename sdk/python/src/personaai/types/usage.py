"""Mirrors ``sdk/src/types/usage.ts``."""

from __future__ import annotations

from typing import TypedDict


class ResourceUsageAgent(TypedDict):
    _id: str
    name: str


class ResourceUsage(TypedDict):
    """A small preview of the Agents referencing a resource — ``agentCount`` is the real total."""

    agentCount: int  # the real total count of referencing Agents — use this, not len(agents)
    agents: list[ResourceUsageAgent]  # a preview list, capped at 20 — not necessarily every match
