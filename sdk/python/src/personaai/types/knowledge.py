"""Mirrors ``sdk/src/types/knowledge.ts``."""

from __future__ import annotations

from typing import BinaryIO, Literal, TypedDict


class KnowledgeDocument(TypedDict):
    """One uploaded source document's chunking summary (not the chunks themselves)."""

    fileName: str
    fileSize: int
    mimeType: str
    chunkCount: int
    uploadedAt: str


class _KnowledgeBaseRequired(TypedDict):
    _id: str
    domain: str
    ownerType: Literal["PersonaUser", "Project", "ExternalUser"]
    name: str
    isPublic: bool
    documentCount: int
    chunkCount: int
    qdrantCollectionName: (
        str  # internal Qdrant collection name backing this KB — informational only
    )
    documents: list[KnowledgeDocument]
    embeddingModel: str
    chunkSize: int  # characters per chunk, used when splitting uploaded documents
    chunkOverlap: int  # character overlap between adjacent chunks
    topK: int  # default chunks returned per search() call when the caller doesn't override top_k
    createdAt: str
    updatedAt: str


class KnowledgeBase(_KnowledgeBaseRequired, total=False):
    """Like ``Skill``/``Agent``, this mirrors the real wire shape (``_id``,
    raw domain/ownerType fields)."""

    ownerId: str
    externalOwnerId: str
    description: str
    providerId: str


class _CreateKnowledgeBaseInputRequired(TypedDict):
    name: str
    # required on the Developer API — unlike the Persona route, there's no
    # "my default provider" concept for a Project or ExternalUser caller
    providerId: str


class CreateKnowledgeBaseInput(_CreateKnowledgeBaseInputRequired, total=False):
    description: str
    isPublic: bool  # default: False
    embeddingModel: str  # default: 'text-embedding-3-small'
    chunkSize: int  # default: 800
    chunkOverlap: int  # default: 100
    topK: int  # default: 5


class UpdateKnowledgeBaseInput(TypedDict, total=False):
    """All fields optional — only what you pass is changed. Does not
    retroactively re-embed existing documents."""

    name: str
    description: str
    isPublic: bool
    embeddingModel: str
    providerId: str
    chunkSize: int
    chunkOverlap: int
    topK: int


class DiscoverKnowledgeBasesParams(TypedDict, total=False):
    page: int  # default: 1
    limit: int  # default: 20
    search: str  # free-text match against name/description
    scope: Literal["mine"]  # restricts to the asserted external user's own KBs (runtime-only)


class _UploadFileInputRequired(TypedDict):
    filename: str
    content: bytes | BinaryIO


class UploadFileInput(_UploadFileInputRequired, total=False):
    contentType: str  # e.g. 'application/pdf'; required when content type can't be inferred


class _UploadedFileSummary(TypedDict):
    fileName: str
    fileSize: int
    mimeType: str
    chunkCount: int


class UploadDocumentsResult(TypedDict):
    documentCount: int  # total for the KB after this upload, not just this call's files
    chunkCount: int  # total for the KB after this upload
    files: list[_UploadedFileSummary]


class DeleteDocumentResult(TypedDict):
    removedChunks: int
    remainingDocuments: int
    remainingChunks: int


class KnowledgeSearchResult(TypedDict):
    text: str
    source: str  # the fileName of the source document this chunk came from
    score: (
        float | None
    )  # similarity score (higher = more relevant); None if the store didn't return one
