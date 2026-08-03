"""Mirrors ``sdk/src/types/usage.ts``."""

from __future__ import annotations

from typing import TypedDict


class ResourceUsageAgent(TypedDict):
    _id: str
    name: str


class ResourceUsage(TypedDict):
    agentCount: int
    agents: list[ResourceUsageAgent]
