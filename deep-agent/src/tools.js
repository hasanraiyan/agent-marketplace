import { TavilySearch } from "@langchain/tavily";

/**
 * Real web search tool powered by the Tavily API.
 * Requires TAVILY_API_KEY to be set in the environment.
 */
export const searchWeb = new TavilySearch({
  maxResults: 5,
  searchDepth: "advanced",
  name: "search_web",
  description: "Search the web for up-to-date information on any topic.",
});

export const tools = [searchWeb];
