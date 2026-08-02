"""Mirrors ``sdk/src/types/skill.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict


class _SkillFileRequired(TypedDict):
    path: str
    content: str


class SkillFile(_SkillFileRequired, total=False):
    mimeType: str
    createdAt: str
    updatedAt: str


class _SkillFileInputRequired(TypedDict):
    path: str
    content: str


class SkillFileInput(_SkillFileInputRequired, total=False):
    mimeType: str


class _SkillRequired(TypedDict):
    _id: str
    domain: str
    ownerType: Literal["PersonaUser", "Project", "ExternalUser"]
    name: str
    description: str
    instructions: str
    files: list[SkillFile]
    isPublic: bool
    createdAt: str
    updatedAt: str


class Skill(_SkillRequired, total=False):
    """Note: unlike ``Provider``, the Developer API returns Skill documents
    in their raw Mongo shape (``_id``, not ``id``) — reflected here as-is
    rather than papering over a real backend inconsistency."""

    ownerId: str
    externalOwnerId: str
    isOwner: bool  # present only on get() — whether the calling identity owns this Skill


class _CreateSkillInputRequired(TypedDict):
    name: str
    description: str
    instructions: str


class CreateSkillInput(_CreateSkillInputRequired, total=False):
    isPublic: bool
    files: list[SkillFileInput]


class UpdateSkillInput(TypedDict, total=False):
    name: str
    description: str
    instructions: str
    isPublic: bool
    files: list[SkillFileInput]


class DiscoverSkillsParams(TypedDict, total=False):
    page: int
    limit: int
    search: str
    scope: Literal["mine"]  # restricts to the asserted external user's own Skills (runtime-only)
