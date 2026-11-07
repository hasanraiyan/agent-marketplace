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

Not yet traced: workflow runs (they have their own run viewer).

## Voice calls

Gemini Live calls (`voice/gateway/VoiceSession.js`) run no LangGraph graph, so `TraceRecorder`
can't see them. Instead each gateway (`voice/gateway/voiceGateway.js` for browser / SDK / Studio
calls, `twilio/twilioGateway.js` for phone calls) calls `traceService.beginVoice()` and injects
the returned `VoiceCallTracer` into `VoiceSession` as `tracer`. **One trace per call**,
`channel: 'voice'` (or the telephony channel), `metadata.voice` set.

```
Turn N                chain   (RUN_STARTED → RUN_FINISHED), usage = this turn's tokens
├─ User / User (typed) / User (image)   human   final transcript only
├─ <tool>             tool    server / browser (metadata.frontend) / end_call (metadata.synthetic)
│   └─ …              nested LLM / retriever steps (a TraceRecorder passed to tool.invoke)
├─ User interrupted   interrupt  barge-in (metadata.bargeIn, droppedAgentMs)
└─ Agent              llm     transcript, timeToFirstTokenMs = time to first audio, usage
Reconnected to Gemini chain   goAway / session resumption (same trace continues)
```

Every `VoiceSession` hook goes through `_trace()`, which swallows errors — tracing can never
break or delay the audio. Writes are fire-and-forget on one promise chain: the trace row is
created at call start (`running`), closed steps + running totals are flushed every 3 turns /
15 s (the trace page polls while running), and `end()` writes the final status:
`agent_ended` / `client_closed` → `success`, `upstream_error` → `error`, `idle` /
`max_duration` → `cancelled`. Phone traces store `metadata.voice.telephony.callerPhone`
**masked** (`+91•••••4321`); the full number is never stored.

**Tokens** (`VoiceUsageMeter.js`). Gemini Live sends `usageMetadata` on many messages and
re-processes the whole context on each response, so the call's usage is the **sum** over
messages (the old `voice_session_ended.usage` reported only the last one; it now reports the
sum, same shape plus `totalTokens`). `usage.details` breaks it down: input audio / text / image /
video, output audio / text, tool use, thoughts, cached. `TRACE_VOICE_USAGE_MODE` picks how
messages are summed: `auto` (default — per response, a same-turn restatement counts only its
growth), `per_response`, or `cumulative`. `TRACE_DEBUG_VOICE_USAGE=true` logs every raw message
so the right mode can be confirmed on a real call.

**Recording** (`TRACE_VOICE_AUDIO=true`, off by default — it records end users' voices).
`VoiceAudioRecorder.js` writes two raw PCM tracks to temp files while the call runs: the mic as
sent to Gemini (16 kHz, placed at arrival time, gaps > 200 ms padded with silence) and the agent
as received (24 kHz, placed on a playback cursor, since Gemini sends audio faster than real
time). On barge-in the agent audio the listener never heard is dropped, matching the client's
playback flush. After the call `traceAudioMix.js` mixes one **stereo 16 kHz WAV** (user left,
agent right; ~3.75 MB/min) **on a worker thread** (`mixInWorker`: up to 2 long-lived, reused
workers, more recordings queue; a 15-minute call keeps the main thread busy ~0–5 ms instead of
~1 s; if no worker can start it falls back to mixing on the main thread in yielding 1-second
blocks), and `trace.audio` goes `recording → processing →
ready` (or `failed` — the trace itself is unaffected). User / agent / turn spans carry
`metadata.audio: { startMs, endMs }` offsets into it. A `voice_recording { enabled: true }`
CUSTOM event at setup lets a client show a recording notice; Studio (ProjectAdmin) clients also
get `trace_started { traceId }` for a "View trace" link.

Storage is local disk (`traceAudioStore.js`, folder `TRACE_AUDIO_DIR`, default
`./trace-audio`, gitignored) — it needs a persistent volume in production. All access goes through
that module, so an S3/R2 backend can be added later without touching anything else. MongoDB's
TTL removes trace documents but not files, so the hourly `sweepVoiceTraces` cron deletes
recordings past `TRACE_RETENTION_DAYS` or whose trace is gone, temp files older than a day, and
marks voice traces left `running` by a restart as `cancelled`.

## API

All routes are Project-Admin (Clerk + `projectAdminAuthMiddleware`), read-only:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/projects/{projectId}/traces` | Paginated runs. Filters: `agentId`, `threadId`, `status`, `source`, `channel`, `from`, `to`; `limit` ≤ 100 |
| GET | `/api/v1/projects/{projectId}/traces/stats` | `days` (1–90, default 7), `agentId` → totals (incl. p50/p95 latency), `byDay`, `byAgent`, `byChannel`, `voice` (calls, minutes, tokens by type), `tools` |
| GET | `/api/v1/projects/{projectId}/traces/{traceId}` | `{ trace, spans }` |
| GET | `/api/v1/projects/{projectId}/traces/{traceId}/audio` | Voice call recording (`audio/wav`), HTTP Range / 206 for seeking; 404 no recording, 409 still recording / processing |

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
| `VoiceCallTracer.js` | The voice `tracer` a VoiceSession talks to; background writes |
| `VoiceTraceRecorder.js` | Voice call → in-memory turn / step tree |
| `VoiceUsageMeter.js` | Sums Gemini Live `usageMetadata`, breakdown by type |
| `VoiceAudioRecorder.js` | Two synced PCM tracks → temp files |
| `traceAudioMix.js` | Temp tracks → stereo WAV; `mixInWorker` worker pool + queue |
| `traceAudioMix.worker.js` | The worker thread that runs the mix |
| `traceAudioStore.js` | Where recordings live (local disk; S3 later) |
| `cron/sweepVoiceTraces.js` | Hourly recording / stale-trace cleanup |

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `TRACES_ENABLED` | `true` | `false` stops recording |
| `TRACE_RETENTION_DAYS` | `30` | TTL for traces and spans. Changing it later requires dropping the existing `createdAt_1` TTL index on `traces` and `tracespans` (or `collMod`) — Mongoose won't alter an existing index. Also the age limit for voice recordings |
| `TRACE_VOICE_AUDIO` | `false` | Record traced voice calls (stereo WAV) |
| `TRACE_AUDIO_DIR` | `trace-audio` | Recording folder (relative to the backend's working directory) |
| `TRACE_AUDIO_MAX_MINUTES` | `15` | Stop recording past this length (`audio.truncated`) |
| `TRACE_VOICE_USAGE_MODE` | `auto` | `auto` / `per_response` / `cumulative` — how Gemini usage messages are summed |
| `TRACE_DEBUG_VOICE_USAGE` | `false` | Log every raw Gemini `usageMetadata` message |
| `CRON_SWEEP_VOICE_TRACES` | `30 * * * *` | Schedule of the voice cleanup job |

## Tests

`tests/traceRecorder.test.js`, `tests/traceSerializer.test.js`, `tests/traceService.test.js`,
`tests/traceController.test.js`, `tests/traceInterrupts.test.js`; voice:
`tests/voiceUsageMeter.test.js`, `tests/voiceTraceRecorder.test.js`,
`tests/voiceAudioRecorder.test.js`, `tests/voiceCallTracer.test.js`,
`tests/voiceSessionTracing.test.js`, `tests/traceServiceVoice.test.js`,
`tests/traceAudio.test.js`, `tests/traceAudioStore.test.js`.
