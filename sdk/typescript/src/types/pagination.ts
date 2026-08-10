/** Pagination metadata attached to every `PaginatedResult`. */
export interface PaginationInfo {
  /** Total matching items across all pages — use this, not `items.length`. */
  total: number;
  /** The page number this result reflects (echoes back the requested `page`, or `1` if omitted). */
  page: number;
  /** The page size this result reflects (echoes back the requested `limit`, or the endpoint's default). */
  limit: number;
  /** Total page count — `Math.ceil(total / limit)`. Check this instead of inferring "is there a next page" from `items.length`. */
  pages: number;
}

/**
 * Envelope returned by every paginated `list()`/`discover()` method
 * (Agents/Skills/Knowledge/MCP/Threads/Files — not Providers, which has no
 * discovery concept and stays a bare array).
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationInfo;
}
