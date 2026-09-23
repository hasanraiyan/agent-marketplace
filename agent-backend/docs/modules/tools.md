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

| Tool                | Source                  | Purpose                                        |
| ------------------- | ----------------------- | ---------------------------------------------- |
| `ask_clarification` | `clarification.tool.js` | Ask user structured questions with options     |
| `present_file`      | `present.tool.js`       | Display a file to the user (shows inline card) |

### Web Search (Conditional)

| Tool         | Source           | Purpose                                                |
| ------------ | ---------------- | ------------------------------------------------------ |
| `search_web` | `search.tool.js` | Web search via Tavily API (only if `webSearchEnabled`) |

### MCP Tools (Attached Connectors)

Dynamic tools from attached MCP servers, discovered via `resolveMcpTools()`.

### Knowledge Base Tools (Attached KBs)

| Tool                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `knowledge_search`       | Semantic search across attached knowledge bases |
| `list_knowledge_sources` | List document sources in knowledge bases        |

### Builder Toolbox (Architect Only)

Tools for the Architect meta-agent to create/manage agents. Each `manage_*`
tool is one consolidated CRUD tool — `action: "create" | "read" | "update" |
"patch" | "delete"` — instead of a separate tool per operation. `read` with
no `id` lists; with `id` fetches one. `update` replaces named fields
wholesale; `patch` (`{ field, op: "set"|"add"|"remove", value }`) targets one
field, letting the model attach/detach a single id (e.g. one MCP) from an
attachment array without resending the whole array.

| Tool                   | Purpose                                                                                                                 | Toolboxes         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `manage_agent`         | CRUD for agents, incl. attaching skills/mcps/restApiTools/rcpSources/knowledgeBases/storeMounts                         | Persona + Project |
| `manage_skill`         | `read`/`update`/`delete` for skills (list/visibility/deletion — no `create`, content is authored via `/skill-library/`) | Persona + Project |
| `manage_mcp`           | CRUD for MCP connectors (`none`/`apiKey` auth only — OAuth needs the Connectors tab UI)                                 | Persona + Project |
| `manage_rcp_source`    | CRUD for RCP (REST Connector Protocol) manifest sources — supersedes REST Tool Sources                                  | Project only      |
| `manage_rest_api_tool` | CRUD for the no-code single-call REST API Tool Builder                                                                  | Project only      |
| `list_my_providers`    | List user's providers (read-only)                                                                                       | Persona only      |

Project-only tools have no Persona-facing route/UI equivalent yet (only
`mcp.routes.js` exists outside the Developer Platform — there's no
`rcpSource.routes.js`/Persona `restApiTool` route), so they're wired only
into the Project/Developer Architect's toolbox (`projectBuilder.tools.js`),
not the Persona one (`builder.tools.js`).

Every `manage_*` tool is HITL-guarded via a `when` predicate
(`agent.factory.js`'s `ARCHITECT_INTERRUPT_ON`) that interrupts every action
except `read` — listing/fetching never pauses for approval, only
create/update/patch/delete do.

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

| Dependency       | Type     | Purpose                        |
| ---------------- | -------- | ------------------------------ |
| MCP module       | Internal | MCP tool resolution            |
| Knowledge module | Internal | Knowledge base tool resolution |
| Agents module    | Internal | Architect agent ID constant    |

## Important Notes

### Architect Agent Detection

When the agent being configured is the Architect (identified by `ARCHITECT_AGENT_ID`), the Builder Toolbox is returned instead of the standard toolset. The Architect does not get MCP or knowledge base tools.

### MCP App Map

The `mcpAppMap` returned from `resolveMcpTools()` maps tool names to their MCP App resource URIs. This is forwarded to the AG-UI translator so the client can render MCP App widgets alongside tool calls.
