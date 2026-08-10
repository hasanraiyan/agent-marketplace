"""Mirrors ``sdk/src/types/skill.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict


class _SkillFileRequired(TypedDict):
    path: str
    content: str


class SkillFile(_SkillFileRequired, total=False):
    """A file bundled with a Skill (e.g. a reference doc or script an Agent can read)."""

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
    instructions: str  # the actual prompt text given to an Agent that has this Skill attached
    files: list[SkillFile]
    isPublic: bool  # visible to every credential in the platform when True, not just this Domain
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
    isPublic: bool  # default: False
    files: list[SkillFileInput]


class UpdateSkillInput(TypedDict, total=False):
    """All fields optional — only what you pass is changed."""

    name: str
    description: str
    instructions: str
    isPublic: bool
    files: list[SkillFileInput]  # replaces the entire files array — this is not a merge/append


class DiscoverSkillsParams(TypedDict, total=False):
    page: int  # default: 1
    limit: int  # default: 20
    search: str  # free-text match against name/description
    scope: Literal["mine"]  # restricts to the asserted external user's own Skills (runtime-only)
