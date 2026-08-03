"""Files (``/api/v1/developer/files``) — a file's Subject is a person, so
every call here requires this client to have been constructed with
``external_user_id`` set (mirrors ``Threads``'s requirement exactly).
Ported from ``sdk/src/resources/files.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, cast

import httpx

from ..types.bulk_delete import BulkDeleteResult
from ..types.file import ListFilesParams, PersonaFile, UploadFilePayload
from ..types.pagination import PaginatedResult

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


def _upload_files(input: UploadFilePayload) -> list[tuple[str, Any]]:
    return [("file", (input["filename"], input["content"], input.get("contentType")))]


def _upload_data(input: UploadFilePayload) -> dict[str, str]:
    data: dict[str, str] = {}
    if input.get("agentId"):
        data["agentId"] = input["agentId"]
    if input.get("threadId"):
        data["threadId"] = input["threadId"]
    return data


class Files:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def upload(self, input: UploadFilePayload, idempotency_key: str | None = None) -> PersonaFile:
        """Uploads a file on behalf of the asserted external user,
        optionally associated with an Agent/Thread.

        Args:
            input: ``filename`` + ``content`` are required; ``contentType``,
                ``agentId``, ``threadId`` are optional context.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of uploading a duplicate file.

        Returns:
            The created :class:`PersonaFile`.

        Example:
            >>> file = client.files.upload({
            ...     "filename": "report.pdf",
            ...     "content": data,
            ...     "contentType": "application/pdf",
            ... })
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            PersonaFile,
            self._transport.request(
                "POST",
                "/api/v1/developer/files",
                files=_upload_files(input),
                data=_upload_data(input),
                headers=headers,
            ),
        )

    def list(self, params: ListFilesParams | None = None) -> PaginatedResult[PersonaFile]:
        """Lists the asserted external user's own uploaded files.

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[PersonaFile],
            self._transport.request("GET", "/api/v1/developer/files", query=params),
        )

    def download(self, file_id: str) -> httpx.Response:
        """Downloads a file's raw bytes.

        Args:
            file_id: The file's ``id``.

        Returns:
            The raw ``httpx.Response`` (a mediated file stream, never
            JSON) — read ``.content``/``.text``/``.iter_bytes()`` as your
            application needs.
        """
        return cast(
            httpx.Response, self._transport.request("GET", f"/api/v1/developer/files/{file_id}")
        )

    def delete(self, file_id: str) -> None:
        """Deletes a file.

        Args:
            file_id: The file's ``id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/files/{file_id}")

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 file ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/files/bulk-delete", json={"ids": ids}
            ),
        )


class AsyncFiles:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def upload(
        self, input: UploadFilePayload, idempotency_key: str | None = None
    ) -> PersonaFile:
        """Uploads a file on behalf of the asserted external user,
        optionally associated with an Agent/Thread.

        Args:
            input: ``filename`` + ``content`` are required; ``contentType``,
                ``agentId``, ``threadId`` are optional context.
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of uploading a duplicate file.

        Returns:
            The created :class:`PersonaFile`.
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            PersonaFile,
            await self._transport.request(
                "POST",
                "/api/v1/developer/files",
                files=_upload_files(input),
                data=_upload_data(input),
                headers=headers,
            ),
        )

    async def list(self, params: ListFilesParams | None = None) -> PaginatedResult[PersonaFile]:
        """Lists the asserted external user's own uploaded files.

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[PersonaFile],
            await self._transport.request("GET", "/api/v1/developer/files", query=params),
        )

    async def download(self, file_id: str) -> httpx.Response:
        """Downloads a file's raw bytes.

        Args:
            file_id: The file's ``id``.

        Returns:
            The raw ``httpx.Response`` (a mediated file stream, never
            JSON) — read ``.content``/``.text``/``.aiter_bytes()`` as your
            application needs.
        """
        return cast(
            httpx.Response,
            await self._transport.request("GET", f"/api/v1/developer/files/{file_id}"),
        )

    async def delete(self, file_id: str) -> None:
        """Deletes a file.

        Args:
            file_id: The file's ``id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/files/{file_id}")

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 file ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/files/bulk-delete", json={"ids": ids}
            ),
        )
