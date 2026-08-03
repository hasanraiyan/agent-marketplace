/** Result of a `bulkDelete()` call — best-effort, partial failures don't throw. */
export interface BulkDeleteResult {
  /** Ids that were successfully deleted. */
  deleted: string[];
  /** Ids that failed, each with a generic reason (existence-hiding: never distinguishes "not found" from "not authorized" from "blocked by a dependency"). */
  failed: Array<{ id: string; reason: string }>;
}
