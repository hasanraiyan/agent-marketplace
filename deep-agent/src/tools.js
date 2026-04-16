import { TavilySearch } from "@langchain/tavily";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

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

/**
 * Initialize MCP tools from configured servers.
 * In a real scenario, these could be loaded from environment variables or a config file.
 */
export async function getMcpTools() {
  try {
    const mcpClient = new MultiServerMCPClient({
      // Example: Google Search MCP server (if available/configured)
      // You can add more servers here
      /*
      google: {
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-google-search"],
      }
      */
    });

    // If you have specific servers to connect to, uncomment above and this:
    // const mcpTools = await mcpClient.getTools();
    // return mcpTools;

    return [];
  } catch (error) {
    console.error("Failed to load MCP tools:", error);
    return [];
  }
}

export const tools = [searchWeb];
