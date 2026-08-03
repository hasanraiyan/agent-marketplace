"""Mirrors ``sdk/src/types/thread.ts``."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


class _ThreadAgentRefRequired(TypedDict):
    _id: str
    name: str
    slug: str


class ThreadAgentRef(_ThreadAgentRefRequired, total=False):
    avatar: str


class _ThreadRequired(TypedDict):
    _id: str
    domain: str
    agentId: str | ThreadAgentRef  # {_id, name, avatar, slug} on list(); bare id on create()/get()
    subjectType: Literal["PersonaUser", "ExternalUser"]
    threadId: str
    title: str
    lastMessageAt: str
    isArchived: bool
    createdAt: str
    updatedAt: str


class Thread(_ThreadRequired, total=False):
    """Like ``Skill``/``Agent``/``Knowledge``/``Mcp``, this mirrors the real
    wire shape (``_id``)."""

    userId: str
    externalUserId: str
    subagentTraces: dict[str, Any]


class CreateThreadInput(TypedDict):
    agentId: str


class UpdateThreadInput(TypedDict, total=False):
    title: str
    isArchived: bool


class ListThreadsParams(TypedDict, total=False):
    page: int
    limit: int


class ThreadMessages(TypedDict):
    """``messages`` holds raw LangChain message objects (role/content/
    tool_calls vary by message type) — intentionally untyped rather than
    guessing at a shape this SDK doesn't own."""

    messages: list[Any]
    state: dict[str, Any]
    subagentTraces: dict[str, Any]
