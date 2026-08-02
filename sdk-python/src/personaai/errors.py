"""Typed errors for the Developer Platform API. Mirrors the backend's own
error envelope (``errorFormatter.js``): ``{success:false, status, statusCode,
message, code, timestamp}``. Ported from ``sdk/src/errors.ts``."""

from __future__ import annotations

from typing import Any


class PersonaApiError(Exception):
    """Base error for any non-2xx or ``{success:false}`` response."""

    def __init__(self, message: str, status_code: int, code: str, response: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.response = response

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}(message={self.message!r}, "
            f"status_code={self.status_code!r}, code={self.code!r})"
        )


class PersonaAuthError(PersonaApiError):
    """401/403 — invalid/missing credential, or the Project isn't ACTIVE."""


class PersonaValidationError(PersonaApiError):
    """400 — request validation failed."""


def error_from_response(status_code: int, body: dict[str, Any] | None) -> PersonaApiError:
    message = (body or {}).get("message") or f"Request failed with status {status_code}"
    code = (body or {}).get("code") or "UNKNOWN_ERROR"

    if status_code in (401, 403):
        return PersonaAuthError(message, status_code, code, body)
    if status_code == 400:
        return PersonaValidationError(message, status_code, code, body)
    return PersonaApiError(message, status_code, code, body)
