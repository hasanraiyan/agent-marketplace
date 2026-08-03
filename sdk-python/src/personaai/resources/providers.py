"""Providers (``/api/v1/developer/providers``) — Project-owned. Control-plane
only: no ``ExternalUser`` ownership exists for Providers. Ported from
``sdk/src/resources/providers.ts``.

Note: this class defines its own method named ``list``, which (combined
with ``from __future__ import annotations``) makes bare ``list[X]``
annotations elsewhere in this file resolve to that method instead of the
builtin under mypy's forward-ref resolution. ``typing.List`` sidesteps the
collision — see the ``per-file-ignores`` entry for this file in
``pyproject.toml``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, cast

from ..types.provider import (
    CreateProviderInput,
    Provider,
    ProviderModel,
    ProviderTestConnectionResult,
    UpdateProviderInput,
)
from ..types.usage import ResourceUsage

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

    def list(self) -> List[Provider]:
        """Every Provider in this credential's Domain. No pagination
        envelope, no ``page``/``limit``/``search`` params — Providers have
        no discovery concept, so this is a plain bare-list Domain-scoped
        list, same result whether this client asserts an external user or
        not."""
        return cast(List[Provider], self._transport.request("GET", "/api/v1/developer/providers"))

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

    def get_models(self, provider_id: str) -> List[ProviderModel]:
        return cast(
            List[ProviderModel],
            self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}/models"),
        )

    def get_usage(self, provider_id: str) -> ResourceUsage:
        """Agents referencing this Provider — check before ``delete()`` to avoid a block."""
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}/usage"),
        )


class AsyncProviders:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateProviderInput) -> Provider:
        return cast(
            Provider,
            await self._transport.request("POST", "/api/v1/developer/providers", json=input),
        )

    async def list(self) -> List[Provider]:
        """Every Provider in this credential's Domain. No pagination
        envelope, no ``page``/``limit``/``search`` params — Providers have
        no discovery concept, so this is a plain bare-list Domain-scoped
        list, same result whether this client asserts an external user or
        not."""
        return cast(
            List[Provider], await self._transport.request("GET", "/api/v1/developer/providers")
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

    async def get_models(self, provider_id: str) -> List[ProviderModel]:
        return cast(
            List[ProviderModel],
            await self._transport.request(
                "GET", f"/api/v1/developer/providers/{provider_id}/models"
            ),
        )

    async def get_usage(self, provider_id: str) -> ResourceUsage:
        """Agents referencing this Provider — check before ``delete()`` to avoid a block."""
        return cast(
            ResourceUsage,
            await self._transport.request(
                "GET", f"/api/v1/developer/providers/{provider_id}/usage"
            ),
        )
