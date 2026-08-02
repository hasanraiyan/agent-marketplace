"""Asynchronous entry point for the Persona.ai Developer Platform SDK — the
``asyncio`` mirror of :class:`personaai.client.PersonaClient`.

**Server-side only.** See ``PersonaClient``'s docstring for the same
credential-handling warning.
"""

from __future__ import annotations

from typing import Any

import httpx

from ._async_http import AsyncTransport
from ._base import TransportConfig
from .resources.agents import AsyncAgents
from .resources.knowledge import AsyncKnowledge
from .resources.mcp import AsyncMcps
from .resources.providers import AsyncProviders
from .resources.skills import AsyncSkills
from .types.principal import PrincipalContext


class AsyncPersonaClient:
    def __init__(
        self,
        base_url: str,
        credential: str,
        *,
        external_user_id: str | None = None,
        max_retries: int = 2,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        config = TransportConfig(
            base_url=base_url,
            credential=credential,
            external_user_id=external_user_id,
            max_retries=max_retries,
        )
        self._transport = AsyncTransport(config, http_client)
        self.providers = AsyncProviders(self._transport)
        self.skills = AsyncSkills(self._transport)
        self.agents = AsyncAgents(self._transport)
        self.knowledge = AsyncKnowledge(self._transport)
        self.mcps = AsyncMcps(self._transport)

    async def aclose(self) -> None:
        await self._transport.aclose()

    async def __aenter__(self) -> AsyncPersonaClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    async def whoami(self) -> PrincipalContext:
        """Resolves the principal context for the credential this client was
        constructed with — a side-effect-free way to sanity-check auth wiring."""
        result: Any = await self._transport.request("GET", "/api/v1/developer/whoami")
        return result  # type: ignore[no-any-return]
