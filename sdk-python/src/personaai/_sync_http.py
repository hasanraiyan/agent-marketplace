"""Synchronous HTTP transport: a thin ``httpx.Client`` wrapper that injects
auth headers, serializes the JSON body, decodes the ``{success, data}``
envelope, and retries 429s using the API's own ``Retry-After`` header.
Ported from ``sdk/src/http.ts``'s ``HttpClient``."""

from __future__ import annotations

import time
from collections.abc import Iterator, Mapping
from typing import Any

import httpx

from ._base import (
    TransportConfig,
    build_headers,
    build_url,
    decode_json_envelope,
    raise_for_non_json_error,
)


class SyncTransport:
    def __init__(self, config: TransportConfig, client: httpx.Client | None = None) -> None:
        self._config = config
        self._client = client or httpx.Client()

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> SyncTransport:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def request(
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
            response = self._client.request(
                method, url, json=json, files=files, data=data, headers=request_headers
            )

            if response.status_code == 429 and attempt < self._config.max_retries:
                retry_after = response.headers.get("Retry-After")
                wait_seconds = float(retry_after) if retry_after else 1.0
                time.sleep(max(0.0, wait_seconds))
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

    def stream_lines(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        headers: Mapping[str, str] | None = None,
    ) -> Iterator[str]:
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
            with self._client.stream(method, url, json=json, headers=request_headers) as response:
                if response.status_code == 429 and attempt < self._config.max_retries:
                    response.read()
                    retry_after = response.headers.get("Retry-After")
                    wait_seconds = float(retry_after) if retry_after else 1.0
                    time.sleep(max(0.0, wait_seconds))
                    attempt += 1
                    continue

                content_type = response.headers.get("content-type", "")
                if "text/event-stream" not in content_type:
                    response.read()
                    if "application/json" in content_type:
                        json_body = response.json() if response.content else None
                        decode_json_envelope(response.status_code, json_body)
                        return
                    raise_for_non_json_error(response.status_code)
                    return

                yield from response.iter_text()
                return
