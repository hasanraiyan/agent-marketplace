import { searchWeb, getMcpTools, tools } from '../src/tools.js';
import { TavilySearch } from "@langchain/tavily";

describe('tools', () => {
  it('should export searchWeb as a TavilySearch instance', () => {
    expect(searchWeb).toBeInstanceOf(TavilySearch);
  });

  it('should include searchWeb in the tools array', () => {
    expect(tools).toContain(searchWeb);
  });

  it('should return an empty array from getMcpTools when no servers are configured', async () => {
    const mcpTools = await getMcpTools();
    expect(Array.isArray(mcpTools)).toBe(true);
    expect(mcpTools.length).toBe(0);
  });
});
