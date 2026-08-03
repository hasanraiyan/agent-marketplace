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
from .chat.client import AsyncChatClient
from .resources.agents import AsyncAgents
from .resources.files import AsyncFiles
from .resources.knowledge import AsyncKnowledge
from .resources.mcp import AsyncMcps
from .resources.providers import AsyncProviders
from .resources.skills import AsyncSkills
from .resources.threads import AsyncThreads
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
        """
        Constructing a client is cheap (no connection happens here), so
        it's fine to build a fresh, per-request instance scoped to
        whoever is making the request (e.g. via ``external_user_id``). At
        high request volume, pass your own shared ``http_client`` (one
        ``httpx.AsyncClient`` built once at app startup) so every
        per-request ``AsyncPersonaClient`` reuses the same connection pool
        instead of each opening its own — this client never closes a
        caller-supplied ``http_client`` (not even via ``aclose()``/the
        ``async with`` context manager), so sharing one this way is safe
        even if individual requests use ``async with
        AsyncPersonaClient(...) as persona:``.
        """
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
        self.threads = AsyncThreads(self._transport)
        self.files = AsyncFiles(self._transport)
        self.chat = AsyncChatClient(self._transport)

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
