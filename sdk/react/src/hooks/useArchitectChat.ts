"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import { openSSEStream } from "../streaming.js";
import type {
  PersonaInterrupt,
  PersonaMessage,
  PersonaPresentedFile,
  PersonaResumeValue,
  PersonaStreamingEvent,
  PersonaSubagentActivityEntry,
  PersonaTodo,
  PersonaToolCall,
  PersonaWorkspaceFile,
  SendArchitectMessageOverride,
  UseArchitectChatOptions,
} from "../types.js";
import {
  isErrorToolContent,
  normalizePendingInterrupt,
  normalizeWorkspaceFiles,
  parsePresentedFile,
  persistedTraceToActivityEntries,
  type PersistedSubagentTraceItem,
} from "./streamEventHelpers.js";

/**
 * The Developer Platform Architect's own reserved Agent id
 * (`DEVELOPER_ARCHITECT_AGENT_ID` in agent-backend/src/modules/agents/
 * architectConstants.js) — it isn't a row in the Agent collection, but the
 * backend's `POST /api/v1/developer/threads` special-cases exactly this id
 * past its usual Agent-existence check (see developerThread.controller.js's
 * `assertAgentAccessible`), so a named Architect Thread can be created the
 * same way as for a real Agent. Kept in sync with that backend constant —
 * update both together if it ever changes.
 */
export const ARCHITECT_AGENT_ID = "000000000000000000000002";

/**
 * Runs the Agent Architect co-pilot — a conversational tool-calling agent
 * that creates/edits the caller's own Agents (`manage_agent`, `manage_skill`,
 * etc.), reached over the runtime's `POST /architect` route (see
 * `@personaai/runtime`'s `routes/architect.ts`). Structurally a trimmed
 * `useChat`: same streaming/interrupt/reload/thread-resume mechanics, but
 * with no `agentId` to pass (the Architect is a single fixed target) and no
 * `voice`/`sandboxCommands` (the Architect has no voice mode and no
 * `execute` tool).
 *
 * `threadId` resume only has an effect when the underlying credential
 * asserts an external user — a bare Project credential has no Subject for a
 * Thread to belong to, so the backend silently keeps its single
 * deterministic per-Project conversation either way (see
 * `developerArchitect.controller.js`'s doc comment).
 */
export function useArchitectChat(options: UseArchitectChatOptions = {}) {
  const { fetchWithAuth, baseUrl, getAuthToken, logger } = usePersonaContext();
  const chatLogger = useMemo(() => logger.child("architect"), [logger]);
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
    chatLogger.debug("useArchitectChat init", {
      threadId,
      hasInitialMessages: !!options.initialMessages?.length,
    });
    chatLogger.trace("useArchitectChat options", {
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedThreadIdRef = useRef<string | undefined>(undefined);

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

  // Internal stream executor — shared by sendMessage and reload so reload can
  // supply a truncated base (mirrors useChat's doSend). Caller has already
  // validated prompt/isStreaming.
  const doSend = useCallback(
    async (
      prompt: string,
      baseMessages: PersonaMessage[],
      overrideOptions?: SendArchitectMessageOverride,
    ): Promise<boolean> => {
      chatLogger.debug("sendMessage start", {
        promptPreview: prompt.slice(0, 100),
        threadId: effectiveThreadId ?? (overrideOptions?.threadId as string | undefined),
        hasResume: !!overrideOptions?.resume,
        messageCount: baseMessages.length,
      });
      chatLogger.trace("sendMessage details", {
        promptPreview: prompt.slice(0, 200),
        hasResume: !!overrideOptions?.resume,
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
          chatLogger.info("minting real thread for ephemeral architect chat", {});
          const createRes = await fetchWithAuth("/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: ARCHITECT_AGENT_ID }),
          });
          if (!createRes.ok) throw new Error(`Failed to create thread: ${createRes.statusText}`);
          const createBody = await createRes.json();
          const created = (createBody?.data ?? createBody) as { _id?: string; id?: string };
          resolvedThreadId = created._id ?? created.id;
          if (!resolvedThreadId) throw new Error("Thread creation returned no id");
          setInternalThreadId(resolvedThreadId);
          loadedThreadIdRef.current = resolvedThreadId;
          options.onThreadCreated?.(resolvedThreadId);
          chatLogger.info("ephemeral architect chat minted", { threadId: resolvedThreadId });
        }
        chatLogger.trace("resolved threadId", { threadId: resolvedThreadId });

        const token = getAuthToken ? await getAuthToken() : null;
        chatLogger.debug("opening SSE stream", {
          hasToken: !!token,
          hasThreadId: !!resolvedThreadId,
        });
        const stream = await openSSEStream({
          url: `${baseUrl}/architect`,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: payloadMessages,
            threadId: resolvedThreadId,
            resume: overrideOptions?.resume,
          }),
          signal: controller.signal,
        });

        if (!stream.ok) {
          chatLogger.warn("SSE stream not ok", { status: stream.status, errorText: stream.errorText });
          chatLogger.error("architect stream failed", { status: stream.status, error: stream.errorText });
          throw new Error(`Architect error (${stream.status}): ${stream.errorText ?? "Stream failed"}`);
        }
        chatLogger.debug("SSE stream opened", { status: stream.status });
        chatLogger.info("architect stream started", { threadId: resolvedThreadId });

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
                  options.onTitle?.(title);
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
        chatLogger.info("sendMessage succeeded", { textLength: accumulatedText.length, toolCallCount: toolCallsMap.size });
        chatLogger.debug("sendMessage completed", { textLength: accumulatedText.length, eventCount: toolCallsMap.size + 1 });
        options.onFinish?.(finalMessage);
        return true;
      } catch (err) {
        if (controller.signal.aborted) {
          chatLogger.info("sendMessage aborted", {});
          chatLogger.debug("stream aborted", {});
          setMessages((prev) => prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg)));
          return false;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("sendMessage failed", { error: errorObj.message });
        chatLogger.error("sendMessage error", { error: errorObj.message });
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
        chatLogger.debug("sendMessage finally", { isStreaming: false });
        chatLogger.trace("sendMessage end", {});
      }
    },
    [baseUrl, getAuthToken, fetchWithAuth, options, chatLogger, effectiveThreadId],
  );

  const sendMessage = useCallback(
    async (contentToSend?: string, overrideOptions?: SendArchitectMessageOverride): Promise<boolean> => {
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
