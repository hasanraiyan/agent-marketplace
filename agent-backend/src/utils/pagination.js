/**
 * Shared response envelope for the Developer Platform's paginated `list()`/
 * `discover()` endpoints (Feature 4: Agents/Skills/Knowledge/MCP/Threads/
 * Files — not Providers, which has no discovery concept and stays a bare
 * array). `pages` is `0` when `limit` is `0` to avoid a divide-by-zero.
 */
export function paginationEnvelope(items, total, page, limit) {
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      pages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  };
}

export default paginationEnvelope;
