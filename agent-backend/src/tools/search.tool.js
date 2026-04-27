import { DynamicStructuredTool } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { z } from 'zod';

/**
 * Initializes and returns the Tavily Web Search Tool.
 * Wraps TavilySearch with a null-tolerant schema so LLMs that emit null for
 * optional fields (includeDomains, excludeDomains, timeRange) don't trigger
 * Zod validation errors inside TavilySearch.call().
 */
export const getSearchTool = () => {
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[ToolRegistry] TAVILY_API_KEY is missing. search_web tool disabled.');
    return null;
  }

  const inner = new TavilySearch({ maxResults: 5, searchDepth: 'advanced' });

  return new DynamicStructuredTool({
    name: 'search_web',
    description:
      'Search the web for up-to-date information on any topic, current events, or queries requiring internet access.',
    schema: z.object({
      query: z.string(),
      searchDepth: z.enum(['basic', 'advanced']).optional(),
      includeImages: z.boolean().optional(),
      topic: z.string().optional(),
      // LLMs sometimes emit null for these — accept it and strip before forwarding
      includeDomains: z.array(z.string()).nullable().optional(),
      excludeDomains: z.array(z.string()).nullable().optional(),
      timeRange: z.enum(['day', 'week', 'month', 'year']).nullable().optional(),
    }),
    func: async (input) => {
      const cleaned = { query: input.query };
      if (input.searchDepth) cleaned.searchDepth = input.searchDepth;
      if (input.includeImages !== undefined) cleaned.includeImages = input.includeImages;
      if (input.topic) cleaned.topic = input.topic;
      if (Array.isArray(input.includeDomains) && input.includeDomains.length > 0)
        cleaned.includeDomains = input.includeDomains;
      if (Array.isArray(input.excludeDomains) && input.excludeDomains.length > 0)
        cleaned.excludeDomains = input.excludeDomains;
      if (input.timeRange) cleaned.timeRange = input.timeRange;
      return await inner.invoke(cleaned);
    },
  });
};
