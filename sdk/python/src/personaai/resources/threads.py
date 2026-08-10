"""Threads (``/api/v1/developer/threads``) — a Thread's Subject is a person
chatting, so every call here requires this client to have been constructed
with ``external_user_id`` set (a bare Project credential has no Subject to
scope a conversation to; the server rejects it with 400
``EXTERNAL_USER_REQUIRED`` otherwise). Ported from
``sdk/src/resources/threads.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, cast

from ..types.bulk_delete import BulkDeleteResult
from ..types.pagination import PaginatedResult
from ..types.thread import (
    CreateThreadInput,
    ListThreadsParams,
    Thread,
    ThreadMessages,
    UpdateThreadInput,
)

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Threads:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateThreadInput, idempotency_key: str | None = None) -> Thread:
        """Creates a new conversation Thread for the asserted external user
        with the given Agent. You don't need to call this before chatting
        — ``chat.send_message()``/``chat.stream()`` create an implicit
        deterministic Thread automatically; call this only when you want an
        explicit, listable Thread up front.

        Args:
            input: ``{"agentId": ...}``.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Thread.

        Returns:
            The created :class:`Thread` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Thread,
            self._transport.request(
                "POST", "/api/v1/developer/threads", json=input, headers=headers
            ),
        )

    def list(self, params: ListThreadsParams | None = None) -> PaginatedResult[Thread]:
        """Lists the asserted external user's own Threads, most recently active first.

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
            Each item's ``agentId`` is populated as
            ``{"_id", "name", "avatar", "slug"}`` here (unlike ``create()``/
            ``get()``, which return a bare id string).
        """
        return cast(
            PaginatedResult[Thread],
            self._transport.request("GET", "/api/v1/developer/threads", query=params),
        )

    def get(self, thread_id: str) -> Thread:
        """Fetches a single Thread by id.

        Args:
            thread_id: The Thread's ``_id``.
        """
        return cast(
            Thread, self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}")
        )

    def update(self, thread_id: str, input: UpdateThreadInput) -> Thread:
        """General-purpose update — ``{title, isArchived}``, both optional.
        Pass just ``{"isArchived": True}`` to archive a Thread without
        touching its title.

        Args:
            thread_id: The Thread's ``_id``.
        """
        return cast(
            Thread,
            self._transport.request("PATCH", f"/api/v1/developer/threads/{thread_id}", json=input),
        )

    def update_title(self, thread_id: str, title: str) -> Thread:
        """Convenience wrapper over ``update()`` for the common title-only case.

        Args:
            thread_id: The Thread's ``_id``.
            title: The new title.
        """
        return self.update(thread_id, {"title": title})

    def delete(self, thread_id: str) -> None:
        """Deletes a Thread and its message history.

        Args:
            thread_id: The Thread's ``_id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/threads/{thread_id}")

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 Thread ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/threads/bulk-delete", json={"ids": ids}
            ),
        )

    def get_messages(self, thread_id: str) -> ThreadMessages:
        """Fetches the full message history + graph state for a Thread —
        the same data ``chat.stream()`` would resume from.

        Args:
            thread_id: The Thread's ``_id``.
        """
        return cast(
            ThreadMessages,
            self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}/messages"),
        )


class AsyncThreads:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateThreadInput, idempotency_key: str | None = None) -> Thread:
        """Creates a new conversation Thread for the asserted external user
        with the given Agent. You don't need to call this before chatting
        — ``chat.send_message()``/``chat.stream()`` create an implicit
        deterministic Thread automatically; call this only when you want an
        explicit, listable Thread up front.

        Args:
            input: ``{"agentId": ...}``.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Thread.

        Returns:
            The created :class:`Thread` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Thread,
            await self._transport.request(
                "POST", "/api/v1/developer/threads", json=input, headers=headers
            ),
        )

    async def list(self, params: ListThreadsParams | None = None) -> PaginatedResult[Thread]:
        """Lists the asserted external user's own Threads, most recently active first.

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
            Each item's ``agentId`` is populated as
            ``{"_id", "name", "avatar", "slug"}`` here (unlike ``create()``/
            ``get()``, which return a bare id string).
        """
        return cast(
            PaginatedResult[Thread],
            await self._transport.request("GET", "/api/v1/developer/threads", query=params),
        )

    async def get(self, thread_id: str) -> Thread:
        """Fetches a single Thread by id.

        Args:
            thread_id: The Thread's ``_id``.
        """
        return cast(
            Thread,
            await self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}"),
        )

    async def update(self, thread_id: str, input: UpdateThreadInput) -> Thread:
        """General-purpose update — ``{title, isArchived}``, both optional.
        Pass just ``{"isArchived": True}`` to archive a Thread without
        touching its title.

        Args:
            thread_id: The Thread's ``_id``.
        """
        return cast(
            Thread,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/threads/{thread_id}", json=input
            ),
        )

    async def update_title(self, thread_id: str, title: str) -> Thread:
        """Convenience wrapper over ``update()`` for the common title-only case.

        Args:
            thread_id: The Thread's ``_id``.
            title: The new title.
        """
        return await self.update(thread_id, {"title": title})

    async def delete(self, thread_id: str) -> None:
        """Deletes a Thread and its message history.

        Args:
            thread_id: The Thread's ``_id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/threads/{thread_id}")

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 Thread ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/threads/bulk-delete", json={"ids": ids}
            ),
        )

    async def get_messages(self, thread_id: str) -> ThreadMessages:
        """Fetches the full message history + graph state for a Thread —
        the same data ``chat.stream()`` would resume from.

        Args:
            thread_id: The Thread's ``_id``.
        """
        return cast(
            ThreadMessages,
            await self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}/messages"),
        )
