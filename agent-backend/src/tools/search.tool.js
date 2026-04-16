import { TavilySearch } from '@langchain/tavily';

/**
 * Initializes and returns the Tavily Web Search Tool.
 * Gracefully handles missing API keys by returning null so systems don't crash aggressively.
 */
export const getSearchTool = () => {
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[ToolRegistry] TAVILY_API_KEY is missing. search_web tool disabled.');
    return null;
  }

  return new TavilySearch({
    maxResults: 5,
    searchDepth: 'advanced',
    name: 'search_web',
    description: 'Search the web for up-to-date information on any topic, current events, or queries requiring internet access.',
  });
};
