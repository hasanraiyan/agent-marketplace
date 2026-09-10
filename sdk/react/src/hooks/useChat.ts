"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import { openSSEStream } from "../streaming.js";
import type {
  PersonaInterrupt,
  PersonaMessage,
  PersonaPresentedFile,
  PersonaResumeValue,
  PersonaRole,
  PersonaSandboxCommand,
  PersonaStreamingEvent,
  PersonaSubagentActivityEntry,
  PersonaTodo,
  PersonaToolCall,
  PersonaWorkspaceFile,
  SendMessageOverride,
  UseChatOptions,
} from "../types.js";

// A failed tool call's TOOL_CALL_RESULT content is a JSON envelope
// (`{status:'error',message}`, see aguiTranslator.js's buildToolErrorContent)
// rather than a separate boolean field on the event itself.
function isErrorToolContent(content: string): boolean {
  if (typeof content !== "string" || !content.trim().startsWith("{"))
    return false;
  try {
    return JSON.parse(content)?.status === "error";
  } catch {
    return false;
  }
}

// Persisted subagent trace item shape (agent-backend's foldSubagentEvent/
// subagentTrace.js) — already folded/paired server-side for compact storage,
// DIFFERENT from the raw per-event `PersonaSubagentActivityEntry` shape the
// live SSE stream sends (kind: 'text'|'tool_start'|'tool_result'). Reloading
// a thread previously never read `data.subagentTraces` at all — a completed
// subagent's activity (its own text/tool timeline) was silently dropped on
// reload even though the backend already persists and returns it, keyed by
// the owning `task` tool call's toolCallId (see agui.controller.js's
// `subagentTraces[callId]`, matching `PersonaToolCall.toolCallId` exactly).
type PersistedSubagentTraceItem =
  | { type: "text"; text: string }
  | {
      type: "tool";
      name: string;
      argsText: string;
      resultText: string;
      status: "running" | "completed";
    };

// Re-expands the folded/paired persisted shape back into the raw kind-based
// entries `PersonaSubagentActivityEntry` (and everything downstream that
// consumes it — buildSubagentTimeline, the live-preview row, the activity
// dialog) already knows how to render, so no sdk/ui changes are needed.
function persistedTraceToActivityEntries(
  items: PersistedSubagentTraceItem[],
): PersonaSubagentActivityEntry[] {
  const entries: PersonaSubagentActivityEntry[] = [];
  for (const item of items) {
    if (item.type === "text") {
      if (item.text) entries.push({ kind: "text", delta: item.text });
    } else {
      entries.push({
        kind: "tool_start",
        toolName: item.name,
        args: item.argsText,
      });
      if (item.status === "completed") {
        entries.push({
          kind: "tool_result",
          toolName: item.name,
          result: item.resultText,
        });
      }
    }
  }
  return entries;
}

// present_file's result is `{status:'success', filePath, title, description}`
// (see present.tool.js) — a signal to highlight that path in the workspace
// files panel, not something meant to render as a generic tool-result blob.
function parsePresentedFile(content: string): PersonaPresentedFile | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.status !== "success" || typeof parsed.filePath !== "string")
      return null;
    return {
      path: parsed.filePath,
      title: typeof parsed.title === "string" ? parsed.title : parsed.filePath,
      description:
        typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch {
    return null;
  }
}

// execute's args are `{ command }` and result `{ output, exitCode }` (see
// CodeSandboxBackend.execute, agent-backend/src/modules/sandbox) — both
// arrive here as opaque JSON strings, so this stays defensive rather than
// assuming either parses cleanly (args in particular is still-accumulating
// JSON while the call streams in).
function parseSandboxCommand(tc: PersonaToolCall): PersonaSandboxCommand {
  let command = tc.args ?? "";
  try {
    const parsedArgs = JSON.parse(tc.args || "{}");
    if (typeof parsedArgs.command === "string") command = parsedArgs.command;
  } catch {
    // incomplete/still-streaming args — show the raw partial string
  }

  let output: string | undefined;
  let exitCode: number | null | undefined;
  if (tc.result) {
    try {
      const parsedResult = JSON.parse(tc.result);
      if (typeof parsedResult.output === "string") {
        output = parsedResult.output;
        exitCode =
          typeof parsedResult.exitCode === "number"
            ? parsedResult.exitCode
            : null;
      } else {
        output = tc.result;
      }
    } catch {
      output = tc.result;
    }
  }

  return {
    toolCallId: tc.toolCallId,
    command,
    output,
    exitCode,
    status: tc.isError ? "error" : tc.result ? "done" : "running",
    seq: tc.seq,
  };
}

// buildFilesTodosSnapshot (aguiTranslator.js) emits snake_case
// created_at/modified_at on the wire — both from the live STATE_SNAPSHOT
// event and from a reloaded thread's persisted state (checkpoint.service.js
// runs the same function). Normalize to the SDK's usual camelCase shape.
function normalizeWorkspaceFiles(
  raw: Record<
    string,
    {
      content: string;
      size: number;
      created_at: string | null;
      modified_at: string | null;
    }
  >,
): Record<string, PersonaWorkspaceFile> {
  const normalized: Record<string, PersonaWorkspaceFile> = {};
  for (const [path, file] of Object.entries(raw || {})) {
    normalized[path] = {
      content: file.content,
      size: file.size,
      createdAt: file.created_at,
      modifiedAt: file.modified_at,
    };
  }
  return normalized;
}

// checkpointService.getMessages() wraps a paused thread's interrupt as
// `{ kind, value }` (see checkpoint.service.js) — the same envelope shape
// the live hitl_request/clarification_request CUSTOM events carry, just
// nested one level deeper. Flatten both into the same PersonaInterrupt shape.
function normalizePendingInterrupt(pending: unknown): PersonaInterrupt | null {
  if (!pending || typeof pending !== "object") return null;
  const p = pending as { kind?: string; value?: Record<string, unknown> };
  if (p.kind === "hitl") {
    return {
      kind: "hitl",
      actionRequests: (p.value?.actionRequests ?? []) as Extract<
        PersonaInterrupt,
        { kind: "hitl" }
      >["actionRequests"],
      reviewConfigs: (p.value?.reviewConfigs ?? []) as unknown[],
    };
  }
  if (p.kind === "clarification") {
    return {
      kind: "clarification",
      questions: (p.value?.questions ?? []) as Extract<
        PersonaInterrupt,
        { kind: "clarification" }
      >["questions"],
    };
  }
  return null;
}

export function useChat(options: UseChatOptions = {}) {
  const { defaultAgentId, fetchWithAuth, baseUrl, getAuthToken, logger } =
    usePersonaContext();
  const chatLogger = useMemo(() => logger.child("chat"), [logger]);
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  // Ephemeral/fake thread support: when threadId is null/undefined the chat is
  // in "new chat" mode — no history fetch, no thread creation until first send.
  // The real id is minted lazily inside doSend and surfaced via
  // options.onThreadCreated so the host can sync its sidebar state.
  const [internalThreadId, setInternalThreadId] = useState<string | undefined>(undefined);
  const effectiveThreadId = threadId ?? internalThreadId;
  // Keep internal in sync when host drives threadId (e.g. after mint)
  useEffect(() => {
    if (threadId !== undefined) setInternalThreadId(threadId);
  }, [threadId]);

  // Log hook initialization at most once per mount (debug/info visible, trace for details)
  // This runs during render, so guard with a ref to avoid spam on every re-render
  const didLogInitRef = useRef(false);
  if (!didLogInitRef.current) {
    didLogInitRef.current = true;
    chatLogger.debug("useChat init", {
      agentId,
      threadId,
      hasInitialMessages: !!options.initialMessages?.length,
    });
    chatLogger.trace("useChat options", {
      agentId,
      threadId,
      initialMessageCount: options.initialMessages?.length ?? 0,
    });
  }

  const [messages, setMessages] = useState<PersonaMessage[]>(
    options.initialMessages || [],
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [interrupt, setInterrupt] = useState<PersonaInterrupt | null>(null);
  const [files, setFiles] = useState<Record<string, PersonaWorkspaceFile>>({});
  const [todos, setTodos] = useState<PersonaTodo[]>([]);
  const [presentedFile, setPresentedFile] =
    useState<PersonaPresentedFile | null>(null);

  // Derived (not separately tracked) from `messages` — every `execute` tool
  // call already lives there, both live-streamed and loaded from history, so
  // this stays correct for free instead of needing its own reset/restore
  // logic the way `presentedFile` (a single most-recent value, not a list)
  // does.
  const sandboxCommands = useMemo<PersonaSandboxCommand[]>(() => {
    const commands: PersonaSandboxCommand[] = [];
    for (const message of messages) {
      for (const tc of message.toolCalls ?? []) {
        if (tc.toolName === "execute") commands.push(parseSandboxCommand(tc));
      }
    }
    return commands;
  }, [messages]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedThreadIdRef = useRef<string | undefined>(undefined);

  // Voice sync bookkeeping — see the effect below. Kept as refs (not state)
  // because they're pure injection-cursor plumbing, never rendered.
  const voiceThreadRef = useRef<string | undefined>(effectiveThreadId);
  const voicePrevLenRef = useRef(0);
  const voiceStreamingIdRef = useRef<string | null>(null);
  const voiceUserPartialIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      chatLogger.info("stop streaming", {});
      chatLogger.debug("abort controller", {
        hasController: !!abortControllerRef.current,
      });
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      chatLogger.debug("streaming stopped");
    } else {
      chatLogger.trace("stop called — no active stream");
    }
  }, [chatLogger]);

  const clear = useCallback(() => {
    chatLogger.info("clear chat", { messageCount: messages.length });
    chatLogger.debug("clear", { messageCount: messages.length });
    stop();
    setMessages([]);
    setError(null);
    setInterrupt(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
    loadedThreadIdRef.current = undefined;
  }, [stop, chatLogger, messages.length]);

  const startNewChat = useCallback(() => {
    chatLogger.info("startNewChat — entering ephemeral mode");
    stop();
    setMessages([]);
    setError(null);
    setInterrupt(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
    setInput("");
    loadedThreadIdRef.current = undefined;
    voiceThreadRef.current = undefined;
    voicePrevLenRef.current = 0;
    voiceStreamingIdRef.current = null;
    voiceUserPartialIdRef.current = null;
    setInternalThreadId(undefined);
  }, [stop, chatLogger]);

  const loadThreadMessages = useCallback(
    async (id: string) => {
      chatLogger.debug("loadThreadMessages start", { threadId: id });
      chatLogger.trace("loadThreadMessages", { threadId: id });
      setIsLoadingHistory(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/threads/${id}/messages`);
        if (!res.ok)
          throw new Error(`Failed to load thread history: ${res.statusText}`);
        const body = await res.json();
        const data = body?.data ?? body;
        const raw = (data?.messages ?? []) as Array<{
          id?: string;
          role: PersonaMessage["role"];
          content: string;
          toolCalls?: PersonaToolCall[];
        }>;
        const subagentTraces = (data?.subagentTraces ?? {}) as Record<
          string,
          PersistedSubagentTraceItem[]
        >;
        const loaded: PersonaMessage[] = raw.map((m, i) => ({
          id: m.id || `history-${id}-${i}`,
          role: m.role,
          content: m.content,
          createdAt: new Date(),
          toolCalls: m.toolCalls?.map((tc) => {
            const trace = subagentTraces[tc.toolCallId];
            return Array.isArray(trace) && trace.length > 0
              ? {
                  ...tc,
                  subagentActivity: persistedTraceToActivityEntries(trace),
                }
              : tc;
          }),
        }));
        setMessages(loaded);
        // Re-show the approval/clarification card on reload if this thread
        // is currently paused — otherwise it wouldn't reappear until the
        // next live stream re-surfaces it.
        setInterrupt(normalizePendingInterrupt(data?.pendingInterrupt));
        // Restore the workspace files/todos this thread already had (same
        // cleaned shape checkpoint.service.js now derives via
        // buildFilesTodosSnapshot, matching the live STATE_SNAPSHOT event).
        setFiles(normalizeWorkspaceFiles(data?.state?.files ?? {}));
        setTodos((data?.state?.todos ?? []) as PersonaTodo[]);
        loadedThreadIdRef.current = id;
        chatLogger.info("loadThreadMessages succeeded", {
          threadId: id,
          messageCount: loaded.length,
        });
        chatLogger.debug("loadThreadMessages completed", {
          threadId: id,
          messageCount: loaded.length,
        });
        return loaded;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("loadThreadMessages failed", {
          threadId: id,
          error: errorObj.message,
        });
        chatLogger.error("loadThreadMessages error", {
          threadId: id,
          error: errorObj.message,
        });
        setError(errorObj);
        if (loadedThreadIdRef.current === id) loadedThreadIdRef.current = undefined;
        return [];
      } finally {
        setIsLoadingHistory(false);
        chatLogger.trace("loadThreadMessages end", { threadId: id });
      }
    },
    [fetchWithAuth, chatLogger],
  );

  // Auto-load history the first time a thread with no in-memory messages is
  // selected (switching threads in the sidebar). Skipped for a thread whose
  // messages already live in state — e.g. one just created by handleSend,
  // which sets its placeholder messages in the same render batch as the
  // threadId change, so `messages` there is never empty at effect time.
  useEffect(() => {
    if (!effectiveThreadId || isStreaming) {
      chatLogger.trace("auto-load skipped", { threadId: effectiveThreadId, isStreaming });
      return;
    }
    if (loadedThreadIdRef.current === effectiveThreadId) {
      chatLogger.trace("auto-load already loaded", { threadId: effectiveThreadId });
      return;
    }
    if (messages.length > 0) {
      chatLogger.trace("auto-load has messages", {
        threadId: effectiveThreadId,
        count: messages.length,
      });
      return;
    }
    chatLogger.info("auto-load thread history", { threadId: effectiveThreadId });
    chatLogger.debug("loadThreadMessages trigger", { threadId: effectiveThreadId });
    void loadThreadMessages(effectiveThreadId);
  }, [effectiveThreadId, isStreaming, messages.length, loadThreadMessages, chatLogger]);

  // Merge a `useVoice()` session's live transcript into `messages` — see
  // `UseChatOptions.voice`. This replaces the hand-rolled sync effects the
  // README used to tell every consumer to write themselves (dedup against
  // thread history, merge same-speaker fragments into one bubble, update the
  // in-progress agent line in place, and not replay a call's old transcript
  // after a threadId switch under the same `useVoice()` instance).
  const voice = options.voice;
  useEffect(() => {
    if (!voice) return;

    // The passed useVoice() instance now targets a different thread (e.g. the
    // host app switched conversations without remounting either hook) — its
    // transcript belongs to a call that's over as far as this feed is
    // concerned. Stop injecting and don't let anything already spoken bleed
    // into the new thread's feed once a new call starts.
    if (voiceThreadRef.current !== effectiveThreadId) {
      voiceThreadRef.current = effectiveThreadId;
      voicePrevLenRef.current = voice.transcript.length;
      voiceStreamingIdRef.current = null;
      voiceUserPartialIdRef.current = null;
      return;
    }

    const isVoiceActive =
      voice.state !== "idle" && voice.state !== "ended" && voice.state !== "error";
    const curLen = voice.transcript.length;

    // start() resets transcript to [] for a fresh call — realign the cursor.
    if (curLen < voicePrevLenRef.current) {
      voicePrevLenRef.current = 0;
      voiceStreamingIdRef.current = null;
      voiceUserPartialIdRef.current = null;
    }

    if (!isVoiceActive) {
      // Flush any unseen transcript lines that arrived just before stop()
      // set state to idle (A1). Previously this block only advanced the
      // pointer, permanently discarding the final user utterance.
      if (curLen > voicePrevLenRef.current) {
        const pendingLines = voice.transcript.slice(voicePrevLenRef.current);
        voicePrevLenRef.current = curLen;
        for (const line of pendingLines) {
          const text = (line.text || "").trim();
          if (!text) continue;
          const role: PersonaRole = line.speaker === "user" ? "user" : "assistant";
          const voiceId = `voice-${line.id}`;
          setMessages((prev) => {
            if (prev.some((m) => m.id === voiceId)) return prev;
            if (prev.some((m) => !m.id.startsWith("voice-") && m.role === role && m.content.trim() === text)) return prev;
            const last = prev[prev.length - 1];
            if (last?.id.startsWith("voice-") && last.role === "assistant" && role === "assistant") {
              const merged = text.startsWith(last.content) ? text : `${last.content} ${text}`.trim();
              return [...prev.slice(0, -1), { ...last, content: merged, isStreaming: false }];
            }
            return [...prev, { id: voiceId, role, content: text, createdAt: new Date() }];
          });
        }
      } else {
        voicePrevLenRef.current = voice.transcript.length;
      }
      if (voiceStreamingIdRef.current) {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === doneId ? { ...m, isStreaming: false } : m)));
      }
      if (voiceUserPartialIdRef.current) {
        const doneId = voiceUserPartialIdRef.current;
        voiceUserPartialIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === doneId ? { ...m, isStreaming: false } : m)));
      }
      return;
    }

    if (curLen > voicePrevLenRef.current) {
      const newLines = voice.transcript.slice(voicePrevLenRef.current);
      voicePrevLenRef.current = curLen;
      for (const line of newLines) {
        const text = (line.text || "").trim();
        if (!text) continue;
        const role: PersonaRole = line.speaker === "user" ? "user" : "assistant";
        const voiceId = `voice-${line.id}`;
        setMessages((prev) => {
          // Already injected this exact line.
          if (prev.some((m) => m.id === voiceId)) return prev;
          // Already on the thread as a persisted turn (voice shares the
          // thread, so a refresh/reload can already hold it).
          if (
            prev.some(
              (m) =>
                !m.id.startsWith("voice-") &&
                m.role === role &&
                m.content.trim() === text,
            )
          )
            return prev;
          const last = prev[prev.length - 1];
          // Consecutive agent finals of one spoken answer merge into the
          // bubble they opened, same as useVoice() does for `transcript`
          // itself — mirrors how the thread coalesces them on reload.
          if (last?.id.startsWith("voice-") && last.role === "assistant" && role === "assistant") {
            const merged = text.startsWith(last.content)
              ? text
              : `${last.content} ${text}`.trim();
            return [...prev.slice(0, -1), { ...last, content: merged, isStreaming: false }];
          }
          return [...prev, { id: voiceId, role, content: text, createdAt: new Date() }];
        });
      }
    }

    const agentPartialText = voice.partial?.speaker === "agent" ? voice.partial.text.trim() : "";
    const userPartialText = voice.partial?.speaker === "user" ? voice.partial.text.trim() : "";

    if (agentPartialText) {
      if (voiceUserPartialIdRef.current) {
        const doneId = voiceUserPartialIdRef.current;
        voiceUserPartialIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === doneId ? { ...m, isStreaming: false } : m)));
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id.startsWith("voice-") && last.role === "assistant") {
          voiceStreamingIdRef.current = last.id;
          return [...prev.slice(0, -1), { ...last, content: agentPartialText, isStreaming: true }];
        }
        const id = voiceStreamingIdRef.current || `voice-partial-${Date.now()}`;
        voiceStreamingIdRef.current = id;
        return [...prev, { id, role: "assistant", content: agentPartialText, isStreaming: true, createdAt: new Date() }];
      });
    } else if (userPartialText) {
      if (voiceStreamingIdRef.current) {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === doneId ? { ...m, isStreaming: false } : m)));
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id.startsWith("voice-") && last.role === "user" && last.isStreaming) {
          voiceUserPartialIdRef.current = last.id;
          return [...prev.slice(0, -1), { ...last, content: userPartialText, isStreaming: true }];
        }
        const id = voiceUserPartialIdRef.current || `voice-partial-user-${Date.now()}`;
        voiceUserPartialIdRef.current = id;
        return [...prev, { id, role: "user", content: userPartialText, isStreaming: true, createdAt: new Date() }];
      });
    } else {
      if (voiceStreamingIdRef.current && voice.state !== "speaking") {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === doneId ? { ...m, isStreaming: false } : m)));
      }
      if (voiceUserPartialIdRef.current) {
        const doneId = voiceUserPartialIdRef.current;
        voiceUserPartialIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === doneId ? { ...m, isStreaming: false } : m)));
      }
    }
    // `voice` itself isn't a dep — useVoice() returns a fresh object every
    // render, so keying off it would re-run this every render regardless of
    // whether the transcript actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice?.transcript, voice?.partial, voice?.state, effectiveThreadId]);

  // Internal stream executor — shared by sendMessage and reload so reload can
  // supply a truncated base (B1: reload must not build nextMessages from the
  // stale full closure). Caller has already validated prompt/isStreaming.
  const doSend = useCallback(
    async (prompt: string, baseMessages: PersonaMessage[], overrideOptions?: SendMessageOverride): Promise<boolean> => {
      const targetAgentId = overrideOptions?.agentId || agentId;
      if (!targetAgentId) {
        const err = new Error("No Agent ID specified for useChat.");
        chatLogger.warn("sendMessage no agentId", {});
        chatLogger.error("sendMessage failed — no agent", { error: err.message });
        setError(err);
        options.onError?.(err);
        return false;
      }

      chatLogger.debug("sendMessage start", {
        promptPreview: prompt.slice(0, 100),
        agentId: targetAgentId,
        threadId: effectiveThreadId ?? (overrideOptions?.threadId as string | undefined),
        hasResume: !!overrideOptions?.resume,
        hasContextOverride: !!overrideOptions?.contextOverride,
        messageCount: baseMessages.length,
      });
      chatLogger.trace("sendMessage details", {
        agentId: targetAgentId,
        promptPreview: prompt.slice(0, 200),
        hasResume: !!overrideOptions?.resume,
        hasContextOverride: !!overrideOptions?.contextOverride,
      });

      const userMessage: PersonaMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "user",
        content: prompt,
        createdAt: new Date(),
      };

      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const placeholderAssistant: PersonaMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        isStreaming: true,
        toolCalls: [],
      };

      const nextMessages = [...baseMessages, userMessage];
      setMessages([...nextMessages, placeholderAssistant]);
      setInput("");
      setIsStreaming(true);
      setError(null);
      setInterrupt(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const finalizeReasoning = () => {
        setMessages((prev) =>
          prev.map((m) => (m.role === "reasoning" && m.isStreaming ? { ...m, isStreaming: false } : m)),
        );
      };

      try {
        const payloadMessages = nextMessages
          .filter((m) => m.role !== "reasoning")
          .map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }));

        let resolvedThreadId: string | undefined = (await (overrideOptions?.threadId as string | undefined)) ?? effectiveThreadId;
        if (!resolvedThreadId) {
          chatLogger.info("minting real thread for ephemeral chat", { agentId: targetAgentId });
          const createRes = await fetchWithAuth("/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: targetAgentId }),
          });
          if (!createRes.ok) throw new Error(`Failed to create thread: ${createRes.statusText}`);
          const createBody = await createRes.json();
          const created = (createBody?.data ?? createBody) as { _id?: string; id?: string };
          resolvedThreadId = created._id ?? created.id;
          if (!resolvedThreadId) throw new Error("Thread creation returned no id");
          setInternalThreadId(resolvedThreadId);
          loadedThreadIdRef.current = resolvedThreadId;
          options.onThreadCreated?.(resolvedThreadId);
          chatLogger.info("ephemeral chat minted", { threadId: resolvedThreadId });
        }
        chatLogger.trace("resolved threadId", { threadId: resolvedThreadId });

        const token = getAuthToken ? await getAuthToken() : null;
        const resolvedHookContext = typeof options.context === "function" ? options.context() : options.context;
        const mergedContext = { ...resolvedHookContext, ...overrideOptions?.context };
        const hasContext = Object.keys(mergedContext).length > 0;
        chatLogger.debug("opening SSE stream", {
          agentId: targetAgentId,
          hasToken: !!token,
          hasThreadId: !!resolvedThreadId,
          hasContext,
        });
        const stream = await openSSEStream({
          url: `${baseUrl}/chat`,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            agentId: targetAgentId,
            messages: payloadMessages,
            threadId: resolvedThreadId,
            resume: overrideOptions?.resume,
            contextOverride: overrideOptions?.contextOverride,
            ...(hasContext ? { context: mergedContext } : {}),
          }),
          signal: controller.signal,
        });

        if (!stream.ok) {
          chatLogger.warn("SSE stream not ok", { status: stream.status, errorText: stream.errorText });
          chatLogger.error("chat stream failed", { agentId: targetAgentId, status: stream.status, error: stream.errorText });
          throw new Error(`Chat error (${stream.status}): ${stream.errorText ?? "Stream failed"}`);
        }
        chatLogger.debug("SSE stream opened", { agentId: targetAgentId, status: stream.status });
        chatLogger.info("chat stream started", { agentId: targetAgentId, threadId: resolvedThreadId });

        const reader = stream.reader;
        let buffer = "";
        let accumulatedText = "";
        const toolCallsMap = new Map<string, PersonaToolCall>();
        let streamSeq = 0;
        let activeReasoningId: string | null = null;
        const reasoningById = new Map<string, { content: string }>();

        const patchAssistant = (patch: Partial<PersonaMessage>) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, toolCalls: Array.from(toolCallsMap.values()), ...patch } : msg,
            ),
          );
        };

        const insertReasoningMessage = (id: string, seq: number) => {
          const msg: PersonaMessage = { id, role: "reasoning", content: "", createdAt: new Date(), isStreaming: true, seq };
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === assistantMessageId);
            if (idx === -1) return [...prev, msg];
            const next = [...prev];
            next.splice(idx, 0, msg);
            return next;
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value ?? "";
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const raw = trimmed.replace(/^data:\s*/, "");
            if (raw === "[DONE]") break;
            try {
              const event = JSON.parse(raw) as PersonaStreamingEvent;
              chatLogger.trace("stream event", { type: event.type, event });
              options.onEvent?.(event);
              if (event.type === "TEXT_MESSAGE_CHUNK" && event.delta) {
                chatLogger.debug("text chunk", { deltaLength: event.delta.length });
                accumulatedText += event.delta;
                patchAssistant({ content: accumulatedText, isStreaming: true });
              } else if (event.type === "TOOL_CALL_CHUNK" && event.toolCallId) {
                chatLogger.debug("tool call chunk", { toolCallId: event.toolCallId, toolCallName: event.toolCallName });
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.args = (existing.args || "") + (event.delta || "");
                } else {
                  toolCallsMap.set(event.toolCallId, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolCallName || "",
                    args: event.delta || "",
                    seq: streamSeq++,
                  });
                }
                patchAssistant({});
              } else if (event.type === "TOOL_CALL_RESULT") {
                chatLogger.debug("tool call result", { toolCallId: event.toolCallId });
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.content;
                  existing.isError = isErrorToolContent(event.content);
                  if (existing.isError) chatLogger.warn("tool call error", { toolCallId: event.toolCallId });
                  if (existing.toolName === "present_file" && !existing.isError) {
                    const presented = parsePresentedFile(event.content);
                    if (presented) {
                      chatLogger.info("present_file", { path: presented.path });
                      setPresentedFile(presented);
                    }
                  }
                  patchAssistant({});
                }
              } else if (event.type === "STATE_SNAPSHOT") {
                chatLogger.debug("state snapshot", {
                  fileCount: Object.keys(event.snapshot.files ?? {}).length,
                  todoCount: event.snapshot.todos?.length ?? 0,
                });
                setFiles(normalizeWorkspaceFiles(event.snapshot.files ?? {}));
                setTodos(event.snapshot.todos ?? []);
              } else if (event.type === "REASONING_MESSAGE_START" && event.messageId) {
                chatLogger.debug("reasoning start", { messageId: event.messageId });
                activeReasoningId = event.messageId;
                reasoningById.set(event.messageId, { content: "" });
                insertReasoningMessage(event.messageId, streamSeq++);
              } else if (event.type === "REASONING_MESSAGE_CONTENT") {
                let rid: string = event.messageId || activeReasoningId || "";
                if (!rid || !reasoningById.has(rid)) {
                  rid = rid || `reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  activeReasoningId = rid;
                  reasoningById.set(rid, { content: "" });
                  insertReasoningMessage(rid, streamSeq++);
                  chatLogger.debug("reasoning lazy start", { messageId: rid });
                }
                const entry = reasoningById.get(rid)!;
                entry.content += event.delta;
                chatLogger.trace("reasoning content", { messageId: rid, deltaLength: event.delta?.length ?? 0 });
                setMessages((prev) => prev.map((m) => (m.id === rid ? { ...m, content: entry.content, isStreaming: true } : m)));
              } else if (event.type === "REASONING_END") {
                chatLogger.debug("reasoning end", { messageId: activeReasoningId });
                const rid = activeReasoningId;
                activeReasoningId = null;
                if (rid) {
                  setMessages((prev) => prev.map((m) => (m.id === rid ? { ...m, isStreaming: false } : m)));
                }
              } else if (event.type === "CUSTOM") {
                chatLogger.debug("custom event", { name: event.name });
                if (event.name === "hitl_request") {
                  const value = event.value as Extract<PersonaInterrupt, { kind: "hitl" }>;
                  chatLogger.info("hitl interrupt", { actionCount: value.actionRequests?.length ?? 0 });
                  setInterrupt({ kind: "hitl", actionRequests: value.actionRequests, reviewConfigs: value.reviewConfigs });
                } else if (event.name === "clarification_request") {
                  const value = event.value as Extract<PersonaInterrupt, { kind: "clarification" }>;
                  chatLogger.info("clarification interrupt", { questionCount: value.questions?.length ?? 0 });
                  setInterrupt({ kind: "clarification", questions: value.questions });
                } else if (event.name === "subagent_activity") {
                  const { toolCallId, ...entry } = event.value as { toolCallId: string } & PersonaSubagentActivityEntry;
                  chatLogger.trace("subagent activity", { toolCallId, kind: entry.kind });
                  const existing = toolCallsMap.get(toolCallId);
                  if (existing) {
                    existing.subagentActivity = [...(existing.subagentActivity || []), entry];
                    patchAssistant({});
                  }
                } else if (event.name === "mcp_app") {
                  const val = event.value as { toolCallId?: string; resourceUri?: string; mcpId?: string } | undefined;
                  if (val?.toolCallId && val?.resourceUri && val?.mcpId) {
                    const existing = toolCallsMap.get(val.toolCallId);
                    if (existing) {
                      existing.mcpApp = { resourceUri: val.resourceUri, mcpId: val.mcpId };
                      patchAssistant({});
                    }
                  }
                }
              } else if ((event as { type: string; title?: string }).type === "title") {
                const title = (event as { title?: string }).title;
                if (typeof title === "string" && title.trim()) {
                  chatLogger.info("auto title", { title });
                  (options as { onTitle?: (t: string) => void }).onTitle?.(title);
                }
              } else if (event.type === "RUN_ERROR") {
                chatLogger.warn("run error", { message: event.message, code: event.code });
                chatLogger.error("stream run error", { code: event.code, message: event.message });
                throw new Error(event.message || "Stream error from agent");
              } else {
                chatLogger.trace("unhandled event", { type: event.type });
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith("Stream error")) throw e;
              chatLogger.warn("event parse error", { raw: raw.slice(0, 200), error: e instanceof Error ? e.message : String(e) });
            }
          }
        }

        const finalMessage: PersonaMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: accumulatedText,
          createdAt: new Date(),
          isStreaming: false,
          toolCalls: Array.from(toolCallsMap.values()),
        };
        setMessages((prev) => prev.map((msg) => (msg.id === assistantMessageId ? finalMessage : msg)));
        chatLogger.info("sendMessage succeeded", { agentId: targetAgentId, textLength: accumulatedText.length, toolCallCount: toolCallsMap.size });
        chatLogger.debug("sendMessage completed", { agentId: targetAgentId, textLength: accumulatedText.length, eventCount: toolCallsMap.size + 1 });
        options.onFinish?.(finalMessage);
        return true;
      } catch (err) {
        if (controller.signal.aborted) {
          chatLogger.info("sendMessage aborted", { agentId: targetAgentId });
          chatLogger.debug("stream aborted", { agentId: targetAgentId });
          setMessages((prev) => prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg)));
          return false;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("sendMessage failed", { agentId: targetAgentId, error: errorObj.message });
        chatLogger.error("sendMessage error", { agentId: targetAgentId, error: errorObj.message });
        setError(errorObj);
        options.onError?.(errorObj);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content || `⚠️ Error: ${errorObj.message || "Failed to get response."}`, isStreaming: false }
              : msg,
          ),
        );
        return false;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        finalizeReasoning();
        chatLogger.debug("sendMessage finally", { agentId: targetAgentId, isStreaming: false });
        chatLogger.trace("sendMessage end", { agentId: targetAgentId });
      }
    },
    [agentId, baseUrl, getAuthToken, fetchWithAuth, options, chatLogger, effectiveThreadId],
  );

  const sendMessage = useCallback(
    async (contentToSend?: string, overrideOptions?: SendMessageOverride): Promise<boolean> => {
      const prompt = (contentToSend ?? input).trim();
      if (!prompt || isStreaming) {
        chatLogger.trace("sendMessage skipped", {
          hasPrompt: !!prompt,
          isStreaming,
        });
        if (isStreaming) {
          chatLogger.warn("sendMessage dropped while streaming — caller should queue or disable send", {});
        }
        return false;
      }
      return doSend(prompt, messages, overrideOptions);
    },
    [input, isStreaming, messages, doSend, chatLogger],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      chatLogger.trace("handleInputChange", { length: e.target.value.length });
      setInput(e.target.value);
    },
    [chatLogger],
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      chatLogger.debug("handleSubmit", {});
      void sendMessage();
    },
    [sendMessage, chatLogger],
  );

  const reload = useCallback(async (): Promise<boolean> => {
    if (messages.length === 0 || isStreaming) {
      chatLogger.trace("reload skipped", {
        messageCount: messages.length,
        isStreaming,
      });
      return false;
    }
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) {
      chatLogger.warn("reload no user message", {});
      return false;
    }

    const lastUserMessage = messages[lastUserIndex];
    const truncated = messages.slice(0, lastUserIndex);
    chatLogger.info("reload", { messageId: lastUserMessage.id });
    chatLogger.debug("reload last user", {
      preview: lastUserMessage.content.slice(0, 100),
    });
    return doSend(lastUserMessage.content, truncated);
  }, [isStreaming, messages, doSend, chatLogger]);

  // Unpauses a paused HITL/clarification run. `displayContent` becomes the
  // visible user-turn bubble (e.g. "Approved", or the typed clarification
  // answer) — the server resolves the actual resume value from `resume`
  // itself, `displayContent` is only ever used for its own transcript text.
  const resumeInterrupt = useCallback(
    (resume: PersonaResumeValue, displayContent: string) => {
      chatLogger.info("resumeInterrupt", {
        kind: (resume as { decisions?: unknown[] }).decisions
          ? "hitl"
          : "clarification",
        preview: displayContent.slice(0, 50),
      });
      return sendMessage(displayContent, { resume });
    },
    [sendMessage, chatLogger],
  );

  const dismissPresentedFile = useCallback(() => {
    chatLogger.debug("dismissPresentedFile", {});
    setPresentedFile(null);
  }, [chatLogger]);

  // Manually re-open a workspace file — e.g. a present_file tool card's
  // "Open" button, after the auto-opened drawer was closed or a different
  // file was selected since.
  const openWorkspaceFile = useCallback(
    (path: string) => {
      chatLogger.debug("openWorkspaceFile", { path });
      setPresentedFile({
        path,
        title: path.split("/").pop() || path,
        description: "",
      });
    },
    [chatLogger],
  );

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    isStreaming,
    isLoading: isStreaming,
    isLoadingHistory,
    error,
    interrupt,
    resumeInterrupt,
    files,
    todos,
    presentedFile,
    dismissPresentedFile,
    openWorkspaceFile,
    sandboxCommands,
    stop,
    reload,
    clear,
    startNewChat,
    currentThreadId: effectiveThreadId,
    isEphemeral: !effectiveThreadId,
    setMessages,
    loadThreadMessages,
  };
}
