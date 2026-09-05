# Voice ↔ Text Chat Sync — now built into the SDK

**TL;DR:** upgrade `@personaai/nextjs` to `0.1.9` (pulls in `@personaai/react@0.7.4`), pass your
`useVoice()` instance into `useChat({ voice })`, and delete the manual sync effects you wrote to
merge voice transcript lines into the chat feed. The SDK now owns that merge.

## What prompted this

The `NotebookChat.js` you shared with us needed two separate `useEffect`s (~100 lines) just to
keep the text chat feed and a live voice call in sync:

- A cursor (`prevVoiceLen`) tracking how much of `voice.transcript` had already been injected
- A ref tracking the id of the currently-open "assistant is speaking" bubble
- Dedup logic against messages already persisted to the thread (since voice turns save back into
  the same thread `useChat` reads)
- Merge logic so one spoken answer split across several `transcript` finals doesn't render as
  several stacked bubbles
- A reset on thread switch so an old call's transcript doesn't bleed into a new conversation

That's not app logic — it's plumbing that belongs in the SDK, and every consumer combining
`useVoice` + `useChat` was going to hit the same wall. So we moved it there instead of asking you
to maintain it.

## What changed

- **`@personaai/react` 0.7.3 → 0.7.4** — `useChat()` accepts a new optional `voice` option.
- **`@personaai/nextjs` 0.1.8 → 0.1.9** — bumps the `@personaai/react` dependency (this is the
  package you actually install; it re-exports `@personaai/react`'s hooks under `'use client'`).

## Before

```jsx
const voice = useVoice({ agentId, threadId: threadId || undefined });
const { messages, setMessages, ... } = useChat({ agentId, threadId });

const prevVoiceLen = useRef(0);
const voiceMsgIdRef = useRef(null);

useEffect(() => {
  if (isVoiceActive) voice.stop();
  prevVoiceLen.current = voice.transcript.length;
  voiceMsgIdRef.current = null;
}, [threadId]);

useEffect(() => {
  // ~90 lines of transcript-length-cursor tracking, dedup against
  // `messages`, fragment merging, and streaming-bubble bookkeeping
}, [voice.transcript, voice.partial, voice.state, isVoiceActive, setMessages]);
```

## After

```jsx
const voice = useVoice({ agentId, threadId: threadId || undefined });
const { messages, ... } = useChat({ agentId, threadId, voice });

// Thread-switch effect stays — stopping an active call on navigation is
// still your product decision, not SDK plumbing — but it no longer needs
// to touch any voice-merge cursor. useChat re-syncs itself on threadId change.
useEffect(() => {
  if (isVoiceActive) voice.stop();
}, [threadId]);
```

Everything else — the length cursor, the streaming-bubble id, both dedup checks, fragment
merging — is gone. `useChat` does it internally now.

## Behavior you get automatically

- One chat bubble per spoken utterance, even when Gemini emits it as several transcript
  fragments or the answer is split by a mid-answer tool call.
- No duplicate bubble if a voice turn already landed in `messages` from thread history (reload,
  or the persisted copy catching up).
- The agent's in-progress spoken line updates in place (`isStreaming: true`), same visual
  treatment as a streaming text response.
- Injected messages carry a `voice-`-prefixed `id`, so you can still special-case them in your
  renderer if you want to (e.g. a small mic icon) — nothing required, though.
- Switching `threadId` on the same `useVoice()` instance no longer replays that call's old
  transcript into the new thread's feed.

## What's still on you

- Starting/stopping the call itself (`voice.start()` / `voice.stop()`) — the SDK never decides
  when a call begins or ends.
- Any product-specific side effects around voice state (e.g. stopping the mic when the user
  navigates to a different topic/thread).

## Upgrade

```bash
npm install @personaai/nextjs@latest
```

No other code changes required beyond passing `voice` into `useChat()` and deleting the effects
above. Full details in [`@personaai/react`'s CHANGELOG](https://github.com/hasanraiyan/agent-marketplace/blob/feat/ai/sdk/react/CHANGELOG.md#074)
and the [Voice section of its README](https://github.com/hasanraiyan/agent-marketplace/blob/feat/ai/sdk/react/README.md#voice).
