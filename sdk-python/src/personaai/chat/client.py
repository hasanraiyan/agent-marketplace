"""AG-UI chat client (``/api/v1/developer/agui``) — runs an Agent as the
asserted external user, streaming the response. Requires this client to
have been constructed with ``external_user_id`` set (a bare Project
credential has no Subject to chat as; the server rejects it with 400).
Ported from ``sdk/src/chat/chat-client.ts``.

Unlike the Node SDK's single ``ChatClient`` (JS async generators cover both
worlds), Python needs a sync/async pair: ``ChatClient.stream()`` is a
regular generator, ``AsyncChatClient.stream()`` is an async generator.
``send_message()``/``stream()`` take ``messages``/``thread_id``/``resume``
as direct parameters rather than one options object, matching how the rest
of this SDK's resource methods take keyword args instead of TS-style
options bags.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING, Any

from ..types.chat import (
    AguiEvent,
    ChatInterrupt,
    ChatMessageInput,
    ChatResult,
    ChatResume,
    EventType,
)
from ._sse import decode_frame, split_buffer

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport

_AGUI_PATH = "/api/v1/developer/agui"


def _stream_headers(agent_id: str, thread_id: str | None) -> dict[str, str]:
    headers = {"x-agent-id": agent_id}
    if thread_id:
        headers["x-thread-id"] = thread_id
    return headers


def _stream_body(messages: list[ChatMessageInput], resume: ChatResume | None) -> dict[str, Any]:
    return {"messages": messages, "resume": resume}


def _accumulate(events: list[AguiEvent]) -> ChatResult:
    text = ""
    interrupt: ChatInterrupt | None = None

    for event in events:
        event_type = event.get("type")
        if event_type == EventType.TEXT_MESSAGE_CHUNK:
            delta = event.get("delta")
            if isinstance(delta, str):
                text += delta
        elif event_type == EventType.CUSTOM:
            name = event.get("name")
            if name == "hitl_request":
                interrupt = {"kind": "hitl", "value": event.get("value")}
            elif name == "clarification_request":
                interrupt = {"kind": "clarification", "value": event.get("value")}

    return {"text": text, "interrupt": interrupt, "events": events}


class ChatClient:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def stream(
        self,
        agent_id: str,
        messages: list[ChatMessageInput],
        *,
        thread_id: str | None = None,
        resume: ChatResume | None = None,
    ) -> Iterator[AguiEvent]:
        """Full event stream, for building your own UI (text deltas, tool
        calls, reasoning, custom events) rather than just the final text."""
        text_chunks = self._transport.stream_lines(
            "POST",
            _AGUI_PATH,
            json=_stream_body(messages, resume),
            headers=_stream_headers(agent_id, thread_id),
        )
        buffer = ""
        for chunk in text_chunks:
            buffer += chunk
            frames, buffer = split_buffer(buffer)
            for frame in frames:
                event = decode_frame(frame)
                if event is not None:
                    yield event

    def send_message(
        self,
        agent_id: str,
        messages: list[ChatMessageInput],
        *,
        thread_id: str | None = None,
        resume: ChatResume | None = None,
    ) -> ChatResult:
        """Convenience wrapper over ``stream()``: drains the full run and
        returns the assembled assistant text, plus a ``ChatInterrupt`` if
        the run paused on a human-in-the-loop decision instead of
        finishing normally."""
        events = list(self.stream(agent_id, messages, thread_id=thread_id, resume=resume))
        return _accumulate(events)


class AsyncChatClient:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def stream(
        self,
        agent_id: str,
        messages: list[ChatMessageInput],
        *,
        thread_id: str | None = None,
        resume: ChatResume | None = None,
    ) -> AsyncIterator[AguiEvent]:
        """Full event stream, for building your own UI (text deltas, tool
        calls, reasoning, custom events) rather than just the final text."""
        text_chunks = self._transport.stream_lines(
            "POST",
            _AGUI_PATH,
            json=_stream_body(messages, resume),
            headers=_stream_headers(agent_id, thread_id),
        )
        buffer = ""
        async for chunk in text_chunks:
            buffer += chunk
            frames, buffer = split_buffer(buffer)
            for frame in frames:
                event = decode_frame(frame)
                if event is not None:
                    yield event

    async def send_message(
        self,
        agent_id: str,
        messages: list[ChatMessageInput],
        *,
        thread_id: str | None = None,
        resume: ChatResume | None = None,
    ) -> ChatResult:
        """Convenience wrapper over ``stream()``: drains the full run and
        returns the assembled assistant text, plus a ``ChatInterrupt`` if
        the run paused on a human-in-the-loop decision instead of
        finishing normally."""
        events = [
            event
            async for event in self.stream(agent_id, messages, thread_id=thread_id, resume=resume)
        ]
        return _accumulate(events)
