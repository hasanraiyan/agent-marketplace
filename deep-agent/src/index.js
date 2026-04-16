import { config } from "./config.js";
import { tools as baseTools, getMcpTools } from "./tools.js";
import { store, checkpointer, createBackend } from "./memory.js";
import { createAgent } from "./factory.js";
import { subagents } from "./subagents.js";

// Load MCP tools asynchronously
const mcpTools = await getMcpTools();
const tools = [...baseTools, ...mcpTools];

/**
 * Single Responsibility: Entry point for exporting the assembled agent graph.
 * This is the interface for langgraph-cli and external tools.
 */
export const agent = await createAgent({
  model: config.model,
  tools,
  store,
  checkpointer,
  backend: createBackend,
  skills: ["/skills/"],
  subagents,
});

