import { getSearchTool } from './search.tool.js';
import { getBuilderToolbox } from './builder.tools.js';
import { askClarificationTool } from './clarification.tool.js';
import { resolveMcpTools } from '../mcp/mcp.tools.js';
import { resolveKnowledgeBaseTools } from '../knowledge/knowledge.tools.js';
import { presentFileTool } from './present.tool.js';

// Defined in a leaf constants module so consumers that sit inside import
// cycles with this module (e.g. agentFactory) can import it safely.
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
export { ARCHITECT_AGENT_ID };

/**
 * @param {Object} agentConfig - The Mongoose Agent document or System Agent object
 * @param {string} userId - The ID of the user interacting with the agent
 * @param {Object} [context] - Execution context (blueprint Phase 9, PR-48);
 *   defaults to a Persona-shaped context built from `userId` — forwarded to
 *   `resolveMcpTools` so per-user OAuth MCP tools resolve the calling
 *   Subject's own connection correctly, Persona or Project external user.
 * @returns {Promise<Array>} Array of initialized LangChain Tools
 */
export const resolveAgentTools = async (
  agentConfig,
  userId,
  context = { principalType: 'PersonaUser', personaUserId: userId }
) => {
  const clarificationTool = askClarificationTool();

  // 1. If it is the Specialized Architect, give it the Builder Toolbox
  if (agentConfig._id?.toString() === ARCHITECT_AGENT_ID) {
    return { tools: [clarificationTool, ...getBuilderToolbox(userId)], mcpAppMap: {} };
  }

  // Long-term memory is file-based now: the agent persists memories through
  // the /memories/ filesystem routes, so no dedicated memory tools are needed.
  const presentTool = presentFileTool();
  const tools = [clarificationTool, presentTool];

  // 2. Core Engine Web Search parsing
  if (agentConfig.webSearchEnabled) {
    const searchTool = getSearchTool();
    if (searchTool) tools.push(searchTool);
  }

  // 3. MCP connector tools (owner-shared or per-user, depending on each
  // attached connector's authMode). mcpAppMap maps a tool name to the MCP App
  // widget (resourceUri + mcpId) the AG-UI stream should render when it's called.
  const { tools: mcpTools, mcpAppMap } = await resolveMcpTools(agentConfig, userId, context);
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
