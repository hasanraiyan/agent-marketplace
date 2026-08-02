"""Threads (``/api/v1/developer/threads``) — a Thread's Subject is a person
chatting, so every call here requires this client to have been constructed
with ``external_user_id`` set (a bare Project credential has no Subject to
scope a conversation to; the server rejects it with 400
``EXTERNAL_USER_REQUIRED`` otherwise). Ported from
``sdk/src/resources/threads.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..types.thread import CreateThreadInput, ListThreadsParams, Thread, ThreadMessages

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Threads:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateThreadInput) -> Thread:
        return cast(
            Thread, self._transport.request("POST", "/api/v1/developer/threads", json=input)
        )

    def list(self, params: ListThreadsParams | None = None) -> list[Thread]:
        """Note: returns a bare list — this endpoint has no pagination envelope."""
        return cast(
            list[Thread],
            self._transport.request("GET", "/api/v1/developer/threads", query=params),
        )

    def get(self, thread_id: str) -> Thread:
        return cast(
            Thread, self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}")
        )

    def update_title(self, thread_id: str, title: str) -> Thread:
        return cast(
            Thread,
            self._transport.request(
                "PATCH", f"/api/v1/developer/threads/{thread_id}", json={"title": title}
            ),
        )

    def delete(self, thread_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/threads/{thread_id}")

    def get_messages(self, thread_id: str) -> ThreadMessages:
        return cast(
            ThreadMessages,
            self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}/messages"),
        )


class AsyncThreads:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateThreadInput) -> Thread:
        return cast(
            Thread,
            await self._transport.request("POST", "/api/v1/developer/threads", json=input),
        )

    async def list(self, params: ListThreadsParams | None = None) -> list[Thread]:
        """Note: returns a bare list — this endpoint has no pagination envelope."""
        return cast(
            list[Thread],
            await self._transport.request("GET", "/api/v1/developer/threads", query=params),
        )

    async def get(self, thread_id: str) -> Thread:
        return cast(
            Thread,
            await self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}"),
        )

    async def update_title(self, thread_id: str, title: str) -> Thread:
        return cast(
            Thread,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/threads/{thread_id}", json={"title": title}
            ),
        )

    async def delete(self, thread_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/threads/{thread_id}")

    async def get_messages(self, thread_id: str) -> ThreadMessages:
        return cast(
            ThreadMessages,
            await self._transport.request("GET", f"/api/v1/developer/threads/{thread_id}/messages"),
        )
