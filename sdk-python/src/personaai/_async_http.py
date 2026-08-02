"""Asynchronous HTTP transport — the ``asyncio``/``httpx.AsyncClient`` mirror
of ``_sync_http.SyncTransport``. Same auth/envelope/retry contract, ported
from ``sdk/src/http.ts``'s ``HttpClient``."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

import httpx

from ._base import (
    TransportConfig,
    build_headers,
    build_url,
    decode_json_envelope,
    raise_for_non_json_error,
)


class AsyncTransport:
    def __init__(self, config: TransportConfig, client: httpx.AsyncClient | None = None) -> None:
        self._config = config
        self._client = client or httpx.AsyncClient()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncTransport:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json: Any = None,
        files: Any = None,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        url = build_url(self._config.base_url, path, query)
        # `files` implies multipart — httpx sets its own Content-Type (with
        # boundary) for that, so only force `application/json` for `json`.
        request_headers = build_headers(self._config, headers, json is not None)

        attempt = 0
        while True:
            response = await self._client.request(
                method, url, json=json, files=files, headers=request_headers
            )

            if response.status_code == 429 and attempt < self._config.max_retries:
                retry_after = response.headers.get("Retry-After")
                wait_seconds = float(retry_after) if retry_after else 1.0
                await asyncio.sleep(max(0.0, wait_seconds))
                attempt += 1
                continue

            return self._parse_response(response)

    def _parse_response(self, response: httpx.Response) -> Any:
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            raise_for_non_json_error(response.status_code)
            # binary/stream responses (e.g. file downloads) — caller handles the raw response
            return response

        json_body = response.json() if response.content else None
        return decode_json_envelope(response.status_code, json_body)
