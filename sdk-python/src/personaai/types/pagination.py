"""Mirrors ``sdk/src/types/pagination.ts``."""

from __future__ import annotations

from typing import Generic, TypedDict, TypeVar

T = TypeVar("T")


class PaginationInfo(TypedDict):
    total: int
    page: int
    limit: int
    pages: int


class PaginatedResult(TypedDict, Generic[T]):
    """Envelope returned by every paginated ``list()``/``discover()`` method
    (Agents/Skills/Knowledge/MCP/Threads/Files — not Providers, which has no
    discovery concept and stays a bare list)."""

    items: list[T]
    pagination: PaginationInfo
