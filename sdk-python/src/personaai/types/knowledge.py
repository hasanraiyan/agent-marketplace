"""Mirrors ``sdk/src/types/knowledge.ts``."""

from __future__ import annotations

from typing import BinaryIO, Literal, TypedDict


class KnowledgeDocument(TypedDict):
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
    qdrantCollectionName: str
    documents: list[KnowledgeDocument]
    embeddingModel: str
    chunkSize: int
    chunkOverlap: int
    topK: int
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
    isPublic: bool
    embeddingModel: str
    chunkSize: int
    chunkOverlap: int
    topK: int


class UpdateKnowledgeBaseInput(TypedDict, total=False):
    name: str
    description: str
    isPublic: bool
    embeddingModel: str
    providerId: str
    chunkSize: int
    chunkOverlap: int
    topK: int


class DiscoverKnowledgeBasesParams(TypedDict, total=False):
    page: int
    limit: int
    search: str
    scope: Literal["mine"]  # restricts to the asserted external user's own KBs (runtime-only)


class _UploadFileInputRequired(TypedDict):
    filename: str
    content: bytes | BinaryIO


class UploadFileInput(_UploadFileInputRequired, total=False):
    contentType: str


class _UploadedFileSummary(TypedDict):
    fileName: str
    fileSize: int
    mimeType: str
    chunkCount: int


class UploadDocumentsResult(TypedDict):
    documentCount: int
    chunkCount: int
    files: list[_UploadedFileSummary]


class DeleteDocumentResult(TypedDict):
    removedChunks: int
    remainingDocuments: int
    remainingChunks: int


class KnowledgeSearchResult(TypedDict):
    text: str
    source: str
    score: float | None
