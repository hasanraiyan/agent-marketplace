"""Mirrors ``sdk/src/types/agent.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict


class AgentSocialLinks(TypedDict, total=False):
    website: str
    twitter: str
    github: str
    linkedin: str


AgentVisibility = Literal["private", "unlisted", "public"]
AgentCategory = Literal["productivity", "coding", "creative", "research", "roleplay", "other"]


class _AgentRequired(TypedDict):
    _id: str
    domain: str
    ownerType: Literal["PersonaUser", "Project", "ExternalUser"]
    name: str
    slug: str
    webSearchEnabled: bool
    visibility: AgentVisibility
    category: AgentCategory
    isActive: bool
    isMainAgent: bool
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
    tagline: str
    bio: str
    personalityTraits: list[str]
    socialLinks: AgentSocialLinks
    systemPrompt: str  # stripped from the response when the caller doesn't own this Agent
    providerId: str  # stripped from the response when the caller doesn't own this Agent
    modelName: str
    skills: list[object]
    mcps: list[object]
    knowledgeBases: list[object]


class _CreateAgentInputRequired(TypedDict):
    name: str
    systemPrompt: str
    providerId: str


class CreateAgentInput(_CreateAgentInputRequired, total=False):
    description: str
    avatar: str
    tags: list[str]
    tagline: str
    bio: str
    personalityTraits: list[str]
    socialLinks: AgentSocialLinks
    modelName: str
    webSearchEnabled: bool
    visibility: AgentVisibility
    category: AgentCategory
    skills: list[str]
    mcps: list[str]
    knowledgeBases: list[str]
    isActive: bool


class UpdateAgentInput(TypedDict, total=False):
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
    skills: list[str]
    mcps: list[str]
    knowledgeBases: list[str]
    visibility: AgentVisibility
    category: AgentCategory
    isActive: bool


class DiscoverAgentsParams(TypedDict, total=False):
    page: int
    limit: int
    search: str
    category: AgentCategory
    scope: Literal["mine"]  # restricts to the asserted external user's own Agents (runtime-only)
