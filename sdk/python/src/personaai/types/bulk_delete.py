"""Mirrors ``sdk/src/types/bulkDelete.ts``."""

from __future__ import annotations

from typing import TypedDict


class BulkDeleteFailure(TypedDict):
    id: str
    # Generic reason (existence-hiding: never distinguishes "not found" from
    # "not authorized" from "blocked by a dependency").
    reason: str


class BulkDeleteResult(TypedDict):
    """Result of a ``bulk_delete()`` call — best-effort, partial failures don't raise."""

    deleted: list[str]  # ids that were successfully deleted
    failed: list[BulkDeleteFailure]
