import type { AgentCategory } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export const listAgents: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.agents.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
    category: request.query.category as AgentCategory | undefined,
    scope: request.query.scope === 'mine' ? 'mine' : undefined,
  });
  return {
    kind: 'buffered',
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(items),
  };
};
