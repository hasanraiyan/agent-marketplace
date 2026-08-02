"""Mirrors ``sdk/src/types/chat.ts``.

Unlike the Node SDK, which gets a fully-typed discriminated ``AGUIEvent``
union for free from ``@ag-ui/core``, this SDK does not depend on any AG-UI
protocol package — avoiding both the heavy ``@ag-ui/client`` dependency
chain the Node SDK deliberately rejected (see ``sdk/src/chat/sse.ts``'s own
comment) and a dependency on a Python AG-UI package this project doesn't
otherwise use. Events are typed loosely as ``AguiEvent = dict[str, Any]`` —
every event has a ``type`` key (see ``EventType``) plus type-specific
fields (``delta``, ``name``, ``value``, etc.); consult the Integration
Guide / AG-UI protocol docs for the full field list per event type.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

AguiEvent = dict[str, Any]


class EventType:
    """String constants for every AG-UI event type this backend emits —
    compare directly against ``event["type"]``."""

    RUN_STARTED = "RUN_STARTED"
    TEXT_MESSAGE_CHUNK = "TEXT_MESSAGE_CHUNK"
    REASONING_MESSAGE_START = "REASONING_MESSAGE_START"
    REASONING_MESSAGE_CONTENT = "REASONING_MESSAGE_CONTENT"
    REASONING_MESSAGE_END = "REASONING_MESSAGE_END"
    TOOL_CALL_CHUNK = "TOOL_CALL_CHUNK"
    TOOL_CALL_RESULT = "TOOL_CALL_RESULT"
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    CUSTOM = "CUSTOM"
    RUN_FINISHED = "RUN_FINISHED"


class ChatMessageInput(TypedDict):
    role: Literal["user", "assistant"]
    content: str


# Approves/denies a pending human-in-the-loop interrupt, or answers a
# pending clarification. Loosely typed to match the wire's own
# `{decisions:[...]} | {answers:[...], text?} | Record<string, unknown>`
# union — see `ChatInterrupt` for which shape a given interrupt expects.
ChatResume = dict[str, Any]


class ChatInterrupt(TypedDict):
    """A pending interrupt surfaced via a CUSTOM event — this backend's own
    human-in-the-loop protocol (tool-approval or clarification-question),
    not the newer standard AG-UI ``RunFinishedInterruptOutcome`` field
    (this backend's translator doesn't emit that).

    ``kind='hitl'`` -> resume with ``{"decisions": [...]}``.
    ``kind='clarification'`` -> resume with ``{"answers": [...], "text": ...}``.
    """

    kind: Literal["hitl", "clarification"]
    value: Any


class ChatResult(TypedDict):
    text: str
    """The final assembled assistant text (concatenated TEXT_MESSAGE_CHUNK deltas)."""
    interrupt: ChatInterrupt | None
    """Set when the run paused on a human-in-the-loop interrupt instead of finishing normally."""
    events: list[AguiEvent]
    """Every raw event received, in order — for callers who want full detail beyond `text`."""
