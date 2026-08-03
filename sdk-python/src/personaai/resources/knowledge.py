"""Knowledge bases (``/api/v1/developer/knowledge``) — Project-owned, or,
when this client asserts an external user, owned by that end user. Ported
from ``sdk/src/resources/knowledge.ts``.

Note: this class defines its own method named ``list``, which (combined
with ``from __future__ import annotations``) makes bare ``list[X]``
annotations elsewhere in this file resolve to that method instead of the
builtin under mypy's forward-ref resolution. ``typing.List`` sidesteps the
collision — see the ``per-file-ignores`` entry for this file in
``pyproject.toml``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, cast
from urllib.parse import quote

from ..types.bulk_delete import BulkDeleteResult
from ..types.knowledge import (
    CreateKnowledgeBaseInput,
    DeleteDocumentResult,
    DiscoverKnowledgeBasesParams,
    KnowledgeBase,
    KnowledgeDocument,
    KnowledgeSearchResult,
    UpdateKnowledgeBaseInput,
    UploadDocumentsResult,
    UploadFileInput,
)
from ..types.usage import ResourceUsage

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


def _httpx_files(files: List[UploadFileInput]) -> List[tuple[str, Any]]:
    return [("files", (f["filename"], f["content"], f.get("contentType"))) for f in files]


class Knowledge:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, input: CreateKnowledgeBaseInput) -> KnowledgeBase:
        return cast(
            KnowledgeBase,
            self._transport.request("POST", "/api/v1/developer/knowledge", json=input),
        )

    def list(self, params: DiscoverKnowledgeBasesParams | None = None) -> List[KnowledgeBase]:
        """Note: returns a bare list — this endpoint has no pagination envelope."""
        return cast(
            List[KnowledgeBase],
            self._transport.request("GET", "/api/v1/developer/knowledge", query=params),
        )

    def get(self, kb_id: str) -> KnowledgeBase:
        return cast(
            KnowledgeBase, self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}")
        )

    def update(self, kb_id: str, input: UpdateKnowledgeBaseInput) -> KnowledgeBase:
        return cast(
            KnowledgeBase,
            self._transport.request("PATCH", f"/api/v1/developer/knowledge/{kb_id}", json=input),
        )

    def delete(self, kb_id: str) -> None:
        self._transport.request("DELETE", f"/api/v1/developer/knowledge/{kb_id}")

    def get_usage(self, kb_id: str) -> ResourceUsage:
        """Agents referencing this Knowledge base. Note: unlike
        Providers/Skills/MCP, Knowledge base deletion does not currently
        block on in-use Agents — this is informational only."""
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/usage"),
        )

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — up to 100 ids per call; partial failures don't raise."""
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/knowledge/bulk-delete", json={"ids": ids}
            ),
        )

    def upload_documents(self, kb_id: str, files: List[UploadFileInput]) -> UploadDocumentsResult:
        """Up to 10 files, 20MB each; PDF/TXT/MD/JSON/CSV."""
        return cast(
            UploadDocumentsResult,
            self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/documents",
                files=_httpx_files(files),
            ),
        )

    def list_documents(self, kb_id: str) -> List[KnowledgeDocument]:
        return cast(
            List[KnowledgeDocument],
            self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/documents"),
        )

    def delete_document(self, kb_id: str, source_name: str) -> DeleteDocumentResult:
        encoded = quote(source_name, safe="")
        return cast(
            DeleteDocumentResult,
            self._transport.request(
                "DELETE", f"/api/v1/developer/knowledge/{kb_id}/documents/{encoded}"
            ),
        )

    def search(
        self, kb_id: str, query: str, top_k: int | None = None
    ) -> List[KnowledgeSearchResult]:
        return cast(
            List[KnowledgeSearchResult],
            self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/search",
                json={"query": query, "topK": top_k},
            ),
        )


class AsyncKnowledge:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def create(self, input: CreateKnowledgeBaseInput) -> KnowledgeBase:
        return cast(
            KnowledgeBase,
            await self._transport.request("POST", "/api/v1/developer/knowledge", json=input),
        )

    async def list(self, params: DiscoverKnowledgeBasesParams | None = None) -> List[KnowledgeBase]:
        """Note: returns a bare list — this endpoint has no pagination envelope."""
        return cast(
            List[KnowledgeBase],
            await self._transport.request("GET", "/api/v1/developer/knowledge", query=params),
        )

    async def get(self, kb_id: str) -> KnowledgeBase:
        return cast(
            KnowledgeBase,
            await self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}"),
        )

    async def update(self, kb_id: str, input: UpdateKnowledgeBaseInput) -> KnowledgeBase:
        return cast(
            KnowledgeBase,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/knowledge/{kb_id}", json=input
            ),
        )

    async def delete(self, kb_id: str) -> None:
        await self._transport.request("DELETE", f"/api/v1/developer/knowledge/{kb_id}")

    async def get_usage(self, kb_id: str) -> ResourceUsage:
        """Agents referencing this Knowledge base. Note: unlike
        Providers/Skills/MCP, Knowledge base deletion does not currently
        block on in-use Agents — this is informational only."""
        return cast(
            ResourceUsage,
            await self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/usage"),
        )

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — up to 100 ids per call; partial failures don't raise."""
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/knowledge/bulk-delete", json={"ids": ids}
            ),
        )

    async def upload_documents(
        self, kb_id: str, files: List[UploadFileInput]
    ) -> UploadDocumentsResult:
        """Up to 10 files, 20MB each; PDF/TXT/MD/JSON/CSV."""
        return cast(
            UploadDocumentsResult,
            await self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/documents",
                files=_httpx_files(files),
            ),
        )

    async def list_documents(self, kb_id: str) -> List[KnowledgeDocument]:
        return cast(
            List[KnowledgeDocument],
            await self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/documents"),
        )

    async def delete_document(self, kb_id: str, source_name: str) -> DeleteDocumentResult:
        encoded = quote(source_name, safe="")
        return cast(
            DeleteDocumentResult,
            await self._transport.request(
                "DELETE", f"/api/v1/developer/knowledge/{kb_id}/documents/{encoded}"
            ),
        )

    async def search(
        self, kb_id: str, query: str, top_k: int | None = None
    ) -> List[KnowledgeSearchResult]:
        return cast(
            List[KnowledgeSearchResult],
            await self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/search",
                json={"query": query, "topK": top_k},
            ),
        )
