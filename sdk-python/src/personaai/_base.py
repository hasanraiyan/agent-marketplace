"""Pure, I/O-free logic shared by the sync and async HTTP transports: config
validation, URL building, header building, and envelope decoding. Ported
from ``sdk/src/http.ts``'s ``buildUrl``/``buildHeaders``/``parseResponse``,
kept dependency- and I/O-free so both transports can share it verbatim."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

from .errors import PersonaApiError, error_from_response


@dataclass(frozen=True)
class TransportConfig:
    """Options shared by ``SyncTransport`` and ``AsyncTransport``."""

    base_url: str
    credential: str
    external_user_id: str | None = None
    max_retries: int = 2

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError('TransportConfig: "base_url" is required')
        if not self.credential:
            raise ValueError('TransportConfig: "credential" is required')
        object.__setattr__(self, "base_url", self.base_url.rstrip("/"))


def build_url(base_url: str, path: str, query: Mapping[str, Any] | None = None) -> str:
    url = base_url + path
    if query:
        params = {k: v for k, v in query.items() if v is not None}
        if params:
            url = f"{url}?{urlencode(params)}"
    return url


def build_headers(
    config: TransportConfig,
    headers: Mapping[str, str] | None,
    has_json_body: bool,
) -> dict[str, str]:
    result: dict[str, str] = {
        "Authorization": f"Bearer {config.credential}",
        "Accept": "application/json",
    }
    if headers:
        result.update(headers)
    if config.external_user_id:
        result["x-persona-external-user-id"] = config.external_user_id
    if has_json_body:
        result["Content-Type"] = "application/json"
    return result


def is_success_status(status_code: int) -> bool:
    return 200 <= status_code < 300


def decode_json_envelope(status_code: int, json_body: Any) -> Any:
    """Apply the ``{success, data}`` / ``{success:false, message, code}``
    envelope contract to an already-parsed JSON body, raising a typed
    ``PersonaApiError`` on failure. Ported from ``http.ts``'s
    ``parseResponse``."""
    success_false = isinstance(json_body, dict) and json_body.get("success") is False
    if not is_success_status(status_code) or success_false:
        raise error_from_response(status_code, json_body if isinstance(json_body, dict) else None)

    if isinstance(json_body, dict) and "data" in json_body:
        return json_body["data"]
    # `/whoami` and similar endpoints that omit the fuller envelope shape.
    return json_body


def raise_for_non_json_error(status_code: int) -> None:
    """Non-JSON body + failure status -> a generic ``PersonaApiError``
    (mirrors ``http.ts``'s ``NON_JSON_ERROR_RESPONSE`` branch). Non-JSON +
    success is left to the caller (binary/stream responses, e.g. file
    downloads, which return the raw transport response instead)."""
    if not is_success_status(status_code):
        raise PersonaApiError(
            f"Request failed with status {status_code}",
            status_code,
            "NON_JSON_ERROR_RESPONSE",
        )
