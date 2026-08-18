# @personaai/react

React SDK for [Persona](https://persona.hasanraiyan.me) — hooks and a context provider for building chat UIs against any Persona backend.

> **v0.3.2.** Requires React 18+. Client-side only — never holds a credential.

## Install

```bash
npm install @personaai/react
```

## Quickstart

```tsx
import { PersonaProvider, useChat } from '@personaai/react';

function App() {
  return (
    <PersonaProvider
      baseUrl="http://localhost:3000/api/persona"
      getAuthToken={async () => getToken()}
      defaultAgentId="my-agent-id"
    >
      <Chat />
    </PersonaProvider>
  );
}

function Chat() {
  const { messages, input, setInput, handleSubmit, isStreaming } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button disabled={isStreaming}>Send</button>
      </form>
    </div>
  );
}
```

## Hooks

| Hook | Purpose |
| --- | --- |
| `useChat` | Streaming chat — messages, send, stop, reload, interrupts, workspace files |
| `useThreads` | Thread CRUD — list, create, delete, rename, archive |
| `useFiles` | Upload management — list, upload, delete |
| `useMemory` | Persistent memory — read, write, delete |
| `useAgents` | Agent discovery — list available agents |
| `useConnection` | Health check — backend connectivity status |

## Full documentation

**[persona.hasanraiyan.me/guides/react/quickstart](https://persona.hasanraiyan.me/guides/react/quickstart)** — quickstart, hooks reference, streaming events, and types.

## Peer dependencies

- `react >= 18`
