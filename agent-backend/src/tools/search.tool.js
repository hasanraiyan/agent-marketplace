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

  // TavilySearch validates these as strict enums. Schemas below stay loose (plain
  // strings) so a malformed value from the LLM does NOT crash this wrapper's own
  // validation; we whitelist-validate and strip invalid values before forwarding,
  // so Tavily never receives input it would reject.
  const VALID_TOPICS = ['general', 'news', 'finance'];
  const VALID_DEPTHS = ['basic', 'advanced'];
  const VALID_TIME_RANGES = ['day', 'week', 'month', 'year'];

  return new DynamicStructuredTool({
    name: 'search_web',
    description:
      'Search the web for up-to-date information on any topic, current events, or queries requiring internet access.',
    schema: z.object({
      query: z.string().describe('The search query / keywords. Put ALL search terms here.'),
      searchDepth: z.enum(['basic', 'advanced']).nullable().optional(),
      includeImages: z.boolean().nullable().optional(),
      // Loose string + whitelist-validated below. NOT a free-text field: it is a
      // category, one of general | news | finance. Search terms go in `query`.
      topic: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Search category. Must be exactly one of: 'general', 'news', or 'finance'. " +
            'Do NOT put search terms here — use `query` for that. Omit if unsure.'
        ),
      // LLMs sometimes emit null for these — accept it and strip before forwarding
      includeDomains: z.array(z.string()).nullable().optional(),
      excludeDomains: z.array(z.string()).nullable().optional(),
      timeRange: z.string().nullable().optional(),
    }),
    func: async (input) => {
      const cleaned = { query: input.query };
      if (VALID_DEPTHS.includes(input.searchDepth)) cleaned.searchDepth = input.searchDepth;
      if (typeof input.includeImages === 'boolean') cleaned.includeImages = input.includeImages;
      if (VALID_TOPICS.includes(input.topic)) cleaned.topic = input.topic;
      if (Array.isArray(input.includeDomains) && input.includeDomains.length > 0)
        cleaned.includeDomains = input.includeDomains;
      if (Array.isArray(input.excludeDomains) && input.excludeDomains.length > 0)
        cleaned.excludeDomains = input.excludeDomains;
      if (VALID_TIME_RANGES.includes(input.timeRange)) cleaned.timeRange = input.timeRange;
      // Tag this internal sub-call so the streaming route can skip emitting AG-UI
      // tool-call events for it. The model called `search_web`, not `TavilySearch`;
      // surfacing the nested call injects a tool-call id with no matching assistant
      // tool call and corrupts the AG-UI message stream.
      return await inner.invoke(cleaned, { tags: ['internal:nested-tool'] });
    },
  });
};
