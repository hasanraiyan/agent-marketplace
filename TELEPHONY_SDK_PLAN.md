# SDK-Owned Telephony Channels — Research & Plan

> **Goal:** a developer keeps their own Twilio number and webhook. Twilio calls *their* backend, they resolve
> the phone number to *their* user id, call Persona through the SDK, and Persona runs the agent — voice call
> audio included. This replaces "Persona owns the Twilio number + webhook" for anyone who wants it, without
> breaking projects that already point their number at Persona.
>
> **Status:** plan only, no code yet. Date: October 2026.

---

## 1. The flow you described

```
WhatsApp message / inbound call
        │
        ▼
Developer's Twilio number  (developer's own Twilio account)
        │  POST form-urlencoded + X-Twilio-Signature
        ▼
Developer's backend  /api/persona/channels/twilio/voice  ·  /message
        │  1. verify Twilio signature (their auth token, their env)
        │  2. resolveUser({ from: "+91…", channel })  →  { externalUserId: "user_2ab…" }
        │  3. Persona SDK call (Project credential, server-side only)
        ▼
Persona platform
        │  voice  → mint single-use telephony ticket, return wss:// stream URL
        │  message→ run the agent turn for that user, return the reply text
        ▼
Twilio  ──►  media stream WS  ──►  Persona VoiceSession  ──►  Gemini Live
```

The important part: **audio never relays through the developer's server.** Their webhook is a fast HTTP
request that resolves identity and returns TwiML; Twilio then opens the media WebSocket straight to Persona.
That keeps voice working on serverless hosts and keeps the developer's Twilio credentials out of Persona.

---

## 2. What exists today (research findings)

### 2.1 `agent-backend/`

| Piece | Status |
| --- | --- |
| `voice/gateway/VoiceSession.js` | Complete: Gemini Live bridge, barge-in, tool calls, transcripts. |
| `voice/gateway/voiceGateway.js` | Complete for browsers: redeems a signed ticket at `WS /api/v1/developer/voice`. |
| `voice/developerVoice.controller.js` | Mints **browser** tickets for Project credentials (`POST /api/v1/developer/voice/sessions`). |
| `twilio/twilioGateway.js` | Telephony bridge at `WS /api/v1/twilio/media-stream`, but **trusts `agentId` / `projectId` / `callerPhone` from query/custom params** — no ticket, no signature, no auth. |
| `twilio/twilio.routes.js` | Persona-hosted webhooks: `POST /api/v1/webhooks/twilio/voice` returns TwiML → Persona's own media stream. |
| `twilio/twilioMessaging.service.js` | Inbound SMS/WhatsApp pipeline + agent reply; **identity is always the phone number** (`externalUserId = phone`, thread `agui-<domain>-<agent>-<phone>`). |
| `twilio/developerMessaging.routes.js` | Machine-credential send routes. **Always sends through Persona's Twilio account**, no way to assert an external user id, no "reply only" mode. |

### 2.2 `sdk/`

| Package | Status |
| --- | --- |
| `@personaai/sdk` | `voice.createSession(agentId)` mints browser tickets; `messages.send` / `sendFromAgent` deliver via Persona's Twilio. No telephony ticket, no reply-without-send. |
| `@personaai/runtime` | `POST /voice/sessions` (always on), `POST /messages` / `/messages/agent` (capability `messages`). **No channel webhook routes.** |
| `@personaai/adapters` | Next translate rejects non-JSON bodies (`translate.ts`); Express/Nest forward `req.body`. **No urlencoded parsing**, which Twilio webhooks require. |
| `@personaai/react` | `useVoice` is complete for the browser; nothing needed for telephony. |
| `persona-agent-sdk` (Python) | No voice/messaging/channel surface yet. |

### 2.3 `platform/`

- Voice docs already generated for `@personaai/sdk` and `@personaai/react` (`content/docs/**/voice.mdx`).
- `voice-indicator` registry component exists for browsers.
- No "bring your own Twilio" guide.

### 2.4 The consuming project — `d:/project`

- `app/api/persona/[...persona]/route.ts` mounts `createPersonaHandler` with `resolveUserFrom: () => auth().userId` — Clerk id → Persona external user id. This is exactly the resolution pattern to reuse for telephony, except Twilio requests carry no Clerk session, so the resolver must read the webhook payload instead.

---

## 3. Gaps to close

1. **Telephony media stream is unauthenticated.** Anyone who knows an agent id can open a stream. Must accept a single-use ticket and derive the runtime context from it.
2. **No telephony ticket endpoint.** Browser tickets point at `/api/v1/developer/voice`; telephony needs a stream URL for `/api/v1/twilio/media-stream`.
3. **Identity is the phone number.** Telephony and messaging hardcode `externalUserId = phone`, so the same person has a different identity in web chat than on WhatsApp. Needs an asserted `externalUserId` from the developer's resolver, with the phone kept only as channel metadata (`turnContext.callerPhone`).
4. **Messaging can only send through Persona's Twilio.** A developer with their own number needs the agent's reply returned to them (inline TwiML), not delivered by Persona.
5. **No webhook handler in the SDK.** Nothing verifies `X-Twilio-Signature`, parses form bodies, resolves the user, and returns TwiML.
6. **Adapters can't parse `application/x-www-form-urlencoded`** (Next throws `TranslationError`), so a Twilio request never reaches a route today.
7. **No call lifecycle visibility** (call started / ended / duration / transcript) for the developer's own records.

---

## 4. Target contracts

### 4.1 `@personaai/sdk`

```ts
// new: telephony ticket for a call the developer's Twilio already answered
const { ticket, streamUrl, expiresAt } = await client.voice.createTelephonySession({
  agentId,
  externalUserId: "user_2ab…", // the developer's own id
  threadId,                    // optional, resume an existing conversation
  from: "+9198…", to: "+1415…", callSid,
  context: { plan: "pro" },    // at-connect turnContext seed, phone is added automatically
});

// new: run the agent for a resolved user and return the reply, without sending it
const { reply, threadId } = await client.messages.generateReply({
  agentId,
  externalUserId: "user_2ab…",
  text: "Hi, where is my order?",
  displayName: "Raiyan",
});
```

### 4.2 `agent-backend`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/developer/voice/telephony/sessions` | Project credential + `x-persona-external-user-id` | Mint a ticket bound to `externalUserId`, return `streamUrl` for the media stream. |
| `WS` | `/api/v1/twilio/media-stream?ticket=…` | ticket | Redeem, build `ProjectRuntimeContext` from the claims, run the session. Legacy param path kept but logged as deprecated. |
| `POST` | `/api/v1/developer/messages/agent/reply` | Project credential + asserted user | Run the agent turn, **do not send**; return `{ reply, threadId }`. |

Ticket claims gain `principalType: "Telephony"` (browser tickets stay `ProjectAdmin` / `ProjectRuntime`, and each ticket is only accepted on its own path).

### 4.3 `@personaai/runtime` — channel routes (opt-in by configuration)

```ts
createPersonaHandler({
  baseUrl, credential,
  resolveUserFrom: async () => auth().userId,
  channels: {
    twilio: {
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      publicUrl: "https://app.example.com", // for exact-URL signature checks
      resolveUser: async ({ channel, from, to, callSid, body }) => {
        const user = await db.user.findByPhone(from);
        return user ? { externalUserId: user.id } : null; // null → 403
      },
      agentId: "…", // optional default, resolver may override per request
    },
  },
});
```

Routes appear only when `channels.twilio` is configured (same pattern as `restToolsManifest` / `rcpManifest`):

| Method | Path | Response |
| --- | --- | --- |
| `POST` | `/channels/twilio/voice` | TwiML `<Response><Connect><Stream url="wss://…/media-stream?ticket=…">` |
| `POST` | `/channels/twilio/message` | TwiML `<Response><Message>agent reply</Message></Response>` |

Both handlers: verify signature → `resolveUser` → Persona SDK call → TwiML. 403 on unknown sender, 400 on bad
signature, and a spoken/TwiML fallback when the agent cannot start.

---

## 5. Identity & continuity model

| Field | Value | Notes |
| --- | --- | --- |
| `externalUserId` | developer's own user id | asserted by the Project credential on the developer's server; the phone number never becomes an identity again |
| `turnContext.callerPhone` / `from` / `callSid` / `channel` | channel metadata | visible to tools via RCP resolvers; never shown to the model |
| thread id | `agui-<domain>-<agentId>-<externalUserId>` | same rule web chat already uses → one conversation across web chat, WhatsApp and phone |
| explicit `threadId` | optional | attach the call/message to an existing thread; ownership checked server-side |

The happy outcome to test: a user chats on the web, sends a WhatsApp message, and calls — all three land in
one thread because the developer resolved the same `externalUserId` for each channel.

---

## 6. Security model

- **The Project credential is the trust boundary.** The developer's server resolves identity; Persona trusts it the same way it already trusts `x-persona-external-user-id` on `/developer/voice/sessions`.
- **Twilio signature is verified on the developer's server**, with their auth token. Persona cannot verify it (the token is theirs), and does not need to — the ticket proves the request came from their credential.
- **Single-use, 60s ticket, bound to path.** No agent/project ids on the wire; replay is rejected.
- **No secrets cross:** Persona never sees the Twilio auth token; the developer never sees Persona's provider keys.
- **Audio is not retained** (unchanged): only transcripts, into the resolved user's thread.
- **Rate limit** both channel routes and the two new machine routes; log call SID + duration, never PII payloads.

---

## 7. Phased plan

### Phase 1 — Backend: authenticated telephony + reply-only messaging
- [ ] Add `Telephony` principal branch to `voiceTicket.service.js` + `voiceGateway.js` / `twilioGateway.js`; accept `?ticket=` on the media stream; reject browser tickets there.
- [ ] New `POST /api/v1/developer/voice/telephony/sessions` (controller + route + OpenAPI block + rate limit) returning `{ ticket, streamUrl, expiresAt }`.
- [ ] Extract `generateReply({ projectId, agentId, externalUserId, threadId, text })` from `twilioMessaging.service.js`; add `POST /api/v1/developer/messages/agent/reply`.
- [ ] Keep phone in `turnContext`, remove it from `externalUserId`; thread id follows `externalUserId`.
- [ ] Tests: ticket principal/path isolation, asserted identity, reply-without-send, dedupe by MessageSid.

### Phase 2 — SDK client
- [ ] `sdk/typescript/src/resources/voice.ts`: `createTelephonySession`; types in `types/voice.ts`.
- [ ] `sdk/typescript/src/resources/messages.ts`: `generateReply`; types.
- [ ] Vitest coverage for both (headers + body + error mapping).

### Phase 3 — Runtime + adapters
- [ ] `sdk/runtime/src/routes/channels.ts` with both webhook handlers; `channels` option in `types/options.ts`; registration in `runtime.ts`.
- [ ] Twilio signature validation (HMAC-SHA1 over the exact public URL + sorted params) — implement locally, no `twilio` dependency.
- [ ] `RuntimeRequest`: allow urlencoded bodies; Next adapter parse them, Express/Nest mount `express.urlencoded`.
- [ ] Buffered XML response with `text/xml`.
- [ ] Tests: signature pass/fail, resolver null → 403, TwiML shape, message reply escaping.

### Phase 4 — Prove it in `d:/project`
- [ ] Point a real Twilio number's Voice + Messaging webhooks at `/api/persona/channels/twilio/{voice,message}`.
- [ ] Map phone → Clerk id from Prisma; keep `resolveUserFrom` untouched for chat.
- [ ] End-to-end: web chat → WhatsApp message → phone call, one thread; verify transcripts persist.
- [ ] Verify latency budget: webhook < 1.5s (ticket mint + resolver), TTFA unchanged.

### Phase 5 — Platform docs
- [ ] SDK guide "Bring your own Twilio (voice + WhatsApp)" with the resolver example.
- [ ] Runtime guide section for channel routes, plus generated resource pages for the two new methods.
- [ ] Update `VOICE_AND_TELEPHONY_SPEC.md` and `docs/modules/twilio.md` so Persona-hosted webhooks are documented as the legacy path.

### Phase 6 — Hardening (separate decision)
- [ ] Call events to the developer (`onCallEnded` webhook/hook: callSid, duration, reason, transcript thread id).
- [ ] Shared ticket-redemption store (Redis) for multi-instance deploys.
- [ ] Long calls: reconnection / hand-off past the 15-minute Gemini Live cap.
- [ ] Python SDK parity (`voice.create_telephony_session`, `messages.generate_reply`).

---

## 8. Risks / must verify

| Risk | Mitigation |
| --- | --- |
| Twilio signature needs the **exact** public URL; proxies and rewrites break it. | Require `channels.twilio.publicUrl`; derive only as a documented fallback from `x-forwarded-proto`/`host`. |
| Twilio's webhook timeout is ~15s; the first agent turn can exceed it. | Voice path is fast (mint only). Messaging: acknowledge + retry-safe MessageSid dedupe, and consider an async reply callback in Phase 6. |
| Next/Vercel body parsing + serverless lifetime. | Urlencoded parsing inside the adapter; no long-lived sockets on the developer's side. |
| Gemini Live's ~15-minute audio cap. | Documented limit; Phase 6 hand-off. |
| **WhatsApp Business Calling**: confirm Twilio exposes a media stream for WhatsApp calls (not just PSTN). | Verify against Twilio docs before promising WhatsApp *calls*; WhatsApp *messages* work regardless. |
| Existing projects still point at Persona's webhooks. | New endpoints are additive; legacy path stays and is marked deprecated. |
| Redeemed-ticket set is in-process. | Fine for one instance; Phase 6 moves it to a shared store. |

---

## 9. Decisions to confirm

1. **Reply delivery for WhatsApp/SMS** — inline TwiML `<Response><Message>` (no Twilio creds at Persona, recommended) vs. Persona sends through the developer's stored Twilio credentials.
2. **Channel route location** — `POST /channels/twilio/*` on the existing Persona handler (recommended, one credential already in env) vs. a separate `createTwilioChannelHandler` export.
3. **Scope** — voice + WhatsApp only, or also RCS/SMS/email adapters behind the same `resolveUser` contract.
