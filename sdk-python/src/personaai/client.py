"""Synchronous entry point for the Persona.ai Developer Platform SDK.

**Server-side only.** The credential this client holds is a server-side
secret (see the Integration Guide) — never construct this in a Jupyter
notebook you intend to share, a serverless function that logs its
environment, or any other context an untrusted party can read.
"""

from __future__ import annotations

from typing import Any

import httpx

from ._base import TransportConfig
from ._sync_http import SyncTransport
from .chat.client import ChatClient
from .resources.agents import Agents
from .resources.audit_logs import AuditLogs
from .resources.files import Files
from .resources.knowledge import Knowledge
from .resources.mcp import Mcps
from .resources.providers import Providers
from .resources.skills import Skills
from .resources.threads import Threads
from .types.principal import PrincipalContext


class PersonaClient:
    def __init__(
        self,
        base_url: str,
        credential: str,
        *,
        external_user_id: str | None = None,
        max_retries: int = 2,
        http_client: httpx.Client | None = None,
    ) -> None:
        """
        Constructing a client is cheap (no connection happens here), so it's
        fine to build a fresh, per-request instance scoped to whoever is
        making the request (e.g. via ``external_user_id``). At high request
        volume, pass your own shared ``http_client`` (one ``httpx.Client``
        built once at app startup) so every per-request ``PersonaClient``
        reuses the same connection pool instead of each opening its own —
        this client never closes a caller-supplied ``http_client`` (not
        even via ``close()``/the ``with`` context manager), so sharing one
        this way is safe even if individual requests use ``with
        PersonaClient(...) as persona:``.

        Args:
            base_url: Base URL of the Persona Developer Platform API, e.g.
                ``"https://api.persona.hasanraiyan.me"``.
            credential: Project credential, shaped ``"<keyId>.<secret>"`` —
                never expose this to a browser/frontend.
            external_user_id: Asserts this client acts on behalf of one of
                your own end users (sent as ``x-persona-external-user-id``).
                Omit for Project-level (control-plane) calls only.
            max_retries: Maximum number of retries on 429 responses. Defaults to ``2``.
            http_client: An existing ``httpx.Client`` to reuse (see above);
                a new one is created if omitted.

        Example:
            >>> client = PersonaClient(
            ...     "https://api.persona.hasanraiyan.me",
            ...     credential=os.environ["PERSONA_CREDENTIAL"],
            ... )
        """
        config = TransportConfig(
            base_url=base_url,
            credential=credential,
            external_user_id=external_user_id,
            max_retries=max_retries,
        )
        self._transport = SyncTransport(config, http_client)
        self.providers = Providers(self._transport)
        self.skills = Skills(self._transport)
        self.agents = Agents(self._transport)
        self.knowledge = Knowledge(self._transport)
        self.mcps = Mcps(self._transport)
        self.threads = Threads(self._transport)
        self.files = Files(self._transport)
        self.audit_logs = AuditLogs(self._transport)
        self.chat = ChatClient(self._transport)

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> PersonaClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def whoami(self) -> PrincipalContext:
        """Resolves the principal context for the credential this client was
        constructed with — a side-effect-free way to sanity-check auth wiring."""
        result: Any = self._transport.request("GET", "/api/v1/developer/whoami")
        return result  # type: ignore[no-any-return]
