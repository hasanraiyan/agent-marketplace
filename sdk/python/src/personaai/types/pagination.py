"""Mirrors ``sdk/src/types/pagination.ts``."""

from __future__ import annotations

from typing import Generic, TypedDict, TypeVar

T = TypeVar("T")


class PaginationInfo(TypedDict):
    """Pagination metadata attached to every ``PaginatedResult``."""

    total: int  # total matching items across all pages — use this, not len(items)
    page: int  # echoes back the requested page, or 1 if omitted
    limit: int  # echoes back the requested limit, or the endpoint's default
    pages: int  # total page count: ceil(total / limit)


class PaginatedResult(TypedDict, Generic[T]):
    """Envelope returned by every paginated ``list()``/``discover()`` method
    (Agents/Skills/Knowledge/MCP/Threads/Files — not Providers, which has no
    discovery concept and stays a bare list)."""

    items: list[T]
    pagination: PaginationInfo
