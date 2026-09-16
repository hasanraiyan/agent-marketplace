# @personaai/react

React SDK for [Persona](https://persona.hasanraiyan.me) — hooks and a context provider for building chat UIs against any Persona backend.

> **v0.17.0.** Requires React 18+. Client-side only — never holds a credential.

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

| Hook                 | Purpose                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `useChat`            | Streaming chat — messages, send, stop, reload, interrupts, live workspace/todo state, sandbox commands, ephemeral new chat |
| `useArchitectChat`   | Streaming chat with the Agent Architect co-pilot — same mechanics as `useChat`, no `agentId`     |
| `useWorkflowStream`  | Live streaming workflow execution — real-time node state tracking, cancellation, and resume    |
| `useWorkflows`       | Workflow discovery & creation — list, paginate, filter, and create workflows                    |
| `useWorkflow`        | Single workflow authoring — drafts, publishing, versions, and Mermaid diagrams                 |
| `useWorkflowRuns`    | Workflow run history — list historical runs, get run details, and cancel in-flight runs        |
| `useVoice`           | Real-time voice calls (Gemini Live) — start/stop/mute, live transcript, tool calls             |
| `useThreads`         | Thread CRUD — list, create, delete, rename, reset, archive                                     |
| `useFiles`           | Upload management — list, upload, delete                                                        |
| `useMemory`          | Persistent memory CRUD — `scope: "user" \| "agent" \| "workspace"` (an Agent's own `/workspace/` files) |
| `useWorkspaceFiles`  | Thin wrapper over `useMemory` (`scope: "workspace"`) scoped to one Agent — list/get/write/delete |
| `useAgents`          | Agent discovery — list available agents (`visibility: "public"` or self-owned only)             |
| `useSkills`          | Skill CRUD — list, create, update, delete, usage                                                |
| `useKnowledgeBases`  | Knowledge base CRUD + document upload/search                                                    |
| `useRcpSources`      | RCP source CRUD + test connection                                                               |
| `useMcpAdmin`        | Self-serve MCP connector CRUD (`scope: "mine"` only)                                            |
| `useMcp`             | MCP discovery + tool listing                                                                    |
| `useMcpConnections`  | End-user MCP OAuth connect/disconnect flow                                                      |
| `useConnection`      | Health check — backend connectivity status                                                      |

## Memory & an Agent's `/workspace/` files

```tsx
const { memory, getFile, writeFile, deleteFile } = useMemory();

// memory.userFiles (shared across every Agent), memory.agentMemories, and
// memory.agentWorkspaces are each PersonaMemoryAgentGroup[] — grouped one entry per Agent.
await writeFile({ path: "/preferences.md", content: "Prefers concise answers.", scope: "user" });

// An Agent's own /workspace/ files — the SAME persistent store its `write_file`/`read_file` tool
// calls use (NOT a Thread's live/checkpointed state, a different, much narrower thing). Shared
// across every Thread this Subject has with that Agent, not private to one conversation.
const report = await getFile({ path: "/outputs/report.md", scope: "workspace", agentId });
```

`useWorkspaceFiles(agentId)` is a thinner wrapper over the same `scope: "workspace"` calls, scoped
to one Agent up front — handy for a dedicated file-explorer UI that isn't inside an active chat:

```tsx
const { files, isLoading, writeFile, deleteFile } = useWorkspaceFiles(agentId);
```

`useChat()`'s own `files`/`todos` are a different, read-only, per-Thread live snapshot (from
`STATE_SNAPSHOT` events during a run) — use `useWorkspaceFiles`/`useMemory` for CRUD independent of
an active chat session.

## Sandbox terminal

If an Agent has `sandboxEnabled: true` (check the active Thread's populated `agentId` — see
`@personaai/sdk`'s README), its `execute` tool calls are real shell commands in an isolated VM, not
simulated. `useChat()`'s `sandboxCommands: PersonaSandboxCommand[]` is a pure derived view over the
same tool-call stream already backing `messages` — `{ toolCallId, command, output, exitCode,
status }` — enough to build a read-only terminal-style replay with no separate fetch or polling.

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

## Ephemeral new chat (0.8.0+)

Create a new chat instantly without minting an empty thread. The real `threadId` is created lazily on the first `sendMessage`.

```tsx
const [threadId, setThreadId] = useState<string | undefined>()
const chat = useChat({
  agentId,
  threadId,
  onThreadCreated: (id) => setThreadId(id), // sync sidebar after mint
})

const handleNewChat = () => {
  chat.startNewChat() // clears messages/files/todos, enters ephemeral mode
  setThreadId(undefined)
}

// isEphemeral is true until first send mints
// chat.currentThreadId reflects the effective id (prop ?? minted)
await chat.sendMessage("Hello") // auto POST /threads if threadId is undefined
```

`sendMessage` and `reload` now return `Promise<boolean>` (`true` sent, `false` dropped while streaming). `startNewChat()`, `currentThreadId` and `isEphemeral` are new returns on `useChat`.

## Agent Architect chat (0.10.0+)

`useArchitectChat` runs the Agent Architect co-pilot — a conversational agent that creates/edits
your own Agents via tool calls (`manage_agent`, `manage_skill`, ...). Same shape as `useChat` (same
streaming/interrupt/reload/ephemeral-thread mechanics), minus `agentId` (fixed target) and
`voice`/`sandboxCommands` (the Architect has neither):

```tsx
import { useArchitectChat } from "@personaai/react";

const architect = useArchitectChat({ threadId });

await architect.sendMessage("Create a support bot that...");
if (architect.interrupt?.kind === "hitl") {
  await architect.resumeInterrupt({ decisions: [{ type: "approve" }] }, "Approved");
}
```

`threadId` resume only has an effect when the underlying credential asserts an external user
(`x-persona-external-user-id`) — a bare Project credential has no Subject for a Thread to belong to,
so the backend keeps its single deterministic per-Project conversation either way.

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
