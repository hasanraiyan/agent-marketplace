# Tools Module

## Purpose

Provides the **central tool resolution system** for AI agents. Aggregates tools from various sources (built-in tools, MCP connectors, knowledge bases) and returns them as LangChain-compatible `DynamicStructuredTool` instances for agent execution.

## Location

`src/modules/tools/`

## Structure

```
src/modules/tools/
├── index.js               # Tool resolution + barrel exports
├── builder.tools.js       # Architect agent's Builder Toolbox (CRUD tools)
├── clarification.tool.js  # ask_clarification tool
├── present.tool.js        # present_file tool
└── search.tool.js         # Web search tool (Tavily)
```

## Responsibilities

- Aggregate tools from all sources for agent initialization
- Provide built-in tools for all agents
- Provide Architect-specific Builder Toolbox tools
- Export `resolveAgentTools()` used by `agent.factory.js`

## Tool Registry

### Core Tools (All Agents)

| Tool | Source | Purpose |
|------|--------|---------|
| `ask_clarification` | `clarification.tool.js` | Ask user structured questions with options |
| `present_file` | `present.tool.js` | Display a file to the user (shows inline card) |

### Web Search (Conditional)

| Tool | Source | Purpose |
|------|--------|---------|
| `search_web` | `search.tool.js` | Web search via Tavily API (only if `webSearchEnabled`) |

### MCP Tools (Attached Connectors)

Dynamic tools from attached MCP servers, discovered via `resolveMcpTools()`.

### Knowledge Base Tools (Attached KBs)

| Tool | Purpose |
|------|---------|
| `knowledge_search` | Semantic search across attached knowledge bases |
| `list_knowledge_sources` | List document sources in knowledge bases |

### Builder Toolbox (Architect Only)

Tools for the Architect meta-agent to create/manage agents:

| Tool | Purpose |
|------|---------|
| `upsert_agent` | Create or update an agent |
| `delete_agent` | Delete an agent |
| `list_my_agents` | List user's agents |
| `list_my_providers` | List user's providers |
| `manage_skill` | List, delete, or toggle skill visibility |

These tools are HITL-guarded (require human approval before execution).

## Tool Resolution Flow

```javascript
// tools/index.js - resolveAgentTools()
export const resolveAgentTools = async (agentConfig, userId) => {
  // 1. Clarification tool (always present)
  const tools = [clarificationTool, presentTool];

  // 2. Web search (if enabled)
  if (agentConfig.webSearchEnabled) {
    tools.push(searchTool);
  }

  // 3. MCP connector tools
  const { tools: mcpTools } = await resolveMcpTools(agentConfig, userId);
  tools.push(...mcpTools);

  // 4. Knowledge base tools (if KBs attached)
  if (agentConfig.knowledgeBases?.length > 0) {
    tools.push(...kbTools);
  }

  return { tools, mcpAppMap };
};
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| MCP module | Internal | MCP tool resolution |
| Knowledge module | Internal | Knowledge base tool resolution |
| Agents module | Internal | Architect agent ID constant |

## Important Notes

### Architect Agent Detection
When the agent being configured is the Architect (identified by `ARCHITECT_AGENT_ID`), the Builder Toolbox is returned instead of the standard toolset. The Architect does not get MCP or knowledge base tools.

### MCP App Map
The `mcpAppMap` returned from `resolveMcpTools()` maps tool names to their MCP App resource URIs. This is forwarded to the AG-UI translator so the client can render MCP App widgets alongside tool calls.
