import { getSearchTool } from './search.tool.js';

/**
 * Tool Registry Builder
 * Receives an Agent configuration payload and dynamically returns 
 * an array of all LangChain Tools it is permitted to use.
 * 
 * @param {Object} agentConfig - The Mongoose Agent document
 * @returns {Array} Array of initialized LangChain Tools
 */
export const resolveAgentTools = (agentConfig) => {
  const tools = [];

  // 1. Core Engine Web Search parsing
  if (agentConfig.webSearchEnabled) {
    const searchTool = getSearchTool();
    if (searchTool) tools.push(searchTool);
  }

  // 2. Future Extensions: Add Calculator, DB connections, API calls, etc.
  
  return tools;
};

// Also expose generic factory for backend scripts outside of Chat loop
export const getAvailableTools = () => {
    const tools = [];
    
    const searchTool = getSearchTool();
    if (searchTool) tools.push(searchTool);
    
    return tools;
};
