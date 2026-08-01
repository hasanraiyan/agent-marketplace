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
  qdrantCollectionName: string;
  documents: KnowledgeDocument[];
  embeddingModel: string;
  providerId?: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  embeddingModel?: string;
  /**
   * Required on the Developer API — unlike the Persona route, there's no
   * "my default provider" concept for a Project or ExternalUser caller.
   */
  providerId: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
}

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
  page?: number;
  limit?: number;
  search?: string;
  /** Restricts to the asserted external user's own Knowledge Bases (ProjectRuntimeContext only). */
  scope?: 'mine';
}

export interface UploadFileInput {
  filename: string;
  /** Node Buffer/Uint8Array, or an already-constructed Blob. */
  content: Uint8Array | Blob;
  contentType?: string;
}

export interface UploadDocumentsResult {
  documentCount: number;
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
  source: string;
  score: number | null;
}
