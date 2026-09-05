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

### How `transcript` is shaped

`transcript` is **live-only**: it starts empty on every `start()` and grows purely from the
voice session's events. The server never replays the thread's prior history into it — pass
`threadId` and the session *persists* new turns to that thread (so `useChat`/`useThreads` can read
them back on reload), but `transcript` itself always reflects just what was spoken in this call.

Gemini Live streams an agent answer as several incremental transcription fragments. The hook merges
them so one utterance is **one transcript line**, mirroring how the same turns read back from the
thread (consecutive assistant messages are coalesced on reload). The merge applies across distinct
spoken segments of one answer too (e.g. split by a mid-answer tool call) — a new agent line is only
started once a committed user line has intervened.

### Showing voice turns in a text `useChat` feed

Share the same `threadId` between `useVoice` and `useChat`, and pass the voice hook's return
value into `useChat`'s `voice` option — that's the whole integration:

```tsx
const voice = useVoice({ agentId, threadId });
const { messages, ... } = useChat({ threadId, voice });
```

`useChat` merges live voice turns into `messages` for you: one bubble per utterance, deduped
against thread history and against a voice turn that already persisted back into the shared
thread, consecutive same-speaker fragments folded into the line they opened, and the
in-progress agent line updated in place while it's still being spoken (`isStreaming: true`, same
as a text response). Injected messages get a `voice-`-prefixed id. You still call `voice.start()`
/ `voice.stop()` yourself — `useChat` only owns the transcript-to-feed sync, not the call
lifecycle.

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
