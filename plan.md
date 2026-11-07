# Voice Mode Tracing — Plan

> **Status:** Proposed. Nothing is built yet.
> **Date:** 2026-11-07
> **Builds on:** the built-in tracing module (`agent-backend/src/modules/traces/`, `platform/src/components/traces/`, see `agent-backend/docs/modules/traces.md`).
> **Scope:** Project developers in `platform/` only, the same as text tracing. Persona (consumer) sessions are never traced.

---

## 1. The problem

Text-chat traces come from `TraceRecorder`, a LangChain callback handler attached to the LangGraph run in `agui.service.js`. Voice calls never go through that path.

- A voice call is a direct WebSocket to **Gemini Live**, run by `agent-backend/src/modules/voice/gateway/VoiceSession.js`.
- Gemini does the speech-to-text, the reply and the tool-call decisions itself, so there's no LangGraph run to hook into.
- The only LangChain code in a call is tool execution: `tool.invoke(...)` in `_invokeToolCallWithTimeout` (`VoiceSession.js:593`).

So voice needs a small recorder that `VoiceSession` feeds from its own events. It writes to the **same `traces` / `trace_spans` collections**, so the Traces page and the Usage stats work with only small changes.

---

## 2. Trace shape

**One trace per call, with one step for each turn.** One trace per turn would scatter a single call across dozens of rows and hide the call-level picture (duration, end reason, total tokens).

```
📞 Voice call · GATE Prep Tutor · 3m 12s · 4.1k tokens        trace (channel: voice)
├─ Turn 1                                                      chain span (RUN_STARTED → RUN_FINISHED)
│   ├─ 👤 User:  "what's the syllabus for DBMS?"                human span
│   ├─ 🔧 search_knowledge   args → result   1.2s              tool span
│   │    └─ (LLM / retriever calls inside the tool, if any)     via TraceRecorder callbacks
│   └─ 🤖 Agent: "DBMS covers ER models, normalization…"        llm span (transcript as output)
├─ Turn 2
│   ├─ 👤 User:  "and how many marks…"
│   ├─ ✋ Interrupted (user cut the agent off)                   interrupt span (barge-in)
│   └─ 🤖 Agent: "Usually around…"  (partial)
├─ Turn 3
│   ├─ 🌐 show_chart (browser tool)  result | timeout | cancelled   tool span, metadata.frontend = true
│   └─ 📴 end_call                                              tool span, metadata.synthetic = true
└─ Ended: agent_ended · 3m 12s                                  trace.metadata.endReason
```

**Trace-level fields**

| Field | Value |
|---|---|
| `channel` | `'voice'` |
| `source` | `playground` (Studio test call, ProjectAdmin) / `api` (ProjectRuntime / ProjectMachine) |
| `threadId` | `claims.threadId` (null for Studio test calls, which have no thread) |
| `endUserId` | `claims.subjectId` for ProjectRuntime |
| `model` / `provider` | Gemini Live model id / resolved voice provider label |
| `input` | the user's first transcript line |
| `output` | the agent's last transcript line |
| `usage` | from Gemini `usageMetadata` (see §6) |
| `metadata.voice` | `{ endReason, durationMs, turns, interruptions, voiceName }` *(new optional field)* |

---

## 3. Where each piece comes from

| Trace data | Hook point in `VoiceSession.js` |
|---|---|
| Trace start | `start()` (or the gateway, just before `session.start()`) |
| Turn step start | `_beginTurnIfNeeded()`, which already creates a `runId` per turn |
| Turn step end | `_endTurn()` |
| User said | `content.inputTranscription` → `_commitTranscript('user', …)` (final text only, never the interim captions) |
| Agent said | `_flushAgentUtterance()`, which produces one merged line per turn |
| Barge-in | `content.interrupted`: an interrupt event; the agent text is marked `metadata.partial = true` |
| Server tool | `_invokeToolCallWithTimeout(fc)`: name, args, result or error, duration; a timeout is an error |
| Browser tool | `_executeFrontendToolCall()`: result, timeout or cancelled; `metadata.frontend = true` |
| Cancellation | `_handleToolCallCancellation()`: the tool span is closed as `cancelled` |
| `end_call` | the `END_CALL_TOOL_NAME` branch: its own small tool span |
| Tokens | `message.usageMetadata` → `lastUsage` |
| Call end | `_closeSession(reason)`: end reason, duration, final status |

**Nested steps inside tools.** `_invokeToolCallWithTimeout` would pass a `TraceRecorder` in the invoke config, `tool.invoke(args, { signal, configurable, callbacks: [recorder] })`. Any LLM call or retriever inside a tool (knowledge search, for example) then shows up under that tool span, exactly as in text traces.

---

## 4. Code design

### 4.1 Backend: new and changed files

| File | Change |
|---|---|
| `traces/VoiceTraceRecorder.js` | **New.** Plain methods, not LangChain callbacks: `turnStart(runId)`, `turnEnd()`, `userSaid(text)`, `agentSaid(text, {partial})`, `interrupted()`, `toolStart(fc, {frontend, synthetic})`, `toolEnd(id, {output, error, cancelled})`, `usage(usageMetadata)`, `snapshot()` → spans + totals. Reuses `traceSerializer.serializeForTrace` (secret masking, truncation) and the 1500-span cap (`truncated`). |
| `traces/trace.service.js` | **Add** `beginVoice({ claims, agent, provider, model })` → `{ traceId, recorder, toolCallbacks(spanId), flush(), finish({status, endReason}) }`, or `null` when tracing is off or the domain is Persona. Same fail-soft, idempotent rules as `begin()`. |
| `traces/trace.repository.js` | Reuse `create` / `update` / `insertSpans`. Possibly add `upsertSpans` for spans that are re-flushed while still open (or only insert spans once they're closed; see §4.3). |
| `traces/trace.model.js` | Add an optional `metadata` (Mixed) field for voice extras. Non-breaking. |
| `traces/index.js` | Export `VoiceTraceRecorder`. |
| `voice/gateway/voiceGateway.js` | Call `traceService.beginVoice(...)` and pass `tracer` into `new VoiceSession({...})`, the same way `onTranscriptCommit` is injected. |
| `voice/gateway/VoiceSession.js` | Accept `tracer` (default `null`). Add one-line `this._trace('x', …)` calls at the §3 hook points. `_trace` wraps every call in try/catch, so **a tracing failure can never affect audio**. |

### 4.2 Module boundaries

- `voice` imports from the `traces` barrel (`../traces/index.js`) only. `traces` never imports `voice`, so there's no cycle.
- `VoiceSession` doesn't import trace code at all; it only calls the injected `tracer`, which keeps it unit-testable.

### 4.3 Writes without blocking audio

1. **At call start:** `create` the trace row (`status: running`) so it appears in the list immediately.
2. **While the call runs:** write a batch every N closed turns or about 15 s (whichever comes first). Insert the newly *closed* spans and `update` the running totals. Open spans are written only once they close, so there are no upserts. The trace page already polls every 3 s while `status === running`, so a long call fills in live.
3. **At close:** one final `finish()`. It closes open spans as cancelled, inserts the remaining spans and sets status, totals, `endedAt`, `durationMs` and `metadata.voice`.
4. Every DB call is fire-and-forget (`void …catch(log)`). None of them are awaited on the WebSocket path.
5. **Crash safety:** if the process dies mid-call, the trace stays `running`. Add a small sweep (existing cron module) that marks `running` voice traces older than max call duration + a margin as `cancelled`.

### 4.4 Status mapping

| `CLOSE_REASON` | Trace status |
|---|---|
| `AGENT_ENDED`, `CLIENT_CLOSED` | `success` |
| `UPSTREAM_ERROR` | `error` (with the error message) |
| `IDLE`, `MAX_DURATION` | `cancelled` |

Tool errors are counted in `toolErrors` and highlighted, but they don't fail the call.

---

## 5. Platform UI (small changes)

| File | Change |
|---|---|
| `components/traces/trace-utils.tsx` | `TraceRow.channel` and `metadata.voice` types; a voice icon (`PhoneIcon`). |
| `app/projects/[projectId]/traces/page.tsx` | Voice badge on rows with `channel === 'voice'`; **channel filter** (all / text / voice); the input/output columns show the first/last transcript. |
| `components/traces/trace-view.tsx` | Voice header tiles: **call duration**, **end reason**, **interruptions**, **turns**. Turn spans render with the existing tree; user/agent lines reuse `MessageCard`. |
| `components/traces/span-detail.tsx` | A barge-in interrupt span shows "User interrupted the agent" (not the HITL `InterruptView`); partial agent text gets a "cut off" badge. |
| `components/traces/trace-usage.tsx` | Split runs and tokens by channel (text vs. voice). |
| `lib/api/projects.ts` | Pass the `channel` filter. |

Backend: `traceService.list` gets a `channel` filter, and `stats` adds a `byChannel` breakdown. Both are additive and non-breaking. The `@openapi` docs in `project.routes.js` get updated to match.

---

## 6. Open questions to check during the build

1. **Token counts:** is Gemini Live `usageMetadata` a running total or per-turn? Check on a real call.
   - If it's a running total, the trace keeps the latest value and each turn span stores the difference.
   - If it's per-turn, sum the turns.
   - Also record the audio vs. text breakdown (`promptTokensDetails` / `responseTokensDetails` by modality) if present.
2. **Audio:** traces store **transcripts only**, not audio. Recording audio raises storage, privacy and consent questions, so it's out of scope for now.
3. **Studio test calls** (ProjectAdmin) have no thread. They're traced with `source: playground` and no "View thread" link.
4. **Live Studio link:** add a "View trace" link to the Studio voice test panel by emitting a `CUSTOM trace_started { traceId }` event, the same as text chat does (ProjectAdmin only).
5. **Session resumption / goAway:** if a call reconnects upstream (`_handleGoAway`), it stays the same trace.

---

## 7. Tests

- `tests/voiceTraceRecorder.test.js` covers:
  - turns, user and agent lines, partial text on barge-in
  - a tool timeout as an error
  - cancellation, frontend tools and the `end_call` span
  - the span cap and `truncated`
  - nested tool callbacks
- `tests/voiceSessionTracing.test.js` uses a fake Gemini session and fake client WS to check:
  - the full trace shape for a scripted call
  - that **the call keeps working when every tracer method throws**
  - the status mapping for each close reason
- `tests/traceService.test.js` (extended) covers:
  - `beginVoice` returns null for Persona or with tracing off
  - periodic flush batching
  - an idempotent `finish`
  - the `channel` filter and `byChannel` stats
- The existing trace and voice suites must stay green.

## 8. Docs

- `agent-backend/docs/modules/traces.md`: a "Voice calls" section (trace shape, hook points, status mapping, token caveat).
- `agent-backend/docs/modules/voice.md` (if present): a short note that calls are traced when `TRACES_ENABLED=true`.
- No new environment variables. `TRACES_ENABLED` and `TRACE_RETENTION_DAYS` cover voice too.

## 9. Build order

1. `VoiceTraceRecorder` and its unit tests.
2. `traceService.beginVoice` with flush/finish, the model `metadata` field, and service tests.
3. Wire it into `voiceGateway.js` and `VoiceSession.js`, plus the session test with a fake Gemini.
4. The `list` channel filter and `stats.byChannel`, plus the OpenAPI docs.
5. Platform: badge, filter, header tiles, interrupt view, usage split.
6. A real call in Studio: check the token semantics (§6.1) and the trace view end to end.
7. Docs.

**Size:** about 6 backend files, 5 or 6 platform files, and 3 test files.
