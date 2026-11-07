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
| `useMessages`        | Outbound SMS/WhatsApp — plain send or Agent-composed reply (`capabilities.messages`)            |
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
| `useRenderTool`      | Custom UI for a server tool's calls (generative UI) — see below                                 |
| `useRenderToolCall`  | Returns a function that renders a tool call with its registered renderer                        |
| `useFrontendTool`    | Give the agent a tool that runs in the browser (navigate, open a modal, …) — see below           |
| `useHumanInTheLoop`  | A frontend tool that waits for the user's answer (`respond()`)                                   |
| `useComponent`       | Generative UI — the agent shows one of your components in the chat                              |
| `useAttachments`     | Pick, check and upload images to send with a message — see below                                |
| `useAttachmentUrl`   | `<img src>` for an attached image (fetched with the user's auth)                                 |

## Images (`useAttachments`, `useAttachmentUrl`)

Turn on the Agent's **Image Input** setting (platform → Agent, or `imageInputEnabled`) and give
it a vision-capable model. Then:

```tsx
function Composer() {
  const chat = useChat();
  const att = useAttachments();

  const send = async () => {
    const ok = await chat.sendMessage(chat.input, { attachments: att.ready });
    if (ok) att.clear();
  };

  return (
    <>
      <input type="file" accept={att.accept} multiple onChange={(e) => att.add(e.target.files)} />
      {att.attachments.map((a) => (
        <img key={a.id} src={a.previewUrl} alt={a.name} onClick={() => att.remove(a.id)} />
      ))}
      {att.error && <p>{att.error}</p>}
      <textarea value={chat.input} onChange={chat.handleInputChange} />
      <button onClick={send} disabled={att.isUploading}>Send</button>
    </>
  );
}

// In the transcript (sent messages and thread history):
function MessageImage({ fileId, name }: { fileId: string; name?: string }) {
  const { url } = useAttachmentUrl(fileId);
  return url ? <img src={url} alt={name ?? "image"} /> : null;
}
// …message.attachments?.map((a) => <MessageImage key={a.fileId} {...a} />)
```

- PNG, JPEG, WebP or GIF; up to 5 MB each and 4 per message (`ATTACHMENT_LIMITS`). The server
  checks the real type from the bytes, ownership and size again.
- Uploads go through the runtime's `POST /files` as the signed-in end user. An image-only
  message (empty text) is allowed; `reload()` resends the last message's images.
- `useAttachmentUrl` reuses the bytes of an image this tab just uploaded, so the sent bubble
  shows instantly; other images are downloaded once and cached (40 MB cap).
- The agent also keeps every image from the thread in its read-only `/uploads/` folder.
- Errors come back as a run error: `INVALID_ATTACHMENT` (bad image) or `MODEL_NO_VISION`.

## Frontend tools (`useFrontendTool`, `useHumanInTheLoop`, `useComponent`)

Tools your app defines and runs **in the browser**, which the agent can call like any other tool.
Turn on **Frontend Tools** for the agent first (agent settings, or `frontendToolsEnabled: true`
via `@personaai/sdk`) — with it off, registered tools are ignored.

```tsx
import { useFrontendTool, useHumanInTheLoop, useComponent } from "@personaai/react";

function AppTools() {
  // Runs code; the return value goes back to the agent.
  useFrontendTool<{ programId: string }>({
    name: "open_program",
    description: "Open a program's detail page for the student.",
    parameters: {
      type: "object",
      properties: { programId: { type: "string" } },
      required: ["programId"],
    },
    handler: ({ programId }) => {
      router.push(`/programs/${programId}`);
      return { opened: programId };
    },
  });

  // Asks the user; the agent waits until respond() is called.
  useHumanInTheLoop<{ university: string }>({
    name: "confirm_application",
    description: "Ask the student to confirm before submitting an application.",
    parameters: { type: "object", properties: { university: { type: "string" } } },
    render: ({ args, status, respond }) => (
      <ConfirmCard
        title={`Apply to ${args.university}?`}
        disabled={status !== "executing" || !respond}
        onYes={() => respond?.({ confirmed: true })}
        onNo={() => respond?.({ confirmed: false })}
      />
    ),
  });

  // Generative UI: the tool's arguments become the component's props.
  useComponent<{ items: Program[] }>({
    name: "show_shortlist",
    description: "Show the student's program shortlist as cards.",
    parameters: shortlistJsonSchema, // or z.toJSONSchema(shortlistSchema)
    render: (args) => <ShortlistCards items={args.items ?? []} />,
  });

  return null;
}
```

Mount `<AppTools />` anywhere under `PersonaProvider`, and render tool calls with
`PersonaToolCallView` (see below) so `render` UIs appear in the transcript.

How it works:

- `useChat` sends every registered tool with each request. When the agent calls one, the run
  **pauses**; `useChat` runs the tool (`handler`, your `respond()`, or "displayed" for a
  component), puts the answer on the tool's card, and **resumes the agent silently** — no extra
  user message.
- Errors: a throwing `handler` (or a tool that isn't registered right now) is reported to the
  agent as a failed tool, so it can recover.
- If the user sends a new message instead of answering, the pending call is cancelled and the
  agent is told the action wasn't completed. A thread reloaded while paused runs its pending tools
  again (handlers included).
- These pauses never appear as `interrupt` — existing approval/clarification UIs are untouched.
  `useChat().pendingFrontendTools` lists calls currently waiting, for display.
- Names must match `^[a-zA-Z0-9_-]{1,64}$` and must not clash with the agent's own tools (a
  clashing tool is dropped server-side). Up to 20 tools; each schema up to 8 KB.

## Custom tool UI (`useRenderTool`)

Render your own component for a tool that runs on the server (MCP, REST API tool, built-in…)
instead of a generic tool card. Display only — the tool itself is unchanged.

```tsx
import { useRenderTool, PersonaToolCallView } from "@personaai/react";

function ProgramSearchUI() {
  useRenderTool<{ query: string }>({
    name: "search_programs",
    render: ({ status, args, result, isError }) => {
      if (status === "inProgress") return <Skeleton label={args.query} />; // args still streaming (partial)
      if (status === "executing") return <Spinner label={`Searching ${args.query}…`} />;
      return isError ? <ErrorNote /> : <ProgramResults json={result} />; // "complete"
    },
  });
  return null;
}

// Wherever you render a message's tool calls:
{message.toolCalls?.map((tc) => (
  <PersonaToolCallView key={tc.toolCallId} toolCall={tc} fallback={<DefaultToolCard call={tc} />} />
))}
```

- `status` is `"inProgress"` (args streaming in — `args` is a best-effort partial object),
  `"executing"` (args complete, waiting for the result), or `"complete"` (`result` is set). It's
  derived from the call itself, so reloaded threads render the same way.
- `name: "*"` registers a catch-all renderer for any tool without its own. Return `null` to hide
  a call entirely.
- Render functions may use hooks; each call keeps its own component state.
- Registered while the calling component is mounted; the latest registration for a name wins.
- No renderer and no `fallback` → `PersonaToolCallView` renders nothing. `useRenderToolCall()`
  returns `undefined` for unmatched calls so you can branch yourself.

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

## SMS and WhatsApp

`useMessages()` sends outbound text messages through your own backend's `POST /messages` /
`POST /messages/agent` routes (requires `@personaai/runtime@^0.16.0` or an adapter built on it).
Both routes are opt-in there — mount a runtime with `capabilities: { messages: true }`, or they
404. That's deliberate: `to` is any E.164 number and every send spends the Project's Twilio
balance, so it isn't end-user-scoped the way `chat`/`voice` are. Anything your `resolveUser`
accepts on that mount can text arbitrary numbers through it, so enable it only where that's
acceptable.

```tsx
import { useMessages } from "@personaai/react";

function FollowUp({ agentId }: { agentId: string }) {
  const { send, sendFromAgent, isSending, error, lastDelivery } = useMessages();

  return (
    <div>
      {/* Plain send — no Agent involved. */}
      <button
        onClick={() => send({ to: "+919876543210", body: "Your order shipped!" })}
        disabled={isSending}
      >
        Text customer
      </button>

      {/* The Agent runs on the shared conversation and its reply is delivered. */}
      <button
        onClick={() =>
          sendFromAgent({
            agentId,
            to: "+919876543210",
            prompt: "Remind them their appointment is tomorrow at 10.",
          })
        }
        disabled={isSending}
      >
        Have the agent follow up
      </button>

      {lastDelivery && <p>Sent in {lastDelivery.parts} part(s)</p>}
      {error && <p role="alert">{error.message}</p>}
    </div>
  );
}
```

The channel is inferred from a `whatsapp:` prefix on `to` (or pass `channel: "whatsapp"`). A body
is required unless you pass an approved WhatsApp template (`contentSid` + `contentVariables`) —
business-initiated WhatsApp messages outside the 24-hour session window need one. Conversations
are keyed by phone number, so SMS, WhatsApp, and voice with the same Agent share one thread;
`sendFromAgent()` continues it rather than starting fresh. Agents with guarded (`interruptOn`)
tools are rejected with a 422, same as voice — there's no confirmation flow on a text channel.

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
