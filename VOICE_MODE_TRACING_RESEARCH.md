# Research & Architecture Plan: Voice-Mode Tracing in Persona

> **Status:** Research & Proposed Technical Specification  
> **Target Modules:** `agent-backend/src/modules/voice/`, `agent-backend/src/modules/traces/`, `platform/`  
> **Key Entry Points:** `VoiceSession.js`, `voiceGateway.js`, `twilioGateway.js`, `trace.service.js`, `TraceRecorder.js`, `trace.model.js`, `traceSpan.model.js`  
> **Date:** November 2026  

---

## 1. Executive Summary & Context

In the Persona platform, agent interactions on the Developer Platform are recorded into the **Traces** system (`Trace` and `TraceSpan` collections in MongoDB), powering the LangSmith/Phoenix-style execution viewer on the platform dashboard (`platform/src/app/projects/[projectId]/traces`).

### The Current Architectural Gap
- **Text Chat:** Tracing runs via `traceService.begin()` in `agui.service.js`, attaching a `TraceRecorder` (a LangChain `BaseCallbackHandler`) to LangGraph's `streamEvents`. Every LLM generation, tool execution, retriever query, and subagent handoff is captured via callbacks.
- **Voice Calls:** As observed in `agent-backend/src/modules/voice/gateway/VoiceSession.js`, voice calls **do not go through LangGraph or LangChain execution graphs**. Instead:
  1. Voice runs over a direct bidirectional WebSocket bridge between the client (browser or Twilio Telephony Stream) and **Gemini Live API** (`connectGeminiLive` in `geminiLiveClient.js`).
  2. Gemini Live handles native audio ingestion, VAD (Voice Activity Detection), STT (speech-to-text), LLM reasoning, TTS (text-to-speech audio streaming), and function-calling decisions on its server.
  3. The only LangChain code executed during a call is `tool.invoke(...)` when `VoiceSession` executes a tool call returned by Gemini (`VoiceSession.js:593`).
  4. Consequently, `agent-backend/docs/modules/traces.md` explicitly notes:
     > *"Not yet traced: workflow runs... and Gemini Live voice sessions (`VoiceSession.js` calls tools outside LangChain callbacks)."*

This document provides complete research on **what can be traced from voice sessions**, **how to record it without blocking real-time audio**, and **how to structure and surface voice traces** in this repository.

---

## 2. What Can We Trace in Voice Mode?

Through a comprehensive audit of `VoiceSession.js`, `voiceGateway.js`, `twilioGateway.js`, `geminiLiveClient.js`, `voiceImage.js`, and `voiceThread.service.js`, we can capture rich, end-to-end telemetry across five core dimensions:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           Voice Telemetry Spectrum                            │
├──────────────────┬──────────────────┬────────────────────┬────────────────────┤
│  Session / Call  │  Conversational  │  Tool Executions   │  Tokens & Modality │
│    Lifecycle     │    Turns & VAD   │  (Sync & Async)    │       Usage        │
├──────────────────┼──────────────────┼────────────────────┼────────────────────┤
│ • Call duration  │ • Turn sequences │ • Server tools     │ • Input tokens     │
│ • End reason     │ • User speech    │ • Frontend tools   │ • Output tokens    │
│ • Model & Voice  │ • Agent speech   │ • Synthetic tools  │ • Audio vs text    │
│ • Resumption     │ • Barge-in       │ • Arguments & I/O  │ • Per-turn delta   │
│ • Telephony data │ • Images & text  │ • Timeouts/Errors  │ • Cumulative usage │
└──────────────────┴──────────────────┴────────────────────┴────────────────────┘
```

### 2.1 Call & Session Metadata (`Trace` Level)

| Attribute | Source in Code | Description |
|---|---|---|
| **`traceId`** | `traceRepository.newId()` | Unique MongoDB ObjectId for the call trace. |
| **`domain`** | `claims.domain` | Project ID (tenant boundary). Only Project calls are traced; consumer runs are skipped. |
| **`agentId` / `agentName`** | `claims.agentId`, `agent.name` | Target agent executing the voice persona. |
| **`threadId`** | `claims.threadId` | Persistent thread ID (or `null`/`voice-test-*` for Studio ephemeral test calls). |
| **`channel`** | `'voice'` | Distinguishes voice calls from `'web'`, `'sms'`, etc. |
| **`source`** | `claims.principalType` | `'playground'` for Developer Studio test calls, `'api'` for ProjectRuntime / Telephony. |
| **`endUserId`** | `claims.subjectId` | External user ID (API/Telephony) or Persona User ID (Studio test). |
| **`model` / `provider`** | `this.model`, `provider.label` | e.g. `gemini-2.0-flash-exp` / `gemini-2.5-flash` under Gemini provider. |
| **`input`** | `inputTranscription.text` | Transcribed text of the **first user utterance** (gives a quick overview in lists). |
| **`output`** | `outputTranscription.text` | Transcribed text of the **final agent utterance**. |
| **`durationMs`** | `Date.now() - this.startedAt` | Total call duration in milliseconds. |
| **`status`** | Call outcome mapping | `'success'`, `'error'`, or `'cancelled'` (see status mapping below). |
| **`metadata.voice`** | Voice-specific extras | `{ voiceName, endReason, turnsCount, interruptionsCount, reconnectsCount, telephony: { callSid, callerPhone } }`. |

### 2.2 Turn-Level Telemetry (`TraceSpan` - Chain / Human / LLM Spans)

Gemini Live structures speech in conversational turns, coordinated in `VoiceSession.js` via `this.turnSeq`, `_beginTurnIfNeeded()`, and `_endTurn()`:

1. **User Turn Spans (`kind: 'human'`):**
   - **Spoken Audio:** Final transcript committed by `_commitTranscript('user', text)` from `content.inputTranscription.text`. (Interim partial transcriptions are ignored to prevent database spam).
   - **Direct Text Input:** When the user types while in a voice call (`voice.text` event).
   - **Multimodal Visual Inputs:** Image frames sent by the user (`voice.image` event handled by `_handleClientImage`). Records image dimensions, MIME type, caption, and attachment `fileId` if persisted.
2. **Agent Utterance Spans (`kind: 'llm'`):**
   - **Accumulated Speech Transcript:** Merged via `mergeTranscriptText` and finalized at `turnComplete` or barge-in by `_flushAgentUtterance()`.
   - **Voice Latency (TTFT / Time to First Audio):** Time from user finishing speaking (`ACTIVITY_END` or `inputTranscription`) to the first audio packet sent (`_beginAgentAudioIfNeeded()`).
   - **Generation Status:** Marked `success` or `interrupted` (barge-in).
3. **Barge-in / Interruption Events (`kind: 'interrupt'`):**
   - Detected by Gemini's server-side VAD when `content.interrupted === true`.
   - Records the exact cutoff point, flags the agent utterance as `metadata.partial = true`, and increments `interruptionsCount`.

### 2.3 Tool Calls (`TraceSpan` - Tool Spans)

`VoiceSession` handles three classes of tools, all interceptable:

1. **Server-Side LangChain Tools (`_invokeToolCallWithTimeout`):**
   - **Captured Data:** `toolName`, `toolCallId`, serialized input arguments `fc.args`, parsed execution output, duration in ms, and error message if failed.
   - **Timeouts:** Timed out after `TOOL_CALL_TIMEOUT_MS` (10s), marked as `status: 'error'`.
   - **Cancellations:** If Gemini sends `toolCallCancellation`, marked as `status: 'cancelled'`.
   - **Sub-spans inside tools:** If a tool internally calls an LLM or vector search (e.g., Knowledge Base retriever), passing a child `TraceRecorder` in `tool.invoke(args, { callbacks: [...] })` will capture nested spans under the tool!
2. **Client / Frontend Tools (`_executeFrontendToolCall`):**
   - For tools executed by the user's browser (e.g. `show_chart`, `request_user_location`).
   - Records args delegated via `voice_frontend_tool_call`, and results returned via `voice.tool_result` / `voice_frontend_tool_result`.
   - Tagged with `metadata.frontend: true`.
3. **Synthetic Voice Control Tools:**
   - `end_call` (`END_CALL_TOOL_NAME`): When the model decides to hang up the call, captured as a tool span with `metadata.synthetic: true`.

### 2.4 Token Usage (`usageMetadata`)

Gemini Live delivers usage metadata in `message.usageMetadata`:
- `promptTokenCount` (Input tokens: audio + text + system instructions + context).
- `candidatesTokenCount` (Output tokens: generated speech + text).
- `totalTokenCount`.
- Modality breakdown (if returned: audio tokens vs. text tokens).

> **Token Metric Behavior in Gemini Live:**
> In Gemini Live bidirectional WebSockets, `usageMetadata` is **cumulative across the session**.
> - The trace-level `usage` captures the latest `usageMetadata` snapshot at session close.
> - Individual turns calculate delta tokens: $\Delta = \text{usage}_{turn\_n} - \text{usage}_{turn\_n-1}$.

---

## 3. High-Level Architecture & Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Call Flow Architecture                         │
│                                                                             │
│  Browser / Twilio                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  voiceGateway / twilioGateway                                               │
│         │                                                                   │
│         ├─► traceService.beginVoice({ claims, agent, model, provider })     │
│         │         │                                                         │
│         │         ▼                                                         │
│         │    Creates Trace (status: 'running', channel: 'voice')            │
│         │    Returns { tracer, finish, flush }                              │
│         │                                                                   │
│         ▼                                                                   │
│  VoiceSession(..., tracer) ◄── Injected tracer instance                     │
│         │                                                                   │
│         ├── on User Speech    ──► tracer.recordUserTurn(...)                │
│         ├── on Tool Invocation──► tracer.recordToolStart(...)               │
│         │                     ──► tracer.recordToolEnd(...)                 │
│         ├── on Agent Utterance──► tracer.recordAgentTurn(...)               │
│         ├── on Barge-in       ──► tracer.recordInterrupt(...)               │
│         ├── on Usage Metadata ──► tracer.recordUsage(...)                   │
│         │                                                                   │
│         ▼                                                                   │
│  _closeSession(reason)                                                      │
│         │                                                                   │
│         └─► tracer.finish({ status, reason, error })                        │
│                   │                                                         │
│                   ▼                                                         │
│              traceRepository.insertSpans(allSpans)                          │
│              traceRepository.update(traceId, { status, usage, durationMs }) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 One Trace Per Call vs. One Trace Per Turn

| Consideration | One Trace Per Turn | One Trace Per Call (Recommended) |
|---|---|---|
| **Trace List UX** | A 5-minute call with 20 turns creates 20 disjointed rows in the Traces table. | Clean, single row for the entire call with total duration, cost, and end reason. |
| **Context & Continuity**| Difficult to calculate total call duration, total tokens, or see where tools were used across the conversation. | Full call timeline visible in the span tree, matching how telephony and voice observability works. |
| **Token Attribution** | Gemini Live reports tokens cumulatively for the whole session. | Natural 1:1 mapping with Gemini's session token counter. |
| **Thread Connection** | Requires navigating by `?threadId=`. | All turns of the call are immediately visible in one tree. |

**Decision:** **One Trace per call**, containing a tree of turns and tool calls.

---

## 4. Trace & Span Tree Organization

In `platform/src/components/traces/trace-view.tsx`, the tree is assembled via `buildTree(spans)` where root spans have `parentSpanId: null`.

We organize the hierarchy as follows:

```
📞 Voice Call: "Customer Support Agent" (channel: 'voice', status: 'success', 3m 42s)
│
├── 📂 Turn 1 (kind: 'chain', name: 'Turn 1', durationMs: 2450)
│    ├── 👤 User: "Can you check my reservation status?" (kind: 'human')
│    ├── 🔧 lookup_booking (kind: 'tool', args: { ref: 'BK-991' }, durationMs: 620)
│    └── 🤖 Agent Utterance (kind: 'llm', TTFT: 480ms, durationMs: 1830)
│
├── 📂 Turn 2 (kind: 'chain', name: 'Turn 2', durationMs: 3100)
│    ├── 👤 User: "Actually, change the date to tomorrow" (kind: 'human')
│    ├── ✋ Barge-in (kind: 'interrupt', name: 'User Barge-in', metadata: { cutOffAtMs: 850 })
│    ├── 🤖 Agent Utterance [Interrupted] (kind: 'llm', metadata: { partial: true })
│    └── 🔧 modify_booking (kind: 'tool', args: { date: '2026-11-08' })
│
└── 📂 Turn 3 (kind: 'chain', name: 'Turn 3', durationMs: 1200)
     ├── 👤 User: "Thanks, that's all!" (kind: 'human')
     ├── 🤖 Agent Utterance: "You're all set. Have a wonderful day!" (kind: 'llm')
     └── 📴 end_call (kind: 'tool', metadata: { synthetic: true })
```

### Span Kinds Utilized

Existing kinds from `SPAN_KIND` in `traceSpan.model.js` are reused directly without modifying schema enums:
- `chain`: Used for Turn containers (`Turn 1`, `Turn 2`).
- `human`: Used for User spoken speech, direct text, or visual image input.
- `llm`: Used for Agent spoken utterances (includes time-to-first-token/audio and transcript).
- `tool`: Used for server tools, client/frontend tools, and synthetic tools (`end_call`).
- `interrupt`: Used for user barge-in events cutting off the assistant.

---

## 5. Non-Blocking Audio Guarantee (NFR Compliance)

Voice applications require strict sub-second audio deadlines (typically <300ms audio packet intervals). **Database latency or network retries must never delay an audio packet.**

### Guardrails:
1. **Pure In-Memory Recording:** `VoiceTraceRecorder` buffers all span objects in memory (plain JavaScript objects). No database operations occur inside audio/transcription loops.
2. **Fire-and-Forget Persistence:** DB writes (`traceRepository.create`, `insertSpans`, `update`) are executed asynchronously and never awaited on the WebSocket thread (`Promise.resolve(...).catch(err => logger.warn(...))`).
3. **Defensive Error Isolation:** In `VoiceSession.js`, all telemetry calls to the tracer are guarded:
   ```javascript
   _trace(fn) {
     if (!this.tracer) return;
     try {
       fn(this.tracer);
     } catch (err) {
       logger.warn('[VoiceTrace] tracer error ignored', { err: err?.message });
     }
   }
   ```
   Even if the tracing system throws an exception, the voice session continues completely unaffected.
4. **Data Sanitization & Audio Stripping:**
   - Raw binary audio buffers (PCM) are **never** passed to the tracer.
   - Text transcripts and tool payloads are processed via `serializeForTrace` (`traceSerializer.js`), which masks API keys, secrets, auth headers, and truncates payloads over length limits.
5. **Span Truncation Cap:** The recorder enforces a maximum cap of 1,500 spans per call (`truncated: true`), safeguarding MongoDB against runaway sessions.

---

## 6. Real-Time Trace Viewing for Long Calls

A voice call can run for up to 15 minutes (`DEFAULT_MAX_DURATION_MS = 900000`). If traces are only persisted when the call terminates:
- An admin checking the Traces page during an ongoing 10-minute call would see an empty "running" trace with no steps.
- If the server process crashes or restarts during a call, all in-flight spans would be lost.

### The Periodic Flush Mechanism
1. **On Session Start:** `traceRepository.create(...)` creates the trace document (`status: 'running'`).
2. **During the Call:** When a turn completes (`turnComplete`), or every 15 seconds, closed turn spans are flushed in an async background batch to `traceRepository.insertSpans(...)`, updating `spanCount` and current token usage on `Trace`.
3. **On Session End:** `finish()` flushes any remaining spans and marks `status: 'success'` (or `'error'` / `'cancelled'`).

---

## 7. Lifecycle Hook Points in `VoiceSession.js`

| Event | `VoiceSession.js` Hook Point | Tracer Action |
|---|---|---|
| **Call Starts** | `start()` | Records session start timestamp, initializes root metadata. |
| **Turn Starts** | `_beginTurnIfNeeded()` | Starts turn span (`turnSeq`, `runId`). |
| **User Speaks** | `content.inputTranscription.text` | Records user transcript span (`kind: 'human'`). |
| **User Sends Text** | `_handleClientMessage` (`case 'voice.text'`) | Records user text span (`kind: 'human'`). |
| **User Sends Image** | `_handleClientImage` | Records user image span with ref & MIME type. |
| **First Audio Packet** | `_beginAgentAudioIfNeeded()` | Records time-to-first-audio latency for current turn. |
| **Agent Utterance** | `_flushAgentUtterance()` | Records agent transcript span (`kind: 'llm'`). |
| **Barge-in** | `content.interrupted` | Records `interrupt` span, marks agent turn `partial: true`. |
| **Tool Requested** | `_invokeToolCallWithTimeout(fc)` | Records tool start (`toolCallId`, `name`, `args`). |
| **Tool Completes** | `_invokeToolCallWithTimeout` return | Records tool output, execution duration, status. |
| **Frontend Tool** | `_executeFrontendToolCall(fc)` | Records client delegation and result (`frontend: true`). |
| **Tool Cancelled** | `_handleToolCallCancellation()` | Marks tool span as `cancelled`. |
| **Token Update** | `message.usageMetadata` | Updates running token counts. |
| **Turn Completes** | `_endTurn()` | Closes turn span container, flushes closed spans. |
| **Call Closes** | `_closeSession(reason)` | Maps status, calculates final duration, commits final trace. |

### Status Mapping on Call Close

| `CLOSE_REASON` in `VoiceSession` | Final `Trace.status` | Description |
|---|---|---|
| `AGENT_ENDED` | `TRACE_STATUS.SUCCESS` | Agent invoked `end_call` tool after conversation concluded. |
| `CLIENT_CLOSED` | `TRACE_STATUS.SUCCESS` | User hung up / closed browser connection cleanly. |
| `IDLE` | `TRACE_STATUS.CANCELLED` | Call timed out due to no audio activity (`IDLE_TIMEOUT_MS = 60s`). |
| `MAX_DURATION` | `TRACE_STATUS.CANCELLED` | Call reached maximum duration limit (15m). |
| `UPSTREAM_ERROR` | `TRACE_STATUS.ERROR` | Gemini Live WebSocket disconnected or errored without resumption. |

---

## 8. Proposed Code Implementation Plan

### 8.1 Backend Changes

1. **`agent-backend/src/modules/traces/VoiceTraceRecorder.js` (NEW)**
   - Plain ES Module class managing turn hierarchy, span creation, serialization via `traceSerializer.js`, span ID generation (`crypto.randomUUID()`), and rollup stats.
   - Methods:
     - `startTurn(runId)`
     - `endTurn()`
     - `recordUserUtterance(text, { attachments, isTextChunk })`
     - `recordAgentAudioStart()`
     - `recordAgentUtterance(text, { partial })`
     - `recordInterruption()`
     - `recordToolStart(fc, { frontend, synthetic })`
     - `recordToolEnd(id, { output, error, cancelled })`
     - `recordUsage(usageMetadata)`
     - `snapshot()` -> `{ spans, totals, usage }`
2. **`agent-backend/src/modules/traces/trace.service.js` (MODIFY)**
   - Add `beginVoice({ claims, agent, provider, model })` returning `{ traceId, tracer, finish }`.
   - Reuses `this.isEnabledFor(context)` to verify `domain !== PERSONA_DOMAIN` and `TRACES_ENABLED`.
3. **`agent-backend/src/modules/traces/trace.model.js` (MODIFY)**
   - Add `metadata: { type: mongoose.Schema.Types.Mixed, default: {} }` to schema to persist `metadata.voice` without breaking existing schemas.
4. **`agent-backend/src/modules/voice/gateway/VoiceSession.js` (MODIFY)**
   - Accept optional `tracer` in constructor.
   - Add safe calls to `tracer` at the lifecycle points identified in Section 7.
5. **`agent-backend/src/modules/voice/gateway/voiceGateway.js` & `twilioGateway.js` (MODIFY)**
   - Call `traceService.beginVoice(...)` upon successful ticket validation and pass `tracer` into `new VoiceSession(...)`.
   - In `voiceGateway.js`, for `ProjectAdmin` sessions, emit a `CUSTOM` event `trace_started` (`{ traceId }`) so the Studio UI can display a "View Trace" button.

### 8.2 Frontend & Platform Changes

1. **`platform/src/components/traces/trace-utils.tsx`**
   - Add `'voice'` channel badge and `PhoneIcon` indicator.
   - Support `metadata.voice` in `TraceRow`.
2. **`platform/src/app/projects/[projectId]/traces/page.tsx`**
   - Add a Channel filter dropdown (`All Channels`, `Web`, `Voice`).
   - Render a phone badge on voice calls.
3. **`platform/src/components/traces/trace-view.tsx`**
   - For voice traces, show voice summary cards in header:
     - **Call Duration** (e.g. `3m 24s`)
     - **Voice Name** (e.g. `Puck`)
     - **Turns & Interruptions** (e.g. `5 turns · 1 barge-in`)
     - **End Reason** (`Agent ended`, `User hangup`, `Idle timeout`)
4. **`platform/src/components/traces/span-detail.tsx`**
   - For `interrupt` spans on voice, display a dedicated "User Barge-in" banner explaining that the user interrupted the agent's response.

---

## 9. Verification & Testing Strategy

1. **Unit Tests (`agent-backend/tests/voiceTraceRecorder.test.js`):**
   - Verify span tree generation for normal multi-turn calls.
   - Verify tool tracking (success, error, timeout, frontend delegation).
   - Verify barge-in and partial agent output handling.
   - Verify payload truncation and secret masking.
2. **Integration Tests (`agent-backend/tests/voiceSessionTracing.test.js`):**
   - Mock Gemini Live session and client WebSocket.
   - Verify trace and span records created in DB for simulated call.
   - Test resiliency: verify voice audio flows normally even if tracer methods throw errors.
3. **Regression Testing:**
   - Run existing text trace test suite (`pnpm test agent-backend/tests/trace*.test.js`).
   - Run existing voice test suite (`pnpm test agent-backend/tests/voice*.test.js`).

---

## 10. Summary & Recommendation

The proposed design:
- Adheres strictly to repository architectural guidelines (`AGENTS.md`).
- Keeps voice audio on an unblocked, zero-latency execution path.
- Reuses existing `traces` and `tracespans` collections without schema breaks.
- Provides immediate observability for both Developer Studio browser test calls and production Twilio phone calls.
- Fits natively into the existing Next.js trace viewer with minimal UI extensions.
