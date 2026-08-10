/** One uploaded source document's chunking summary (not the chunks themselves). */
export interface KnowledgeDocument {
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkCount: number;
  uploadedAt: string;
}

/** Like Skill/Agent, this mirrors the real wire shape (`_id`, raw domain/ownerType fields). */
export interface KnowledgeBase {
  _id: string;
  domain: string;
  ownerType: 'PersonaUser' | 'Project' | 'ExternalUser';
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description?: string;
  isPublic: boolean;
  documentCount: number;
  chunkCount: number;
  /** Internal Qdrant collection name backing this Knowledge base — informational only. */
  qdrantCollectionName: string;
  documents: KnowledgeDocument[];
  embeddingModel: string;
  providerId?: string;
  /** Characters per chunk, used when splitting uploaded documents. */
  chunkSize: number;
  /** Character overlap between adjacent chunks. */
  chunkOverlap: number;
  /** Default number of chunks returned per `search()` call when the caller doesn't override `topK`. */
  topK: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  /** @default false */
  isPublic?: boolean;
  /** @default 'text-embedding-3-small' */
  embeddingModel?: string;
  /**
   * Required on the Developer API — unlike the Persona route, there's no
   * "my default provider" concept for a Project or ExternalUser caller.
   */
  providerId: string;
  /** @default 800 */
  chunkSize?: number;
  /** @default 100 */
  chunkOverlap?: number;
  /** @default 5 */
  topK?: number;
}

/** All fields optional — only what you pass is changed. Does not retroactively re-embed existing documents. */
export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  embeddingModel?: string;
  providerId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
}

export interface DiscoverKnowledgeBasesParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
  /** Free-text match against `name`/`description`. */
  search?: string;
  /** Restricts to the asserted external user's own Knowledge Bases (`ProjectRuntimeContext` only). */
  scope?: 'mine';
}

export interface UploadFileInput {
  filename: string;
  /** Node Buffer/Uint8Array, or an already-constructed Blob. */
  content: Uint8Array | Blob;
  /** e.g. `'application/pdf'`. Required when `content` isn't already a `Blob` with its own `type`. */
  contentType?: string;
}

export interface UploadDocumentsResult {
  /** Total document count for the Knowledge base after this upload (not just this call's files). */
  documentCount: number;
  /** Total chunk count for the Knowledge base after this upload. */
  chunkCount: number;
  files: Array<{ fileName: string; fileSize: number; mimeType: string; chunkCount: number }>;
}

export interface DeleteDocumentResult {
  removedChunks: number;
  remainingDocuments: number;
  remainingChunks: number;
}

export interface KnowledgeSearchResult {
  text: string;
  /** The `fileName` of the source document this chunk came from. */
  source: string;
  /** Similarity score (higher is more relevant); `null` if the underlying store didn't return one. */
  score: number | null;
}
