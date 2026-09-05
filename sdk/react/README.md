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

If you drive a `useVoice({ agentId, threadId })` session alongside `useChat({ threadId })` and
inject live turns into the chat feed yourself, dedupe before injecting. Because the session
persists to the same thread, `useChat.messages` may already carry a turn once it refreshes or on
reload — re-injecting the live copy appends it a second time:

```tsx
const { transcript, ... } = useVoice({ agentId, threadId });
const { messages, appendMessage, ... } = useChat({ threadId });

// Turn a committed voice line into a chat message once, and only if the feed
// does not already hold this content (from an earlier live inject OR a reload
// that pulled the persisted thread).
const pushVoiceLine = (line: { id: string; speaker: "user" | "agent"; text: string }) => {
  if (messages.some((m) => m.id === line.id)) return;           // injected before
  if (messages.some((m) =>
    !String(m.id).startsWith("voice-") &&
    m.role === line.speaker &&
    String(m.content).trim() === line.text.trim(),
  )) return;                                                     // already on the thread
  appendMessage({
    id: `voice-${line.id}`,
    role: line.speaker,
    content: line.text,
  });
};
```

Voice turns are intentionally **live-only** in `useVoice` — history is the thread's job, not the
hook's, so when you share a thread with `useChat` you own the dedup at the injection boundary.

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
