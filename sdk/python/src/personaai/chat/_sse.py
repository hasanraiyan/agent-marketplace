"""Pure SSE-framing/event-decoding logic, shared by the sync and async chat
clients (each drives it from its own kind of chunk iterator, so the actual
`for`/`async for` loop can't be shared, only this buffer/decode step can).
Ported from ``sdk/src/chat/sse.ts``'s ``parseAguiEventStream``."""

from __future__ import annotations

import json as json_lib

from ..types.chat import AguiEvent


def split_buffer(buffer: str) -> tuple[list[str], str]:
    """Splits ``buffer`` on the SSE frame delimiter (``\\n\\n``), returning
    (complete raw frames, leftover partial frame) — mirrors
    ``buffer.split('\\n\\n')`` + ``.pop()`` in ``sse.ts``."""
    frames = buffer.split("\n\n")
    leftover = frames.pop()
    return frames, leftover


def decode_frame(raw_frame: str) -> AguiEvent | None:
    """Extracts and JSON-decodes the ``data:`` line(s) of one SSE frame.
    Returns ``None`` for frames with no data, or malformed/partial JSON —
    skipped rather than raised, matching SSE's own tolerant-parsing
    convention."""
    data_lines = [line[5:].lstrip() for line in raw_frame.split("\n") if line.startswith("data:")]
    if not data_lines:
        return None

    data = "\n".join(data_lines)
    if not data:
        return None

    try:
        event = json_lib.loads(data)
    except ValueError:
        return None

    return event if isinstance(event, dict) else None
