/** Clean formatted shape (`id`, not `_id`) — unlike Thread/Skill/Agent/Knowledge. */
export interface PersonaFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  agentId: string | null;
  threadId: string | null;
  createdAt: string;
}

export interface UploadFilePayload {
  filename: string;
  /** Node Buffer/Uint8Array, or an already-constructed Blob. */
  content: Uint8Array | Blob;
  contentType?: string;
  agentId?: string;
  threadId?: string;
}

export interface ListFilesParams {
  page?: number;
  limit?: number;
}
