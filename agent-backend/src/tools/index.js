import { getSearchTool } from './search.tool.js';
import { getBuilderToolbox } from './builder.tools.js';
import { askClarificationTool } from './clarification.tool.js';
import { resolveMcpTools } from './mcp.tools.js';

export const ARCHITECT_AGENT_ID = '000000000000000000000000';

/**
 * @param {Object} agentConfig - The Mongoose Agent document or System Agent object
 * @param {string} userId - The ID of the user interacting with the agent
 * @returns {Promise<Array>} Array of initialized LangChain Tools
 */
export const resolveAgentTools = async (agentConfig, userId) => {
  const clarificationTool = askClarificationTool();

  // 1. If it is the Specialized Architect, give it the Builder Toolbox
  if (agentConfig._id?.toString() === ARCHITECT_AGENT_ID) {
    return [clarificationTool, ...getBuilderToolbox(userId)];
  }

  const tools = [clarificationTool];

  // 2. Core Engine Web Search parsing
  if (agentConfig.webSearchEnabled) {
    const searchTool = getSearchTool();
    if (searchTool) tools.push(searchTool);
  }

  // 3. MCP connector tools (owner-shared or per-user, depending on each
  // attached connector's authMode)
  const mcpTools = await resolveMcpTools(agentConfig, userId);
  tools.push(...mcpTools);

  return tools;
};

// Also expose generic factory for backend scripts outside of Chat loop
export const getAvailableTools = () => {
  const tools = [askClarificationTool()];

  const searchTool = getSearchTool();
  if (searchTool) tools.push(searchTool);

  return tools;
};
