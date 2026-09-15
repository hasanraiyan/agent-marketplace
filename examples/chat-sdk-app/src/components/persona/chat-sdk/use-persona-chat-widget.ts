"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  useChat,
  useThreads,
  useFiles,
  useVoice,
  type PersonaStreamingEvent,
} from "@personaai/react";
import { groupReasoning } from "./message-grouping";

export interface UsePersonaChatWidgetOptions {
  agentId?: string;
  /** Controlled active thread — omit to let the hook manage it internally. */
  threadId?: string;
  onThreadChange?: (threadId: string | undefined) => void;
  /** Raw AG-UI event passthrough — see `PersonaChatView`'s `onEvent` prop. */
  onEvent?: (event: PersonaStreamingEvent) => void;
  /** @default true — set false to omit voice entirely (no mic permission prompt, no useVoice wiring). */
  enableVoice?: boolean;
}

/**
 * Every stateful/behavioral piece `PersonaChatView` is built on: thread
 * selection, lazy thread creation on the first message, HITL/clarification
 * decision accumulation, and mapping `@personaai/react`'s wire-accurate
 * types onto the `chat` registry item's presentational shapes (see
 * `./adapter`). A consumer assembling its own layout can call this
 * directly instead of reimplementing the same wiring against the raw
 * `useChat`/`useThreads` hooks.
 */
export function usePersonaChatWidget(options: UsePersonaChatWidgetOptions = {}) {
  const { agentId, threadId: controlledThreadId, onThreadChange, onEvent, enableVoice = true } = options;

  const [internalThreadId, setInternalThreadId] = useState<string | undefined>(undefined);
  const activeThreadId = controlledThreadId !== undefined ? controlledThreadId : internalThreadId;

  const {
    threads,
    createThread,
    deleteThread,
    renameThread,
    isLoading: threadsLoading,
  } = useThreads();
  const { files: uploadedFiles, uploadFile, deleteFile, isLoading: filesLoading } = useFiles();

  // Always called (hooks can't be conditional) — cheap until voice.start()
  // is actually invoked. `enableVoice` only gates whether it's merged into
  // `useChat` and whether `PersonaChatView` renders any voice UI for it.
  const voice = useVoice({ agentId, threadId: activeThreadId });

  const {
    messages: rawMessages,
    todos: rawTodos,
    interrupt: rawInterrupt,
    files: workspaceFiles,
    resumeInterrupt,
    ...restChat
  } = useChat({
    agentId,
    threadId: activeThreadId,
    onEvent,
    // useChat merges live voice turns into `messages` automatically —
    // one bubble per utterance, deduped against history — while `voice`
    // is in an active (non-idle/ended/error) state.
    voice: enableVoice ? voice : undefined,
  });

  const isVoiceActive = enableVoice && !["idle", "ended", "error"].includes(voice.state);

  const setActiveThread = useCallback(
    (id: string | undefined) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );

  const handleSelectThread = useCallback(
    (id: string | undefined) => {
      restChat.clear();
      setActiveThread(id);
    },
    [restChat, setActiveThread]
  );

  const handleNewChat = useCallback(() => {
    restChat.clear();
    setActiveThread(undefined);
  }, [restChat, setActiveThread]);

  const handleSend = useCallback(
    (content?: string) => {
      // Not awaited before sendMessage — see sdk/ui's usePersonaChatWidget
      // for why: sendMessage's own optimistic update already runs
      // synchronously, so passing the in-flight thread-creation promise
      // straight through gets both an instant message and a real threadId.
      const threadId = activeThreadId
        ? Promise.resolve(activeThreadId)
        : createThread(agentId)
            .then((t) => {
              if (t?._id) setActiveThread(t._id);
              return t?._id;
            })
            .catch(() => undefined);

      void restChat.sendMessage(content, { threadId });
    },
    [activeThreadId, agentId, createThread, restChat, setActiveThread]
  );

  // HITL actions are decided one at a time by InterruptPanel's
  // onDecideHitl(actionName, decision) but the backend expects every
  // actionRequest's decision resumed together, in the same order the
  // interrupt listed them — accumulate by tool name (the only identifier
  // `PersonaHitlActionRequest` carries) until all are decided, then resume.
  const hitlDecisions = useRef<Map<string, "approve" | "reject">>(new Map());
  const handleDecideHitl = useCallback(
    (actionName: string, decision: "approve" | "reject") => {
      if (!rawInterrupt || rawInterrupt.kind !== "hitl") return;
      hitlDecisions.current.set(actionName, decision);
      const total = rawInterrupt.actionRequests.length;
      if (hitlDecisions.current.size >= total) {
        const decisions = rawInterrupt.actionRequests.map((a) => ({
          type: hitlDecisions.current.get(a.name) ?? ("reject" as const),
        }));
        hitlDecisions.current.clear();
        const display = decisions.every((d) => d.type === "approve") ? "Approved" : "Rejected";
        void resumeInterrupt({ decisions }, display);
      }
    },
    [rawInterrupt, resumeInterrupt]
  );

  const handleSubmitClarification = useCallback(
    (answers: Record<string, string>) => {
      if (!rawInterrupt || rawInterrupt.kind !== "clarification") return;
      const ordered = rawInterrupt.questions.map((q) => answers[q.id] ?? "");
      void resumeInterrupt({ answers: ordered }, ordered.filter(Boolean).join(", "));
    },
    [rawInterrupt, resumeInterrupt]
  );

  const messages = useMemo(() => groupReasoning(rawMessages), [rawMessages]);

  return {
    // thread selection
    activeThreadId,
    setActiveThread,
    // threads
    threads,
    threadsLoading,
    createThread,
    deleteThread,
    renameThread,
    // uploaded files
    uploadedFiles,
    filesLoading,
    uploadFile,
    deleteFile,
    // chat — every other useChat field (isStreaming, stop, reload, etc.)
    ...restChat,
    workspaceFiles,
    // messages grouped for rendering (reasoning nested under its assistant
    // message) — todos/interrupt are the SDK's own PersonaTodo[]/PersonaInterrupt, unmodified
    messages,
    todos: rawTodos,
    interrupt: rawInterrupt,
    resumeInterrupt,
    // voice
    voice,
    isVoiceActive,
    // composed handlers
    handleSelectThread,
    handleNewChat,
    handleSend,
    handleDecideHitl,
    handleSubmitClarification,
  };
}
