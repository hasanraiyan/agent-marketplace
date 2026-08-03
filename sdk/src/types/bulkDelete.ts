/** Result of a `bulkDelete()` call — best-effort, partial failures don't throw. */
export interface BulkDeleteResult {
  deleted: string[];
  failed: Array<{ id: string; reason: string }>;
}
