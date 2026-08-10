"""Mirrors ``sdk/src/types/memory.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict


class MemoryFile(TypedDict):
    """One memory file as returned by the API (mirrors ``memory.service.js``'s
    ``_toFileDto``)."""

    scope: Literal["user", "agent"]
    # Set when scope is 'agent'.
    agentId: str | None
    path: str
    content: str
    mimeType: str
    createdAt: str
    updatedAt: str


class MemoryAgentGroup(TypedDict):
    """One agent's group of agent-scoped memory files, as returned by
    ``memory.list()``."""

    agentId: str
    # None if the Agent no longer exists.
    agentName: str | None
    files: list[MemoryFile]


class MemoryListResult(TypedDict):
    """``GET /api/v1/developer/memory`` — every memory file for the asserted
    external user: user-global files plus one group per Agent that has
    agent-scoped memory."""

    userFiles: list[MemoryFile]
    agentMemories: list[MemoryAgentGroup]


class MemoryFileScopeParams(TypedDict, total=False):
    scope: Literal["user", "agent"]  # default: 'user'
    agentId: str  # required when scope is 'agent'


class GetMemoryFileParams(MemoryFileScopeParams):
    path: str


class WriteMemoryFileInput(MemoryFileScopeParams):
    path: str
    content: str


class DeleteMemoryFileParams(MemoryFileScopeParams):
    path: str
