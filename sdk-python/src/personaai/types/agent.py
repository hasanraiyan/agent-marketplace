"""Mirrors ``sdk/src/types/agent.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict


class AgentSocialLinks(TypedDict, total=False):
    website: str
    twitter: str
    github: str
    linkedin: str


# "unlisted" is reachable by direct link/id but excluded from public discovery listings.
AgentVisibility = Literal["private", "unlisted", "public"]
AgentCategory = Literal["productivity", "coding", "creative", "research", "roleplay", "other"]


class _AgentRequired(TypedDict):
    _id: str
    domain: str
    ownerType: Literal["PersonaUser", "Project", "ExternalUser"]
    name: str
    slug: str  # URL-safe, unique within the Domain; used in some public-facing routes
    webSearchEnabled: bool
    visibility: AgentVisibility
    category: AgentCategory
    isActive: bool
    isMainAgent: bool  # whether this is the Project's designated default/primary Agent
    createdAt: str
    updatedAt: str


class Agent(_AgentRequired, total=False):
    """Note: like ``Skill``, this mirrors the real wire shape (``_id``, raw
    domain/ownerType fields) — ``get()`` returns ``skills``/``mcps``/
    ``knowledgeBases`` populated as objects, while ``create()``/``update()``/
    ``list()`` return them as bare id strings; typed loosely here
    (``list[object]``) to reflect that real difference rather than picking
    one shape and being wrong for the other calls."""

    ownerId: str
    externalOwnerId: str
    description: str
    avatar: str
    tags: list[str]
    tagline: str  # short one-liner shown in list/card views
    bio: str  # longer free-text bio shown on the Agent's own profile view
    personalityTraits: list[str]
    socialLinks: AgentSocialLinks
    systemPrompt: str  # stripped from the response when the caller doesn't own this Agent
    providerId: str  # stripped from the response when the caller doesn't own this Agent
    modelName: str  # overrides the referenced Provider's defaultModel when set
    skills: list[object]  # bare id strings on create/update/list; populated objects on get()
    mcps: list[object]  # bare id strings on create/update/list; populated objects on get()
    knowledgeBases: list[
        object
    ]  # bare id strings on create/update/list; populated objects on get()


class _CreateAgentInputRequired(TypedDict):
    name: str
    systemPrompt: str  # the instructions that define this Agent's behavior/persona
    providerId: str  # must reference a Provider already created via providers.create()


class CreateAgentInput(_CreateAgentInputRequired, total=False):
    description: str
    avatar: str
    tags: list[str]
    tagline: str
    bio: str
    personalityTraits: list[str]
    socialLinks: AgentSocialLinks
    modelName: str  # overrides the referenced Provider's defaultModel
    webSearchEnabled: bool  # default: False
    visibility: AgentVisibility  # default: 'private'
    category: AgentCategory  # default: 'other'
    skills: list[str]  # Skill ids to attach at creation time
    mcps: list[str]  # MCP server ids to attach at creation time
    knowledgeBases: list[str]  # Knowledge base ids to attach at creation time
    isActive: bool  # default: True


class UpdateAgentInput(TypedDict, total=False):
    """All fields optional — only what you pass is changed."""

    name: str
    description: str
    avatar: str
    tags: list[str]
    tagline: str
    bio: str
    personalityTraits: list[str]
    socialLinks: AgentSocialLinks
    systemPrompt: str
    providerId: str
    modelName: str
    webSearchEnabled: bool
    skills: list[str]  # replaces the entire list — this is not a merge/append
    mcps: list[str]  # replaces the entire list — this is not a merge/append
    knowledgeBases: list[str]  # replaces the entire list — this is not a merge/append
    visibility: AgentVisibility
    category: AgentCategory
    isActive: bool


class DiscoverAgentsParams(TypedDict, total=False):
    page: int  # default: 1
    limit: int  # default: 20
    search: str  # free-text match against name/description/tagline
    category: AgentCategory
    scope: Literal["mine"]  # restricts to the asserted external user's own Agents (runtime-only)
