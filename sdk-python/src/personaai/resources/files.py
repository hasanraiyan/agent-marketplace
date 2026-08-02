"""Files (``/api/v1/developer/files``) — a file's Subject is a person, so
every call here requires this client to have been constructed with
``external_user_id`` set (mirrors ``Threads``'s requirement exactly).
Ported from ``sdk/src/resources/files.ts``."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

import httpx

from ..types.file import ListFilesParams, PersonaFile, UploadFilePayload

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

    def upload(self, input: UploadFilePayload) -> PersonaFile:
        return cast(
            PersonaFile,
            self._transport.request(
                "POST",
                "/api/v1/developer/files",
                files=_upload_files(input),
                data=_upload_data(input),
            ),
        )

    def list(self, params: ListFilesParams | None = None) -> list[PersonaFile]:
        """Note: returns a bare list — no pagination envelope in its `data` field."""
        return cast(
            list[PersonaFile],
            self._transport.request("GET", "/api/v1/developer/files", query=params),
        )

    def download(self, file_id: str) -> httpx.Response:
        """Returns the raw ``httpx.Response`` (a mediated file stream, never
        JSON) — read ``.content``/``.text``/``.iter_bytes()`` as your
        application needs."""
        return cast(
            httpx.Response, self._transport.request("GET", f"/api/v1/developer/files/{file_id}")
        )

    def delete(self, file_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/files/{file_id}")


class AsyncFiles:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def upload(self, input: UploadFilePayload) -> PersonaFile:
        return cast(
            PersonaFile,
            await self._transport.request(
                "POST",
                "/api/v1/developer/files",
                files=_upload_files(input),
                data=_upload_data(input),
            ),
        )

    async def list(self, params: ListFilesParams | None = None) -> list[PersonaFile]:
        """Note: returns a bare list — no pagination envelope in its `data` field."""
        return cast(
            list[PersonaFile],
            await self._transport.request("GET", "/api/v1/developer/files", query=params),
        )

    async def download(self, file_id: str) -> httpx.Response:
        """Returns the raw ``httpx.Response`` (a mediated file stream, never
        JSON) — read ``.content``/``.text``/``.aiter_bytes()`` as your
        application needs."""
        return cast(
            httpx.Response,
            await self._transport.request("GET", f"/api/v1/developer/files/{file_id}"),
        )

    async def delete(self, file_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/files/{file_id}")
