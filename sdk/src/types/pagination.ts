/** Pagination metadata attached to every `PaginatedResult`. */
export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
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
