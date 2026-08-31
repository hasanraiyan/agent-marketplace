"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  PersonaProvider: () => PersonaProvider,
  VERSION: () => VERSION,
  openSSEStream: () => openSSEStream,
  supportsStreamingFetch: () => supportsStreamingFetch,
  useAgents: () => useAgents,
  useChat: () => useChat,
  useConnection: () => useConnection,
  useFiles: () => useFiles,
  useMcpConnections: () => useMcpConnections,
  useMemory: () => useMemory,
  usePersonaContext: () => usePersonaContext,
  useThreads: () => useThreads
});
module.exports = __toCommonJS(index_exports);

// src/context/PersonaContext.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var PersonaContext = (0, import_react.createContext)(null);
function PersonaProvider({
  baseUrl,
  getAuthToken,
  defaultAgentId,
  children
}) {
  const normalizedBaseUrl = (0, import_react.useMemo)(() => baseUrl.replace(/\/+$/, ""), [baseUrl]);
  const value = (0, import_react.useMemo)(() => {
    async function fetchWithAuth(path, init = {}) {
      const token = getAuthToken ? await getAuthToken() : null;
      const headers = new Headers(init.headers || {});
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${normalizedBaseUrl}${cleanPath}`;
      return fetch(url, {
        ...init,
        headers
      });
    }
    return {
      baseUrl: normalizedBaseUrl,
      getAuthToken,
      defaultAgentId,
      fetchWithAuth
    };
  }, [normalizedBaseUrl, getAuthToken, defaultAgentId]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaContext.Provider, { value, children });
}
function usePersonaContext() {
  const context = (0, import_react.useContext)(PersonaContext);
  if (!context) {
    throw new Error("usePersonaContext must be used within a <PersonaProvider>");
  }
  return context;
}

// src/hooks/useChat.ts
var import_react2 = require("react");

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
    for (const [key, val] of Object.entries(opts.headers)) xhr.setRequestHeader(key, val);
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
      reader: { read: async () => ({ done: true }), cancel: () => controller.abort() }
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
  if (typeof content !== "string" || !content.trim().startsWith("{")) return false;
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
      entries.push({ kind: "tool_start", toolName: item.name, args: item.argsText });
      if (item.status === "completed") {
        entries.push({ kind: "tool_result", toolName: item.name, result: item.resultText });
      }
    }
  }
  return entries;
}
function parsePresentedFile(content) {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.status !== "success" || typeof parsed.filePath !== "string") return null;
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
  const { defaultAgentId, fetchWithAuth, baseUrl, getAuthToken } = usePersonaContext();
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  const [messages, setMessages] = (0, import_react2.useState)(options.initialMessages || []);
  const [input, setInput] = (0, import_react2.useState)("");
  const [isStreaming, setIsStreaming] = (0, import_react2.useState)(false);
  const [isLoadingHistory, setIsLoadingHistory] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const [interrupt, setInterrupt] = (0, import_react2.useState)(null);
  const [files, setFiles] = (0, import_react2.useState)({});
  const [todos, setTodos] = (0, import_react2.useState)([]);
  const [presentedFile, setPresentedFile] = (0, import_react2.useState)(null);
  const abortControllerRef = (0, import_react2.useRef)(null);
  const loadedThreadIdRef = (0, import_react2.useRef)(void 0);
  const stop = (0, import_react2.useCallback)(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);
  const clear = (0, import_react2.useCallback)(() => {
    stop();
    setMessages([]);
    setError(null);
    setInterrupt(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
  }, [stop]);
  const loadThreadMessages = (0, import_react2.useCallback)(
    async (id) => {
      setIsLoadingHistory(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/threads/${id}/messages`);
        if (!res.ok) throw new Error(`Failed to load thread history: ${res.statusText}`);
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
            return Array.isArray(trace) && trace.length > 0 ? { ...tc, subagentActivity: persistedTraceToActivityEntries(trace) } : tc;
          })
        }));
        setMessages(loaded);
        setInterrupt(normalizePendingInterrupt(data?.pendingInterrupt));
        setFiles(normalizeWorkspaceFiles(data?.state?.files ?? {}));
        setTodos(data?.state?.todos ?? []);
        return loaded;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        return [];
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [fetchWithAuth]
  );
  (0, import_react2.useEffect)(() => {
    if (!threadId || isStreaming) return;
    if (loadedThreadIdRef.current === threadId) return;
    if (messages.length > 0) return;
    loadedThreadIdRef.current = threadId;
    void loadThreadMessages(threadId);
  }, [threadId, isStreaming, messages.length, loadThreadMessages]);
  const sendMessage = (0, import_react2.useCallback)(
    async (contentToSend, overrideOptions) => {
      const prompt = (contentToSend ?? input).trim();
      if (!prompt || isStreaming) return;
      const targetAgentId = overrideOptions?.agentId || agentId;
      if (!targetAgentId) {
        const err = new Error("No Agent ID specified for useChat.");
        setError(err);
        options.onError?.(err);
        return;
      }
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
        const token = getAuthToken ? await getAuthToken() : null;
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
          throw new Error(`Chat error (${stream.status}): ${stream.errorText ?? "Stream failed"}`);
        }
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
              (msg) => msg.id === assistantMessageId ? { ...msg, toolCalls: Array.from(toolCallsMap.values()), ...patch } : msg
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
              options.onEvent?.(event);
              if (event.type === "TEXT_MESSAGE_CHUNK" && event.delta) {
                accumulatedText += event.delta;
                patchAssistant({ content: accumulatedText, isStreaming: true });
              } else if (event.type === "TOOL_CALL_CHUNK" && event.toolCallId) {
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
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.content;
                  existing.isError = isErrorToolContent(event.content);
                  if (existing.toolName === "present_file" && !existing.isError) {
                    const presented = parsePresentedFile(event.content);
                    if (presented) setPresentedFile(presented);
                  }
                  patchAssistant({});
                }
              } else if (event.type === "STATE_SNAPSHOT") {
                setFiles(normalizeWorkspaceFiles(event.snapshot.files));
                setTodos(event.snapshot.todos);
              } else if (event.type === "REASONING_MESSAGE_START" && event.messageId) {
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
                }
                const entry = reasoningById.get(rid);
                entry.content += event.delta;
                setMessages(
                  (prev) => prev.map(
                    (m) => m.id === rid ? { ...m, content: entry.content, isStreaming: true } : m
                  )
                );
              } else if (event.type === "REASONING_END") {
                const rid = activeReasoningId;
                activeReasoningId = null;
                if (rid) {
                  setMessages(
                    (prev) => prev.map((m) => m.id === rid ? { ...m, isStreaming: false } : m)
                  );
                }
              } else if (event.type === "CUSTOM") {
                if (event.name === "hitl_request") {
                  const value2 = event.value;
                  setInterrupt({
                    kind: "hitl",
                    actionRequests: value2.actionRequests,
                    reviewConfigs: value2.reviewConfigs
                  });
                } else if (event.name === "clarification_request") {
                  const value2 = event.value;
                  setInterrupt({ kind: "clarification", questions: value2.questions });
                } else if (event.name === "subagent_activity") {
                  const { toolCallId, ...entry } = event.value;
                  const existing = toolCallsMap.get(toolCallId);
                  if (existing) {
                    existing.subagentActivity = [...existing.subagentActivity || [], entry];
                    patchAssistant({});
                  }
                }
              } else if (event.type === "RUN_ERROR") {
                throw new Error(event.message || "Stream error from agent");
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith("Stream error")) {
                throw e;
              }
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
          (prev) => prev.map((msg) => msg.id === assistantMessageId ? finalMessage : msg)
        );
        options.onFinish?.(finalMessage);
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages(
            (prev) => prev.map(
              (msg) => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
            )
          );
          return;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
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
      }
    },
    [agentId, baseUrl, getAuthToken, input, isStreaming, messages, options]
  );
  const handleInputChange = (0, import_react2.useCallback)((e) => {
    setInput(e.target.value);
  }, []);
  const handleSubmit = (0, import_react2.useCallback)(
    (e) => {
      if (e) e.preventDefault();
      void sendMessage();
    },
    [sendMessage]
  );
  const reload = (0, import_react2.useCallback)(() => {
    if (messages.length === 0 || isStreaming) return;
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;
    const lastUserMessage = messages[lastUserIndex];
    setMessages(messages.slice(0, lastUserIndex));
    void sendMessage(lastUserMessage.content);
  }, [isStreaming, messages, sendMessage]);
  const resumeInterrupt = (0, import_react2.useCallback)(
    (resume, displayContent) => sendMessage(displayContent, { resume }),
    [sendMessage]
  );
  const dismissPresentedFile = (0, import_react2.useCallback)(() => setPresentedFile(null), []);
  const openWorkspaceFile = (0, import_react2.useCallback)(
    (path) => setPresentedFile({ path, title: path.split("/").pop() || path, description: "" }),
    []
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
var import_react3 = require("react");
function useMemory(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [memory, setMemory] = (0, import_react3.useState)({ userFiles: [], agentMemories: [] });
  const [isLoading, setIsLoading] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)(null);
  const fetchMemory = (0, import_react3.useCallback)(async () => {
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
  const getFile = (0, import_react3.useCallback)(
    async (params) => {
      const query = new URLSearchParams({ path: params.path });
      if (params.scope) query.set("scope", params.scope);
      if (params.agentId) query.set("agentId", params.agentId);
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to get memory file: ${res.statusText}`);
      return await res.json();
    },
    [fetchWithAuth]
  );
  const writeFile = (0, import_react3.useCallback)(
    async (params) => {
      const res = await fetchWithAuth("/memory/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error(`Failed to write memory file: ${res.statusText}`);
      const updated = await res.json();
      void fetchMemory();
      return updated;
    },
    [fetchWithAuth, fetchMemory]
  );
  const deleteFile = (0, import_react3.useCallback)(
    async (params) => {
      const query = new URLSearchParams({ path: params.path });
      if (params.scope) query.set("scope", params.scope);
      if (params.agentId) query.set("agentId", params.agentId);
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error(`Failed to delete memory file: ${res.statusText}`);
      void fetchMemory();
    },
    [fetchWithAuth, fetchMemory]
  );
  (0, import_react3.useEffect)(() => {
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
var import_react4 = require("react");
function useThreads(autoFetch = true) {
  const { fetchWithAuth, defaultAgentId } = usePersonaContext();
  const [threads, setThreads] = (0, import_react4.useState)([]);
  const [isLoading, setIsLoading] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)(null);
  const fetchThreads = (0, import_react4.useCallback)(async () => {
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
  const createThread = (0, import_react4.useCallback)(
    async (agentId) => {
      const targetAgentId = agentId || defaultAgentId;
      const res = await fetchWithAuth("/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: targetAgentId })
      });
      if (!res.ok) throw new Error(`Failed to create thread: ${res.statusText}`);
      const data = await res.json();
      const created = data?.data ?? data;
      void fetchThreads();
      return created;
    },
    [fetchWithAuth, defaultAgentId, fetchThreads]
  );
  const deleteThread = (0, import_react4.useCallback)(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete thread: ${res.statusText}`);
      setThreads((prev) => prev.filter((t) => t._id !== threadId));
    },
    [fetchWithAuth]
  );
  const bulkDeleteThreads = (0, import_react4.useCallback)(
    async (threadIds) => {
      const res = await fetchWithAuth("/threads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: threadIds })
      });
      if (!res.ok) throw new Error(`Failed to bulk-delete threads: ${res.statusText}`);
      const data = await res.json();
      const result = data?.data ?? data;
      const deletedSet = new Set(result.deleted);
      setThreads((prev) => prev.filter((t) => !deletedSet.has(t._id)));
      return result;
    },
    [fetchWithAuth]
  );
  const deleteAllThreads = (0, import_react4.useCallback)(async () => {
    const ids = threads.map((t) => t._id);
    for (let i = 0; i < ids.length; i += 100) {
      await bulkDeleteThreads(ids.slice(i, i + 100));
    }
  }, [threads, bulkDeleteThreads]);
  const updateThread = (0, import_react4.useCallback)(
    async (threadId, input) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!res.ok) throw new Error(`Failed to update thread: ${res.statusText}`);
      const data = await res.json();
      const updated = data?.data ?? data;
      setThreads((prev) => prev.map((t) => t._id === threadId ? { ...t, ...updated } : t));
      return updated;
    },
    [fetchWithAuth]
  );
  const renameThread = (0, import_react4.useCallback)(
    (threadId, title) => updateThread(threadId, { title }),
    [updateThread]
  );
  const getThread = (0, import_react4.useCallback)(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}`);
      if (!res.ok) throw new Error(`Failed to fetch thread: ${res.statusText}`);
      const data = await res.json();
      return data?.data ?? data;
    },
    [fetchWithAuth]
  );
  (0, import_react4.useEffect)(() => {
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
    getThread
  };
}

// src/hooks/useFiles.ts
var import_react5 = require("react");
function useFiles(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = (0, import_react5.useState)([]);
  const [isLoading, setIsLoading] = (0, import_react5.useState)(false);
  const [isUploading, setIsUploading] = (0, import_react5.useState)(false);
  const [error, setError] = (0, import_react5.useState)(null);
  const fetchFiles = (0, import_react5.useCallback)(async () => {
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
  const uploadFile = (0, import_react5.useCallback)(
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
  const deleteFile = (0, import_react5.useCallback)(
    async (fileId) => {
      const res = await fetchWithAuth(`/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    },
    [fetchWithAuth]
  );
  const bulkDeleteFiles = (0, import_react5.useCallback)(
    async (fileIds) => {
      const res = await fetchWithAuth("/files/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fileIds })
      });
      if (!res.ok) throw new Error(`Failed to bulk-delete files: ${res.statusText}`);
      const idSet = new Set(fileIds);
      setFiles((prev) => prev.filter((f) => !idSet.has(f.id)));
      return await res.json();
    },
    [fetchWithAuth]
  );
  const getDownloadUrl = (0, import_react5.useCallback)(
    (fileId) => {
      return `/files/${fileId}`;
    },
    []
  );
  (0, import_react5.useEffect)(() => {
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
var import_react6 = require("react");
function useAgents(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = (0, import_react6.useState)([]);
  const [isLoading, setIsLoading] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)(null);
  const fetchAgents = (0, import_react6.useCallback)(async () => {
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
  (0, import_react6.useEffect)(() => {
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
var import_react7 = require("react");
function useConnection(autoCheck = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [health, setHealth] = (0, import_react7.useState)(null);
  const [isConnected, setIsConnected] = (0, import_react7.useState)(false);
  const [isLoading, setIsLoading] = (0, import_react7.useState)(false);
  const checkHealth = (0, import_react7.useCallback)(async () => {
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
  (0, import_react7.useEffect)(() => {
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
var import_react8 = require("react");
function useMcpConnections(options = {}) {
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId ?? defaultAgentId;
  const autoFetch = options.autoFetch ?? true;
  const [connections, setConnections] = (0, import_react8.useState)([]);
  const [isLoading, setIsLoading] = (0, import_react8.useState)(false);
  const [error, setError] = (0, import_react8.useState)(null);
  const fetchConnections = (0, import_react8.useCallback)(async () => {
    if (!agentId) return [];
    setIsLoading(true);
    setError(null);
    try {
      const returnTo = options.returnTo ?? (typeof window !== "undefined" ? window.location.href : void 0);
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      const res = await fetchWithAuth(`/agents/${agentId}/mcp-connections${query}`);
      if (!res.ok) throw new Error(`Failed to load MCP connections: ${res.statusText}`);
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
  (0, import_react8.useEffect)(() => {
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
var VERSION = "0.4.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersonaProvider,
  VERSION,
  openSSEStream,
  supportsStreamingFetch,
  useAgents,
  useChat,
  useConnection,
  useFiles,
  useMcpConnections,
  useMemory,
  usePersonaContext,
  useThreads
});
//# sourceMappingURL=index.cjs.map