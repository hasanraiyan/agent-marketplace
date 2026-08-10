import type { RouteHandler } from '../routing.js';
import { json, toInt } from '../routeHelpers.js';

// Requires capabilities.auditLogs — a security/compliance log almost never
// belongs behind the same auth gate as end-user chat sessions.

export const listAuditLogs: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.auditLogs.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    eventType: request.query.eventType,
  });
  return json(200, items);
};
