"""Stores (``/api/v1/developer/stores``) — named, scoped mount points you
create and assign to Agents (``Agent.storeMounts``, settable via
``agents.update()``), generalizing the fixed ``/memories/user/``/
``/memories/agent/`` mounts into arbitrarily-named ones.

Config CRUD (``create``/``list``/``get``/``update``/``delete``) works with a
bare Project credential — a Store's config isn't per-founder. File CRUD is the
same, *except* when the Store's own ``scope`` is ``'externalUser'``: only then
does this client need to have been constructed with ``external_user_id`` set,
or the call 400s with ``EXTERNAL_USER_REQUIRED`` (enforced server-side per
request, after loading the store).
Ported from ``sdk/src/resources/stores.ts``.

Note: this class defines its own method named ``list``, which (combined with
``from __future__ import annotations``) makes bare ``list[X]`` annotations
elsewhere in this file resolve to that method instead of the builtin under
mypy's forward-ref resolution. ``typing.List`` sidesteps the collision — see
the ``per-file-ignores`` entry for this file in ``pyproject.toml``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, cast

from ..types.pagination import PaginatedResult
from ..types.store import (
    CreateStoreInput,
    DeleteStoreFileParams,
    DiscoverStoresParams,
    GetStoreFileParams,
    Store,
    StoreFile,
    UpdateStoreInput,
    WriteStoreFileInput,
)

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Stores:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateStoreInput) -> Store:
        """Creates a new named Store.

        Args:
            input: ``name`` (lowercase letters, numbers, hyphens only) and
                ``scope`` are required; ``description``/``accessMode`` (default
                ``'readwrite'``) are optional. ``scope`` cannot be changed
                after creation.
        """
        return cast(
            Store,
            self._transport.request("POST", "/api/v1/developer/stores", json=input),
        )

    def list(self, params: DiscoverStoresParams | None = None) -> PaginatedResult[Store]:
        """Lists this Project's Stores.

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text against ``name``).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[Store],
            self._transport.request("GET", "/api/v1/developer/stores", query=params),
        )

    def get(self, store_id: str) -> Store:
        """Fetches a single Store's config by id.

        Args:
            store_id: The Store's ``_id``.
        """
        return cast(Store, self._transport.request("GET", f"/api/v1/developer/stores/{store_id}"))

    def update(self, store_id: str, input: UpdateStoreInput) -> Store:
        """Updates a Store's ``name``/``description``/``accessMode``.
        ``scope`` is not updatable — create a new Store if you need a
        different one.

        Args:
            store_id: The Store's ``_id``.
        """
        return cast(
            Store,
            self._transport.request("PATCH", f"/api/v1/developer/stores/{store_id}", json=input),
        )

    def delete(self, store_id: str) -> None:
        """Deletes a Store — also removes it from every Agent's ``storeMounts``
        and purges all of its data (every founder's partition, for an
        ``externalUser``-scoped Store).

        Args:
            store_id: The Store's ``_id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/stores/{store_id}")

    def list_files(self, store_id: str) -> List[StoreFile]:
        """Lists files in a Store. For an ``externalUser``-scoped Store, lists
        only this client's asserted external user's own partition.

        Args:
            store_id: The Store's ``_id``.
        """
        result: Any = self._transport.request(
            "GET", f"/api/v1/developer/stores/{store_id}/files"
        )
        return cast(List[StoreFile], result["files"])

    def get_file(self, store_id: str, path: str) -> StoreFile:
        """Reads one file from a Store.

        Args:
            store_id: The Store's ``_id``.
            path: The file's path.
        """
        return cast(
            StoreFile,
            self._transport.request(
                "GET",
                f"/api/v1/developer/stores/{store_id}/file",
                query={"path": path},
            ),
        )

    def write_file(self, store_id: str, path: str, content: str) -> StoreFile:
        """Creates or overwrites one file in a Store. Not gated by the Store's
        ``accessMode`` — ``readonly`` only blocks an Agent's own tool calls;
        this is how a readonly Store's content actually gets populated.

        Args:
            store_id: The Store's ``_id``.
            path: The file's path.
            content: The file's full content (overwrites any existing content).
        """
        return cast(
            StoreFile,
            self._transport.request(
                "PUT",
                f"/api/v1/developer/stores/{store_id}/file",
                json={"path": path, "content": content},
            ),
        )

    def delete_file(self, store_id: str, path: str) -> None:
        """Deletes one file from a Store.

        Args:
            store_id: The Store's ``_id``.
            path: The file's path.
        """
        self._transport.request(
            "DELETE",
            f"/api/v1/developer/stores/{store_id}/file",
            query={"path": path},
        )


class AsyncStores:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateStoreInput) -> Store:
        """Creates a new named Store.

        Args:
            input: ``name`` (lowercase letters, numbers, hyphens only) and
                ``scope`` are required; ``description``/``accessMode`` (default
                ``'readwrite'``) are optional. ``scope`` cannot be changed
                after creation.
        """
        return cast(
            Store,
            await self._transport.request("POST", "/api/v1/developer/stores", json=input),
        )

    async def list(
        self, params: DiscoverStoresParams | None = None
    ) -> PaginatedResult[Store]:
        """Lists this Project's Stores.

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text against ``name``).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[Store],
            await self._transport.request("GET", "/api/v1/developer/stores", query=params),
        )

    async def get(self, store_id: str) -> Store:
        """Fetches a single Store's config by id.

        Args:
            store_id: The Store's ``_id``.
        """
        return cast(
            Store,
            await self._transport.request("GET", f"/api/v1/developer/stores/{store_id}"),
        )

    async def update(self, store_id: str, input: UpdateStoreInput) -> Store:
        """Updates a Store's ``name``/``description``/``accessMode``.
        ``scope`` is not updatable — create a new Store if you need a
        different one.

        Args:
            store_id: The Store's ``_id``.
        """
        return cast(
            Store,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/stores/{store_id}", json=input
            ),
        )

    async def delete(self, store_id: str) -> None:
        """Deletes a Store — also removes it from every Agent's ``storeMounts``
        and purges all of its data (every founder's partition, for an
        ``externalUser``-scoped Store).

        Args:
            store_id: The Store's ``_id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/stores/{store_id}")

    async def list_files(self, store_id: str) -> List[StoreFile]:
        """Lists files in a Store. For an ``externalUser``-scoped Store, lists
        only this client's asserted external user's own partition.

        Args:
            store_id: The Store's ``_id``.
        """
        result: Any = await self._transport.request(
            "GET", f"/api/v1/developer/stores/{store_id}/files"
        )
        return cast(List[StoreFile], result["files"])

    async def get_file(self, store_id: str, path: str) -> StoreFile:
        """Reads one file from a Store.

        Args:
            store_id: The Store's ``_id``.
            path: The file's path.
        """
        return cast(
            StoreFile,
            await self._transport.request(
                "GET",
                f"/api/v1/developer/stores/{store_id}/file",
                query={"path": path},
            ),
        )

    async def write_file(self, store_id: str, path: str, content: str) -> StoreFile:
        """Creates or overwrites one file in a Store. Not gated by the Store's
        ``accessMode`` — ``readonly`` only blocks an Agent's own tool calls;
        this is how a readonly Store's content actually gets populated.

        Args:
            store_id: The Store's ``_id``.
            path: The file's path.
            content: The file's full content (overwrites any existing content).
        """
        return cast(
            StoreFile,
            await self._transport.request(
                "PUT",
                f"/api/v1/developer/stores/{store_id}/file",
                json={"path": path, "content": content},
            ),
        )

    async def delete_file(self, store_id: str, path: str) -> None:
        """Deletes one file from a Store.

        Args:
            store_id: The Store's ``_id``.
            path: The file's path.
        """
        await self._transport.request(
            "DELETE",
            f"/api/v1/developer/stores/{store_id}/file",
            query={"path": path},
        )
