import { getSearchTool } from './search.tool.js';
import { getBuilderToolbox } from './builder.tools.js';
import { askClarificationTool } from './clarification.tool.js';
import { resolveMcpTools } from './mcp.tools.js';
import { resolveKnowledgeBaseTools } from './knowledge.tools.js';
import { getMemoryTools } from './memory.tools.js';
import { presentFileTool } from './present.tool.js';

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
    return { tools: [clarificationTool, ...getBuilderToolbox(userId)], mcpAppMap: {} };
  }

  const agentId = agentConfig._id?.toString() || agentConfig.id?.toString();
  const presentTool = presentFileTool();
  const tools = [clarificationTool, presentTool, ...getMemoryTools(userId, agentId)];

  // 2. Core Engine Web Search parsing
  if (agentConfig.webSearchEnabled) {
    const searchTool = getSearchTool();
    if (searchTool) tools.push(searchTool);
  }

  // 3. MCP connector tools (owner-shared or per-user, depending on each
  // attached connector's authMode). mcpAppMap maps a tool name to the MCP App
  // widget (resourceUri + mcpId) the AG-UI stream should render when it's called.
  const { tools: mcpTools, mcpAppMap } = await resolveMcpTools(agentConfig, userId);
  tools.push(...mcpTools);

  // 4. Knowledge Base tools (semantic search + list sources per KB)
  if (agentConfig.knowledgeBases && agentConfig.knowledgeBases.length > 0) {
    const kbTools = await resolveKnowledgeBaseTools(agentConfig.knowledgeBases, userId);
    tools.push(...kbTools);
  }

  return { tools, mcpAppMap };
};

// Also expose generic factory for backend scripts outside of Chat loop
export const getAvailableTools = () => {
  const tools = [askClarificationTool(), presentFileTool()];

  const searchTool = getSearchTool();
  if (searchTool) tools.push(searchTool);

  return tools;
};
