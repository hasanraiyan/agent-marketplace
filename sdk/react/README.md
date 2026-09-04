# @personaai/react

React SDK for [Persona](https://persona.hasanraiyan.me) — hooks and a context provider for building chat UIs against any Persona backend.

> **v0.3.2.** Requires React 18+. Client-side only — never holds a credential.

## Install

```bash
npm install @personaai/react
```

## Quickstart

```tsx
import { PersonaProvider, useChat } from "@personaai/react";

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

| Hook            | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `useChat`       | Streaming chat — messages, send, stop, reload, interrupts, workspace files |
| `useVoice`      | Real-time voice calls (Gemini Live) — start/stop/mute, live transcript, tool calls |
| `useThreads`    | Thread CRUD — list, create, delete, rename, reset, archive                 |
| `useFiles`      | Upload management — list, upload, delete                                   |
| `useMemory`     | Persistent memory — read, write, delete                                    |
| `useAgents`     | Agent discovery — list available agents                                    |
| `useConnection` | Health check — backend connectivity status                                 |

## Voice

Real-time voice calls with an Agent, powered by Gemini Live. Requires your backend to be running
`@personaai/runtime@^0.7.0` (or a framework adapter on top of it) so `POST /voice/sessions` exists
to mint tickets — see that package's README for why the actual call bypasses your backend and
goes straight to Persona instead of relaying through it like `useChat` does.

```tsx
import { useVoice } from "@personaai/react";

function VoiceCall() {
  const { state, transcript, partial, toolCalls, start, stop, mute, isMuted } = useVoice();

  return (
    <div>
      <p>State: {state}</p>
      {state === "idle" ? (
        <button onClick={start}>Start call</button>
      ) : (
        <>
          <button onClick={() => mute(!isMuted)}>{isMuted ? "Unmute" : "Mute"}</button>
          <button onClick={stop}>End call</button>
        </>
      )}
      {transcript.map((line) => (
        <p key={line.id}>
          <b>{line.speaker}:</b> {line.text}
        </p>
      ))}
      {partial && <p style={{ opacity: 0.6 }}>{partial.text}</p>}
    </div>
  );
}
```

Requires a browser with `AudioWorklet` support (every current evergreen browser). Needs an HTTPS
page in production — browsers refuse an insecure `ws://` connection from an `https:` page.

## Devtools

Floating panel for local debugging — inspect hooks, messages and threads with zero runtime changes. Dev-only, not bundled to production unless imported.

```bash
npm install -D @personaai/devtools
```

```tsx
import { PersonaDevtools } from "@personaai/devtools/react";
import { useChat, useThreads } from "@personaai/react";

function Devtools() {
  const { threads } = useThreads();
  const { messages, files, todos } = useChat();
  return <PersonaDevtools clientState={{ threads, messages, files, todos }} />;
}

{
  process.env.NODE_ENV === "development" && <Devtools />;
}
```

See `@personaai/devtools` `sdk/devtools/README.md` for `core`/`react`/`nextjs` subpaths and `baseUrl` polling option.

## Full documentation

**[persona.hasanraiyan.me/guides/react/quickstart](https://persona.hasanraiyan.me/guides/react/quickstart)** — quickstart, hooks reference, streaming events, and types.

## Peer dependencies

- `react >= 18`
