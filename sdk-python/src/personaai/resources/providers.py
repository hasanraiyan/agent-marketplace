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

from ..types.bulk_delete import BulkDeleteResult
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

    def create(self, input: CreateProviderInput, idempotency_key: str | None = None) -> Provider:
        """Creates a new Provider (an OpenAI-compatible endpoint + API key)
        that Agents in this Project can reference.

        Args:
            input: ``label``, ``baseURL``, ``apiKey``, ``defaultModel`` are
                required; ``isDefault`` is optional (defaults to ``False``
                server-side).
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Provider.

        Returns:
            The created :class:`Provider`.

        Example:
            >>> provider = client.providers.create({
            ...     "label": "OpenAI (prod)",
            ...     "baseURL": "https://api.openai.com/v1",
            ...     "apiKey": os.environ["OPENAI_API_KEY"],
            ...     "defaultModel": "gpt-4o-mini",
            ... })
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Provider,
            self._transport.request(
                "POST", "/api/v1/developer/providers", json=input, headers=headers
            ),
        )

    def list(self) -> List[Provider]:
        """Every Provider in this credential's Domain. No pagination
        envelope, no ``page``/``limit``/``search`` params — Providers have
        no discovery concept, so this is a plain bare-list Domain-scoped
        list, same result whether this client asserts an external user or
        not.

        Returns:
            A plain ``list[Provider]`` (not a ``PaginatedResult``, unlike
            every other resource's ``list()``).
        """
        return cast(List[Provider], self._transport.request("GET", "/api/v1/developer/providers"))

    def get(self, provider_id: str) -> Provider:
        """Fetches a single Provider by id.

        Args:
            provider_id: The Provider's ``id``.
        """
        return cast(
            Provider, self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}")
        )

    def update(self, provider_id: str, input: UpdateProviderInput) -> Provider:
        """Partially updates a Provider — only the fields you pass are changed.

        Args:
            provider_id: The Provider's ``id``.
            input: Any subset of ``label``/``baseURL``/``apiKey``/``defaultModel``/``isDefault``.
        """
        return cast(
            Provider,
            self._transport.request(
                "PATCH", f"/api/v1/developer/providers/{provider_id}", json=input
            ),
        )

    def delete(self, provider_id: str) -> None:
        """Deletes a Provider. Raises ``PersonaApiError`` if any Agent still
        references it — call ``get_usage()`` first to check.

        Args:
            provider_id: The Provider's ``id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/providers/{provider_id}")

    def test_connection(self, provider_id: str) -> ProviderTestConnectionResult:
        """Verifies this Provider's ``baseURL``/``apiKey`` actually work by
        making a live call to the underlying endpoint.

        Args:
            provider_id: The Provider's ``id``.

        Returns:
            ``{"success", "message"}`` — ``success: False`` means the call
            reached the endpoint but it rejected the credentials/URL, not
            that this call itself failed.
        """
        return cast(
            ProviderTestConnectionResult,
            self._transport.request(
                "POST", f"/api/v1/developer/providers/{provider_id}/test-connection"
            ),
        )

    def get_models(self, provider_id: str) -> List[ProviderModel]:
        """Lists the models this Provider's endpoint reports as available
        (e.g. for populating a model-picker in your own UI).

        Args:
            provider_id: The Provider's ``id``.
        """
        return cast(
            List[ProviderModel],
            self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}/models"),
        )

    def get_usage(self, provider_id: str) -> ResourceUsage:
        """Agents referencing this Provider — check before ``delete()`` to avoid a block.

        Args:
            provider_id: The Provider's ``id``.

        Returns:
            ``agentCount`` is the real total; ``agents`` is a preview capped at 20.
        """
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}/usage"),
        )

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures (e.g. a Provider
        still referenced by an Agent) don't raise or abort the rest of the
        batch.

        Args:
            ids: Up to 100 Provider ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/providers/bulk-delete", json={"ids": ids}
            ),
        )


class AsyncProviders:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(
        self, input: CreateProviderInput, idempotency_key: str | None = None
    ) -> Provider:
        """Creates a new Provider (an OpenAI-compatible endpoint + API key)
        that Agents in this Project can reference.

        Args:
            input: ``label``, ``baseURL``, ``apiKey``, ``defaultModel`` are
                required; ``isDefault`` is optional (defaults to ``False``
                server-side).
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Provider.

        Returns:
            The created :class:`Provider`.
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            Provider,
            await self._transport.request(
                "POST", "/api/v1/developer/providers", json=input, headers=headers
            ),
        )

    async def list(self) -> List[Provider]:
        """Every Provider in this credential's Domain. No pagination
        envelope, no ``page``/``limit``/``search`` params — Providers have
        no discovery concept, so this is a plain bare-list Domain-scoped
        list, same result whether this client asserts an external user or
        not.

        Returns:
            A plain ``list[Provider]`` (not a ``PaginatedResult``, unlike
            every other resource's ``list()``).
        """
        return cast(
            List[Provider], await self._transport.request("GET", "/api/v1/developer/providers")
        )

    async def get(self, provider_id: str) -> Provider:
        """Fetches a single Provider by id.

        Args:
            provider_id: The Provider's ``id``.
        """
        return cast(
            Provider,
            await self._transport.request("GET", f"/api/v1/developer/providers/{provider_id}"),
        )

    async def update(self, provider_id: str, input: UpdateProviderInput) -> Provider:
        """Partially updates a Provider — only the fields you pass are changed.

        Args:
            provider_id: The Provider's ``id``.
            input: Any subset of ``label``/``baseURL``/``apiKey``/``defaultModel``/``isDefault``.
        """
        return cast(
            Provider,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/providers/{provider_id}", json=input
            ),
        )

    async def delete(self, provider_id: str) -> None:
        """Deletes a Provider. Raises ``PersonaApiError`` if any Agent still
        references it — call ``get_usage()`` first to check.

        Args:
            provider_id: The Provider's ``id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/providers/{provider_id}")

    async def test_connection(self, provider_id: str) -> ProviderTestConnectionResult:
        """Verifies this Provider's ``baseURL``/``apiKey`` actually work by
        making a live call to the underlying endpoint.

        Args:
            provider_id: The Provider's ``id``.

        Returns:
            ``{"success", "message"}`` — ``success: False`` means the call
            reached the endpoint but it rejected the credentials/URL, not
            that this call itself failed.
        """
        return cast(
            ProviderTestConnectionResult,
            await self._transport.request(
                "POST", f"/api/v1/developer/providers/{provider_id}/test-connection"
            ),
        )

    async def get_models(self, provider_id: str) -> List[ProviderModel]:
        """Lists the models this Provider's endpoint reports as available
        (e.g. for populating a model-picker in your own UI).

        Args:
            provider_id: The Provider's ``id``.
        """
        return cast(
            List[ProviderModel],
            await self._transport.request(
                "GET", f"/api/v1/developer/providers/{provider_id}/models"
            ),
        )

    async def get_usage(self, provider_id: str) -> ResourceUsage:
        """Agents referencing this Provider — check before ``delete()`` to avoid a block.

        Args:
            provider_id: The Provider's ``id``.

        Returns:
            ``agentCount`` is the real total; ``agents`` is a preview capped at 20.
        """
        return cast(
            ResourceUsage,
            await self._transport.request(
                "GET", f"/api/v1/developer/providers/{provider_id}/usage"
            ),
        )

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures (e.g. a Provider
        still referenced by an Agent) don't raise or abort the rest of the
        batch.

        Args:
            ids: Up to 100 Provider ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/providers/bulk-delete", json={"ids": ids}
            ),
        )
