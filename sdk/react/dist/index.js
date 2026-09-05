// src/context/PersonaContext.tsx
import { createContext, useContext, useMemo } from "react";
import { createLogger } from "@personaai/logger";
import { jsx } from "react/jsx-runtime";
var PersonaContext = createContext(null);
function PersonaProvider({
  baseUrl,
  getAuthToken,
  defaultAgentId,
  logLevel,
  logger: loggerProp,
  children
}) {
  const normalizedBaseUrl = useMemo(
    () => baseUrl.replace(/\/+$/, ""),
    [baseUrl]
  );
  const logger = useMemo(() => {
    const l = loggerProp ?? createLogger(
      "react",
      logLevel !== void 0 ? { level: logLevel } : void 0
    );
    l.debug("PersonaProvider created", {
      baseUrl: normalizedBaseUrl,
      hasDefaultAgentId: !!defaultAgentId
    });
    l.info("PersonaProvider mounted", { baseUrl: normalizedBaseUrl });
    l.trace("PersonaProvider config", {
      baseUrl: normalizedBaseUrl,
      hasGetAuthToken: !!getAuthToken
    });
    return l;
  }, [loggerProp, logLevel, normalizedBaseUrl, defaultAgentId, getAuthToken]);
  const value = useMemo(() => {
    async function fetchWithAuth(path, init = {}) {
      const token = getAuthToken ? await getAuthToken() : null;
      const headers = new Headers(init.headers || {});
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        logger.trace("fetchWithAuth with token", { path });
      } else {
        logger.trace("fetchWithAuth without token", { path });
        logger.debug("fetchWithAuth no token", { path });
      }
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${normalizedBaseUrl}${cleanPath}`;
      logger.debug("fetchWithAuth request", {
        path: cleanPath,
        url,
        hasToken: !!token
      });
      logger.trace("fetchWithAuth details", {
        url,
        path: cleanPath,
        hasToken: !!token
      });
      try {
        const res = await fetch(url, {
          ...init,
          headers
        });
        logger.debug("fetchWithAuth response", {
          path: cleanPath,
          status: res.status,
          ok: res.ok
        });
        if (!res.ok) {
          logger.warn("fetchWithAuth non-ok", {
            path: cleanPath,
            status: res.status
          });
        } else {
          logger.info("fetchWithAuth succeeded", {
            path: cleanPath,
            status: res.status
          });
        }
        return res;
      } catch (err) {
        logger.error("fetchWithAuth failed", {
          path: cleanPath,
          error: err instanceof Error ? err.message : String(err)
        });
        throw err;
      }
    }
    return {
      baseUrl: normalizedBaseUrl,
      getAuthToken,
      defaultAgentId,
      fetchWithAuth,
      logger
    };
  }, [normalizedBaseUrl, getAuthToken, defaultAgentId, logger]);
  return /* @__PURE__ */ jsx(PersonaContext.Provider, { value, children });
}
function usePersonaContext() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error(
      "usePersonaContext must be used within a <PersonaProvider>"
    );
  }
  return context;
}

// src/hooks/useChat.ts
import { useCallback, useEffect, useMemo as useMemo2, useRef, useState } from "react";

// src/streaming.ts
function supportsStreamingFetch() {
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    return false;
  }
  return typeof fetch !== "undefined" && typeof ReadableStream !== "undefined";
}
function fetchReader(response, controller) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  return {
    async read() {
      const { done, value } = await reader.read();
      if (done) return { done: true };
      return { done: false, value: decoder.decode(value, { stream: true }) };
    },
    cancel() {
      controller.abort();
      void reader.cancel().catch(() => {
      });
    }
  };
}
function xhrStream(opts) {
  return new Promise((resolveStream, rejectStream) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", opts.url);
    for (const [key, val] of Object.entries(opts.headers))
      xhr.setRequestHeader(key, val);
    let consumed = 0;
    let finished = false;
    let failure = null;
    const queue = [];
    let waiting = null;
    let waitingReject = null;
    let headersResolved = false;
    const pump = () => {
      const text = xhr.responseText;
      if (text.length <= consumed) return;
      const chunk = text.slice(consumed);
      consumed = text.length;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        waitingReject = null;
        resolve({ done: false, value: chunk });
      } else {
        queue.push(chunk);
      }
    };
    const finish = (err) => {
      if (finished) return;
      finished = true;
      failure = err ?? null;
      if (waiting) {
        const resolve = waiting;
        const reject = waitingReject;
        waiting = null;
        waitingReject = null;
        if (err && reject) reject(err);
        else resolve({ done: true });
      }
    };
    const reader = {
      read() {
        if (queue.length > 0) {
          return Promise.resolve({ done: false, value: queue.shift() });
        }
        if (finished) {
          return failure ? Promise.reject(failure) : Promise.resolve({ done: true });
        }
        return new Promise((resolve, reject) => {
          waiting = resolve;
          waitingReject = reject;
        });
      },
      cancel() {
        finish();
        xhr.abort();
      }
    };
    const resolveHeaders = () => {
      if (headersResolved) return;
      headersResolved = true;
      const ok = xhr.status >= 200 && xhr.status < 300;
      resolveStream({
        status: xhr.status,
        ok,
        getHeader: (name) => xhr.getResponseHeader(name),
        reader
      });
    };
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 2) {
        resolveHeaders();
      } else if (xhr.readyState === 3) {
        resolveHeaders();
        pump();
      } else if (xhr.readyState === 4) {
        resolveHeaders();
        pump();
        finish();
      }
    };
    xhr.onerror = () => {
      const err = new Error("Network request failed");
      if (!headersResolved) rejectStream(err);
      finish(err);
    };
    xhr.ontimeout = () => {
      const err = new Error("Network request timed out");
      if (!headersResolved) rejectStream(err);
      finish(err);
    };
    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        finish();
      } else {
        opts.signal.addEventListener("abort", () => {
          finish();
          xhr.abort();
        });
      }
    }
    xhr.send(opts.body);
  });
}
async function openSSEStream(opts) {
  if (!supportsStreamingFetch()) {
    return xhrStream(opts);
  }
  const controller = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort());
  }
  const response = await fetch(opts.url, {
    method: "POST",
    headers: opts.headers,
    body: opts.body,
    signal: controller.signal
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Stream failed");
    return {
      status: response.status,
      ok: false,
      errorText,
      getHeader: (name) => response.headers.get(name),
      reader: {
        read: async () => ({ done: true }),
        cancel: () => controller.abort()
      }
    };
  }
  if (!response.body) {
    const text = await response.text();
    let handed = false;
    return {
      status: response.status,
      ok: true,
      getHeader: (name) => response.headers.get(name),
      reader: {
        read: async () => handed ? { done: true } : (handed = true, { done: false, value: text }),
        cancel: () => controller.abort()
      }
    };
  }
  return {
    status: response.status,
    ok: true,
    getHeader: (name) => response.headers.get(name),
    reader: fetchReader(response, controller)
  };
}

// src/hooks/useChat.ts
function isErrorToolContent(content) {
  if (typeof content !== "string" || !content.trim().startsWith("{"))
    return false;
  try {
    return JSON.parse(content)?.status === "error";
  } catch {
    return false;
  }
}
function persistedTraceToActivityEntries(items) {
  const entries = [];
  for (const item of items) {
    if (item.type === "text") {
      if (item.text) entries.push({ kind: "text", delta: item.text });
    } else {
      entries.push({
        kind: "tool_start",
        toolName: item.name,
        args: item.argsText
      });
      if (item.status === "completed") {
        entries.push({
          kind: "tool_result",
          toolName: item.name,
          result: item.resultText
        });
      }
    }
  }
  return entries;
}
function parsePresentedFile(content) {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.status !== "success" || typeof parsed.filePath !== "string")
      return null;
    return {
      path: parsed.filePath,
      title: typeof parsed.title === "string" ? parsed.title : parsed.filePath,
      description: typeof parsed.description === "string" ? parsed.description : ""
    };
  } catch {
    return null;
  }
}
function normalizeWorkspaceFiles(raw) {
  const normalized = {};
  for (const [path, file] of Object.entries(raw || {})) {
    normalized[path] = {
      content: file.content,
      size: file.size,
      createdAt: file.created_at,
      modifiedAt: file.modified_at
    };
  }
  return normalized;
}
function normalizePendingInterrupt(pending) {
  if (!pending || typeof pending !== "object") return null;
  const p = pending;
  if (p.kind === "hitl") {
    return {
      kind: "hitl",
      actionRequests: p.value?.actionRequests ?? [],
      reviewConfigs: p.value?.reviewConfigs ?? []
    };
  }
  if (p.kind === "clarification") {
    return {
      kind: "clarification",
      questions: p.value?.questions ?? []
    };
  }
  return null;
}
function useChat(options = {}) {
  const { defaultAgentId, fetchWithAuth, baseUrl, getAuthToken, logger } = usePersonaContext();
  const chatLogger = useMemo2(() => logger.child("chat"), [logger]);
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  const didLogInitRef = useRef(false);
  if (!didLogInitRef.current) {
    didLogInitRef.current = true;
    chatLogger.debug("useChat init", {
      agentId,
      threadId,
      hasInitialMessages: !!options.initialMessages?.length
    });
    chatLogger.trace("useChat options", {
      agentId,
      threadId,
      initialMessageCount: options.initialMessages?.length ?? 0
    });
  }
  const [messages, setMessages] = useState(
    options.initialMessages || []
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState(null);
  const [interrupt, setInterrupt] = useState(null);
  const [files, setFiles] = useState({});
  const [todos, setTodos] = useState([]);
  const [presentedFile, setPresentedFile] = useState(null);
  const abortControllerRef = useRef(null);
  const loadedThreadIdRef = useRef(void 0);
  const voiceThreadRef = useRef(threadId);
  const voicePrevLenRef = useRef(0);
  const voiceStreamingIdRef = useRef(null);
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      chatLogger.info("stop streaming", {});
      chatLogger.debug("abort controller", {
        hasController: !!abortControllerRef.current
      });
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      chatLogger.debug("streaming stopped");
    } else {
      chatLogger.trace("stop called \u2014 no active stream");
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
  }, [stop, chatLogger, messages.length]);
  const loadThreadMessages = useCallback(
    async (id) => {
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
        const raw = data?.messages ?? [];
        const subagentTraces = data?.subagentTraces ?? {};
        const loaded = raw.map((m, i) => ({
          id: m.id || `history-${id}-${i}`,
          role: m.role,
          content: m.content,
          createdAt: /* @__PURE__ */ new Date(),
          toolCalls: m.toolCalls?.map((tc) => {
            const trace = subagentTraces[tc.toolCallId];
            return Array.isArray(trace) && trace.length > 0 ? {
              ...tc,
              subagentActivity: persistedTraceToActivityEntries(trace)
            } : tc;
          })
        }));
        setMessages(loaded);
        setInterrupt(normalizePendingInterrupt(data?.pendingInterrupt));
        setFiles(normalizeWorkspaceFiles(data?.state?.files ?? {}));
        setTodos(data?.state?.todos ?? []);
        chatLogger.info("loadThreadMessages succeeded", {
          threadId: id,
          messageCount: loaded.length
        });
        chatLogger.debug("loadThreadMessages completed", {
          threadId: id,
          messageCount: loaded.length
        });
        return loaded;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("loadThreadMessages failed", {
          threadId: id,
          error: errorObj.message
        });
        chatLogger.error("loadThreadMessages error", {
          threadId: id,
          error: errorObj.message
        });
        setError(errorObj);
        return [];
      } finally {
        setIsLoadingHistory(false);
        chatLogger.trace("loadThreadMessages end", { threadId: id });
      }
    },
    [fetchWithAuth, chatLogger]
  );
  useEffect(() => {
    if (!threadId || isStreaming) {
      chatLogger.trace("auto-load skipped", { threadId, isStreaming });
      return;
    }
    if (loadedThreadIdRef.current === threadId) {
      chatLogger.trace("auto-load already loaded", { threadId });
      return;
    }
    if (messages.length > 0) {
      chatLogger.trace("auto-load has messages", {
        threadId,
        count: messages.length
      });
      return;
    }
    loadedThreadIdRef.current = threadId;
    chatLogger.info("auto-load thread history", { threadId });
    chatLogger.debug("loadThreadMessages trigger", { threadId });
    void loadThreadMessages(threadId);
  }, [threadId, isStreaming, messages.length, loadThreadMessages, chatLogger]);
  const voice = options.voice;
  useEffect(() => {
    if (!voice) return;
    if (voiceThreadRef.current !== threadId) {
      voiceThreadRef.current = threadId;
      voicePrevLenRef.current = voice.transcript.length;
      voiceStreamingIdRef.current = null;
      return;
    }
    const isVoiceActive = voice.state !== "idle" && voice.state !== "ended" && voice.state !== "error";
    const curLen = voice.transcript.length;
    if (curLen < voicePrevLenRef.current) {
      voicePrevLenRef.current = 0;
      voiceStreamingIdRef.current = null;
    }
    if (!isVoiceActive) {
      voicePrevLenRef.current = voice.transcript.length;
      if (voiceStreamingIdRef.current) {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages(
          (prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m)
        );
      }
      return;
    }
    if (curLen > voicePrevLenRef.current) {
      const newLines = voice.transcript.slice(voicePrevLenRef.current);
      voicePrevLenRef.current = curLen;
      for (const line of newLines) {
        const text = (line.text || "").trim();
        if (!text) continue;
        const role = line.speaker === "user" ? "user" : "assistant";
        const voiceId = `voice-${line.id}`;
        setMessages((prev) => {
          if (prev.some((m) => m.id === voiceId)) return prev;
          if (prev.some(
            (m) => !m.id.startsWith("voice-") && m.role === role && m.content.trim() === text
          ))
            return prev;
          const last = prev[prev.length - 1];
          if (last?.id.startsWith("voice-") && last.role === "assistant" && role === "assistant") {
            const merged = text.startsWith(last.content) ? text : `${last.content} ${text}`.trim();
            return [...prev.slice(0, -1), { ...last, content: merged, isStreaming: false }];
          }
          return [...prev, { id: voiceId, role, content: text, createdAt: /* @__PURE__ */ new Date() }];
        });
      }
    }
    const partialText = voice.partial?.speaker === "agent" ? voice.partial.text.trim() : "";
    if (partialText) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id.startsWith("voice-") && last.role === "assistant") {
          voiceStreamingIdRef.current = last.id;
          return [...prev.slice(0, -1), { ...last, content: partialText, isStreaming: true }];
        }
        const id = voiceStreamingIdRef.current || `voice-partial-${Date.now()}`;
        voiceStreamingIdRef.current = id;
        return [...prev, { id, role: "assistant", content: partialText, isStreaming: true, createdAt: /* @__PURE__ */ new Date() }];
      });
    } else if (voice.state !== "speaking" && voiceStreamingIdRef.current) {
      const doneId = voiceStreamingIdRef.current;
      voiceStreamingIdRef.current = null;
      setMessages(
        (prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m)
      );
    }
  }, [voice?.transcript, voice?.partial, voice?.state, threadId]);
  const sendMessage = useCallback(
    async (contentToSend, overrideOptions) => {
      const prompt = (contentToSend ?? input).trim();
      if (!prompt || isStreaming) {
        chatLogger.trace("sendMessage skipped", {
          hasPrompt: !!prompt,
          isStreaming
        });
        return;
      }
      const targetAgentId = overrideOptions?.agentId || agentId;
      if (!targetAgentId) {
        const err = new Error("No Agent ID specified for useChat.");
        chatLogger.warn("sendMessage no agentId", {});
        chatLogger.error("sendMessage failed \u2014 no agent", {
          error: err.message
        });
        setError(err);
        options.onError?.(err);
        return;
      }
      chatLogger.debug("sendMessage start", {
        promptPreview: prompt.slice(0, 100),
        agentId: targetAgentId,
        threadId: threadId ?? overrideOptions?.threadId,
        hasResume: !!overrideOptions?.resume,
        messageCount: messages.length
      });
      chatLogger.trace("sendMessage details", {
        agentId: targetAgentId,
        promptPreview: prompt.slice(0, 200),
        hasResume: !!overrideOptions?.resume
      });
      const userMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "user",
        content: prompt,
        createdAt: /* @__PURE__ */ new Date()
      };
      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const placeholderAssistant = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: /* @__PURE__ */ new Date(),
        isStreaming: true,
        toolCalls: []
      };
      const nextMessages = [...messages, userMessage];
      setMessages([...nextMessages, placeholderAssistant]);
      setInput("");
      setIsStreaming(true);
      setError(null);
      setInterrupt(null);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const finalizeReasoning = () => {
        setMessages(
          (prev) => prev.map(
            (m) => m.role === "reasoning" && m.isStreaming ? { ...m, isStreaming: false } : m
          )
        );
      };
      try {
        const payloadMessages = nextMessages.filter((m) => m.role !== "reasoning").map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        const resolvedThreadId = await (overrideOptions?.threadId ?? options.threadId);
        chatLogger.trace("resolved threadId", { threadId: resolvedThreadId });
        const token = getAuthToken ? await getAuthToken() : null;
        chatLogger.debug("opening SSE stream", {
          agentId: targetAgentId,
          hasToken: !!token,
          hasThreadId: !!resolvedThreadId
        });
        const stream = await openSSEStream({
          url: `${baseUrl}/chat`,
          headers: {
            "Content-Type": "application/json",
            ...token ? { Authorization: `Bearer ${token}` } : {}
          },
          body: JSON.stringify({
            agentId: targetAgentId,
            messages: payloadMessages,
            threadId: resolvedThreadId,
            resume: overrideOptions?.resume
          }),
          signal: controller.signal
        });
        if (!stream.ok) {
          chatLogger.warn("SSE stream not ok", {
            status: stream.status,
            errorText: stream.errorText
          });
          chatLogger.error("chat stream failed", {
            agentId: targetAgentId,
            status: stream.status,
            error: stream.errorText
          });
          throw new Error(
            `Chat error (${stream.status}): ${stream.errorText ?? "Stream failed"}`
          );
        }
        chatLogger.debug("SSE stream opened", {
          agentId: targetAgentId,
          status: stream.status
        });
        chatLogger.info("chat stream started", {
          agentId: targetAgentId,
          threadId: resolvedThreadId
        });
        const reader = stream.reader;
        let buffer = "";
        let accumulatedText = "";
        const toolCallsMap = /* @__PURE__ */ new Map();
        let streamSeq = 0;
        let activeReasoningId = null;
        const reasoningById = /* @__PURE__ */ new Map();
        const patchAssistant = (patch) => {
          setMessages(
            (prev) => prev.map(
              (msg) => msg.id === assistantMessageId ? {
                ...msg,
                toolCalls: Array.from(toolCallsMap.values()),
                ...patch
              } : msg
            )
          );
        };
        const insertReasoningMessage = (id, seq) => {
          const msg = {
            id,
            role: "reasoning",
            content: "",
            createdAt: /* @__PURE__ */ new Date(),
            isStreaming: true,
            seq
          };
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
              const event = JSON.parse(raw);
              chatLogger.trace("stream event", { type: event.type, event });
              options.onEvent?.(event);
              if (event.type === "TEXT_MESSAGE_CHUNK" && event.delta) {
                chatLogger.debug("text chunk", {
                  deltaLength: event.delta.length
                });
                accumulatedText += event.delta;
                patchAssistant({ content: accumulatedText, isStreaming: true });
              } else if (event.type === "TOOL_CALL_CHUNK" && event.toolCallId) {
                chatLogger.debug("tool call chunk", {
                  toolCallId: event.toolCallId,
                  toolCallName: event.toolCallName
                });
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.args = (existing.args || "") + (event.delta || "");
                } else {
                  toolCallsMap.set(event.toolCallId, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolCallName || "",
                    args: event.delta || "",
                    seq: streamSeq++
                  });
                }
                patchAssistant({});
              } else if (event.type === "TOOL_CALL_RESULT") {
                chatLogger.debug("tool call result", {
                  toolCallId: event.toolCallId
                });
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.content;
                  existing.isError = isErrorToolContent(event.content);
                  if (existing.isError)
                    chatLogger.warn("tool call error", {
                      toolCallId: event.toolCallId
                    });
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
                  todoCount: event.snapshot.todos?.length ?? 0
                });
                setFiles(normalizeWorkspaceFiles(event.snapshot.files));
                setTodos(event.snapshot.todos);
              } else if (event.type === "REASONING_MESSAGE_START" && event.messageId) {
                chatLogger.debug("reasoning start", {
                  messageId: event.messageId
                });
                activeReasoningId = event.messageId;
                reasoningById.set(event.messageId, { content: "" });
                insertReasoningMessage(event.messageId, streamSeq++);
              } else if (event.type === "REASONING_MESSAGE_CONTENT") {
                let rid = event.messageId || activeReasoningId || "";
                if (!rid || !reasoningById.has(rid)) {
                  rid = rid || `reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  activeReasoningId = rid;
                  reasoningById.set(rid, { content: "" });
                  insertReasoningMessage(rid, streamSeq++);
                  chatLogger.debug("reasoning lazy start", { messageId: rid });
                }
                const entry = reasoningById.get(rid);
                entry.content += event.delta;
                chatLogger.trace("reasoning content", {
                  messageId: rid,
                  deltaLength: event.delta?.length ?? 0
                });
                setMessages(
                  (prev) => prev.map(
                    (m) => m.id === rid ? { ...m, content: entry.content, isStreaming: true } : m
                  )
                );
              } else if (event.type === "REASONING_END") {
                chatLogger.debug("reasoning end", {
                  messageId: activeReasoningId
                });
                const rid = activeReasoningId;
                activeReasoningId = null;
                if (rid) {
                  setMessages(
                    (prev) => prev.map(
                      (m) => m.id === rid ? { ...m, isStreaming: false } : m
                    )
                  );
                }
              } else if (event.type === "CUSTOM") {
                chatLogger.debug("custom event", { name: event.name });
                if (event.name === "hitl_request") {
                  const value2 = event.value;
                  chatLogger.info("hitl interrupt", {
                    actionCount: value2.actionRequests?.length ?? 0
                  });
                  setInterrupt({
                    kind: "hitl",
                    actionRequests: value2.actionRequests,
                    reviewConfigs: value2.reviewConfigs
                  });
                } else if (event.name === "clarification_request") {
                  const value2 = event.value;
                  chatLogger.info("clarification interrupt", {
                    questionCount: value2.questions?.length ?? 0
                  });
                  setInterrupt({
                    kind: "clarification",
                    questions: value2.questions
                  });
                } else if (event.name === "subagent_activity") {
                  const { toolCallId, ...entry } = event.value;
                  chatLogger.trace("subagent activity", {
                    toolCallId,
                    kind: entry.kind
                  });
                  const existing = toolCallsMap.get(toolCallId);
                  if (existing) {
                    existing.subagentActivity = [
                      ...existing.subagentActivity || [],
                      entry
                    ];
                    patchAssistant({});
                  }
                }
              } else if (event.type === "RUN_ERROR") {
                chatLogger.warn("run error", {
                  message: event.message,
                  code: event.code
                });
                chatLogger.error("stream run error", {
                  code: event.code,
                  message: event.message
                });
                throw new Error(event.message || "Stream error from agent");
              } else {
                chatLogger.trace("unhandled event", { type: event.type });
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith("Stream error")) {
                throw e;
              }
              chatLogger.warn("event parse error", {
                raw: raw.slice(0, 200),
                error: e instanceof Error ? e.message : String(e)
              });
            }
          }
        }
        const finalMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: accumulatedText,
          createdAt: /* @__PURE__ */ new Date(),
          isStreaming: false,
          toolCalls: Array.from(toolCallsMap.values())
        };
        setMessages(
          (prev) => prev.map(
            (msg) => msg.id === assistantMessageId ? finalMessage : msg
          )
        );
        chatLogger.info("sendMessage succeeded", {
          agentId: targetAgentId,
          textLength: accumulatedText.length,
          toolCallCount: toolCallsMap.size
        });
        chatLogger.debug("sendMessage completed", {
          agentId: targetAgentId,
          textLength: accumulatedText.length,
          eventCount: toolCallsMap.size + 1
        });
        options.onFinish?.(finalMessage);
      } catch (err) {
        if (controller.signal.aborted) {
          chatLogger.info("sendMessage aborted", { agentId: targetAgentId });
          chatLogger.debug("stream aborted", { agentId: targetAgentId });
          setMessages(
            (prev) => prev.map(
              (msg) => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
            )
          );
          return;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("sendMessage failed", {
          agentId: targetAgentId,
          error: errorObj.message
        });
        chatLogger.error("sendMessage error", {
          agentId: targetAgentId,
          error: errorObj.message
        });
        setError(errorObj);
        options.onError?.(errorObj);
        setMessages(
          (prev) => prev.map(
            (msg) => msg.id === assistantMessageId ? {
              ...msg,
              content: msg.content || `\u26A0\uFE0F Error: ${errorObj.message || "Failed to get response."}`,
              isStreaming: false
            } : msg
          )
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        finalizeReasoning();
        chatLogger.debug("sendMessage finally", {
          agentId: targetAgentId,
          isStreaming: false
        });
        chatLogger.trace("sendMessage end", { agentId: targetAgentId });
      }
    },
    [
      agentId,
      baseUrl,
      getAuthToken,
      input,
      isStreaming,
      messages,
      options,
      chatLogger,
      threadId
    ]
  );
  const handleInputChange = useCallback(
    (e) => {
      chatLogger.trace("handleInputChange", { length: e.target.value.length });
      setInput(e.target.value);
    },
    [chatLogger]
  );
  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      chatLogger.debug("handleSubmit", {});
      void sendMessage();
    },
    [sendMessage, chatLogger]
  );
  const reload = useCallback(() => {
    if (messages.length === 0 || isStreaming) {
      chatLogger.trace("reload skipped", {
        messageCount: messages.length,
        isStreaming
      });
      return;
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
      return;
    }
    const lastUserMessage = messages[lastUserIndex];
    chatLogger.info("reload", { messageId: lastUserMessage.id });
    chatLogger.debug("reload last user", {
      preview: lastUserMessage.content.slice(0, 100)
    });
    setMessages(messages.slice(0, lastUserIndex));
    void sendMessage(lastUserMessage.content);
  }, [isStreaming, messages, sendMessage, chatLogger]);
  const resumeInterrupt = useCallback(
    (resume, displayContent) => {
      chatLogger.info("resumeInterrupt", {
        kind: resume.decisions ? "hitl" : "clarification",
        preview: displayContent.slice(0, 50)
      });
      return sendMessage(displayContent, { resume });
    },
    [sendMessage, chatLogger]
  );
  const dismissPresentedFile = useCallback(() => {
    chatLogger.debug("dismissPresentedFile", {});
    setPresentedFile(null);
  }, [chatLogger]);
  const openWorkspaceFile = useCallback(
    (path) => {
      chatLogger.debug("openWorkspaceFile", { path });
      setPresentedFile({
        path,
        title: path.split("/").pop() || path,
        description: ""
      });
    },
    [chatLogger]
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
    setMessages,
    loadThreadMessages
  };
}

// src/hooks/useMemory.ts
import { useCallback as useCallback2, useEffect as useEffect2, useState as useState2 } from "react";
function useMemory(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [memory, setMemory] = useState2({
    userFiles: [],
    agentMemories: []
  });
  const [isLoading, setIsLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const fetchMemory = useCallback2(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/memory");
      if (!res.ok) {
        throw new Error(`Failed to fetch memory: ${res.statusText}`);
      }
      const data = await res.json();
      setMemory(data);
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return { userFiles: [], agentMemories: [] };
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  const getFile = useCallback2(
    async (params) => {
      const query = new URLSearchParams({ path: params.path });
      if (params.scope) query.set("scope", params.scope);
      if (params.agentId) query.set("agentId", params.agentId);
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`);
      if (!res.ok)
        throw new Error(`Failed to get memory file: ${res.statusText}`);
      return await res.json();
    },
    [fetchWithAuth]
  );
  const writeFile = useCallback2(
    async (params) => {
      const res = await fetchWithAuth("/memory/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      if (!res.ok)
        throw new Error(`Failed to write memory file: ${res.statusText}`);
      const updated = await res.json();
      void fetchMemory();
      return updated;
    },
    [fetchWithAuth, fetchMemory]
  );
  const deleteFile = useCallback2(
    async (params) => {
      const query = new URLSearchParams({ path: params.path });
      if (params.scope) query.set("scope", params.scope);
      if (params.agentId) query.set("agentId", params.agentId);
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`, {
        method: "DELETE"
      });
      if (!res.ok)
        throw new Error(`Failed to delete memory file: ${res.statusText}`);
      void fetchMemory();
    },
    [fetchWithAuth, fetchMemory]
  );
  useEffect2(() => {
    if (autoFetch) {
      void fetchMemory();
    }
  }, [autoFetch, fetchMemory]);
  return {
    memory,
    isLoading,
    error,
    refetch: fetchMemory,
    getFile,
    writeFile,
    deleteFile
  };
}

// src/hooks/useThreads.ts
import { useCallback as useCallback3, useEffect as useEffect3, useState as useState3 } from "react";
function useThreads(autoFetch = true) {
  const { fetchWithAuth, defaultAgentId } = usePersonaContext();
  const [threads, setThreads] = useState3([]);
  const [isLoading, setIsLoading] = useState3(false);
  const [error, setError] = useState3(null);
  const fetchThreads = useCallback3(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/threads");
      if (!res.ok) throw new Error(`Failed to list threads: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || data?.threads || (Array.isArray(data?.data) ? data.data : void 0) || [];
      setThreads(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  const createThread = useCallback3(
    async (agentId) => {
      const targetAgentId = agentId || defaultAgentId;
      const res = await fetchWithAuth("/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: targetAgentId })
      });
      if (!res.ok)
        throw new Error(`Failed to create thread: ${res.statusText}`);
      const data = await res.json();
      const created = data?.data ?? data;
      void fetchThreads();
      return created;
    },
    [fetchWithAuth, defaultAgentId, fetchThreads]
  );
  const deleteThread = useCallback3(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, {
        method: "DELETE"
      });
      if (!res.ok)
        throw new Error(`Failed to delete thread: ${res.statusText}`);
      setThreads((prev) => prev.filter((t) => t._id !== threadId));
    },
    [fetchWithAuth]
  );
  const bulkDeleteThreads = useCallback3(
    async (threadIds) => {
      const res = await fetchWithAuth("/threads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: threadIds })
      });
      if (!res.ok)
        throw new Error(`Failed to bulk-delete threads: ${res.statusText}`);
      const data = await res.json();
      const result = data?.data ?? data;
      const deletedSet = new Set(result.deleted);
      setThreads((prev) => prev.filter((t) => !deletedSet.has(t._id)));
      return result;
    },
    [fetchWithAuth]
  );
  const deleteAllThreads = useCallback3(async () => {
    const ids = threads.map((t) => t._id);
    for (let i = 0; i < ids.length; i += 100) {
      await bulkDeleteThreads(ids.slice(i, i + 100));
    }
  }, [threads, bulkDeleteThreads]);
  const updateThread = useCallback3(
    async (threadId, input) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!res.ok)
        throw new Error(`Failed to update thread: ${res.statusText}`);
      const data = await res.json();
      const updated = data?.data ?? data;
      setThreads(
        (prev) => prev.map((t) => t._id === threadId ? { ...t, ...updated } : t)
      );
      return updated;
    },
    [fetchWithAuth]
  );
  const renameThread = useCallback3(
    (threadId, title) => updateThread(threadId, { title }),
    [updateThread]
  );
  const resetThread = useCallback3(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}/reset`, {
        method: "POST"
      });
      if (!res.ok) throw new Error(`Failed to reset thread: ${res.statusText}`);
      const data = await res.json();
      const reset = data?.data ?? data;
      setThreads(
        (prev) => prev.map((t) => t._id === threadId ? { ...t, ...reset } : t)
      );
      return reset;
    },
    [fetchWithAuth]
  );
  const getThread = useCallback3(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}`);
      if (!res.ok) throw new Error(`Failed to fetch thread: ${res.statusText}`);
      const data = await res.json();
      return data?.data ?? data;
    },
    [fetchWithAuth]
  );
  useEffect3(() => {
    if (autoFetch) {
      void fetchThreads();
    }
  }, [autoFetch, fetchThreads]);
  return {
    threads,
    isLoading,
    error,
    refetch: fetchThreads,
    createThread,
    deleteThread,
    bulkDeleteThreads,
    deleteAllThreads,
    updateThread,
    renameThread,
    resetThread,
    getThread
  };
}

// src/hooks/useVoice.ts
import { useCallback as useCallback4, useEffect as useEffect4, useMemo as useMemo3, useRef as useRef2, useState as useState4 } from "react";

// src/hooks/voiceWorklets.ts
var RECORDER_WORKLET_SOURCE = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._chunkSamples = 320; // 20ms @ 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this._buffer.push(channel[i]);
      }
      while (this._buffer.length >= this._chunkSamples) {
        const chunk = this._buffer.splice(0, this._chunkSamples);
        const int16 = new Int16Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
`;
var PLAYER_WORKLET_SOURCE = `
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._readOffset = 0;
    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === 'flush') {
        this._queue = [];
        this._readOffset = 0;
        return;
      }
      const int16 = new Int16Array(msg);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000;
      }
      this._queue.push(float32);
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    let outIdx = 0;
    while (outIdx < output.length) {
      if (this._queue.length === 0) {
        output[outIdx++] = 0;
        continue;
      }
      const current = this._queue[0];
      const remaining = current.length - this._readOffset;
      const toCopy = Math.min(remaining, output.length - outIdx);
      output.set(current.subarray(this._readOffset, this._readOffset + toCopy), outIdx);
      outIdx += toCopy;
      this._readOffset += toCopy;
      if (this._readOffset >= current.length) {
        this._queue.shift();
        this._readOffset = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);
`;
function toModuleUrl(source) {
  const blob = new Blob([source], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
function recorderWorkletUrl() {
  return toModuleUrl(RECORDER_WORKLET_SOURCE);
}
function playerWorkletUrl() {
  return toModuleUrl(PLAYER_WORKLET_SOURCE);
}

// src/hooks/useVoice.ts
function mergeTranscriptText(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  if (next === prev || prev.endsWith(next)) return prev;
  if (next.startsWith(prev)) return next;
  const needSpace = !/\s$/.test(prev) && !/^\s/.test(next);
  return prev + (needSpace ? " " : "") + next;
}
function useVoice(options = {}) {
  const { defaultAgentId, fetchWithAuth, logger } = usePersonaContext();
  const voiceLogger = useMemo3(() => logger.child("voice"), [logger]);
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  const [state, setState] = useState4("idle");
  const [isMuted, setIsMuted] = useState4(false);
  const [transcript, setTranscript] = useState4(
    []
  );
  const [partial, setPartial] = useState4(
    null
  );
  const [toolCalls, setToolCalls] = useState4([]);
  const [error, setError] = useState4(null);
  const [endReason, setEndReason] = useState4(
    null
  );
  const wsRef = useRef2(null);
  const streamRef = useRef2(null);
  const inputCtxRef = useRef2(null);
  const outputCtxRef = useRef2(null);
  const recorderNodeRef = useRef2(null);
  const playerNodeRef = useRef2(null);
  const acceptedTurnSeqRef = useRef2(0);
  const mountedRef = useRef2(true);
  const lastFinalTurnRef = useRef2(
    null
  );
  useEffect4(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const teardownAudio = useCallback4(() => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {
    }
    streamRef.current = null;
    try {
      recorderNodeRef.current?.disconnect();
    } catch {
    }
    recorderNodeRef.current = null;
    try {
      playerNodeRef.current?.disconnect();
    } catch {
    }
    playerNodeRef.current = null;
    try {
      void inputCtxRef.current?.close();
    } catch {
    }
    inputCtxRef.current = null;
    try {
      void outputCtxRef.current?.close();
    } catch {
    }
    outputCtxRef.current = null;
  }, []);
  const stop = useCallback4(() => {
    voiceLogger.debug("stop() called");
    try {
      wsRef.current?.close(1e3, "client_stop");
    } catch {
    }
    wsRef.current = null;
    teardownAudio();
    if (mountedRef.current) setState("idle");
  }, [teardownAudio, voiceLogger]);
  useEffect4(() => stop, [stop]);
  const startCapture = useCallback4(async (inputSampleRate) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    });
    streamRef.current = stream;
    const inputCtx = new AudioContext({ sampleRate: inputSampleRate });
    inputCtxRef.current = inputCtx;
    await inputCtx.audioWorklet.addModule(recorderWorkletUrl());
    const source = inputCtx.createMediaStreamSource(stream);
    const recorderNode = new AudioWorkletNode(
      inputCtx,
      "pcm-recorder-processor"
    );
    recorderNode.port.onmessage = (event) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(event.data);
      }
    };
    recorderNodeRef.current = recorderNode;
    source.connect(recorderNode);
  }, []);
  const setupPlayback = useCallback4(async (outputSampleRate) => {
    const outputCtx = new AudioContext({ sampleRate: outputSampleRate });
    outputCtxRef.current = outputCtx;
    await outputCtx.audioWorklet.addModule(playerWorkletUrl());
    const playerNode = new AudioWorkletNode(outputCtx, "pcm-player-processor");
    playerNode.connect(outputCtx.destination);
    playerNodeRef.current = playerNode;
  }, []);
  const upsertToolCall = useCallback4(
    (id, patch) => {
      setToolCalls((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return [...prev, { id, status: "running", ...patch }];
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    },
    []
  );
  const handleTranscript = useCallback4((value) => {
    const { speaker, text, isFinal, turnSeq } = value;
    if (!isFinal) {
      setPartial({ id: "partial", speaker, text });
      return;
    }
    setPartial((prev) => prev?.speaker === speaker ? null : prev);
    const last = lastFinalTurnRef.current;
    const sameUserBurst = speaker === "user" && last && last.speaker === speaker && last.turnSeq === turnSeq;
    setTranscript((prev) => {
      const tail = prev[prev.length - 1];
      const agentContinues = speaker === "agent" && tail?.speaker === "agent";
      if (agentContinues || sameUserBurst && tail?.speaker === "user") {
        const merged = mergeTranscriptText(tail.text, text);
        if (merged === tail.text) return prev;
        return prev.map(
          (l, i) => i === prev.length - 1 ? { ...l, text: merged } : l
        );
      }
      return [...prev, { id: `${speaker}-${prev.length}`, speaker, text }];
    });
    lastFinalTurnRef.current = { speaker, turnSeq };
  }, []);
  const handleCustomEvent = useCallback4(
    (name, value) => {
      switch (name) {
        case "voice_session_ready":
          voiceLogger.debug("voice_session_ready", value);
          Promise.all([
            setupPlayback(value.outputSampleRate),
            startCapture(value.inputSampleRate)
          ]).then(() => {
            if (mountedRef.current) setState("listening");
          }).catch((err) => {
            voiceLogger.error("audio graph setup failed", {
              error: err instanceof Error ? err.message : String(err)
            });
            if (mountedRef.current) {
              setError(err instanceof Error ? err : new Error(String(err)));
              setState("error");
            }
          });
          break;
        case "voice_activity":
          if (value.speaker === "user" && value.state === "start") {
            setState("listening");
          } else if (value.speaker === "user" && value.state === "end") {
            setState("thinking");
          } else if (value.speaker === "agent" && value.state === "start") {
            setState("speaking");
          } else if (value.speaker === "agent" && value.state === "end") {
            setState("listening");
          }
          break;
        case "voice_transcript":
          handleTranscript(value);
          break;
        case "voice_interrupted":
          acceptedTurnSeqRef.current = value.turnSeq;
          playerNodeRef.current?.port.postMessage({ type: "flush" });
          break;
        case "voice_session_resumed":
          voiceLogger.info("session transparently resumed");
          break;
        case "voice_session_ended":
          voiceLogger.info("session ended", { reason: value.reason });
          setState("ended");
          setEndReason(value.reason ?? null);
          teardownAudio();
          try {
            wsRef.current?.close();
          } catch {
          }
          wsRef.current = null;
          break;
        default:
          break;
      }
    },
    [handleTranscript, setupPlayback, startCapture, teardownAudio, voiceLogger]
  );
  const handleMessage = useCallback4(
    (event) => {
      if (typeof event.data !== "string") {
        const buf = event.data;
        const view = new DataView(buf);
        const turnSeq = view.getUint32(0, true);
        if (turnSeq >= acceptedTurnSeqRef.current) {
          acceptedTurnSeqRef.current = turnSeq;
          const pcmBytes = buf.slice(4);
          playerNodeRef.current?.port.postMessage(pcmBytes, [pcmBytes]);
        }
        return;
      }
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "CUSTOM":
          handleCustomEvent(
            msg.name,
            msg.value
          );
          break;
        case "TOOL_CALL_CHUNK":
          upsertToolCall(msg.toolCallId, {
            name: msg.toolCallName,
            status: "running"
          });
          break;
        case "TOOL_CALL_RESULT": {
          let parsed = null;
          try {
            parsed = JSON.parse(msg.content);
          } catch {
            parsed = { output: msg.content };
          }
          upsertToolCall(msg.toolCallId, {
            status: parsed?.error ? "error" : "done",
            summary: parsed?.error || (typeof parsed?.output === "string" ? parsed.output : JSON.stringify(parsed?.output ?? ""))
          });
          break;
        }
        case "RUN_ERROR":
          voiceLogger.warn("RUN_ERROR", { message: msg.message });
          setError(
            new Error(msg.message || "The agent run failed.")
          );
          setState("error");
          break;
        default:
          break;
      }
    },
    [handleCustomEvent, upsertToolCall, voiceLogger]
  );
  const start = useCallback4(async () => {
    if (!agentId) {
      const err = new Error(
        "useVoice: no agentId provided and no defaultAgentId set on PersonaProvider"
      );
      setError(err);
      setState("error");
      return;
    }
    setError(null);
    setEndReason(null);
    setTranscript([]);
    setPartial(null);
    setToolCalls([]);
    acceptedTurnSeqRef.current = 0;
    setState("connecting");
    voiceLogger.debug("start() called", { agentId, threadId });
    try {
      const res = await fetchWithAuth("/voice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          ...threadId ? { threadId } : {}
        })
      });
      if (!res.ok) {
        throw new Error(`Failed to start voice session: ${res.statusText}`);
      }
      const data = await res.json();
      const ticket = data?.data ?? data;
      if (!ticket?.wsUrl) {
        throw new Error("Server did not return a voice session URL.");
      }
      const ws = new WebSocket(ticket.wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onmessage = handleMessage;
      ws.onerror = () => {
        voiceLogger.warn("WebSocket error");
        if (mountedRef.current) {
          setError(new Error("Voice connection error."));
          setState("error");
        }
      };
      ws.onclose = () => {
        if (mountedRef.current && wsRef.current === ws) {
          setState((prev) => prev === "error" ? prev : "idle");
        }
      };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      voiceLogger.error("start() failed", { error: errorObj.message });
      if (mountedRef.current) {
        setError(errorObj);
        setState("error");
      }
      teardownAudio();
    }
  }, [agentId, threadId, fetchWithAuth, handleMessage, teardownAudio, voiceLogger]);
  const mute = useCallback4((muted) => {
    setIsMuted(muted);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);
  const sendText = useCallback4((text) => {
    if (!text?.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "voice.text", text }));
  }, []);
  return {
    state,
    isMuted,
    transcript,
    partial,
    toolCalls,
    error,
    endReason,
    start,
    stop,
    mute,
    sendText
  };
}

// src/hooks/useFiles.ts
import { useCallback as useCallback5, useEffect as useEffect5, useState as useState5 } from "react";
function useFiles(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState5([]);
  const [isLoading, setIsLoading] = useState5(false);
  const [isUploading, setIsUploading] = useState5(false);
  const [error, setError] = useState5(null);
  const fetchFiles = useCallback5(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/files");
      if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || data?.files || [];
      setFiles(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  const uploadFile = useCallback5(
    async (fileOrFormData) => {
      setIsUploading(true);
      setError(null);
      try {
        let body;
        if (fileOrFormData instanceof FormData) {
          body = fileOrFormData;
        } else {
          body = new FormData();
          body.append("file", fileOrFormData);
        }
        const res = await fetchWithAuth("/files", {
          method: "POST",
          body
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "Upload failed");
          throw new Error(`Upload error (${res.status}): ${errText}`);
        }
        const uploaded = await res.json();
        void fetchFiles();
        return uploaded;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsUploading(false);
      }
    },
    [fetchWithAuth, fetchFiles]
  );
  const deleteFile = useCallback5(
    async (fileId) => {
      const res = await fetchWithAuth(`/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    },
    [fetchWithAuth]
  );
  const bulkDeleteFiles = useCallback5(
    async (fileIds) => {
      const res = await fetchWithAuth("/files/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fileIds })
      });
      if (!res.ok)
        throw new Error(`Failed to bulk-delete files: ${res.statusText}`);
      const idSet = new Set(fileIds);
      setFiles((prev) => prev.filter((f) => !idSet.has(f.id)));
      return await res.json();
    },
    [fetchWithAuth]
  );
  const getDownloadUrl = useCallback5((fileId) => {
    return `/files/${fileId}`;
  }, []);
  useEffect5(() => {
    if (autoFetch) {
      void fetchFiles();
    }
  }, [autoFetch, fetchFiles]);
  return {
    files,
    isLoading,
    isUploading,
    error,
    refetch: fetchFiles,
    uploadFile,
    deleteFile,
    bulkDeleteFiles,
    getDownloadUrl
  };
}

// src/hooks/useAgents.ts
import { useCallback as useCallback6, useEffect as useEffect6, useState as useState6 } from "react";
function useAgents(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = useState6([]);
  const [isLoading, setIsLoading] = useState6(false);
  const [error, setError] = useState6(null);
  const fetchAgents = useCallback6(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/agents");
      if (!res.ok) throw new Error(`Failed to list agents: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || data?.agents || [];
      setAgents(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  useEffect6(() => {
    if (autoFetch) {
      void fetchAgents();
    }
  }, [autoFetch, fetchAgents]);
  return {
    agents,
    isLoading,
    error,
    refetch: fetchAgents
  };
}

// src/hooks/useConnection.ts
import { useCallback as useCallback7, useEffect as useEffect7, useState as useState7 } from "react";
function useConnection(autoCheck = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [health, setHealth] = useState7(null);
  const [isConnected, setIsConnected] = useState7(false);
  const [isLoading, setIsLoading] = useState7(false);
  const checkHealth = useCallback7(async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth("/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setIsConnected(true);
        return data;
      }
      setIsConnected(false);
      return null;
    } catch {
      setIsConnected(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  useEffect7(() => {
    if (autoCheck) {
      void checkHealth();
    }
  }, [autoCheck, checkHealth]);
  return {
    isConnected,
    health,
    isLoading,
    checkHealth
  };
}

// src/hooks/useMcpConnections.ts
import { useCallback as useCallback8, useEffect as useEffect8, useState as useState8 } from "react";
function useMcpConnections(options = {}) {
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId ?? defaultAgentId;
  const autoFetch = options.autoFetch ?? true;
  const [connections, setConnections] = useState8([]);
  const [isLoading, setIsLoading] = useState8(false);
  const [error, setError] = useState8(null);
  const fetchConnections = useCallback8(async () => {
    if (!agentId) return [];
    setIsLoading(true);
    setError(null);
    try {
      const returnTo = options.returnTo ?? (typeof window !== "undefined" ? window.location.href : void 0);
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      const res = await fetchWithAuth(
        `/agents/${agentId}/mcp-connections${query}`
      );
      if (!res.ok)
        throw new Error(`Failed to load MCP connections: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || [];
      setConnections(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [agentId, fetchWithAuth, options.returnTo]);
  useEffect8(() => {
    if (autoFetch) void fetchConnections();
  }, [autoFetch, fetchConnections]);
  return {
    connections,
    /** Convenience filter for the common "show a banner for what's missing" case. */
    unconnected: connections.filter((c) => !c.connected),
    isLoading,
    error,
    refetch: fetchConnections
  };
}

// src/index.ts
import {
  createLogger as createLogger2,
  createNoopLogger,
  setLogLevel,
  getLogLevel,
  isLevelEnabled
} from "@personaai/logger";
var VERSION = "0.7.3";
export {
  PersonaProvider,
  VERSION,
  createLogger2 as createLogger,
  createNoopLogger,
  getLogLevel,
  isLevelEnabled,
  openSSEStream,
  setLogLevel,
  supportsStreamingFetch,
  useAgents,
  useChat,
  useConnection,
  useFiles,
  useMcpConnections,
  useMemory,
  usePersonaContext,
  useThreads,
  useVoice
};
//# sourceMappingURL=index.js.map