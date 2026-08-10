"""Memory (``/api/v1/developer/memory``) — a subject's memory files are the
same ``/memories/user/``/``/memories/agent/`` filesystem an Agent's own
``write_file``/``read_file`` tool calls see, exposed over REST.

Every call here requires this client to have been constructed with
``external_user_id`` set — a bare Project credential has no Subject to scope
memory to; the server rejects it with 400 ``EXTERNAL_USER_REQUIRED`` otherwise.
Ported from ``sdk/src/resources/memory.ts``.

Note: this class defines its own method named ``list``, which (combined with
``from __future__ import annotations``) makes bare ``list[X]`` annotations
elsewhere in this file resolve to that method instead of the builtin under
mypy's forward-ref resolution. ``typing.List`` sidesteps the collision — see
the ``per-file-ignores`` entry for this file in ``pyproject.toml``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, cast

from ..types.memory import (
    DeleteMemoryFileParams,
    GetMemoryFileParams,
    MemoryFile,
    MemoryListResult,
    WriteMemoryFileInput,
)

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


class Memory:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def list(self) -> MemoryListResult:
        """Lists every memory file for the asserted external user:
        user-global files plus one group per Agent that has agent-scoped
        memory.

        Returns:
            ``{"userFiles": list[MemoryFile], "agentMemories":
            [{"agentId", "agentName", "files": list[MemoryFile]}, ...]}``.
        """
        return cast(
            MemoryListResult, self._transport.request("GET", "/api/v1/developer/memory")
        )

    def get_file(
        self,
        path: str,
        *,
        scope: str | None = None,
        agent_id: str | None = None,
    ) -> MemoryFile:
        """Reads one memory file.

        Args:
            path: The file's path, e.g. ``/memories/user/index.md``.
            scope: ``'user'`` (default) or ``'agent'``.
            agent_id: Required when ``scope`` is ``'agent'``.
        """
        return cast(
            MemoryFile,
            self._transport.request(
                "GET",
                "/api/v1/developer/memory/file",
                query={"path": path, "scope": scope, "agentId": agent_id},
            ),
        )

    def write_file(
        self,
        path: str,
        content: str,
        *,
        scope: str | None = None,
        agent_id: str | None = None,
    ) -> MemoryFile:
        """Creates or overwrites one memory file.

        Args:
            path: The file's path, e.g. ``/memories/user/preferences.md``.
            content: The file's full content (overwrites any existing content).
            scope: ``'user'`` (default) or ``'agent'``.
            agent_id: Required when ``scope`` is ``'agent'``.
        """
        return cast(
            MemoryFile,
            self._transport.request(
                "PUT",
                "/api/v1/developer/memory/file",
                json={"path": path, "content": content, "scope": scope, "agentId": agent_id},
            ),
        )

    def delete_file(
        self,
        path: str,
        *,
        scope: str | None = None,
        agent_id: str | None = None,
    ) -> None:
        """Deletes one memory file.

        Args:
            path: The file's path.
            scope: ``'user'`` (default) or ``'agent'``.
            agent_id: Required when ``scope`` is ``'agent'``.
        """
        self._transport.request(
            "DELETE",
            "/api/v1/developer/memory/file",
            query={"path": path, "scope": scope, "agentId": agent_id},
        )


class AsyncMemory:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def list(self) -> MemoryListResult:
        """Lists every memory file for the asserted external user:
        user-global files plus one group per Agent that has agent-scoped
        memory.

        Returns:
            ``{"userFiles": list[MemoryFile], "agentMemories":
            [{"agentId", "agentName", "files": list[MemoryFile]}, ...]}``.
        """
        return cast(
            MemoryListResult,
            await self._transport.request("GET", "/api/v1/developer/memory"),
        )

    async def get_file(
        self,
        path: str,
        *,
        scope: str | None = None,
        agent_id: str | None = None,
    ) -> MemoryFile:
        """Reads one memory file.

        Args:
            path: The file's path, e.g. ``/memories/user/index.md``.
            scope: ``'user'`` (default) or ``'agent'``.
            agent_id: Required when ``scope`` is ``'agent'``.
        """
        return cast(
            MemoryFile,
            await self._transport.request(
                "GET",
                "/api/v1/developer/memory/file",
                query={"path": path, "scope": scope, "agentId": agent_id},
            ),
        )

    async def write_file(
        self,
        path: str,
        content: str,
        *,
        scope: str | None = None,
        agent_id: str | None = None,
    ) -> MemoryFile:
        """Creates or overwrites one memory file.

        Args:
            path: The file's path, e.g. ``/memories/user/preferences.md``.
            content: The file's full content (overwrites any existing content).
            scope: ``'user'`` (default) or ``'agent'``.
            agent_id: Required when ``scope`` is ``'agent'``.
        """
        return cast(
            MemoryFile,
            await self._transport.request(
                "PUT",
                "/api/v1/developer/memory/file",
                json={"path": path, "content": content, "scope": scope, "agentId": agent_id},
            ),
        )

    async def delete_file(
        self,
        path: str,
        *,
        scope: str | None = None,
        agent_id: str | None = None,
    ) -> None:
        """Deletes one memory file.

        Args:
            path: The file's path.
            scope: ``'user'`` (default) or ``'agent'``.
            agent_id: Required when ``scope`` is ``'agent'``.
        """
        await self._transport.request(
            "DELETE",
            "/api/v1/developer/memory/file",
            query={"path": path, "scope": scope, "agentId": agent_id},
        )
