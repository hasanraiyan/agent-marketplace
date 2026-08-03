/** Clean formatted shape (`id`, not `_id`) — unlike Thread/Skill/Agent/Knowledge. */
export interface PersonaFile {
  id: string;
  originalName: string;
  mimeType: string;
  /** Bytes. */
  size: number;
  agentId: string | null;
  threadId: string | null;
  createdAt: string;
}

export interface UploadFilePayload {
  filename: string;
  /** Node Buffer/Uint8Array, or an already-constructed Blob. */
  content: Uint8Array | Blob;
  /** e.g. `'application/pdf'`. Required when `content` isn't already a `Blob` with its own `type`. */
  contentType?: string;
  /** Associates this file with an Agent, e.g. for later reference in that Agent's tool calls. */
  agentId?: string;
  /** Associates this file with a specific Thread/conversation. */
  threadId?: string;
}

export interface ListFilesParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
}
