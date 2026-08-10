"""Agent Architect client (``/api/v1/developer/architect/agui``) — a
conversational co-pilot that creates/edits Agents via tool calls, on your
behalf. Unlike :class:`ChatClient`, there's no ``agent_id`` to pass (it's
always this one dedicated Architect) and no thread selection (one implicit
conversation per caller).

**Ownership depends on whether this client was constructed with
``external_user_id``:** omit it and the Architect builds/edits Agents owned by
your whole Project (the SDK-reachable equivalent of a Project Admin managing
the shared roster by hand). Set it and the Architect builds/edits Agents owned
by that one external user instead — the same dual-mode ownership convention
every other Developer Platform resource follows.

Ported from ``sdk/src/chat/architect-client.ts``.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING, Any

from ..types.chat import AguiEvent, ChatMessageInput, ChatResult, ChatResume
from ._sse import decode_frame, split_buffer
from .client import _accumulate

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport

_ARCHITECT_PATH = "/api/v1/developer/architect/agui"


def _architect_body(messages: list[ChatMessageInput], resume: ChatResume | None) -> dict[str, Any]:
    return {"messages": messages, "resume": resume}


class ArchitectClient:
    """Synchronous Architect chat client."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def stream(
        self,
        messages: list[ChatMessageInput],
        *,
        resume: ChatResume | None = None,
    ) -> Iterator[AguiEvent]:
        """Streams the raw AG-UI event sequence for a run against the
        Architect.

        Args:
            messages: The conversation turn(s) to send.
            resume: Answers a pending interrupt from a previous run (see
                :class:`ChatInterrupt`); omit for a fresh message.

        Yields:
            Each raw :data:`AguiEvent` as it arrives.
        """
        text_chunks = self._transport.stream_lines(
            "POST", _ARCHITECT_PATH, json=_architect_body(messages, resume)
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
        messages: list[ChatMessageInput],
        *,
        resume: ChatResume | None = None,
    ) -> ChatResult:
        """Convenience wrapper over ``stream()``: drains the full run and
        returns the assembled assistant text, plus a ``ChatInterrupt`` if the
        run paused on a human-in-the-loop decision (e.g. confirming
        ``upsert_agent``) instead of finishing normally.

        Args:
            messages: The conversation turn(s) to send.
            resume: Answers a pending interrupt from a previous run.

        Returns:
            ``{"text", "interrupt", "events"}`` — ``interrupt`` is set
            instead of the run finishing normally when a human-in-the-loop
            decision is pending; resume it by calling this again with
            ``resume`` set.

        Example:
            >>> result = client.architect.send_message(
            ...     [{"role": "user", "content": "Create an agent that... "}]
            ... )
            >>> print(result["text"])
        """
        events = list(self.stream(messages, resume=resume))
        return _accumulate(events)


class AsyncArchitectClient:
    """Asynchronous Architect chat client."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def stream(
        self,
        messages: list[ChatMessageInput],
        *,
        resume: ChatResume | None = None,
    ) -> AsyncIterator[AguiEvent]:
        """Streams the raw AG-UI event sequence for a run against the
        Architect.

        Args:
            messages: The conversation turn(s) to send.
            resume: Answers a pending interrupt from a previous run (see
                :class:`ChatInterrupt`); omit for a fresh message.

        Yields:
            Each raw :data:`AguiEvent` as it arrives.
        """
        text_chunks = self._transport.stream_lines(
            "POST", _ARCHITECT_PATH, json=_architect_body(messages, resume)
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
        messages: list[ChatMessageInput],
        *,
        resume: ChatResume | None = None,
    ) -> ChatResult:
        """Convenience wrapper over ``stream()``: drains the full run and
        returns the assembled assistant text, plus a ``ChatInterrupt`` if the
        run paused on a human-in-the-loop decision instead of finishing
        normally.

        Args:
            messages: The conversation turn(s) to send.
            resume: Answers a pending interrupt from a previous run.

        Returns:
            ``{"text", "interrupt", "events"}`` — ``interrupt`` is set
            instead of the run finishing normally when a human-in-the-loop
            decision is pending; resume it by calling this again with
            ``resume`` set.
        """
        events = [event async for event in self.stream(messages, resume=resume)]
        return _accumulate(events)
