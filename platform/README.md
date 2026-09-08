# Persona Developer Platform (`platform.persona.hasanraiyan.me`)

The Next.js App Router developer console and agent creation/testing platform for Persona.

---

## Persona Shadcn Component Registry

Persona provides an official shadcn-compatible component registry so you can install the platform's chat, code editing, and MCP Ext App components directly into your own codebase with **zero CSS clashes** and full Tailwind customization.

### Available Registry Items

| Component | Installation Command | Description |
| :--- | :--- | :--- |
| **`chat`** | `npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/chat.json` | Full AI agent chat timeline with AG-UI streaming, tool execution cards, MCP Ext Apps, thinking indicator, and subagent drawer. |
| **`mcp-app`** | `npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/mcp-app.json` | Sandboxed iframe runner with AppBridge for interactive MCP Ext Apps and prompt dispatch. |
| **`file-explorer`** | `npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/file-explorer.json` | Workspace code explorer and editor with tab management, markdown preview, and save/discard actions. |
| **`voice-indicator`** | `npx shadcn@latest add https://platform.persona.hasanraiyan.me/r/voice-indicator.json` | Voice audio visualizer and status indicator. |

### Building the Registry

Registry files are generated into `public/r/` via:

```bash
pnpm run registry:build
```

---

## Development

```bash
pnpm run dev
pnpm run build
```
