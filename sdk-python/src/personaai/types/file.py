"""Mirrors ``sdk/src/types/file.ts``."""

from __future__ import annotations

from typing import BinaryIO, TypedDict


class PersonaFile(TypedDict):
    """Clean formatted shape (``id``, not ``_id``) — unlike Thread/Skill/Agent/Knowledge."""

    id: str
    originalName: str
    mimeType: str
    size: int  # bytes
    agentId: str | None
    threadId: str | None
    createdAt: str


class _UploadFilePayloadRequired(TypedDict):
    filename: str
    content: bytes | BinaryIO


class UploadFilePayload(_UploadFilePayloadRequired, total=False):
    contentType: str  # e.g. 'application/pdf'; required when content type can't be inferred
    agentId: str  # associates this file with an Agent, e.g. for later reference in tool calls
    threadId: str  # associates this file with a specific Thread/conversation


class ListFilesParams(TypedDict, total=False):
    page: int  # default: 1
    limit: int  # default: 20
