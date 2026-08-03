"""Asynchronous HTTP transport — the ``asyncio``/``httpx.AsyncClient`` mirror
of ``_sync_http.SyncTransport``. Same auth/envelope/retry contract, ported
from ``sdk/src/http.ts``'s ``HttpClient``."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Mapping
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
        # Whether this transport created its own httpx.AsyncClient (and so
        # must close it) vs. received one from the caller (who owns its
        # lifecycle — typically a single httpx.AsyncClient shared across
        # many AsyncPersonaClient instances for connection-pool reuse; see
        # `http_client=` in AsyncPersonaClient's docstring).
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient()

    async def aclose(self) -> None:
        """Closes the underlying httpx.AsyncClient — but only if this
        transport created it itself. A caller-supplied client
        (`http_client=`) is never closed here, since the caller may still
        be using it for other AsyncPersonaClient instances."""
        if self._owns_client:
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
        data: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        url = build_url(self._config.base_url, path, query)
        # `files`/`data` implies multipart — httpx sets its own Content-Type
        # (with boundary) for that, so only force `application/json` for `json`.
        request_headers = build_headers(self._config, headers, json is not None)

        attempt = 0
        while True:
            response = await self._client.request(
                method, url, json=json, files=files, data=data, headers=request_headers
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

    async def stream_lines(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        headers: Mapping[str, str] | None = None,
    ) -> AsyncIterator[str]:
        """Issues a streaming request (for SSE) and yields decoded text
        chunks as they arrive off the wire. Retries 429s exactly like
        ``request()``; raises the same typed errors if the server responds
        with a normal JSON error envelope instead of starting the event
        stream. Bypasses ``request()``'s buffering — the caller does its
        own SSE framing."""
        url = build_url(self._config.base_url, path, None)
        request_headers = build_headers(self._config, headers, json is not None)

        attempt = 0
        while True:
            async with self._client.stream(
                method, url, json=json, headers=request_headers
            ) as response:
                if response.status_code == 429 and attempt < self._config.max_retries:
                    await response.aread()
                    retry_after = response.headers.get("Retry-After")
                    wait_seconds = float(retry_after) if retry_after else 1.0
                    await asyncio.sleep(max(0.0, wait_seconds))
                    attempt += 1
                    continue

                content_type = response.headers.get("content-type", "")
                if "text/event-stream" not in content_type:
                    await response.aread()
                    if "application/json" in content_type:
                        json_body = response.json() if response.content else None
                        decode_json_envelope(response.status_code, json_body)
                        return
                    raise_for_non_json_error(response.status_code)
                    return

                async for chunk in response.aiter_text():
                    yield chunk
                return
