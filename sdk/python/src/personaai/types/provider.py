"""Mirrors ``sdk/src/types/provider.ts``."""

from __future__ import annotations

from typing import TypedDict


class Provider(TypedDict):
    """A Provider as returned by the API — ``apiKey`` is never included."""

    id: str
    label: str
    baseURL: str
    defaultModel: str
    isDefault: bool  # at most one per Domain — the fallback when an Agent has no providerId
    createdAt: str
    updatedAt: str


class _CreateProviderInputRequired(TypedDict):
    label: str  # human-readable name shown in your own UI, e.g. "OpenAI (prod)"
    baseURL: str  # OpenAI-compatible base URL, e.g. "https://api.openai.com/v1"
    apiKey: str  # plaintext — encrypted at rest, never returned in any response
    defaultModel: (
        str  # model id used when an Agent references this Provider without its own modelName
    )


class CreateProviderInput(_CreateProviderInputRequired, total=False):
    isDefault: bool  # default: False


class UpdateProviderInput(TypedDict, total=False):
    """All fields optional — only what you pass is changed."""

    label: str
    baseURL: str
    apiKey: str  # replaces the stored key entirely; omit to leave the existing key untouched
    defaultModel: str
    isDefault: bool


class ProviderModel(TypedDict):
    id: str


class ProviderTestConnectionResult(TypedDict):
    # False means the endpoint rejected the credentials/URL, not that the request itself failed
    success: bool
    message: str
