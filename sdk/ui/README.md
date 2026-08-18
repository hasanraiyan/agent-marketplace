# @personaai/ui

Pre-built React components for [Persona](https://persona.hasanraiyan.me) — full chat widgets and standalone building blocks for streaming chat UIs.

> **v0.7.3.** Requires `@personaai/react` ^0.3.2 and React 18+. Client-side only.

## Install

```bash
npm install @personaai/ui @personaai/react
```

## Quickstart

```tsx
import { PersonaProvider } from '@personaai/react';
import { PersonaChatView } from '@personaai/ui';
import '@personaai/ui/styles.css'; // required — bundles Tailwind utilities + KaTeX

function App() {
  return (
    <PersonaProvider baseUrl="http://localhost:3000/api/persona" defaultAgentId="my-agent-id">
      <div className="h-screen">
        <PersonaChatView agentId="my-agent-id" title="Support Chat" />
      </div>
    </PersonaProvider>
  );
}
```

## Components

| Component | Purpose |
| --- | --- |
| `PersonaChatView` | Full chat widget — sidebar, message feed, composer, files drawer |
| `PersonaChatLauncher` | Floating action button that toggles a `PersonaChatView` panel |
| `PersonaMessageFeed` | Standalone message list with markdown, tool cards, avatars |
| `PersonaComposer` | Input area with send/stop, file upload, starter prompts |
| `PersonaSidebar` | Thread list with search, date grouping, inline rename |
| `PersonaFilesDrawer` | Three-tab drawer — uploads, workspace, memory |
| `PersonaToolTrace` | Single tool call card (args, result, status) |
| `PersonaToolGroup` | Clustered tool calls with semantic titles |
| `PersonaMarkdown` | Markdown rendering (GFM tables, KaTeX math, code blocks) |
| `PersonaInterruptCard` | HITL approval and clarification question UI |
| `PersonaSkeleton` | Loading skeleton primitives |

## Full documentation

**[persona.hasanraiyan.me/guides/ui/quickstart](https://persona.hasanraiyan.me/guides/ui/quickstart)** — quickstart, components reference, theming, and launcher docs.

## Peer dependencies

- `@personaai/react` ^0.3.2
- `react` >= 18
