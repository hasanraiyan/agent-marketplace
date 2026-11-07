# Traces Module

Built-in run tracing for **Developer Platform Project agents** — a LangSmith/Phoenix-style
step tree for every agent run, shown on the platform's **Traces** page
(`platform/src/app/projects/[projectId]/traces`).

Persona (consumer) and Agent Studio runs are **not** traced — only runs whose
`executionContext.domain` is a Project.

## What gets recorded

One **Trace** per agent run (one AG-UI turn), holding:

| Field | Meaning |
| --- | --- |
| `agentId`, `agentName`, `threadId` | What ran, and in which conversation |
| `source` | `playground` (Project Admin test chat), `api` (Project credential), `architect` |
| `channel` | `web`, `sms`, `whatsapp`, … (turn channel) |
| `endUserId` | ExternalUser id (API) or the Admin's Persona User id (playground) |
| `status` | `running` → `success` / `error` / `interrupted` (HITL pause) / `cancelled` (client gone) |
| `input`, `output`, `error` | User message, final assistant text, run error |
| `durationMs`, `usage`, `llmCalls`, `toolCalls`, `toolErrors` | Totals |

and many **TraceSpans** (one per step), linked by `spanId`/`parentSpanId` (LangChain run ids):

| `kind` | Source callback | Captured |
| --- | --- | --- |
| `llm` | `handleChatModelStart/LLMEnd` | model, provider, input messages, output message + tool calls, token usage, time-to-first-token, tools offered, finish reason |
| `tool` | `handleToolStart/End/Error` | parsed input, output (ToolMessage / Command unwrapped), error |
| `subagent` | the deepagents `task` tool | named after `subagent_type`; `metadata.description` (the task), `metadata.rollup` (its LLM calls, tool calls, failed steps and tokens, nested subagents included). Parallel subagents are attributed by callback parent ids. Trace has `subagentCalls`. |
| `retriever` | `handleRetrieverStart/End` | query, doc count + snippets |
| `chain` | graph nodes only | timing and errors (no state dump) |

Noise control: runs tagged `langsmith:hidden`, `__*` nodes, and non-node wrapper chains are
never stored (their children are re-parented to the nearest stored ancestor); graph-node spans
that end with no children and no error are dropped.

Payloads go through `traceSerializer.js`: messages collapse to `{ role, content, tool_calls }`,
credential-looking keys (`apiKey`, `authorization`, `password`, `secret`, `*_token`, …) become
`***`, base64 data URLs become a size note, and every field is size-capped.

## How it hooks in

```
agui.service.js runAgentAsAguiEvents()
  └─ traceService.begin(...)            → { traceId, recorder, finish }
  └─ agentInstance.streamEvents(input, { callbacks: [runScopeTracker, recorder] })
  └─ for await (event of translateLangGraphStream(...))   // watches RUN_ERROR
  └─ finally: trace.finish({ status, error })              // not awaited
```

- `TraceRecorder` is a LangChain `BaseCallbackHandler` with `awaitHandlers = true` (pure
  in-memory work), so timestamps are accurate and nothing is still queued at `finalize()`.
- The Trace doc is created (status `running`) at run start; spans are bulk-inserted and the
  totals written once, when the run ends. Every write is fail-soft — tracing never breaks or
  delays a run.
- Playground (`ProjectAdmin`) runs also get a `trace_started` CUSTOM event
  (`{ traceId }`) so the chat can link to its trace. It is not emitted to API callers and is
  not part of the public AG-UI event catalog.

## Human-in-the-loop

A run that pauses (HITL tool approval via `interruptOn`, a clarification question, or frontend
tools waiting on the browser) and the run that later resumes it are **two traces**, linked both ways:

| Paused run | Resumed run |
| --- | --- |
| `status: interrupted` (shown as *paused*) | normal status of the continued run |
| `interrupt`: `summarizeInterrupt()` — kind, summary, pending actions (args masked, allowed decisions) or questions | `resume`: `summarizeResume()` — approve/reject/edit decisions (+ feedback, edited args), answers, or client tool results |
| synthetic `interrupt` step ("Approval required" …) at the pause | synthetic `human` step ("Human decision" …) pinned before every real step |
| `resumedByTraceId` | `resumedFromTraceId` (latest `interrupted` trace on the same thread), `input` = the decision summary |

The graph node that raised `GraphInterrupt` is kept with `metadata.interrupted: true`, not marked
as an error. Helpers live in `traceInterrupts.js`; `agui.service.js` passes `{ pending, value }`
of the resume and the translator's `onInterrupt` info. The platform shows a banner linking the
two runs and a **View thread** link (`?threadId=` on the list) for the whole conversation.

Not yet traced: workflow runs (they have their own run viewer) and Gemini Live voice sessions
(`VoiceSession.js` calls tools outside LangChain callbacks).

## API

All routes are Project-Admin (Clerk + `projectAdminAuthMiddleware`), read-only:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/projects/{projectId}/traces` | Paginated runs. Filters: `agentId`, `threadId`, `status`, `source`, `from`, `to`; `limit` ≤ 100 |
| GET | `/api/v1/projects/{projectId}/traces/stats` | `days` (1–90, default 7), `agentId` → totals (incl. p50/p95 latency), `byDay`, `byAgent`, `tools` |
| GET | `/api/v1/projects/{projectId}/traces/{traceId}` | `{ trace, spans }` |

## Files

| File | Role |
| --- | --- |
| `trace.model.js` / `traceSpan.model.js` | Mongoose schemas, TTL indexes |
| `TraceRecorder.js` | Callback handler → in-memory span tree |
| `traceSerializer.js` | Safe, masked, capped payload serialization |
| `traceInterrupts.js` | HITL pause / resume summaries |
| `trace.repository.js` | DB access |
| `trace.service.js` | `begin()` write path; `list` / `get` / `stats` |
| `trace.controller.js` | HTTP handlers (routes live in `projects/project.routes.js`) |

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `TRACES_ENABLED` | `true` | `false` stops recording |
| `TRACE_RETENTION_DAYS` | `30` | TTL for traces and spans. Changing it later requires dropping the existing `createdAt_1` TTL index on `traces` and `tracespans` (or `collMod`) — Mongoose won't alter an existing index |

## Tests

`tests/traceRecorder.test.js`, `tests/traceSerializer.test.js`, `tests/traceService.test.js`,
`tests/traceController.test.js`, `tests/traceInterrupts.test.js`.
