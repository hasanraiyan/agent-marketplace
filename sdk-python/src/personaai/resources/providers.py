"""Providers (``/api/v1/developer/providers``) — Project-owned. Control-plane
only: no ``ExternalUser`` ownership exists for Providers, and there's no
list/discover endpoint (the API surface has none; this client mirrors it
1:1). Ported from ``sdk/src/resources/providers.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..types.provider import (
    CreateProviderInput,
    Provider,
    ProviderModel,
    ProviderTestConnectionResult,
    UpdateProviderInput,
)

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Providers:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateProviderInput) -> Provider:
        return cast(
            Provider, self._transport.request("POST", "/api/v1/developer/providers", json=input)
        )

    def get(self, provider_id: str) -> Provider:
        return cast(
            Provider, self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}")
        )

    def update(self, provider_id: str, input: UpdateProviderInput) -> Provider:
        return cast(
            Provider,
            self._transport.request(
                "PATCH", f"/api/v1/developer/providers/{provider_id}", json=input
            ),
        )

    def delete(self, provider_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/providers/{provider_id}")

    def test_connection(self, provider_id: str) -> ProviderTestConnectionResult:
        return cast(
            ProviderTestConnectionResult,
            self._transport.request(
                "POST", f"/api/v1/developer/providers/{provider_id}/test-connection"
            ),
        )

    def get_models(self, provider_id: str) -> list[ProviderModel]:
        return cast(
            list[ProviderModel],
            self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}/models"),
        )


class AsyncProviders:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateProviderInput) -> Provider:
        return cast(
            Provider,
            await self._transport.request("POST", "/api/v1/developer/providers", json=input),
        )

    async def get(self, provider_id: str) -> Provider:
        return cast(
            Provider,
            await self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}"),
        )

    async def update(self, provider_id: str, input: UpdateProviderInput) -> Provider:
        return cast(
            Provider,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/providers/{provider_id}", json=input
            ),
        )

    async def delete(self, provider_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/providers/{provider_id}")

    async def test_connection(self, provider_id: str) -> ProviderTestConnectionResult:
        return cast(
            ProviderTestConnectionResult,
            await self._transport.request(
                "POST", f"/api/v1/developer/providers/{provider_id}/test-connection"
            ),
        )

    async def get_models(self, provider_id: str) -> list[ProviderModel]:
        return cast(
            list[ProviderModel],
            await self._transport.request(
                "GET", f"/api/v1/developer/providers/{provider_id}/models"
            ),
        )
