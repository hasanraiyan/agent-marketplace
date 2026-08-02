"""Mirrors ``sdk/src/types/provider.ts``."""

from __future__ import annotations

from typing import TypedDict


class Provider(TypedDict):
    id: str
    label: str
    baseURL: str
    defaultModel: str
    isDefault: bool
    createdAt: str
    updatedAt: str


class _CreateProviderInputRequired(TypedDict):
    label: str
    baseURL: str
    apiKey: str  # plaintext — encrypted at rest, never returned in any response
    defaultModel: str


class CreateProviderInput(_CreateProviderInputRequired, total=False):
    isDefault: bool


class UpdateProviderInput(TypedDict, total=False):
    label: str
    baseURL: str
    apiKey: str
    defaultModel: str
    isDefault: bool


class ProviderModel(TypedDict):
    id: str


class ProviderTestConnectionResult(TypedDict):
    success: bool
    message: str
