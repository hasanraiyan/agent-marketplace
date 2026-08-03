"""Mirrors ``sdk/src/types/bulkDelete.ts``."""

from __future__ import annotations

from typing import TypedDict


class BulkDeleteFailure(TypedDict):
    id: str
    reason: str


class BulkDeleteResult(TypedDict):
    deleted: list[str]
    failed: list[BulkDeleteFailure]
