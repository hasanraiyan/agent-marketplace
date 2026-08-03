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
from ..types.pagination import PaginatedResult
from ..types.usage import ResourceUsage

if TYPE_CHECKING:
    from .._async_http import AsyncTransport
    from .._sync_http import SyncTransport


def _httpx_files(files: List[UploadFileInput]) -> List[tuple[str, Any]]:
    return [("files", (f["filename"], f["content"], f.get("contentType"))) for f in files]


class Knowledge:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(
        self, input: CreateKnowledgeBaseInput, idempotency_key: str | None = None
    ) -> KnowledgeBase:
        """Creates a new (empty) Knowledge base. Upload documents afterward
        via ``upload_documents()``.

        Args:
            input: ``name`` and ``providerId`` are required (the Provider
                supplies the embedding model's API key).
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Knowledge Base.

        Returns:
            The created :class:`KnowledgeBase` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            KnowledgeBase,
            self._transport.request(
                "POST", "/api/v1/developer/knowledge", json=input, headers=headers
            ),
        )

    def list(
        self, params: DiscoverKnowledgeBasesParams | None = None
    ) -> PaginatedResult[KnowledgeBase]:
        """Lists/searches Knowledge bases visible to this credential (this
        Project's own, plus any public ones).

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text), ``scope="mine"`` (restricts to the
                asserted external user's own Knowledge Bases — runtime
                context only).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[KnowledgeBase],
            self._transport.request("GET", "/api/v1/developer/knowledge", query=params),
        )

    def get(self, kb_id: str) -> KnowledgeBase:
        """Fetches a single Knowledge base by id.

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        return cast(
            KnowledgeBase, self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}")
        )

    def update(self, kb_id: str, input: UpdateKnowledgeBaseInput) -> KnowledgeBase:
        """Partially updates a Knowledge base — only the fields you pass
        are changed. Note: changing ``providerId``/``embeddingModel``/
        ``chunkSize``/``chunkOverlap`` does not retroactively re-embed
        already-uploaded documents.

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        return cast(
            KnowledgeBase,
            self._transport.request("PATCH", f"/api/v1/developer/knowledge/{kb_id}", json=input),
        )

    def delete(self, kb_id: str) -> None:
        """Deletes a Knowledge base and all its embedded chunks.

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        self._transport.request("DELETE", f"/api/v1/developer/knowledge/{kb_id}")

    def get_usage(self, kb_id: str) -> ResourceUsage:
        """Agents referencing this Knowledge base. Note: unlike
        Providers/Skills/MCP, Knowledge base deletion does not currently
        block on in-use Agents — this is informational only.

        Args:
            kb_id: The Knowledge base's ``_id``.

        Returns:
            ``agentCount`` is the real total; ``agents`` is a preview capped at 20.
        """
        return cast(
            ResourceUsage,
            self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/usage"),
        )

    def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 Knowledge base ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            self._transport.request(
                "POST", "/api/v1/developer/knowledge/bulk-delete", json={"ids": ids}
            ),
        )

    def upload_documents(self, kb_id: str, files: List[UploadFileInput]) -> UploadDocumentsResult:
        """Uploads and chunks/embeds one or more documents into this
        Knowledge base. This call is synchronous — it returns only once
        embedding finishes, so expect it to take longer for larger/more
        files.

        Args:
            kb_id: The Knowledge base's ``_id``.
            files: Up to 10 files per call, 20MB each. Supported types:
                PDF, TXT, MD, JSON, CSV.

        Example:
            >>> result = client.knowledge.upload_documents(kb_id, [
            ...     {"filename": "handbook.pdf", "content": file_bytes,
            ...      "contentType": "application/pdf"},
            ... ])
        """
        return cast(
            UploadDocumentsResult,
            self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/documents",
                files=_httpx_files(files),
            ),
        )

    def list_documents(self, kb_id: str) -> List[KnowledgeDocument]:
        """Lists the distinct source documents currently chunked/embedded
        in this Knowledge base (not the individual chunks themselves).

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        return cast(
            List[KnowledgeDocument],
            self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/documents"),
        )

    def delete_document(self, kb_id: str, source_name: str) -> DeleteDocumentResult:
        """Deletes every chunk that came from one uploaded source document.

        Args:
            kb_id: The Knowledge base's ``_id``.
            source_name: The document's ``fileName`` as returned by ``list_documents()``.
        """
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
        """Runs a similarity search against this Knowledge base's embedded
        chunks — the same retrieval an Agent with this Knowledge base
        attached would use internally.

        Args:
            kb_id: The Knowledge base's ``_id``.
            query: The natural-language search text.
            top_k: Max number of chunks to return. Defaults to the
                Knowledge base's own configured ``topK`` (set at creation,
                default ``5``).
        """
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

    async def create(
        self, input: CreateKnowledgeBaseInput, idempotency_key: str | None = None
    ) -> KnowledgeBase:
        """Creates a new (empty) Knowledge base. Upload documents afterward
        via ``upload_documents()``.

        Args:
            input: ``name`` and ``providerId`` are required (the Provider
                supplies the embedding model's API key).
            idempotency_key: Sent as the ``Idempotency-Key`` header — a
                safe retry with the same key replays the original response
                instead of creating a duplicate Knowledge Base.

        Returns:
            The created :class:`KnowledgeBase` (raw Mongo shape — ``_id``, not ``id``).
        """
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return cast(
            KnowledgeBase,
            await self._transport.request(
                "POST", "/api/v1/developer/knowledge", json=input, headers=headers
            ),
        )

    async def list(
        self, params: DiscoverKnowledgeBasesParams | None = None
    ) -> PaginatedResult[KnowledgeBase]:
        """Lists/searches Knowledge bases visible to this credential (this
        Project's own, plus any public ones).

        Args:
            params: ``page`` (default ``1``), ``limit`` (default ``20``),
                ``search`` (free-text), ``scope="mine"`` (restricts to the
                asserted external user's own Knowledge Bases — runtime
                context only).

        Returns:
            ``{"items", "pagination": {"total", "page", "limit", "pages"}}``.
        """
        return cast(
            PaginatedResult[KnowledgeBase],
            await self._transport.request("GET", "/api/v1/developer/knowledge", query=params),
        )

    async def get(self, kb_id: str) -> KnowledgeBase:
        """Fetches a single Knowledge base by id.

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        return cast(
            KnowledgeBase,
            await self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}"),
        )

    async def update(self, kb_id: str, input: UpdateKnowledgeBaseInput) -> KnowledgeBase:
        """Partially updates a Knowledge base — only the fields you pass
        are changed. Note: changing ``providerId``/``embeddingModel``/
        ``chunkSize``/``chunkOverlap`` does not retroactively re-embed
        already-uploaded documents.

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        return cast(
            KnowledgeBase,
            await self._transport.request(
                "PATCH", f"/api/v1/developer/knowledge/{kb_id}", json=input
            ),
        )

    async def delete(self, kb_id: str) -> None:
        """Deletes a Knowledge base and all its embedded chunks.

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        await self._transport.request("DELETE", f"/api/v1/developer/knowledge/{kb_id}")

    async def get_usage(self, kb_id: str) -> ResourceUsage:
        """Agents referencing this Knowledge base. Note: unlike
        Providers/Skills/MCP, Knowledge base deletion does not currently
        block on in-use Agents — this is informational only.

        Args:
            kb_id: The Knowledge base's ``_id``.

        Returns:
            ``agentCount`` is the real total; ``agents`` is a preview capped at 20.
        """
        return cast(
            ResourceUsage,
            await self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/usage"),
        )

    async def bulk_delete(self, ids: List[str]) -> BulkDeleteResult:
        """Best-effort batch delete — partial failures don't raise or abort
        the rest of the batch.

        Args:
            ids: Up to 100 Knowledge base ids per call.

        Returns:
            ``{"deleted", "failed"}`` — check ``failed`` for per-id reasons.
        """
        return cast(
            BulkDeleteResult,
            await self._transport.request(
                "POST", "/api/v1/developer/knowledge/bulk-delete", json={"ids": ids}
            ),
        )

    async def upload_documents(
        self, kb_id: str, files: List[UploadFileInput]
    ) -> UploadDocumentsResult:
        """Uploads and chunks/embeds one or more documents into this
        Knowledge base. This call is synchronous — it returns only once
        embedding finishes, so expect it to take longer for larger/more
        files.

        Args:
            kb_id: The Knowledge base's ``_id``.
            files: Up to 10 files per call, 20MB each. Supported types:
                PDF, TXT, MD, JSON, CSV.
        """
        return cast(
            UploadDocumentsResult,
            await self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/documents",
                files=_httpx_files(files),
            ),
        )

    async def list_documents(self, kb_id: str) -> List[KnowledgeDocument]:
        """Lists the distinct source documents currently chunked/embedded
        in this Knowledge base (not the individual chunks themselves).

        Args:
            kb_id: The Knowledge base's ``_id``.
        """
        return cast(
            List[KnowledgeDocument],
            await self._transport.request("GET", f"/api/v1/developer/knowledge/{kb_id}/documents"),
        )

    async def delete_document(self, kb_id: str, source_name: str) -> DeleteDocumentResult:
        """Deletes every chunk that came from one uploaded source document.

        Args:
            kb_id: The Knowledge base's ``_id``.
            source_name: The document's ``fileName`` as returned by ``list_documents()``.
        """
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
        """Runs a similarity search against this Knowledge base's embedded
        chunks — the same retrieval an Agent with this Knowledge base
        attached would use internally.

        Args:
            kb_id: The Knowledge base's ``_id``.
            query: The natural-language search text.
            top_k: Max number of chunks to return. Defaults to the
                Knowledge base's own configured ``topK`` (set at creation,
                default ``5``).
        """
        return cast(
            List[KnowledgeSearchResult],
            await self._transport.request(
                "POST",
                f"/api/v1/developer/knowledge/{kb_id}/search",
                json={"query": query, "topK": top_k},
            ),
        )
