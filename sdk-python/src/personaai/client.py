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
from .resources.agents import Agents
from .resources.knowledge import Knowledge
from .resources.providers import Providers
from .resources.skills import Skills
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
