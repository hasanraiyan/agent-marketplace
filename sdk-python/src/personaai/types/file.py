"""Mirrors ``sdk/src/types/file.ts``."""

from __future__ import annotations

from typing import BinaryIO, TypedDict


class PersonaFile(TypedDict):
    """Clean formatted shape (``id``, not ``_id``) — unlike Thread/Skill/Agent/Knowledge."""

    id: str
    originalName: str
    mimeType: str
    size: int
    agentId: str | None
    threadId: str | None
    createdAt: str


class _UploadFilePayloadRequired(TypedDict):
    filename: str
    content: bytes | BinaryIO


class UploadFilePayload(_UploadFilePayloadRequired, total=False):
    contentType: str
    agentId: str
    threadId: str


class ListFilesParams(TypedDict, total=False):
    page: int
    limit: int
