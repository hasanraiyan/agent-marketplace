# Voice Mode Tracing — Plan (v3: with token counting, audio recording and the research review)

> **Status (2026-11-07):** Built: backend, platform, tests and docs (build steps 2–8 and 10). Still open:
> - **Step 1/9:** a real Studio call to confirm the Gemini token format and check the recording end to end. `TRACE_DEBUG_VOICE_USAGE=true` is set in `.env` for this.
> - **Done (2026-11-07):** the WAV mix runs on reused worker threads (`mixInWorker`; up to 2 at once, the rest queue). On a 15-minute call, main-thread busy time dropped from about 960 ms to 0–5 ms.
> - **Simplification:** the Studio player fetches the file as a Blob (no signed URLs).
> **Date:** 2026-11-07
> **Changes from v1:** token counting is now a requirement, with per-response accounting and a breakdown by type (§6). Call audio is now recorded and playable in the trace view (§7).
> **Changes from v2:** merged `VOICE_MODE_TRACING_RESEARCH.md` (review in §11):
> - **Twilio phone calls** are covered (`twilio/twilioGateway.js`)
> - **time-to-first-audio** latency
> - **upstream reconnects** (goAway / session resumption)
> - a **`trace_started`** event for the Studio test panel
> - telephony metadata with the phone number masked
>
> The research's claim that token counts are cumulative and its field names were corrected (§11).
> **Builds on:** the built-in tracing module (`agent-backend/src/modules/traces/`, `platform/src/components/traces/`, `agent-backend/docs/modules/traces.md`).
> **Scope:** Project developers in `platform/` only. Persona (consumer) sessions are never traced or recorded.

---

## 1. The problem

Text-chat traces come from `TraceRecorder`, a LangChain callback handler on the LangGraph run (`agui.service.js`). Voice calls never take that path.

- A voice call is a direct WebSocket to **Gemini Live**, run by `agent-backend/src/modules/voice/gateway/VoiceSession.js`.
- Gemini handles the speech recognition, the replies and the tool-call decisions, so there's no LangGraph run to hook into.
- The only LangChain code in a call is tool execution: `tool.invoke(...)` in `_invokeToolCallWithTimeout` (`VoiceSession.js:593`).

So voice gets its own recorders, fed by `VoiceSession` events. They write into the **same `traces` / `trace_spans` collections**, which keeps the Traces page and Usage stats working with small additions.

**Three recorders:**

| Recorder | Records | Where it's stored |
|---|---|---|
| `VoiceTraceRecorder` | turns, transcripts, tools, barge-ins, end reason | `trace_spans` + `traces` |
| `VoiceUsageMeter` | every Gemini `usageMetadata` message, broken down by type (§6) | `traces.usage` + per-turn span usage |
| `VoiceAudioRecorder` | user mic audio + agent speech, kept in sync | one WAV file per call, plus `traces.audio` (§7) |

---

## 2. Trace shape

**One trace per call, with one step for each turn.**

```
📞 Voice call · GATE Prep Tutor · 3m 12s · 18.4k tokens · ▶ recording   trace (channel: voice)
├─ Turn 1                       0:00–0:21 ▶                chain span, usage = sum of this turn's responses
│   ├─ 👤 User:  "what's the syllabus for DBMS?"           human span, audio offset 0:00–0:03
│   ├─ 🔧 search_knowledge   args → result   1.2s          tool span
│   │    └─ (LLM / retriever calls inside the tool)        TraceRecorder callbacks
│   └─ 🤖 Agent: "DBMS covers ER models…"                  llm span, usage + audio offset 0:05–0:21
├─ Turn 2                       0:22–0:40 ▶
│   ├─ 👤 User:  "and how many marks…"
│   ├─ ✋ Interrupted (user cut the agent off)              interrupt span (barge-in)
│   └─ 🤖 Agent: "Usually around…"  (cut off)
├─ Turn 3
│   ├─ 🌐 show_chart (browser tool)  result | timeout | cancelled
│   └─ 📴 end_call
└─ Ended: agent_ended · 3m 12s
```

**Trace-level fields**

| Field | Value |
|---|---|
| `channel` | `'voice'` |
| `source` | `playground` (Studio test call, ProjectAdmin) / `api` (ProjectRuntime / ProjectMachine) |
| `threadId`, `endUserId` | `claims.threadId`, `claims.subjectId` |
| `model` / `provider` | Gemini Live model id / voice provider label |
| `input` / `output` | first user line / last agent line |
| `usage` | summed totals plus the by-type breakdown (§6) |
| `audio` | recording info (§7) |
| `metadata.voice` | `{ endReason, durationMs, turns, interruptions, reconnects, voiceName, imagesSent, latency: { firstAudioP50Ms, firstAudioP95Ms }, telephony? }` |
| `metadata.voice.telephony` | Twilio calls only: `{ callSid, callerPhone: '+91•••••4321' (masked, last 4 digits), channel }` |

**Entry points (both get traced):**

| Gateway | Calls | `source` |
|---|---|---|
| `voice/gateway/voiceGateway.js` | browser / SDK calls (`useVoice`), Studio test calls | `playground` (ProjectAdmin) / `api` (ProjectRuntime) |
| `twilio/twilioGateway.js` → `startVoiceSessionForTwilio` | phone calls over a Twilio Media Stream (always ProjectRuntime) | `api`, `channel` from `claims.telephony.channel` (default `'voice'`) |

Both build a `new VoiceSession(...)`, so all recording sits inside `VoiceSession`, and each gateway only adds `traceService.beginVoice(...)` and passes the `tracer` in. `TwilioVoiceTransport` converts the audio before `VoiceSession` sees it (8 kHz µ-law ↔ PCM, via `twilio/audioConverter.js`), so the audio recorder gets the same PCM 16k / 24k formats on both paths. Phone audio is 8 kHz quality upsampled to 16 kHz.

---

## 3. Where each piece comes from

| Trace data | Hook point in `VoiceSession.js` |
|---|---|
| Trace start, recording start | `start()` (the gateway creates the recorders before `session.start()`) |
| Turn start / end | `_beginTurnIfNeeded()` / `_endTurn()` (a `runId` per turn already exists) |
| User said | `content.inputTranscription`, `voice.text` messages, captions sent with `voice.image` |
| Agent said | `_flushAgentUtterance()`, one merged line per turn |
| Barge-in | `content.interrupted` (also cuts the agent audio track at that moment; §7.2) |
| Server tool | `_invokeToolCallWithTimeout(fc)`: args, result or error, duration; a timeout is an error |
| Browser tool | `_executeFrontendToolCall()`: result, timeout or cancelled |
| Cancellation | `_handleToolCallCancellation()`: the span is closed as `cancelled` |
| `end_call` | the `END_CALL_TOOL_NAME` branch |
| **Tokens** | `message.usageMetadata` (`VoiceSession.js:367`), **every message, not just the last one** |
| **User audio** | `_forwardClientAudio(buffer)` (`VoiceSession.js:984`), PCM 16 kHz |
| **Agent audio** | `content.modelTurn.parts[].inlineData` (`VoiceSession.js:383`), PCM 24 kHz |
| Images | `_handleClientImage()`: file ref on the user span when the image was persisted |
| **Time to first audio** | from `voiceActivity` `ACTIVITY_END` (`VoiceSession.js:344`), or failing that the final `inputTranscription`, to `_beginAgentAudioIfNeeded()`. Stored as `timeToFirstTokenMs` on the agent span (the existing field, so the UI shows it with no changes). p50/p95 per call go in `metadata.voice.latency`. |
| Tool latency | the tool span's duration (already captured) |
| **Upstream reconnect** | `_handleGoAway()` + `sessionResumptionUpdate` (`VoiceSession.js:307`, `:353`): a `chain` event span "Reconnected to Gemini", `reconnects += 1`. **The trace stays the same**, and the audio timeline continues. |
| Call end | `_closeSession(reason)` |

**Nested steps inside tools:** pass a `TraceRecorder` into `tool.invoke(args, { signal, configurable, callbacks: [recorder] })`, so LLM and retriever calls inside a tool appear under its span.

---

## 4. Code design

### 4.1 Backend files

| File | Change |
|---|---|
| `traces/VoiceTraceRecorder.js` | **New.** `turnStart/turnEnd`, `userSaid`, `agentSaid(text,{partial})`, `interrupted`, `toolStart/toolEnd`, `snapshot()`. Reuses `serializeForTrace` (masking, truncation) and the 1500-span cap. |
| `traces/VoiceUsageMeter.js` | **New.** §6. |
| `traces/VoiceAudioRecorder.js` | **New.** §7. Streams to temp files on disk, so memory stays flat. |
| `traces/traceAudioStore.js` | **New.** A small storage interface: `createWriteTarget`, `finalize`, `openReadStream(key, range)`, `stat`, `delete`, `sweep(olderThan)`. Starts with local disk; S3/R2 can be added later. |
| `traces/trace.service.js` | **Add** `beginVoice({ claims, agent, provider, model })` → `{ traceId, tracer, finish }`, or `null`. **Add** `getAudio(domain, traceId, range)`. `list` gets a `channel` filter; `stats` gets `byChannel` + `voice: { calls, audioMinutes, tokensByModality }`. |
| `traces/trace.repository.js` | Reuse `create/update/insertSpans`. Add `findAudioMeta(domain, traceId)`. |
| `traces/trace.model.js` | Optional `audio` sub-document, `usage.details` (§6.3) and `metadata` (Mixed). All additive. |
| `traces/trace.controller.js` | **Add** `audio` (streams the WAV with HTTP Range / 206 support). |
| `projects/project.routes.js` | **Add** `GET /api/v1/projects/{projectId}/traces/{traceId}/audio`, with `projectAdminAuthMiddleware` and `@openapi` docs. Update the list docs for `channel`. |
| `cron/` | **Add** a daily trace-audio sweep (§7.5) and a stale-`running` voice trace sweep. |
| `config/index.js` | `traces.voiceAudio` settings (§7.6). |
| `voice/gateway/voiceGateway.js` | Call `traceService.beginVoice(...)` and inject `tracer` into `new VoiceSession({...})`, the same way `onTranscriptCommit` is injected. For ProjectAdmin (Studio) calls, `VoiceSession` emits `CUSTOM trace_started { traceId }` so the voice test panel can show **"View trace"**, the same as text chat. |
| `twilio/twilioGateway.js` | The same `beginVoice(...)` call in `startVoiceSessionForTwilio`, plus `telephony` metadata (callSid, masked caller number). |
| `platform/.../voice test panel` | Read `trace_started` and show the "View trace" link (and the recording notice, §7.6). |
| `voice/gateway/VoiceSession.js` | Accept `tracer` (default `null`). Add one-line `this._trace(...)` calls at the §3 hook points. `_trace` wraps everything in try/catch, so **a tracing or recording failure can never affect the live audio**. |

`tracer` is a single object that wraps the three recorders, so `VoiceSession` holds only one dependency.

### 4.2 Module boundaries
- `voice` imports from the `traces` barrel only. `traces` never imports `voice`, so there's no cycle.
- `VoiceSession` never imports trace code; it only calls the injected `tracer`.

### 4.3 Writes without blocking audio
1. **At call start:** `create` the trace row (`status: running`, `audio.status: recording`).
2. **During the call:** every N closed turns or ~15 s, insert the newly closed spans and update totals (including the running token sum). The trace page already polls every 3 s while running.
3. **At close:** `finish()` closes open spans, writes the remaining spans, sets the final usage and status, then finalizes the audio in the background (`audio.status: processing → ready | failed`).
4. Every DB and disk write is fire-and-forget. None of them are awaited on the WebSocket path.
5. **Crash safety:** a cron sweep marks `running` voice traces older than the max call length + 5 min as `cancelled` and `audio.status: failed`, then deletes their temp files.

### 4.4 Status mapping

| `CLOSE_REASON` | Trace status |
|---|---|
| `AGENT_ENDED`, `CLIENT_CLOSED` | `success` |
| `UPSTREAM_ERROR` | `error` |
| `IDLE` (no audio for `IDLE_TIMEOUT_MS` = 60 s), `MAX_DURATION` (15 min) | `cancelled` |

Tool errors are counted in `toolErrors` and don't fail the call. A tool times out after `TOOL_CALL_TIMEOUT_MS` = **20 s** (`voice.constants.js:110`); it's then marked `error` with the timeout message.

---

## 5. Platform UI

| File | Change |
|---|---|
| `components/traces/trace-utils.tsx` | `channel`, `audio`, `usage.details` and `metadata.voice` types; a voice icon. |
| `app/projects/[projectId]/traces/page.tsx` | Voice badge; **channel filter** (all / text / voice); a 🎙 icon when a recording exists. |
| `components/traces/voice-player.tsx` | **New.** Audio player for the call (§7.4): a waveform-free scrubber with turn markers, play/pause, speed (1× / 1.5× / 2×), and a switch for user / agent / both. |
| `components/traces/trace-view.tsx` | Voice header tiles: **duration, end reason, voice name, turns · barge-ins, first-audio p50, tokens**, plus a 📞 caller tile (masked number) for phone calls. The player sits under the header. Selecting a turn or utterance span jumps the player to that offset, and a ▶ on each span plays just that segment. |
| `components/traces/span-detail.tsx` | A barge-in span shows "User interrupted the agent"; cut-off agent text gets a "cut off" badge; usage tab per turn (§6.4). |
| `components/traces/trace-usage.tsx` | Text vs. voice split; a **voice token mix** chart (audio vs. text, input vs. output) and **audio minutes**. |
| `lib/api/projects.ts` | `channel` filter; `getProjectTraceAudio(projectId, traceId)`, which fetches with auth and returns a `Blob` (§7.4). |

---

## 6. Token counting (required)

### 6.1 What Gemini sends
`LiveServerMessage.usageMetadata` (`@google/genai` `UsageMetadata`) is documented as **"usage metadata about model response(s)"**. It has:

- `promptTokenCount` / `promptTokensDetails[]` (by type: `AUDIO`, `TEXT`, `IMAGE`, `VIDEO`)
- `responseTokenCount` / `responseTokensDetails[]`
- `toolUsePromptTokenCount` / `toolUsePromptTokensDetails[]`
- `thoughtsTokenCount`
- `cachedContentTokenCount` / `cacheTokensDetails[]`
- `totalTokenCount` (= prompt + response + tool-use + thoughts)

Gemini Live processes the **whole conversation context again on every model response**, so each response's `promptTokenCount` includes all of the history. The real token use of a call is the **sum over responses**, not the last value.

**Bug in today's code:** `VoiceSession` keeps only `lastUsage` (`VoiceSession.js:368`), so `voice_session_ended.usage` reports one response's numbers rather than the call's. The meter fixes this.

### 6.2 `VoiceUsageMeter`
- `record(usageMetadata, { turnRunId, at })` runs for **every** message that carries usage.
- It keeps three things:
  - a **list of responses** (capped at 500 per call), each with the raw counts by type
  - a **total per turn**
  - a **total for the call**
- **Handling running totals.** If a usage message turns out to be a running total rather than one response's figures, store the difference from the last value instead.
  - The meter checks this from the data: within one turn, are `responseTokenCount` values non-decreasing while the prompt figure stays constant?
  - If so, those messages are running totals, and only the final one of the turn is counted.
  - Build step 1 (§10) confirms this on real calls. A unit test fixes the expected behaviour for both shapes.
- **Fix:** `VoiceSession` reports the meter's call total in `voice_session_ended.usage`. Same shape (`inputTokens`, `outputTokens`, `durationMs`), plus optional `totalTokens`. This is additive: the values become correct and nothing is renamed.

### 6.3 What gets stored

```js
usage: {
  inputTokens,          // Σ promptTokenCount + toolUsePromptTokenCount
  outputTokens,         // Σ responseTokenCount + thoughtsTokenCount
  totalTokens,          // Σ totalTokenCount
  details: {            // new, optional, voice only for now
    input:  { audio, text, image, video },
    output: { audio, text },
    toolUse, thoughts, cached,
    responses           // number of usage messages counted
  }
}
```

- **Turn spans** get `usage` for their own turn.
- The **agent-utterance (`llm`) span** gets the usage of the response that produced it.
- Existing text-trace `usage` fields are unchanged, so the Usage tab's totals and p50/p95 keep working.

### 6.4 UI
- **Header:** a tokens tile with a popover breakdown (Audio in / Text in / Image in / Audio out / Text out / Tool use / Cached).
- **Span detail:** a turn shows "this turn: 3.2k in (2.9k audio), 410 out (380 audio)".
- **Usage tab:** voice tokens by type over time, plus average tokens per minute of call.

---

## 7. Audio recording

### 7.1 What is recorded
- **User track:** the exact PCM the client sends to Gemini (`_forwardClientAudio`), 16 kHz mono s16le.
- **Agent track:** the exact PCM Gemini sends back (`modelTurn.parts[].inlineData`), 24 kHz mono s16le.
- **Output:** one **stereo WAV per call**, with the user on the left channel and the agent on the right, kept in sync on one timeline. The agent track is resampled to 16 kHz.
- **Size:** about **3.75 MB per minute**. The max call is 15 min (`DEFAULT_MAX_DURATION_MS`), so the worst case is about **56 MB**.
- **Phase 2 (§7.7):** compress to Opus/MP3, about 0.2–0.5 MB per minute.

### 7.2 Keeping the two tracks in sync

The tracks arrive differently. The mic streams in real time, while Gemini sends agent audio **in bursts, faster than real time**. The client buffers it and plays it out, and on barge-in it **throws away** whatever hasn't played yet. The recording has to match what the people on the call actually heard.

- **Timeline:** milliseconds since the call started (`startedAt`).
- **User track:**
  - Each chunk is written at its arrival time.
  - If the arrival time is more than 200 ms past the end of what's already written (mic muted, network gap), silence is inserted first.
  - The track never runs ahead of real time.
- **Agent track:** a **playback cursor** model.
  - When a chunk arrives, it's queued at `max(cursor, now)`, and `cursor` moves forward by the chunk's length.
  - Queued audio is kept in memory only until real time catches up with it, then written to disk. That's bounded to about one utterance, a few MB at most.
  - **On `content.interrupted`:** queued audio past `now` is dropped (the listener never heard it), and the cursor resets to `now`. This matches the client flushing its playback buffer (`voice_interrupted`).
- Both tracks are written as raw PCM to **two temp files** (`<traceId>.user.pcm`, `<traceId>.agent.pcm`) using append streams, so memory stays flat however long the call runs.
- **Span offsets:** each user and agent span stores `metadata.audio = { startMs, endMs }` from the same timeline. The UI uses these to play a single segment.

### 7.3 Finalizing (after the call, in the background)
1. Close both PCM streams.
2. Resample the agent track 24k → 16k with linear interpolation (good enough for speech).
3. Interleave L/R into `<traceId>.wav`, writing the 44-byte header first, in chunks via streams.
4. Delete the temp files.
5. Update the trace: `audio: { status: 'ready', storageKey, mimeType: 'audio/wav', durationMs, bytes, sampleRate: 16000, channels: { left: 'user', right: 'agent' } }`.
6. This runs **off the WebSocket path** in a `worker_threads` worker, so the event loop never blocks during a 15-minute mix.
7. If anything fails, the trace is set to `audio.status: 'failed'` with the error. The trace itself is unaffected.

### 7.4 Playback
- **Endpoint:** `GET /api/v1/projects/{projectId}/traces/{traceId}/audio`.
  - Project admin only, and the trace must belong to that project (same 404 rules as `get`).
  - Streams the WAV with **HTTP Range / 206** support so seeking works.
  - Returns `404` if there's no recording, and `409` with `{ status }` while it's still `recording` or `processing`.
- **Platform:** the API needs a Clerk bearer token, and a plain `<audio src>` can't send one.
  - **v1:** `getProjectTraceAudio` fetches the file with auth, turns it into a `Blob`, and plays it from an object URL. That's at most ~56 MB, fine for a dashboard.
  - **Later, if needed:** a short-lived HMAC-signed URL (same signing approach as OAuth state) so the browser can stream and seek directly.
- **Player:** turn markers on the scrubber; clicking a span seeks to it; a user / agent / both switch (the Web Audio `ChannelSplitter` mutes one side).

### 7.5 Storage and retention
- **Storage:** local disk under `TRACE_AUDIO_DIR` (default `<cwd>/trace-audio`), the same approach as `developer-uploads/` (`files/file.service.js:19`), behind the `traceAudioStore` interface.
- **Decision (2026-11-07):** start with **local disk only**. S3/R2 comes after all voice-tracing features are built, as a second `traceAudioStore` backend that touches nothing else.
- **Deployment warning:** if the host's disk is wiped on redeploy, recordings are lost. Mount a persistent volume, or add the S3/R2 option to `traceAudioStore` (§7.7).
- **Retention:** MongoDB's TTL removes trace documents but not files, so a daily cron sweep:
  - deletes `trace-audio/*.wav` older than `TRACE_RETENTION_DAYS`
  - deletes orphaned files whose trace no longer exists
  - deletes stale temp `.pcm` files older than 1 day
- **Cleanup on removal:** deleting an agent or project triggers a best-effort cleanup of its recordings through `traceService` (if those delete flows exist).

### 7.6 Settings, privacy and consent

| Env var | Default | Meaning |
|---|---|---|
| `TRACE_VOICE_AUDIO` | `false` | Turn on call recording. Needs `TRACES_ENABLED=true`. |
| `TRACE_AUDIO_DIR` | `./trace-audio` | Where recordings are stored. |
| `TRACE_AUDIO_MAX_MINUTES` | `15` | Stop recording past this length; the trace continues and is marked `audio.truncated`. |

- Recording is **off by default** because it captures end users' voices. We'll enable it in your `agent-backend/.env`.
- **Notice to the client:** when recording is on, the session emits a new `CUSTOM voice_recording { enabled: true }` event at connect, so a client app can show "This call may be recorded". Studio's voice test panel shows it.
- Developers using `ProjectRuntime` are responsible for telling their own end users. This goes in `docs/modules/traces.md` and the SDK voice docs.
- Persona sessions are never recorded (the same `isEnabledFor` rule as text).
- Recordings are visible only to project admins, through the authenticated endpoint. The files aren't publicly served.

### 7.7 Phase 2 (not in the first build)
- Compression: Opus (ffmpeg if available) or MP3 (`lamejs` in the worker) for ~10× smaller files.
- S3/R2 storage for `traceAudioStore`.
- A waveform display; transcript text highlighted in sync with playback.
- A per-agent setting to turn recording on or off, on top of the environment flag.

---

## 8. Tests

- **`tests/voiceTraceRecorder.test.js`:**
  - turns, transcripts and barge-in
  - a tool timeout, cancellation, frontend tools and `end_call`
  - the span cap and nested tool callbacks
- **`tests/voiceUsageMeter.test.js`:**
  - summing per response and the breakdown by type
  - **running-total detection** (both shapes)
  - per-turn attribution and the 500-response cap
- **`tests/voiceAudioRecorder.test.js`** (fake clock):
  - silence padding for user-track gaps
  - the agent playback cursor, and **barge-in dropping unplayed audio**
  - span offsets and the `maxMinutes` cap
  - a WAV header that's correct for size and stereo layout
  - resampling the length 24k → 16k
- **`tests/voiceSessionTracing.test.js`** (fake Gemini session and WS):
  - the full trace shape
  - time-to-first-audio measured from `ACTIVITY_END`
  - a goAway reconnect keeps the same trace and the audio timeline continues
  - `trace_started` is emitted for ProjectAdmin only
  - `voice_session_ended.usage` now reports the summed total
  - **the call keeps working when every tracer method throws**
  - the status mapping per close reason
- **`tests/twilioGatewayTracing.test.js`:**
  - a phone call creates a voice trace with `source: api`, `callSid`, and a **masked** caller number (the full number is never stored)
- **`tests/traceAudio.controller.test.js`:**
  - Range/206, 404 for another project or no audio, 409 while processing
- **`tests/traceService.test.js`** (extended):
  - `beginVoice` returns null for Persona or when tracing/recording is off
  - flush batching
  - the `channel` filter and `byChannel` / voice stats
  - the audio sweep
- Existing trace and voice suites must stay green.

## 9. Docs
- `agent-backend/docs/modules/traces.md`: a "Voice calls" section covering the trace shape, token accounting, recording, consent and retention.
- `docs/operations/environment-variables.md`: `TRACE_VOICE_AUDIO`, `TRACE_AUDIO_DIR`, `TRACE_AUDIO_MAX_MINUTES`.
- SDK voice docs: the `voice_recording` event and the corrected `voice_session_ended.usage`.

## 10. Build order
1. **Check the token format.** Add a temporary debug log of every raw `usageMetadata` during a real Studio call, and confirm whether values are per-response or running totals and which type breakdowns are present. Fix the meter's detection and its tests to match. Remove the log.
2. `VoiceUsageMeter` and tests. Fix `voice_session_ended.usage`.
3. `VoiceTraceRecorder` + `traceService.beginVoice` + model fields + tests.
4. Wire `tracer` into `voiceGateway.js` / `VoiceSession.js` (including time-to-first-audio, reconnects and `trace_started`), plus the fake-Gemini session test. Then wire `twilioGateway.js` and its test.
5. `VoiceAudioRecorder` + `traceAudioStore` + the finalize worker + tests.
6. The audio endpoint (Range) + OpenAPI docs + the sweep cron + the `voice_recording` event.
7. The `list` channel filter and `stats.byChannel` / voice stats.
8. Platform: badge and filter, header tiles, token breakdown, voice player, segment playback, usage charts.
9. **Real call end to end** in Studio: check the tokens against Google AI Studio usage, that the recording is in sync after a barge-in, and that seeking works.
10. Docs, and `TRACE_VOICE_AUDIO=true` in `agent-backend/.env`.

**Size:** about 12 backend files (6 new), 8 platform files (1 new) and 7 test files.

---

## 11. Review of `VOICE_MODE_TRACING_RESEARCH.md`

I checked the research against the code. Here's what was adopted and what was corrected.

### Adopted (now in this plan)
| From the research | Where |
|---|---|
| Twilio phone calls through `twilioGateway.js` | §2 entry points, §4.1, tests |
| Telephony metadata (`callSid`, caller phone) | §2. **The phone number is masked** to the last 4 digits; the full number is never stored, because it's personal data. |
| Time to first audio per turn | §3, header tile, `timeToFirstTokenMs` on agent spans |
| Reconnect count (goAway / resumption) | §3; the call keeps one trace |
| `trace_started` for Studio "View trace" | §4.1 (was an open question in v1) |
| `voice.text` typed input and image captions as user spans | §3 |
| A `_trace(fn)` guard, in-memory spans, fire-and-forget writes, 1500-span cap, periodic flush | §4.1, §4.3 (already matched) |
| Reusing existing span kinds (`chain`/`human`/`llm`/`tool`/`interrupt`) with no enum change | §2 (already matched) |

### Corrected
| Research says | Code shows | Effect on the plan |
|---|---|---|
| "`usageMetadata` is **cumulative across the session**", so keep the last value and take differences per turn | Not verified anywhere in the repo. The `@google/genai` typings describe it as *"usage metadata about model response(s)"*, i.e. per response. Today's code keeps only the last value, which is exactly what undercounts if it's per-response. | The meter **supports both** and detects which one it's getting; **build step 1 checks this on a real call** before we rely on it (§6.2). We don't assume either way. |
| Output field `candidatesTokenCount` | Gemini Live `UsageMetadata` has **`responseTokenCount`** (+ `responseTokensDetails`). It also has `toolUsePromptTokenCount`, `thoughtsTokenCount` and `cachedContentTokenCount`, which the research doesn't list. | §6.1 / §6.3 use the real field names and count every field. |
| Tool timeout `TOOL_CALL_TIMEOUT_MS` = 10 s | `voice.constants.js:110` = **20 s** | §4.4 |
| `twilioGateway.js` under `voice/gateway/` | It lives in **`modules/twilio/twilioGateway.js`** (imports `VoiceSession` directly) | §2, §4.1 |
| "Raw PCM is **never** passed to the tracer" | That conflicted with the new audio recording requirement | Still true for **spans**: no audio goes into MongoDB. PCM goes only to the separate `VoiceAudioRecorder` → WAV file (§7). |
| No audio capture; token accounting is optional | You asked for both | §6 and §7 |
| `endUserId` = Persona User ID for Studio tests | Studio tests are ProjectAdmin, not Persona users; Persona sessions are never traced | §2 `source` / `endUserId` rules |
