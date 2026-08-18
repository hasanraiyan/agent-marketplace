import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { sanitizeToolsForGemini } from '../src/modules/agents/sanitizeToolsForGemini.js';

function findExclusiveKeyword(value) {
  if (Array.isArray(value)) return value.some(findExclusiveKeyword);
  if (value === null || typeof value !== 'object') return false;
  if ('exclusiveMinimum' in value || 'exclusiveMaximum' in value) return true;
  return Object.values(value).some(findExclusiveKeyword);
}

describe('sanitizeToolsForGemini', () => {
  it('rewrites exclusiveMinimum/exclusiveMaximum to minimum/maximum instead of dropping the constraint', async () => {
    const tool = new DynamicStructuredTool({
      name: 'set_budget',
      description: 'Sets a budget amount',
      schema: z.object({
        amount: z.number().positive(),
        cap: z.number().lt(1000),
      }),
      func: async ({ amount }) => `set to ${amount}`,
    });

    const [sanitized] = sanitizeToolsForGemini([tool]);

    expect(findExclusiveKeyword(sanitized.schema)).toBe(false);
    expect(sanitized.schema.properties.amount.minimum).toBe(0);
    expect(sanitized.schema.properties.cap.maximum).toBe(1000);
  });

  it('preserves name, description, and calling behavior', async () => {
    const tool = new DynamicStructuredTool({
      name: 'set_budget',
      description: 'Sets a budget amount',
      schema: z.object({ amount: z.number().positive() }),
      func: async ({ amount }) => `set to ${amount}`,
    });

    const [sanitized] = sanitizeToolsForGemini([tool]);

    expect(sanitized.name).toBe('set_budget');
    expect(sanitized.description).toBe('Sets a budget amount');
    await expect(sanitized.func({ amount: 5 })).resolves.toBe('set to 5');
  });

  it('leaves a tool with no exclusive-bound constraints unchanged in shape', async () => {
    const tool = new DynamicStructuredTool({
      name: 'get_status',
      description: 'No numeric constraints',
      schema: z.object({ id: z.string() }),
      func: async () => 'ok',
    });

    const [sanitized] = sanitizeToolsForGemini([tool]);

    expect(findExclusiveKeyword(sanitized.schema)).toBe(false);
    expect(sanitized.schema.properties.id.type).toBe('string');
  });

  it('returns the tool unchanged when it has no schema at all', async () => {
    const noSchemaTool = { name: 'health_check', description: 'x', func: async () => 'ok' };

    const [result] = sanitizeToolsForGemini([noSchemaTool]);

    expect(result).toBe(noSchemaTool);
  });
});
