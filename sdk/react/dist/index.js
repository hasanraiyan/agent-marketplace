// src/types.ts
function getChannelBadgeLabel(channel) {
  switch (channel) {
    case "voice":
      return "Transcribed from phone call";
    case "whatsapp":
      return "via WhatsApp";
    case "sms":
      return "via SMS";
    case "web":
    default:
      return "Web Chat";
  }
}

// src/context/PersonaContext.tsx
import { createContext, useContext, useMemo, useState } from "react";
import { createLogger } from "@personaai/logger";

// src/tools/partialJson.ts
function scan(text) {
  const stack = [];
  const cuts = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      cuts.push(i);
    } else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === ",") cuts.push(i);
  }
  return { stack, inString, escaped, cuts };
}
function closeUp(text) {
  const { stack, inString, escaped } = scan(text);
  let out = text;
  if (inString) {
    if (escaped) out = out.slice(0, -1);
    out += '"';
  }
  out = out.replace(/\s+$/, "");
  if (out.endsWith(",")) out = out.slice(0, -1);
  else if (out.endsWith(":")) out += "null";
  out = out.replace(
    /(-|\d+\.|\d+[eE][+-]?)$/,
    (m) => m === "-" ? "null" : m.replace(/[.eE+-]+$/, "")
  );
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  return out;
}
function parsePartialJson(text) {
  if (typeof text !== "string") return void 0;
  const trimmed = text.trim();
  if (!trimmed) return void 0;
  try {
    return JSON.parse(trimmed);
  } catch {
  }
  let candidate = trimmed;
  for (let attempt = 0; attempt < 64 && candidate; attempt++) {
    try {
      return JSON.parse(closeUp(candidate));
    } catch {
      const { cuts } = scan(candidate);
      const last = cuts[cuts.length - 1];
      if (last === void 0) return void 0;
      const keep = candidate[last] === "," ? last : last + 1;
      if (keep >= candidate.length) {
        candidate = candidate.slice(0, last);
      } else {
        candidate = candidate.slice(0, keep);
      }
    }
  }
  return void 0;
}

// src/tools/registry.ts
var ANY_TOOL = "*";
function getToolCallStatus(toolCall) {
  if (toolCall.result !== void 0) return "complete";
  const args = (toolCall.args ?? "").trim();
  if (!args) return "inProgress";
  try {
    JSON.parse(args);
    return "executing";
  } catch {
    return "inProgress";
  }
}
function toArgsObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function buildToolRenderProps(toolCall) {
  const status = getToolCallStatus(toolCall);
  const base = {
    name: toolCall.toolName,
    toolCallId: toolCall.toolCallId,
    isError: !!toolCall.isError,
    toolCall
  };
  const args = toArgsObject(parsePartialJson(toolCall.args));
  if (status === "complete")
    return { ...base, status, args, result: toolCall.result };
  return { ...base, status, args, result: void 0 };
}
var EMPTY_OBJECT_SCHEMA = {
  type: "object",
  properties: {}
};
function resolveToolParameters(parameters) {
  let schema = parameters;
  if (parameters && typeof parameters.toJSONSchema === "function") {
    schema = parameters.toJSONSchema();
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return EMPTY_OBJECT_SCHEMA;
  }
  const { $schema, ...rest } = schema;
  return { ...rest, type: "object" };
}
var PersonaToolRegistry = class {
  renderers = /* @__PURE__ */ new Map();
  frontendTools = /* @__PURE__ */ new Map();
  responders = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  version = 0;
  /**
   * Register a frontend tool. The latest registration for a name wins.
   * Returns an unregister function that only removes *this* registration.
   */
  registerFrontendTool(entry) {
    const name = entry.definition.name;
    const slot = { ...entry, id: Symbol(name) };
    this.frontendTools.set(name, slot);
    this.emit();
    return () => {
      if (this.frontendTools.get(name)?.id === slot.id) {
        this.frontendTools.delete(name);
        this.emit();
      }
    };
  }
  getFrontendTool(name) {
    return this.frontendTools.get(name);
  }
  /** Definitions to send with each run (empty → no `tools` sent at all). */
  getFrontendToolDefinitions() {
    return Array.from(this.frontendTools.values(), (t) => t.definition);
  }
  /** Make `respond` available to the waiting human-in-the-loop call `toolCallId`. */
  setResponder(toolCallId, respond) {
    this.responders.set(toolCallId, respond);
    this.emit();
  }
  clearResponder(toolCallId) {
    if (this.responders.delete(toolCallId)) this.emit();
  }
  getResponder(toolCallId) {
    return this.responders.get(toolCallId);
  }
  /**
   * Register a renderer for `name` (or `"*"`). The latest registration wins.
   * Returns an unregister function that only removes *this* registration.
   */
  registerRenderer(name, render) {
    const entry = { id: Symbol(name), render };
    this.renderers.set(name, entry);
    this.emit();
    return () => {
      if (this.renderers.get(name)?.id === entry.id) {
        this.renderers.delete(name);
        this.emit();
      }
    };
  }
  /** The renderer for `name`, falling back to the `"*"` wildcard. */
  getRenderer(name) {
    return (this.renderers.get(name) ?? this.renderers.get(ANY_TOOL))?.render;
  }
  hasRenderer(name) {
    return this.renderers.has(name);
  }
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = () => this.version;
  emit() {
    this.version++;
    for (const listener of this.listeners) listener();
  }
};

// src/context/PersonaContext.tsx
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
  const [toolRegistry] = useState(() => new PersonaToolRegistry());
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
          const parsedResult = { isJson: false };
          try {
            const body = await res.clone().json();
            if (body && typeof body === "object") {
              const message = body.error?.message ?? body.message ?? void 0;
              if (body.error?.code ?? message) {
                parsedResult.isJson = true;
                parsedResult.info = {
                  status: res.status,
                  code: body.error?.code,
                  message
                };
              }
            }
          } catch {
          }
          logger.warn("fetchWithAuth non-ok", {
            path: cleanPath,
            status: res.status,
            ...parsedResult.info ?? {}
          });
          if (parsedResult.info) {
            try {
              res.personaError = parsedResult.info;
            } catch {
            }
          }
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
      logger,
      toolRegistry
    };
  }, [normalizedBaseUrl, getAuthToken, defaultAgentId, logger, toolRegistry]);
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
import { useCallback, useEffect, useMemo as useMemo2, useRef, useState as useState2 } from "react";

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
    const method = opts.method ?? "POST";
    xhr.open(method, opts.url);
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
    xhr.send(method === "GET" ? null : opts.body ?? null);
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
  const method = opts.method ?? "POST";
  const response = await fetch(opts.url, {
    method,
    headers: opts.headers,
    body: method === "GET" ? void 0 : opts.body,
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

// src/hooks/streamEventHelpers.ts
function normalizeFrontendToolCalls(value) {
  const calls = value?.calls;
  if (!Array.isArray(calls)) return null;
  const out = [];
  for (const c of calls) {
    if (!c || typeof c !== "object" || typeof c.name !== "string") continue;
    const { toolCallId, name, args } = c;
    out.push({
      toolCallId: typeof toolCallId === "string" ? toolCallId : null,
      name,
      args: args && typeof args === "object" && !Array.isArray(args) ? args : {}
    });
  }
  return out.length > 0 ? out : null;
}
function normalizePendingFrontendTools(pending) {
  if (!pending || typeof pending !== "object") return null;
  const p = pending;
  return p.kind === "frontend_tool" ? normalizeFrontendToolCalls(p.value) : null;
}
function formatFrontendToolResult(answer) {
  if (answer.error != null) return JSON.stringify({ status: "error", message: String(answer.error) });
  const { result } = answer;
  if (result === void 0 || result === null) return "Done.";
  return typeof result === "string" ? result : JSON.stringify(result);
}
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

// src/hooks/useChat.ts
function httpFailure(res, what) {
  const info = res.personaError;
  if (!info || !info.code && !info.message) {
    return new Error(`Failed to ${what}: ${res.statusText || res.status}`);
  }
  const parts = [info.status, info.code, info.message].filter(Boolean).join(", ");
  return new Error(`Failed to ${what}: ${parts}`);
}
function parseSandboxCommand(tc) {
  let command = tc.args ?? "";
  try {
    const parsedArgs = JSON.parse(tc.args || "{}");
    if (typeof parsedArgs.command === "string") command = parsedArgs.command;
  } catch {
  }
  let output;
  let exitCode;
  if (tc.result) {
    try {
      const parsedResult = JSON.parse(tc.result);
      if (typeof parsedResult.output === "string") {
        output = parsedResult.output;
        exitCode = typeof parsedResult.exitCode === "number" ? parsedResult.exitCode : null;
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
    seq: tc.seq
  };
}
function findLocalToolCallId(messages, call, claimed) {
  if (call.toolCallId) {
    for (const m of messages) {
      if (m.toolCalls?.some((tc) => tc.toolCallId === call.toolCallId)) return call.toolCallId;
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const tc of messages[i].toolCalls ?? []) {
      if (tc.toolName === call.name && tc.result === void 0 && !claimed.has(tc.toolCallId)) {
        return tc.toolCallId;
      }
    }
  }
  return null;
}
function applyFrontendResults(messages, byLocalId) {
  if (byLocalId.size === 0) return messages;
  return messages.map((m) => {
    if (!m.toolCalls?.some((tc) => byLocalId.has(tc.toolCallId))) return m;
    return {
      ...m,
      toolCalls: m.toolCalls.map((tc) => {
        const answer = byLocalId.get(tc.toolCallId);
        return answer ? { ...tc, result: formatFrontendToolResult(answer), isError: answer.error != null } : tc;
      })
    };
  });
}
function toSerializable(value) {
  if (value === void 0) return null;
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return String(value);
  }
}
function useChat(options = {}) {
  const { defaultAgentId, fetchWithAuth, baseUrl, getAuthToken, logger, toolRegistry } = usePersonaContext();
  const chatLogger = useMemo2(() => logger.child("chat"), [logger]);
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  const [internalThreadId, setInternalThreadId] = useState2(void 0);
  const effectiveThreadId = threadId ?? internalThreadId;
  useEffect(() => {
    if (threadId !== void 0) setInternalThreadId(threadId);
  }, [threadId]);
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
  const [messages, setMessages] = useState2(
    options.initialMessages || []
  );
  const [input, setInput] = useState2("");
  const [isStreaming, setIsStreaming] = useState2(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState2(false);
  const [error, setError] = useState2(null);
  const [interrupt, setInterrupt] = useState2(null);
  const [pendingFrontendTools, setPendingFrontendTools] = useState2(null);
  const [files, setFiles] = useState2({});
  const [todos, setTodos] = useState2([]);
  const [presentedFile, setPresentedFile] = useState2(null);
  const sandboxCommands = useMemo2(() => {
    const commands = [];
    for (const message of messages) {
      for (const tc of message.toolCalls ?? []) {
        if (tc.toolName === "execute") commands.push(parseSandboxCommand(tc));
      }
    }
    return commands;
  }, [messages]);
  const abortControllerRef = useRef(null);
  const loadedThreadIdRef = useRef(void 0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const frontendEpochRef = useRef(0);
  const voiceThreadRef = useRef(effectiveThreadId);
  const voicePrevLenRef = useRef(0);
  const voiceStreamingIdRef = useRef(null);
  const voiceUserPartialIdRef = useRef(null);
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
    frontendEpochRef.current++;
    setPendingFrontendTools(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
    loadedThreadIdRef.current = void 0;
  }, [stop, chatLogger, messages.length]);
  const startNewChat = useCallback(() => {
    chatLogger.info("startNewChat \u2014 entering ephemeral mode");
    stop();
    setMessages([]);
    setError(null);
    setInterrupt(null);
    frontendEpochRef.current++;
    setPendingFrontendTools(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
    setInput("");
    loadedThreadIdRef.current = void 0;
    voiceThreadRef.current = void 0;
    voicePrevLenRef.current = 0;
    voiceStreamingIdRef.current = null;
    voiceUserPartialIdRef.current = null;
    setInternalThreadId(void 0);
  }, [stop, chatLogger]);
  const loadThreadMessages = useCallback(
    async (id) => {
      chatLogger.debug("loadThreadMessages start", { threadId: id });
      chatLogger.trace("loadThreadMessages", { threadId: id });
      setIsLoadingHistory(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/threads/${id}/messages`);
        if (!res.ok) throw httpFailure(res, "load thread history");
        const body = await res.json();
        const data = body?.data ?? body;
        const raw = data?.messages ?? [];
        const subagentTraces = data?.subagentTraces ?? {};
        const loaded = raw.map((m, i) => ({
          id: m.id || `history-${id}-${i}`,
          role: m.role,
          content: m.content,
          createdAt: /* @__PURE__ */ new Date(),
          channel: m.channel ?? (m.id?.startsWith("voice-") ? "voice" : "web"),
          ...m.metadata ? { metadata: m.metadata } : {},
          ...Array.isArray(m.attachments) && m.attachments.length > 0 ? { attachments: m.attachments } : {},
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
        frontendEpochRef.current++;
        setPendingFrontendTools(normalizePendingFrontendTools(data?.pendingInterrupt));
        setFiles(normalizeWorkspaceFiles(data?.state?.files ?? {}));
        setTodos(data?.state?.todos ?? []);
        loadedThreadIdRef.current = id;
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
        if (loadedThreadIdRef.current === id) loadedThreadIdRef.current = void 0;
        return [];
      } finally {
        setIsLoadingHistory(false);
        chatLogger.trace("loadThreadMessages end", { threadId: id });
      }
    },
    [fetchWithAuth, chatLogger]
  );
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
        count: messages.length
      });
      return;
    }
    chatLogger.info("auto-load thread history", { threadId: effectiveThreadId });
    chatLogger.debug("loadThreadMessages trigger", { threadId: effectiveThreadId });
    void loadThreadMessages(effectiveThreadId);
  }, [effectiveThreadId, isStreaming, messages.length, loadThreadMessages, chatLogger]);
  const voice = options.voice;
  useEffect(() => {
    if (!voice) return;
    if (voiceThreadRef.current !== effectiveThreadId) {
      voiceThreadRef.current = effectiveThreadId;
      voicePrevLenRef.current = voice.transcript.length;
      voiceStreamingIdRef.current = null;
      voiceUserPartialIdRef.current = null;
      return;
    }
    const isVoiceActive = voice.state !== "idle" && voice.state !== "ended" && voice.state !== "error";
    const curLen = voice.transcript.length;
    if (curLen < voicePrevLenRef.current) {
      voicePrevLenRef.current = 0;
      voiceStreamingIdRef.current = null;
      voiceUserPartialIdRef.current = null;
    }
    if (!isVoiceActive) {
      if (curLen > voicePrevLenRef.current) {
        const pendingLines = voice.transcript.slice(voicePrevLenRef.current);
        voicePrevLenRef.current = curLen;
        for (const line of pendingLines) {
          const text = (line.text || "").trim();
          if (!text) continue;
          const role = line.speaker === "user" ? "user" : "assistant";
          const voiceId = `voice-${line.id}`;
          setMessages((prev) => {
            if (prev.some((m) => m.id === voiceId)) return prev;
            if (prev.some((m) => !m.id.startsWith("voice-") && m.role === role && m.content.trim() === text)) return prev;
            const last = prev[prev.length - 1];
            if (last?.id.startsWith("voice-") && last.role === "assistant" && role === "assistant") {
              const merged = text.startsWith(last.content) ? text : `${last.content} ${text}`.trim();
              return [...prev.slice(0, -1), { ...last, content: merged, isStreaming: false }];
            }
            return [...prev, { id: voiceId, role, content: text, createdAt: /* @__PURE__ */ new Date(), channel: "voice" }];
          });
        }
      } else {
        voicePrevLenRef.current = voice.transcript.length;
      }
      if (voiceStreamingIdRef.current) {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m));
      }
      if (voiceUserPartialIdRef.current) {
        const doneId = voiceUserPartialIdRef.current;
        voiceUserPartialIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m));
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
    const agentPartialText = voice.partial?.speaker === "agent" ? voice.partial.text.trim() : "";
    const userPartialText = voice.partial?.speaker === "user" ? voice.partial.text.trim() : "";
    if (agentPartialText) {
      if (voiceUserPartialIdRef.current) {
        const doneId = voiceUserPartialIdRef.current;
        voiceUserPartialIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m));
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id.startsWith("voice-") && last.role === "assistant") {
          voiceStreamingIdRef.current = last.id;
          return [...prev.slice(0, -1), { ...last, content: agentPartialText, isStreaming: true, channel: "voice" }];
        }
        const id = voiceStreamingIdRef.current || `voice-partial-${Date.now()}`;
        voiceStreamingIdRef.current = id;
        return [...prev, { id, role: "assistant", content: agentPartialText, isStreaming: true, createdAt: /* @__PURE__ */ new Date(), channel: "voice" }];
      });
    } else if (userPartialText) {
      if (voiceStreamingIdRef.current) {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m));
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id.startsWith("voice-") && last.role === "user" && last.isStreaming) {
          voiceUserPartialIdRef.current = last.id;
          return [...prev.slice(0, -1), { ...last, content: userPartialText, isStreaming: true, channel: "voice" }];
        }
        const id = voiceUserPartialIdRef.current || `voice-partial-user-${Date.now()}`;
        voiceUserPartialIdRef.current = id;
        return [...prev, { id, role: "user", content: userPartialText, isStreaming: true, createdAt: /* @__PURE__ */ new Date(), channel: "voice" }];
      });
    } else {
      if (voiceStreamingIdRef.current && voice.state !== "speaking") {
        const doneId = voiceStreamingIdRef.current;
        voiceStreamingIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m));
      }
      if (voiceUserPartialIdRef.current) {
        const doneId = voiceUserPartialIdRef.current;
        voiceUserPartialIdRef.current = null;
        setMessages((prev) => prev.map((m) => m.id === doneId ? { ...m, isStreaming: false } : m));
      }
    }
  }, [voice?.transcript, voice?.partial, voice?.state, effectiveThreadId]);
  const doSend = useCallback(
    async (prompt, baseMessages, overrideOptions, internal) => {
      const silent = !!internal?.silent;
      const targetAgentId = overrideOptions?.agentId || agentId;
      if (!targetAgentId) {
        const err = new Error("No Agent ID specified for useChat.");
        chatLogger.warn("sendMessage no agentId", {});
        chatLogger.error("sendMessage failed \u2014 no agent", { error: err.message });
        setError(err);
        options.onError?.(err);
        return false;
      }
      chatLogger.debug("sendMessage start", {
        promptPreview: prompt.slice(0, 100),
        agentId: targetAgentId,
        threadId: effectiveThreadId ?? overrideOptions?.threadId,
        hasResume: !!overrideOptions?.resume,
        hasContextOverride: !!overrideOptions?.contextOverride,
        messageCount: baseMessages.length
      });
      chatLogger.trace("sendMessage details", {
        agentId: targetAgentId,
        promptPreview: prompt.slice(0, 200),
        hasResume: !!overrideOptions?.resume,
        hasContextOverride: !!overrideOptions?.contextOverride
      });
      const attachments = (overrideOptions?.attachments ?? []).filter((a) => !!a?.fileId);
      const userMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "user",
        content: prompt,
        createdAt: /* @__PURE__ */ new Date(),
        channel: "web",
        ...attachments.length > 0 ? { attachments } : {}
      };
      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const placeholderAssistant = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: /* @__PURE__ */ new Date(),
        isStreaming: true,
        toolCalls: [],
        channel: "web"
      };
      const nextMessages = silent ? baseMessages : [...baseMessages, userMessage];
      if (silent) {
        setMessages((prev) => [...prev, placeholderAssistant]);
      } else {
        setMessages([...nextMessages, placeholderAssistant]);
        setInput("");
        frontendEpochRef.current++;
      }
      setIsStreaming(true);
      setError(null);
      setInterrupt(null);
      setPendingFrontendTools(null);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const finalizeReasoning = () => {
        setMessages(
          (prev) => prev.map((m) => m.role === "reasoning" && m.isStreaming ? { ...m, isStreaming: false } : m)
        );
      };
      try {
        const payloadMessages = (silent ? [] : nextMessages).filter((m) => m.role !== "reasoning").map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        let resolvedThreadId = await overrideOptions?.threadId ?? effectiveThreadId;
        if (!resolvedThreadId) {
          chatLogger.info("minting real thread for ephemeral chat", { agentId: targetAgentId });
          const createRes = await fetchWithAuth("/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: targetAgentId })
          });
          if (!createRes.ok) throw httpFailure(createRes, "create thread");
          const createBody = await createRes.json();
          const created = createBody?.data ?? createBody;
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
        const frontendTools = toolRegistry.getFrontendToolDefinitions();
        chatLogger.debug("opening SSE stream", {
          agentId: targetAgentId,
          hasToken: !!token,
          hasThreadId: !!resolvedThreadId,
          hasContext
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
            resume: overrideOptions?.resume,
            contextOverride: overrideOptions?.contextOverride,
            ...hasContext ? { context: mergedContext } : {},
            // Frontend tools (useFrontendTool & co.) — sent on every request,
            // resumes included, so the server's paused stub tools exist when
            // the run continues. Ignored unless the agent opted in.
            ...frontendTools.length > 0 ? { tools: frontendTools } : {},
            // Images for this turn — added to the last user message by the
            // runtime. Never on a silent frontend-tool resume (no new message).
            ...!silent && attachments.length > 0 ? { attachments: attachments.map((a) => ({ fileId: a.fileId })) } : {}
          }),
          signal: controller.signal
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
          const msg = { id, role: "reasoning", content: "", createdAt: /* @__PURE__ */ new Date(), isStreaming: true, seq, channel: "web" };
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
                    seq: streamSeq++
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
                  todoCount: event.snapshot.todos?.length ?? 0
                });
                setFiles(normalizeWorkspaceFiles(event.snapshot.files ?? {}));
                setTodos(event.snapshot.todos ?? []);
              } else if (event.type === "REASONING_MESSAGE_START" && event.messageId) {
                chatLogger.debug("reasoning start", { messageId: event.messageId });
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
                chatLogger.trace("reasoning content", { messageId: rid, deltaLength: event.delta?.length ?? 0 });
                setMessages((prev) => prev.map((m) => m.id === rid ? { ...m, content: entry.content, isStreaming: true } : m));
              } else if (event.type === "REASONING_END") {
                chatLogger.debug("reasoning end", { messageId: activeReasoningId });
                const rid = activeReasoningId;
                activeReasoningId = null;
                if (rid) {
                  setMessages((prev) => prev.map((m) => m.id === rid ? { ...m, isStreaming: false } : m));
                }
              } else if (event.type === "CUSTOM") {
                chatLogger.debug("custom event", { name: event.name });
                if (event.name === "hitl_request") {
                  const value2 = event.value;
                  chatLogger.info("hitl interrupt", { actionCount: value2.actionRequests?.length ?? 0 });
                  setInterrupt({ kind: "hitl", actionRequests: value2.actionRequests, reviewConfigs: value2.reviewConfigs });
                } else if (event.name === "clarification_request") {
                  const value2 = event.value;
                  chatLogger.info("clarification interrupt", { questionCount: value2.questions?.length ?? 0 });
                  setInterrupt({ kind: "clarification", questions: value2.questions });
                } else if (event.name === "frontend_tool_request") {
                  const calls = normalizeFrontendToolCalls(event.value);
                  chatLogger.info("frontend tool request", { names: calls?.map((c) => c.name) ?? [] });
                  if (calls) setPendingFrontendTools(calls);
                } else if (event.name === "subagent_activity") {
                  const { toolCallId, ...entry } = event.value;
                  chatLogger.trace("subagent activity", { toolCallId, kind: entry.kind });
                  const existing = toolCallsMap.get(toolCallId);
                  if (existing) {
                    existing.subagentActivity = [...existing.subagentActivity || [], entry];
                    patchAssistant({});
                  }
                } else if (event.name === "mcp_app") {
                  const val = event.value;
                  if (val?.toolCallId && val?.resourceUri && val?.mcpId) {
                    const existing = toolCallsMap.get(val.toolCallId);
                    if (existing) {
                      existing.mcpApp = { resourceUri: val.resourceUri, mcpId: val.mcpId };
                      patchAssistant({});
                    }
                  }
                } else if (event.name === "mcp_auth_required") {
                  const val = event.value;
                  const servers = val?.servers ?? [];
                  if (servers.length > 0) {
                    chatLogger.info("mcp auth required", { mcpIds: servers.map((s) => s.mcpId) });
                    options.onMcpAuthRequired?.(servers);
                  }
                }
              } else if (event.type === "title") {
                const title = event.title;
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
        const finalMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: accumulatedText,
          createdAt: /* @__PURE__ */ new Date(),
          isStreaming: false,
          toolCalls: Array.from(toolCallsMap.values()),
          channel: "web"
        };
        setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? finalMessage : msg));
        chatLogger.info("sendMessage succeeded", { agentId: targetAgentId, textLength: accumulatedText.length, toolCallCount: toolCallsMap.size });
        chatLogger.debug("sendMessage completed", { agentId: targetAgentId, textLength: accumulatedText.length, eventCount: toolCallsMap.size + 1 });
        options.onFinish?.(finalMessage);
        return true;
      } catch (err) {
        if (controller.signal.aborted) {
          chatLogger.info("sendMessage aborted", { agentId: targetAgentId });
          chatLogger.debug("stream aborted", { agentId: targetAgentId });
          setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg));
          return false;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("sendMessage failed", { agentId: targetAgentId, error: errorObj.message });
        chatLogger.error("sendMessage error", { agentId: targetAgentId, error: errorObj.message });
        setError(errorObj);
        options.onError?.(errorObj);
        setMessages(
          (prev) => prev.map(
            (msg) => msg.id === assistantMessageId ? { ...msg, content: msg.content || `\u26A0\uFE0F Error: ${errorObj.message || "Failed to get response."}`, isStreaming: false } : msg
          )
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
    [agentId, baseUrl, getAuthToken, fetchWithAuth, options, chatLogger, effectiveThreadId, toolRegistry]
  );
  const sendMessage = useCallback(
    async (contentToSend, overrideOptions) => {
      const prompt = (contentToSend ?? input).trim();
      const hasAttachments = (overrideOptions?.attachments?.length ?? 0) > 0;
      if (!prompt && !hasAttachments || isStreaming) {
        chatLogger.trace("sendMessage skipped", {
          hasPrompt: !!prompt,
          isStreaming
        });
        if (isStreaming) {
          chatLogger.warn("sendMessage dropped while streaming \u2014 caller should queue or disable send", {});
        }
        return false;
      }
      return doSend(prompt, messages, overrideOptions);
    },
    [input, isStreaming, messages, doSend, chatLogger]
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
  const reload = useCallback(async () => {
    if (messages.length === 0 || isStreaming) {
      chatLogger.trace("reload skipped", {
        messageCount: messages.length,
        isStreaming
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
      preview: lastUserMessage.content.slice(0, 100)
    });
    return doSend(
      lastUserMessage.content,
      truncated,
      lastUserMessage.attachments?.length ? { attachments: lastUserMessage.attachments } : void 0
    );
  }, [isStreaming, messages, doSend, chatLogger]);
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
  const doSendRef = useRef(doSend);
  doSendRef.current = doSend;
  useEffect(() => {
    if (!pendingFrontendTools?.length || isStreaming) return;
    const calls = pendingFrontendTools;
    const epoch = frontendEpochRef.current;
    let cancelled = false;
    const waiters = /* @__PURE__ */ new Map();
    const runOne = async (call, localId) => {
      const toolCallId = call.toolCallId ?? localId ?? "";
      const entry = toolRegistry.getFrontendTool(call.name);
      if (!entry) {
        chatLogger.warn("frontend tool not registered", { name: call.name });
        return { toolCallId, error: `Tool "${call.name}" isn't available in this app right now.` };
      }
      if (entry.kind === "component") {
        return { toolCallId, result: "Displayed to the user." };
      }
      if (entry.kind === "humanInTheLoop") {
        const key = localId ?? toolCallId;
        return new Promise((resolve) => {
          waiters.set(key, resolve);
          toolRegistry.setResponder(key, (value) => {
            if (!waiters.has(key)) return;
            waiters.delete(key);
            toolRegistry.clearResponder(key);
            resolve({ toolCallId, result: toSerializable(value) });
          });
        });
      }
      try {
        const result = await entry.handler?.(call.args, { toolCallId });
        return { toolCallId, result: toSerializable(result) };
      } catch (err) {
        chatLogger.warn("frontend tool handler threw", { name: call.name });
        return { toolCallId, error: err instanceof Error ? err.message : String(err) };
      }
    };
    const run = async () => {
      const claimed = /* @__PURE__ */ new Set();
      const localIds = calls.map((call) => {
        const id = findLocalToolCallId(messagesRef.current, call, claimed);
        if (id) claimed.add(id);
        return id;
      });
      chatLogger.info("running frontend tools", { names: calls.map((c) => c.name) });
      const answers = await Promise.all(calls.map((call, i) => runOne(call, localIds[i])));
      if (cancelled || frontendEpochRef.current !== epoch) return;
      const byLocalId = /* @__PURE__ */ new Map();
      localIds.forEach((id, i) => {
        if (id) byLocalId.set(id, answers[i]);
      });
      setMessages((prev) => applyFrontendResults(prev, byLocalId));
      setPendingFrontendTools(null);
      await doSendRef.current("", messagesRef.current, { resume: { toolResults: answers } }, { silent: true });
    };
    const timer = setTimeout(() => void run(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      for (const [key, resolve] of waiters) {
        toolRegistry.clearResponder(key);
        resolve({ toolCallId: key, error: "cancelled" });
      }
      waiters.clear();
    };
  }, [pendingFrontendTools, isStreaming, toolRegistry, chatLogger]);
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
    /** Frontend tool calls the agent is waiting on — run and resumed automatically; for display. */
    pendingFrontendTools,
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
    loadThreadMessages
  };
}

// src/hooks/useArchitectChat.ts
import { useCallback as useCallback2, useEffect as useEffect2, useMemo as useMemo3, useRef as useRef2, useState as useState3 } from "react";
var ARCHITECT_AGENT_ID = "000000000000000000000002";
function useArchitectChat(options = {}) {
  const { fetchWithAuth, baseUrl, getAuthToken, logger } = usePersonaContext();
  const chatLogger = useMemo3(() => logger.child("architect"), [logger]);
  const threadId = options.threadId;
  const [internalThreadId, setInternalThreadId] = useState3(void 0);
  const effectiveThreadId = threadId ?? internalThreadId;
  useEffect2(() => {
    if (threadId !== void 0) setInternalThreadId(threadId);
  }, [threadId]);
  const didLogInitRef = useRef2(false);
  if (!didLogInitRef.current) {
    didLogInitRef.current = true;
    chatLogger.debug("useArchitectChat init", {
      threadId,
      hasInitialMessages: !!options.initialMessages?.length
    });
    chatLogger.trace("useArchitectChat options", {
      threadId,
      initialMessageCount: options.initialMessages?.length ?? 0
    });
  }
  const [messages, setMessages] = useState3(
    options.initialMessages || []
  );
  const [input, setInput] = useState3("");
  const [isStreaming, setIsStreaming] = useState3(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState3(false);
  const [error, setError] = useState3(null);
  const [interrupt, setInterrupt] = useState3(null);
  const [files, setFiles] = useState3({});
  const [todos, setTodos] = useState3([]);
  const [presentedFile, setPresentedFile] = useState3(null);
  const abortControllerRef = useRef2(null);
  const loadedThreadIdRef = useRef2(void 0);
  const stop = useCallback2(() => {
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
  const clear = useCallback2(() => {
    chatLogger.info("clear chat", { messageCount: messages.length });
    chatLogger.debug("clear", { messageCount: messages.length });
    stop();
    setMessages([]);
    setError(null);
    setInterrupt(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
    loadedThreadIdRef.current = void 0;
  }, [stop, chatLogger, messages.length]);
  const startNewChat = useCallback2(() => {
    chatLogger.info("startNewChat \u2014 entering ephemeral mode");
    stop();
    setMessages([]);
    setError(null);
    setInterrupt(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
    setInput("");
    loadedThreadIdRef.current = void 0;
    setInternalThreadId(void 0);
  }, [stop, chatLogger]);
  const loadThreadMessages = useCallback2(
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
        loadedThreadIdRef.current = id;
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
        if (loadedThreadIdRef.current === id) loadedThreadIdRef.current = void 0;
        return [];
      } finally {
        setIsLoadingHistory(false);
        chatLogger.trace("loadThreadMessages end", { threadId: id });
      }
    },
    [fetchWithAuth, chatLogger]
  );
  useEffect2(() => {
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
        count: messages.length
      });
      return;
    }
    chatLogger.info("auto-load thread history", { threadId: effectiveThreadId });
    chatLogger.debug("loadThreadMessages trigger", { threadId: effectiveThreadId });
    void loadThreadMessages(effectiveThreadId);
  }, [effectiveThreadId, isStreaming, messages.length, loadThreadMessages, chatLogger]);
  const doSend = useCallback2(
    async (prompt, baseMessages, overrideOptions) => {
      chatLogger.debug("sendMessage start", {
        promptPreview: prompt.slice(0, 100),
        threadId: effectiveThreadId ?? overrideOptions?.threadId,
        hasResume: !!overrideOptions?.resume,
        messageCount: baseMessages.length
      });
      chatLogger.trace("sendMessage details", {
        promptPreview: prompt.slice(0, 200),
        hasResume: !!overrideOptions?.resume
      });
      const userMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "user",
        content: prompt,
        createdAt: /* @__PURE__ */ new Date(),
        channel: "web"
      };
      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const placeholderAssistant = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: /* @__PURE__ */ new Date(),
        isStreaming: true,
        toolCalls: [],
        channel: "web"
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
        setMessages(
          (prev) => prev.map((m) => m.role === "reasoning" && m.isStreaming ? { ...m, isStreaming: false } : m)
        );
      };
      try {
        const payloadMessages = nextMessages.filter((m) => m.role !== "reasoning").map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        let resolvedThreadId = await overrideOptions?.threadId ?? effectiveThreadId;
        if (!resolvedThreadId) {
          chatLogger.info("minting real thread for ephemeral architect chat", {});
          const createRes = await fetchWithAuth("/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: ARCHITECT_AGENT_ID })
          });
          if (!createRes.ok) throw new Error(`Failed to create thread: ${createRes.statusText}`);
          const createBody = await createRes.json();
          const created = createBody?.data ?? createBody;
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
          hasThreadId: !!resolvedThreadId
        });
        const stream = await openSSEStream({
          url: `${baseUrl}/architect`,
          headers: {
            "Content-Type": "application/json",
            ...token ? { Authorization: `Bearer ${token}` } : {}
          },
          body: JSON.stringify({
            messages: payloadMessages,
            threadId: resolvedThreadId,
            resume: overrideOptions?.resume
          }),
          signal: controller.signal
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
          const msg = { id, role: "reasoning", content: "", createdAt: /* @__PURE__ */ new Date(), isStreaming: true, seq, channel: "web" };
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
                    seq: streamSeq++
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
                  todoCount: event.snapshot.todos?.length ?? 0
                });
                setFiles(normalizeWorkspaceFiles(event.snapshot.files ?? {}));
                setTodos(event.snapshot.todos ?? []);
              } else if (event.type === "REASONING_MESSAGE_START" && event.messageId) {
                chatLogger.debug("reasoning start", { messageId: event.messageId });
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
                chatLogger.trace("reasoning content", { messageId: rid, deltaLength: event.delta?.length ?? 0 });
                setMessages((prev) => prev.map((m) => m.id === rid ? { ...m, content: entry.content, isStreaming: true } : m));
              } else if (event.type === "REASONING_END") {
                chatLogger.debug("reasoning end", { messageId: activeReasoningId });
                const rid = activeReasoningId;
                activeReasoningId = null;
                if (rid) {
                  setMessages((prev) => prev.map((m) => m.id === rid ? { ...m, isStreaming: false } : m));
                }
              } else if (event.type === "CUSTOM") {
                chatLogger.debug("custom event", { name: event.name });
                if (event.name === "hitl_request") {
                  const value2 = event.value;
                  chatLogger.info("hitl interrupt", { actionCount: value2.actionRequests?.length ?? 0 });
                  setInterrupt({ kind: "hitl", actionRequests: value2.actionRequests, reviewConfigs: value2.reviewConfigs });
                } else if (event.name === "clarification_request") {
                  const value2 = event.value;
                  chatLogger.info("clarification interrupt", { questionCount: value2.questions?.length ?? 0 });
                  setInterrupt({ kind: "clarification", questions: value2.questions });
                } else if (event.name === "subagent_activity") {
                  const { toolCallId, ...entry } = event.value;
                  chatLogger.trace("subagent activity", { toolCallId, kind: entry.kind });
                  const existing = toolCallsMap.get(toolCallId);
                  if (existing) {
                    existing.subagentActivity = [...existing.subagentActivity || [], entry];
                    patchAssistant({});
                  }
                } else if (event.name === "mcp_app") {
                  const val = event.value;
                  if (val?.toolCallId && val?.resourceUri && val?.mcpId) {
                    const existing = toolCallsMap.get(val.toolCallId);
                    if (existing) {
                      existing.mcpApp = { resourceUri: val.resourceUri, mcpId: val.mcpId };
                      patchAssistant({});
                    }
                  }
                }
              } else if (event.type === "title") {
                const title = event.title;
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
        const finalMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: accumulatedText,
          createdAt: /* @__PURE__ */ new Date(),
          isStreaming: false,
          toolCalls: Array.from(toolCallsMap.values()),
          channel: "web"
        };
        setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? finalMessage : msg));
        chatLogger.info("sendMessage succeeded", { textLength: accumulatedText.length, toolCallCount: toolCallsMap.size });
        chatLogger.debug("sendMessage completed", { textLength: accumulatedText.length, eventCount: toolCallsMap.size + 1 });
        options.onFinish?.(finalMessage);
        return true;
      } catch (err) {
        if (controller.signal.aborted) {
          chatLogger.info("sendMessage aborted", {});
          chatLogger.debug("stream aborted", {});
          setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg));
          return false;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        chatLogger.warn("sendMessage failed", { error: errorObj.message });
        chatLogger.error("sendMessage error", { error: errorObj.message });
        setError(errorObj);
        options.onError?.(errorObj);
        setMessages(
          (prev) => prev.map(
            (msg) => msg.id === assistantMessageId ? { ...msg, content: msg.content || `\u26A0\uFE0F Error: ${errorObj.message || "Failed to get response."}`, isStreaming: false } : msg
          )
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
    [baseUrl, getAuthToken, fetchWithAuth, options, chatLogger, effectiveThreadId]
  );
  const sendMessage = useCallback2(
    async (contentToSend, overrideOptions) => {
      const prompt = (contentToSend ?? input).trim();
      if (!prompt || isStreaming) {
        chatLogger.trace("sendMessage skipped", {
          hasPrompt: !!prompt,
          isStreaming
        });
        if (isStreaming) {
          chatLogger.warn("sendMessage dropped while streaming \u2014 caller should queue or disable send", {});
        }
        return false;
      }
      return doSend(prompt, messages, overrideOptions);
    },
    [input, isStreaming, messages, doSend, chatLogger]
  );
  const handleInputChange = useCallback2(
    (e) => {
      chatLogger.trace("handleInputChange", { length: e.target.value.length });
      setInput(e.target.value);
    },
    [chatLogger]
  );
  const handleSubmit = useCallback2(
    (e) => {
      if (e) e.preventDefault();
      chatLogger.debug("handleSubmit", {});
      void sendMessage();
    },
    [sendMessage, chatLogger]
  );
  const reload = useCallback2(async () => {
    if (messages.length === 0 || isStreaming) {
      chatLogger.trace("reload skipped", {
        messageCount: messages.length,
        isStreaming
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
      preview: lastUserMessage.content.slice(0, 100)
    });
    return doSend(lastUserMessage.content, truncated);
  }, [isStreaming, messages, doSend, chatLogger]);
  const resumeInterrupt = useCallback2(
    (resume, displayContent) => {
      chatLogger.info("resumeInterrupt", {
        kind: resume.decisions ? "hitl" : "clarification",
        preview: displayContent.slice(0, 50)
      });
      return sendMessage(displayContent, { resume });
    },
    [sendMessage, chatLogger]
  );
  const dismissPresentedFile = useCallback2(() => {
    chatLogger.debug("dismissPresentedFile", {});
    setPresentedFile(null);
  }, [chatLogger]);
  const openWorkspaceFile = useCallback2(
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
    startNewChat,
    currentThreadId: effectiveThreadId,
    isEphemeral: !effectiveThreadId,
    setMessages,
    loadThreadMessages
  };
}

// src/hooks/useMemory.ts
import { useCallback as useCallback3, useEffect as useEffect3, useState as useState4 } from "react";
function useMemory(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [memory, setMemory] = useState4({
    userFiles: [],
    agentMemories: [],
    agentWorkspaces: []
  });
  const [isLoading, setIsLoading] = useState4(false);
  const [error, setError] = useState4(null);
  const fetchMemory = useCallback3(async () => {
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
      return { userFiles: [], agentMemories: [], agentWorkspaces: [] };
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  const getFile = useCallback3(
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
  const writeFile = useCallback3(
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
  const deleteFile = useCallback3(
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
  useEffect3(() => {
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
import { useCallback as useCallback4, useEffect as useEffect4, useState as useState5 } from "react";
function useThreads(autoFetch = true) {
  const { fetchWithAuth, defaultAgentId } = usePersonaContext();
  const [threads, setThreads] = useState5([]);
  const [isLoading, setIsLoading] = useState5(false);
  const [error, setError] = useState5(null);
  const fetchThreads = useCallback4(async () => {
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
  const createThread = useCallback4(
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
  const deleteThread = useCallback4(
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
  const bulkDeleteThreads = useCallback4(
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
  const deleteAllThreads = useCallback4(async () => {
    const ids = threads.map((t) => t._id);
    for (let i = 0; i < ids.length; i += 100) {
      await bulkDeleteThreads(ids.slice(i, i + 100));
    }
  }, [threads, bulkDeleteThreads]);
  const updateThread = useCallback4(
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
  const renameThread = useCallback4(
    (threadId, title) => updateThread(threadId, { title }),
    [updateThread]
  );
  const resetThread = useCallback4(
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
  const getThread = useCallback4(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}`);
      if (!res.ok) throw new Error(`Failed to fetch thread: ${res.statusText}`);
      const data = await res.json();
      return data?.data ?? data;
    },
    [fetchWithAuth]
  );
  useEffect4(() => {
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

// src/hooks/useWorkspaceFiles.ts
import { useCallback as useCallback5, useEffect as useEffect5, useState as useState6 } from "react";
function toWorkspaceFile(file) {
  return {
    content: file.content,
    size: file.content.length,
    createdAt: file.createdAt ?? null,
    modifiedAt: file.updatedAt ?? null
  };
}
function useWorkspaceFiles(agentId, autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState6({});
  const [isLoading, setIsLoading] = useState6(false);
  const [isSaving, setIsSaving] = useState6(false);
  const [error, setError] = useState6(null);
  const fetchFiles = useCallback5(async () => {
    if (!agentId) return {};
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/memory");
      if (!res.ok) throw new Error(`Failed to list workspace files: ${res.statusText}`);
      const data = await res.json();
      const body = data?.data ?? data;
      const group = (body?.agentWorkspaces ?? []).find(
        (g) => g.agentId === agentId
      );
      const normalized = {};
      for (const file of group?.files ?? []) {
        normalized[file.path] = toWorkspaceFile(file);
      }
      setFiles(normalized);
      return normalized;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, agentId]);
  const getFile = useCallback5(
    async (path) => {
      if (!agentId) throw new Error("useWorkspaceFiles: no agentId set");
      const query = new URLSearchParams({ path, scope: "workspace", agentId });
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to read workspace file: ${res.statusText}`);
      const data = await res.json();
      const raw = data?.data ?? data;
      return toWorkspaceFile(raw);
    },
    [fetchWithAuth, agentId]
  );
  const writeFile = useCallback5(
    async (path, content) => {
      if (!agentId) throw new Error("useWorkspaceFiles: no agentId set");
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/memory/file", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content, scope: "workspace", agentId })
        });
        if (!res.ok) throw new Error(`Failed to write workspace file: ${res.statusText}`);
        const data = await res.json();
        const raw = data?.data ?? data;
        const file = toWorkspaceFile(raw);
        setFiles((prev) => ({ ...prev, [path]: file }));
        return file;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchWithAuth, agentId]
  );
  const deleteFile = useCallback5(
    async (path) => {
      if (!agentId) throw new Error("useWorkspaceFiles: no agentId set");
      const query = new URLSearchParams({ path, scope: "workspace", agentId });
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete workspace file: ${res.statusText}`);
      setFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    },
    [fetchWithAuth, agentId]
  );
  useEffect5(() => {
    if (autoFetch && agentId) {
      void fetchFiles();
    } else if (!agentId) {
      setFiles({});
    }
  }, [autoFetch, agentId, fetchFiles]);
  return {
    files,
    isLoading,
    isSaving,
    error,
    refetch: fetchFiles,
    getFile,
    writeFile,
    deleteFile
  };
}

// src/hooks/useVoice.ts
import { useCallback as useCallback6, useEffect as useEffect6, useMemo as useMemo4, useRef as useRef3, useState as useState7 } from "react";

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
  const voiceLogger = useMemo4(() => logger.child("voice"), [logger]);
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  const contextOverride = options.contextOverride;
  const context = options.context;
  const [state, setState] = useState7("idle");
  const [isMuted, setIsMuted] = useState7(false);
  const [transcript, setTranscript] = useState7(
    []
  );
  const [partial, setPartial] = useState7(
    null
  );
  const [toolCalls, setToolCalls] = useState7([]);
  const [error, setError] = useState7(null);
  const [endReason, setEndReason] = useState7(
    null
  );
  const wsRef = useRef3(null);
  const streamRef = useRef3(null);
  const inputCtxRef = useRef3(null);
  const outputCtxRef = useRef3(null);
  const recorderNodeRef = useRef3(null);
  const playerNodeRef = useRef3(null);
  const acceptedTurnSeqRef = useRef3(0);
  const mountedRef = useRef3(true);
  const lastFinalTurnRef = useRef3(
    null
  );
  useEffect6(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const teardownAudio = useCallback6(() => {
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
  const stop = useCallback6(() => {
    voiceLogger.debug("stop() called");
    try {
      wsRef.current?.close(1e3, "client_stop");
    } catch {
    }
    wsRef.current = null;
    teardownAudio();
    if (mountedRef.current) setState("idle");
  }, [teardownAudio, voiceLogger]);
  useEffect6(() => stop, [stop]);
  const startCapture = useCallback6(async (inputSampleRate) => {
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
  const setupPlayback = useCallback6(async (outputSampleRate) => {
    const outputCtx = new AudioContext({ sampleRate: outputSampleRate });
    outputCtxRef.current = outputCtx;
    await outputCtx.audioWorklet.addModule(playerWorkletUrl());
    const playerNode = new AudioWorkletNode(outputCtx, "pcm-player-processor");
    playerNode.connect(outputCtx.destination);
    playerNodeRef.current = playerNode;
  }, []);
  const upsertToolCall = useCallback6(
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
  const handleTranscript = useCallback6((value) => {
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
  const handleCustomEvent = useCallback6(
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
  const handleMessage = useCallback6(
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
  const start = useCallback6(async () => {
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
    voiceLogger.debug("start() called", {
      agentId,
      threadId,
      hasContextOverride: !!contextOverride,
      hasContext: !!context
    });
    try {
      const res = await fetchWithAuth("/voice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          ...threadId ? { threadId } : {},
          ...contextOverride ? { contextOverride } : {},
          ...context ? { context } : {}
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
  }, [agentId, threadId, contextOverride, context, fetchWithAuth, handleMessage, teardownAudio, voiceLogger]);
  const mute = useCallback6((muted) => {
    setIsMuted(muted);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);
  const sendText = useCallback6((text) => {
    if (!text?.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "voice.text", text }));
  }, []);
  const updateContext = useCallback6((newContext) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "voice.context", context: newContext }));
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
    sendText,
    updateContext
  };
}

// src/hooks/useMessages.ts
import { useCallback as useCallback7, useMemo as useMemo5, useRef as useRef4, useState as useState8 } from "react";
async function readErrorMessage(res, fallback) {
  try {
    const body = await res.json();
    const message = body?.error?.message ?? body?.message;
    if (typeof message === "string" && message) return message;
  } catch {
  }
  return `${fallback}: ${res.statusText}`;
}
function useMessages() {
  const { fetchWithAuth, logger } = usePersonaContext();
  const messagesLogger = useMemo5(() => logger.child("messages"), [logger]);
  const [isSending, setIsSending] = useState8(false);
  const [error, setError] = useState8(null);
  const [lastDelivery, setLastDelivery] = useState8(null);
  const inFlightRef = useRef4(0);
  const post = useCallback7(
    async (path, input) => {
      inFlightRef.current += 1;
      setIsSending(true);
      setError(null);
      try {
        const res = await fetchWithAuth(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          throw new Error(await readErrorMessage(res, "Failed to send message"));
        }
        const payload = await res.json();
        const delivery = payload?.data ?? payload;
        setLastDelivery(delivery);
        messagesLogger.info("message sent", { path });
        return delivery;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        messagesLogger.warn("message send failed", {
          path,
          error: errorObj.message
        });
        setError(errorObj);
        throw errorObj;
      } finally {
        inFlightRef.current -= 1;
        if (inFlightRef.current === 0) setIsSending(false);
      }
    },
    [fetchWithAuth, messagesLogger]
  );
  const send = useCallback7(
    (input) => post("/messages", input),
    [post]
  );
  const sendFromAgent = useCallback7(
    (input) => post("/messages/agent", input),
    [post]
  );
  return { isSending, error, lastDelivery, send, sendFromAgent };
}

// src/hooks/useFiles.ts
import { useCallback as useCallback8, useEffect as useEffect7, useState as useState9 } from "react";
function useFiles(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState9([]);
  const [isLoading, setIsLoading] = useState9(false);
  const [isUploading, setIsUploading] = useState9(false);
  const [error, setError] = useState9(null);
  const fetchFiles = useCallback8(async () => {
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
  const uploadFile = useCallback8(
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
  const deleteFile = useCallback8(
    async (fileId) => {
      const res = await fetchWithAuth(`/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    },
    [fetchWithAuth]
  );
  const bulkDeleteFiles = useCallback8(
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
  const getDownloadUrl = useCallback8((fileId) => {
    return `/files/${fileId}`;
  }, []);
  useEffect7(() => {
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
import { useCallback as useCallback9, useEffect as useEffect8, useState as useState10 } from "react";
function useAgents(options = true) {
  const opts = typeof options === "boolean" ? { autoFetch: options } : options;
  const { autoFetch = true, page, limit, search, category, scope } = opts;
  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = useState10([]);
  const [pagination, setPagination] = useState10({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0
  });
  const [isLoading, setIsLoading] = useState10(false);
  const [error, setError] = useState10(null);
  const fetchAgents = useCallback9(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      if (category) query.set("category", category);
      if (scope) query.set("scope", scope);
      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/agents${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list agents: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setAgents(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 }
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search, category, scope]);
  const getAgent = useCallback9(
    async (agentId) => {
      const res = await fetchWithAuth(`/agents/${agentId}`);
      if (!res.ok) throw new Error(`Failed to fetch agent: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const createAgent = useCallback9(
    async (input) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create agent (${res.status}): ${errText}`);
        }
        const created = await res.json();
        setAgents((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const updateAgent = useCallback9(
    async (agentId, input) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update agent (${res.status}): ${errText}`);
        }
        const updated = await res.json();
        setAgents((prev) => prev.map((a) => a._id === agentId ? updated : a));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const deleteAgent = useCallback9(
    async (agentId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/agents/${agentId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete agent (${res.status}): ${errText}`);
        }
        setAgents((prev) => prev.filter((a) => a._id !== agentId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const bulkDeleteAgents = useCallback9(
    async (ids) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/agents/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete agents (${res.status}): ${errText}`);
        }
        const result = await res.json();
        const deletedSet = new Set(result.deleted);
        setAgents((prev) => prev.filter((a) => !deletedSet.has(a._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  useEffect8(() => {
    if (autoFetch) void fetchAgents();
  }, [autoFetch, fetchAgents]);
  return {
    agents,
    pagination,
    isLoading,
    error,
    refetch: fetchAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    bulkDeleteAgents
  };
}

// src/hooks/useConnection.ts
import { useCallback as useCallback10, useEffect as useEffect9, useState as useState11 } from "react";
function useConnection(autoCheck = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [health, setHealth] = useState11(null);
  const [isConnected, setIsConnected] = useState11(false);
  const [isLoading, setIsLoading] = useState11(false);
  const checkHealth = useCallback10(async () => {
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
  useEffect9(() => {
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
import { useCallback as useCallback11, useEffect as useEffect10, useState as useState12 } from "react";
function useMcpConnections(options = {}) {
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId ?? defaultAgentId;
  const autoFetch = options.autoFetch ?? true;
  const [connections, setConnections] = useState12([]);
  const [isLoading, setIsLoading] = useState12(false);
  const [error, setError] = useState12(null);
  const fetchConnections = useCallback11(async () => {
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
  const [isDisconnecting, setIsDisconnecting] = useState12(false);
  const disconnect = useCallback11(
    async (mcpId) => {
      setIsDisconnecting(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}/oauth/user/connection`, {
          method: "DELETE"
        });
        if (!res.ok)
          throw new Error(`Failed to disconnect MCP: ${res.statusText}`);
        setConnections(
          (prev) => prev.map(
            (c) => c.mcpId === mcpId ? { ...c, connected: false, status: "not_connected", authorizeUrl: null } : c
          )
        );
        void fetchConnections();
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsDisconnecting(false);
      }
    },
    [fetchWithAuth, fetchConnections]
  );
  useEffect10(() => {
    if (autoFetch) void fetchConnections();
  }, [autoFetch, fetchConnections]);
  return {
    connections,
    /** Convenience filter for the common "show a banner for what's missing" case. */
    unconnected: connections.filter((c) => !c.connected),
    isLoading,
    error,
    refetch: fetchConnections,
    disconnect,
    isDisconnecting
  };
}

// src/hooks/useMcp.ts
import { useCallback as useCallback12 } from "react";
function useMcp(options = {}) {
  const { fetchWithAuth } = usePersonaContext();
  const defaultMcpId = options.mcpId;
  const readResource = useCallback12(
    async (uri, mcpId) => {
      const id = mcpId ?? defaultMcpId;
      if (!id) throw new Error("MCP server ID is required to read resource");
      const res = await fetchWithAuth(
        `/mcps/${id}/resource?uri=${encodeURIComponent(uri)}`
      );
      if (!res.ok) {
        throw new Error(`Failed to read MCP resource: ${res.statusText}`);
      }
      return await res.json();
    },
    [fetchWithAuth, defaultMcpId]
  );
  const callTool = useCallback12(
    async (name, args, mcpId) => {
      const id = mcpId ?? defaultMcpId;
      if (!id) throw new Error("MCP server ID is required to call tool");
      const res = await fetchWithAuth(`/mcps/${id}/call-tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args })
      });
      if (!res.ok) {
        throw new Error(`Failed to call MCP tool: ${res.statusText}`);
      }
      return await res.json();
    },
    [fetchWithAuth, defaultMcpId]
  );
  return {
    readResource,
    callTool
  };
}

// src/hooks/useSkills.ts
import { useCallback as useCallback13, useEffect as useEffect11, useState as useState13 } from "react";
function useSkills(options = {}) {
  const { autoFetch = true, page, limit, search, scope } = options;
  const { fetchWithAuth } = usePersonaContext();
  const [skills, setSkills] = useState13([]);
  const [pagination, setPagination] = useState13({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0
  });
  const [isLoading, setIsLoading] = useState13(false);
  const [error, setError] = useState13(null);
  const fetchSkills = useCallback13(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      if (scope) query.set("scope", scope);
      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/skills${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list skills: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setSkills(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 }
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search, scope]);
  const getSkill = useCallback13(
    async (skillId) => {
      const res = await fetchWithAuth(`/skills/${skillId}`);
      if (!res.ok) throw new Error(`Failed to fetch skill: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const createSkill = useCallback13(
    async (input) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create skill (${res.status}): ${errText}`);
        }
        const created = await res.json();
        setSkills((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const updateSkill = useCallback13(
    async (skillId, input) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update skill (${res.status}): ${errText}`);
        }
        const updated = await res.json();
        setSkills((prev) => prev.map((s) => s._id === skillId ? updated : s));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const deleteSkill = useCallback13(
    async (skillId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/skills/${skillId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete skill (${res.status}): ${errText}`);
        }
        setSkills((prev) => prev.filter((s) => s._id !== skillId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const bulkDeleteSkills = useCallback13(
    async (ids) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/skills/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete skills (${res.status}): ${errText}`);
        }
        const result = await res.json();
        const deletedSet = new Set(result.deleted);
        setSkills((prev) => prev.filter((s) => !deletedSet.has(s._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const getSkillUsage = useCallback13(
    async (skillId) => {
      const res = await fetchWithAuth(`/skills/${skillId}/usage`);
      if (!res.ok) throw new Error(`Failed to fetch skill usage: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  useEffect11(() => {
    if (autoFetch) void fetchSkills();
  }, [autoFetch, fetchSkills]);
  return {
    skills,
    pagination,
    isLoading,
    error,
    refetch: fetchSkills,
    getSkill,
    createSkill,
    updateSkill,
    deleteSkill,
    bulkDeleteSkills,
    getSkillUsage
  };
}

// src/hooks/useRcpSources.ts
import { useCallback as useCallback14, useEffect as useEffect12, useState as useState14 } from "react";
function useRcpSources(options = {}) {
  const { autoFetch = true, page, limit, search } = options;
  const { fetchWithAuth } = usePersonaContext();
  const [rcpSources, setRcpSources] = useState14([]);
  const [pagination, setPagination] = useState14({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0
  });
  const [isLoading, setIsLoading] = useState14(false);
  const [error, setError] = useState14(null);
  const fetchRcpSources = useCallback14(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/rcp-sources${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list RCP sources: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setRcpSources(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 }
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search]);
  const getRcpSource = useCallback14(
    async (sourceId) => {
      const res = await fetchWithAuth(`/rcp-sources/${sourceId}`);
      if (!res.ok) throw new Error(`Failed to fetch RCP source: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const createRcpSource = useCallback14(
    async (input) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/rcp-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create RCP source (${res.status}): ${errText}`);
        }
        const created = await res.json();
        setRcpSources((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const updateRcpSource = useCallback14(
    async (sourceId, input) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/rcp-sources/${sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update RCP source (${res.status}): ${errText}`);
        }
        const updated = await res.json();
        setRcpSources((prev) => prev.map((s) => s._id === sourceId ? updated : s));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const deleteRcpSource = useCallback14(
    async (sourceId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/rcp-sources/${sourceId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete RCP source (${res.status}): ${errText}`);
        }
        setRcpSources((prev) => prev.filter((s) => s._id !== sourceId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const bulkDeleteRcpSources = useCallback14(
    async (ids) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/rcp-sources/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete RCP sources (${res.status}): ${errText}`);
        }
        const result = await res.json();
        const deletedSet = new Set(result.deleted);
        setRcpSources((prev) => prev.filter((s) => !deletedSet.has(s._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const getRcpSourceUsage = useCallback14(
    async (sourceId) => {
      const res = await fetchWithAuth(`/rcp-sources/${sourceId}/usage`);
      if (!res.ok) throw new Error(`Failed to fetch RCP source usage: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const testRcpSourceConnection = useCallback14(
    async (sourceId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/rcp-sources/${sourceId}/test`, { method: "POST" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to test RCP source connection (${res.status}): ${errText}`);
        }
        const result = await res.json();
        setRcpSources(
          (prev) => prev.map(
            (s) => s._id === sourceId ? { ...s, tools: result.tools, lastTestedAt: (/* @__PURE__ */ new Date()).toISOString() } : s
          )
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  useEffect12(() => {
    if (autoFetch) void fetchRcpSources();
  }, [autoFetch, fetchRcpSources]);
  return {
    rcpSources,
    pagination,
    isLoading,
    error,
    refetch: fetchRcpSources,
    getRcpSource,
    createRcpSource,
    updateRcpSource,
    deleteRcpSource,
    bulkDeleteRcpSources,
    getRcpSourceUsage,
    testRcpSourceConnection
  };
}

// src/hooks/useKnowledgeBases.ts
import { useCallback as useCallback15, useEffect as useEffect13, useState as useState15 } from "react";
function useKnowledgeBases(options = {}) {
  const { autoFetch = true, page, limit, search, scope } = options;
  const { fetchWithAuth } = usePersonaContext();
  const [knowledgeBases, setKnowledgeBases] = useState15([]);
  const [pagination, setPagination] = useState15({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0
  });
  const [isLoading, setIsLoading] = useState15(false);
  const [isUploading, setIsUploading] = useState15(false);
  const [error, setError] = useState15(null);
  const fetchKnowledgeBases = useCallback15(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      if (scope) query.set("scope", scope);
      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/knowledge${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list knowledge bases: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setKnowledgeBases(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 }
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search, scope]);
  const getKnowledgeBase = useCallback15(
    async (kbId) => {
      const res = await fetchWithAuth(`/knowledge/${kbId}`);
      if (!res.ok) throw new Error(`Failed to fetch knowledge base: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const createKnowledgeBase = useCallback15(
    async (input) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create knowledge base (${res.status}): ${errText}`);
        }
        const created = await res.json();
        setKnowledgeBases((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const updateKnowledgeBase = useCallback15(
    async (kbId, input) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/knowledge/${kbId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update knowledge base (${res.status}): ${errText}`);
        }
        const updated = await res.json();
        setKnowledgeBases((prev) => prev.map((kb) => kb._id === kbId ? updated : kb));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const deleteKnowledgeBase = useCallback15(
    async (kbId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/knowledge/${kbId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete knowledge base (${res.status}): ${errText}`);
        }
        setKnowledgeBases((prev) => prev.filter((kb) => kb._id !== kbId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const bulkDeleteKnowledgeBases = useCallback15(
    async (ids) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/knowledge/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete knowledge bases (${res.status}): ${errText}`);
        }
        const result = await res.json();
        const deletedSet = new Set(result.deleted);
        setKnowledgeBases((prev) => prev.filter((kb) => !deletedSet.has(kb._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const getKnowledgeBaseUsage = useCallback15(
    async (kbId) => {
      const res = await fetchWithAuth(`/knowledge/${kbId}/usage`);
      if (!res.ok) throw new Error(`Failed to fetch knowledge base usage: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const uploadDocuments = useCallback15(
    async (kbId, files) => {
      setIsUploading(true);
      setError(null);
      try {
        const body = new FormData();
        for (const file of files) {
          if (file.content instanceof Blob) {
            body.append("files", file.content, file.filename);
          } else {
            body.append("files", {
              uri: file.content.uri,
              name: file.content.name ?? file.filename,
              type: file.content.type ?? file.contentType
            });
          }
        }
        const res = await fetchWithAuth(`/knowledge/${kbId}/documents`, {
          method: "POST",
          body
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to upload documents (${res.status}): ${errText}`);
        }
        const result = await res.json();
        setKnowledgeBases(
          (prev) => prev.map(
            (kb) => kb._id === kbId ? { ...kb, documentCount: result.documentCount, chunkCount: result.chunkCount } : kb
          )
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsUploading(false);
      }
    },
    [fetchWithAuth]
  );
  const listDocuments = useCallback15(
    async (kbId) => {
      const res = await fetchWithAuth(`/knowledge/${kbId}/documents`);
      if (!res.ok) throw new Error(`Failed to list documents: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const deleteDocument = useCallback15(
    async (kbId, sourceName) => {
      setError(null);
      try {
        const res = await fetchWithAuth(
          `/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete document (${res.status}): ${errText}`);
        }
        const result = await res.json();
        setKnowledgeBases(
          (prev) => prev.map(
            (kb) => kb._id === kbId ? { ...kb, documentCount: result.remainingDocuments, chunkCount: result.remainingChunks } : kb
          )
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const searchKnowledgeBase = useCallback15(
    async (kbId, query, opts) => {
      const res = await fetchWithAuth(`/knowledge/${kbId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: opts?.topK })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to search knowledge base (${res.status}): ${errText}`);
      }
      return res.json();
    },
    [fetchWithAuth]
  );
  useEffect13(() => {
    if (autoFetch) void fetchKnowledgeBases();
  }, [autoFetch, fetchKnowledgeBases]);
  return {
    knowledgeBases,
    pagination,
    isLoading,
    isUploading,
    error,
    refetch: fetchKnowledgeBases,
    getKnowledgeBase,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    bulkDeleteKnowledgeBases,
    getKnowledgeBaseUsage,
    uploadDocuments,
    listDocuments,
    deleteDocument,
    search: searchKnowledgeBase
  };
}

// src/hooks/useMcpAdmin.ts
import { useCallback as useCallback16, useEffect as useEffect14, useState as useState16 } from "react";
function useMcpAdmin(options = {}) {
  const { autoFetch = true, page, limit, search } = options;
  const { fetchWithAuth } = usePersonaContext();
  const [mcps, setMcps] = useState16([]);
  const [pagination, setPagination] = useState16({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0
  });
  const [isLoading, setIsLoading] = useState16(false);
  const [error, setError] = useState16(null);
  const fetchMcps = useCallback16(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      query.set("scope", "mine");
      const res = await fetchWithAuth(`/mcps?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to list MCPs: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setMcps(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 }
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search]);
  const getMcp = useCallback16(
    async (mcpId) => {
      const res = await fetchWithAuth(`/mcps/${mcpId}`);
      if (!res.ok) throw new Error(`Failed to fetch MCP: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth]
  );
  const createMcp = useCallback16(
    async (input) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/mcps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create MCP (${res.status}): ${errText}`);
        }
        const created = await res.json();
        setMcps((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const updateMcp = useCallback16(
    async (mcpId, input) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update MCP (${res.status}): ${errText}`);
        }
        const updated = await res.json();
        setMcps((prev) => prev.map((m) => m._id === mcpId ? updated : m));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const deleteMcp = useCallback16(
    async (mcpId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete MCP (${res.status}): ${errText}`);
        }
        setMcps((prev) => prev.filter((m) => m._id !== mcpId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const bulkDeleteMcps = useCallback16(
    async (ids) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/mcps/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete MCPs (${res.status}): ${errText}`);
        }
        const result = await res.json();
        const deletedSet = new Set(result.deleted);
        setMcps((prev) => prev.filter((m) => !deletedSet.has(m._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  const testConnection = useCallback16(
    async (mcpId) => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}/test`, { method: "POST" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to test MCP connection (${res.status}): ${errText}`);
        }
        const result = await res.json();
        setMcps(
          (prev) => prev.map(
            (m) => m._id === mcpId ? { ...m, tools: result.tools, resources: result.resources, resourceTemplates: result.resourceTemplates } : m
          )
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  useEffect14(() => {
    if (autoFetch) void fetchMcps();
  }, [autoFetch, fetchMcps]);
  return {
    mcps,
    pagination,
    isLoading,
    error,
    refetch: fetchMcps,
    getMcp,
    createMcp,
    updateMcp,
    deleteMcp,
    bulkDeleteMcps,
    testConnection
  };
}

// src/hooks/useWorkflows.ts
import { useCallback as useCallback17, useEffect as useEffect15, useState as useState17 } from "react";
function useWorkflows(options) {
  const opts = typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true, search, scope, visibility, isEnabled, page, limit } = opts;
  const { fetchWithAuth } = usePersonaContext();
  const [workflows, setWorkflows] = useState17([]);
  const [pagination, setPagination] = useState17({
    page: page ?? 1,
    limit: limit ?? 20,
    total: 0,
    totalPages: 0
  });
  const [isLoading, setIsLoading] = useState17(false);
  const [error, setError] = useState17(null);
  const fetchWorkflows = useCallback17(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (scope) params.set("scope", scope);
      if (visibility) params.set("visibility", visibility);
      if (isEnabled !== void 0) params.set("isEnabled", String(isEnabled));
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetchWithAuth(`/workflows${queryStr}`);
      if (!res.ok) {
        throw new Error(`Failed to list workflows: ${res.statusText}`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setWorkflows(items);
      if (data?.pagination) {
        setPagination({
          page: data.pagination.page ?? 1,
          limit: data.pagination.limit ?? items.length,
          total: data.pagination.total ?? items.length,
          // Backend's paginationEnvelope() names this field `pages`, not
          // `totalPages` — this used to always fall through to the `?? 1`
          // default.
          totalPages: data.pagination.pages ?? 1
        });
      } else {
        setPagination({
          page: 1,
          limit: items.length,
          total: items.length,
          totalPages: 1
        });
      }
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, search, scope, visibility, isEnabled, page, limit]);
  const createWorkflow = useCallback17(
    async (input) => {
      setError(null);
      try {
        const res = await fetchWithAuth("/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create workflow (${res.status}): ${errText}`);
        }
        const created = await res.json();
        setWorkflows((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth]
  );
  useEffect15(() => {
    if (autoFetch) {
      void fetchWorkflows();
    }
  }, [autoFetch, fetchWorkflows]);
  return {
    workflows,
    pagination,
    isLoading,
    error,
    refetch: fetchWorkflows,
    createWorkflow
  };
}

// src/hooks/useWorkflow.ts
import { useCallback as useCallback18, useEffect as useEffect16, useState as useState18 } from "react";
function useWorkflow(workflowId, options) {
  const opts = typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true } = opts;
  const { fetchWithAuth } = usePersonaContext();
  const [workflow, setWorkflow] = useState18(null);
  const [versions, setVersions] = useState18([]);
  const [mermaid, setMermaid] = useState18(null);
  const [isLoading, setIsLoading] = useState18(false);
  const [error, setError] = useState18(null);
  const fetchWorkflow = useCallback18(async () => {
    if (!workflowId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow (${res.status}): ${res.statusText}`);
      }
      const data = await res.json();
      setWorkflow(data);
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, workflowId]);
  const fetchVersions = useCallback18(async () => {
    if (!workflowId) return [];
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}/versions`);
      if (!res.ok) return [];
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setVersions(items);
      return items;
    } catch {
      return [];
    }
  }, [fetchWithAuth, workflowId]);
  const getVersion = useCallback18(
    async (version) => {
      if (!workflowId) throw new Error("Workflow ID is required");
      const res = await fetchWithAuth(`/workflows/${workflowId}/versions/${version}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow version (${res.status}): ${res.statusText}`);
      }
      return await res.json();
    },
    [fetchWithAuth, workflowId]
  );
  const fetchMermaid = useCallback18(async () => {
    if (!workflowId) return "";
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}/mermaid`);
      if (!res.ok) return "";
      const data = await res.json();
      const code = typeof data?.mermaid === "string" ? data.mermaid : String(data ?? "");
      setMermaid(code);
      return code;
    } catch {
      return "";
    }
  }, [fetchWithAuth, workflowId]);
  const updateWorkflow = useCallback18(
    async (input) => {
      if (!workflowId) throw new Error("Workflow ID is required");
      setError(null);
      const res = await fetchWithAuth(`/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to update workflow (${res.status}): ${errText}`);
      }
      const updated = await res.json();
      setWorkflow(updated);
      return updated;
    },
    [fetchWithAuth, workflowId]
  );
  const saveDraft = useCallback18(
    async (draft) => {
      if (!workflowId) throw new Error("Workflow ID is required");
      setError(null);
      const res = await fetchWithAuth(`/workflows/${workflowId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to save draft (${res.status}): ${errText}`);
      }
      const updated = await res.json();
      setWorkflow(updated);
      return updated;
    },
    [fetchWithAuth, workflowId]
  );
  const publish = useCallback18(async () => {
    if (!workflowId) throw new Error("Workflow ID is required");
    setError(null);
    const res = await fetchWithAuth(`/workflows/${workflowId}/publish`, {
      method: "POST"
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Failed to publish workflow (${res.status}): ${errText}`);
    }
    const versionResult = await res.json();
    void fetchWorkflow();
    void fetchVersions();
    return versionResult;
  }, [fetchWithAuth, workflowId, fetchWorkflow, fetchVersions]);
  const deleteWorkflow = useCallback18(async () => {
    if (!workflowId) throw new Error("Workflow ID is required");
    setError(null);
    const res = await fetchWithAuth(`/workflows/${workflowId}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      throw new Error(`Failed to delete workflow (${res.status}): ${res.statusText}`);
    }
    setWorkflow(null);
  }, [fetchWithAuth, workflowId]);
  useEffect16(() => {
    if (autoFetch && workflowId) {
      void fetchWorkflow();
    }
  }, [autoFetch, workflowId, fetchWorkflow]);
  return {
    workflow,
    versions,
    mermaid,
    isLoading,
    error,
    refetch: fetchWorkflow,
    fetchVersions,
    getVersion,
    fetchMermaid,
    updateWorkflow,
    saveDraft,
    publish,
    deleteWorkflow
  };
}

// src/hooks/useWorkflowStream.ts
import { useCallback as useCallback19, useEffect as useEffect17, useRef as useRef5, useState as useState19 } from "react";
function useWorkflowStream(workflowId, options) {
  const { baseUrl, getAuthToken, fetchWithAuth, logger } = usePersonaContext();
  const [status, setStatus] = useState19("idle");
  const [runId, setRunId] = useState19(null);
  const [activeNodeId, setActiveNodeId] = useState19(null);
  const [nodeRuns, setNodeRuns] = useState19(
    {}
  );
  const [text, setText] = useState19("");
  const [output, setOutput] = useState19(null);
  const [error, setError] = useState19(null);
  const [events, setEvents] = useState19([]);
  const abortControllerRef = useRef5(null);
  const currentRunIdRef = useRef5(null);
  currentRunIdRef.current = runId;
  const optionsRef = useRef5(options);
  optionsRef.current = options;
  const cancel = useCallback19(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const currentRun = currentRunIdRef.current;
    if (currentRun) {
      try {
        await fetchWithAuth(`/workflows/runs/${currentRun}/cancel`, {
          method: "POST"
        });
      } catch (err) {
        logger.warn("Failed to send cancel request to workflow run", {
          runId: currentRun,
          error: String(err)
        });
      }
    }
    setStatus("cancelled");
    setActiveNodeId(null);
  }, [fetchWithAuth, logger]);
  const reset = useCallback19(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
    setRunId(null);
    setActiveNodeId(null);
    setNodeRuns({});
    setText("");
    setOutput(null);
    setError(null);
    setEvents([]);
  }, []);
  const processStream = useCallback19(
    async (url, method, body, targetRunId) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStatus("running");
      setError(null);
      const token = getAuthToken ? await getAuthToken() : null;
      const headers = {
        Accept: "text/event-stream"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (method === "POST") {
        headers["Content-Type"] = "application/json";
      }
      let assignedRunId = targetRunId ?? null;
      let accumulatedText = "";
      let finalOutput = null;
      try {
        const stream = await openSSEStream({
          url,
          method,
          headers,
          body,
          signal: controller.signal
        });
        if (!stream.ok) {
          throw new Error(
            stream.errorText || `Stream request failed with status ${stream.status}`
          );
        }
        const runIdHeader = stream.getHeader("x-persona-run-id");
        if (runIdHeader) {
          assignedRunId = runIdHeader;
          setRunId(runIdHeader);
        }
        let buffer = "";
        while (true) {
          const { done, value } = await stream.reader.read();
          if (done) break;
          if (!value) continue;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed.startsWith("data:")) {
              const rawData = trimmed.slice(5).trim();
              if (!rawData || rawData === "[DONE]") continue;
              try {
                const event = JSON.parse(rawData);
                setEvents((prev) => [...prev, event]);
                optionsRef.current?.onEvent?.(event);
                if ("runId" in event && typeof event.runId === "string" && !assignedRunId) {
                  assignedRunId = event.runId;
                  setRunId(event.runId);
                }
                if (event.type === "TEXT_MESSAGE_CHUNK") {
                  accumulatedText += event.delta;
                  setText((prev) => prev + event.delta);
                } else if (event.type === "CUSTOM") {
                  if (event.name === "workflow_node_started") {
                    const val = event.value;
                    setActiveNodeId(val.nodeId);
                    setNodeRuns((prev) => ({
                      ...prev,
                      [val.nodeId]: {
                        nodeId: val.nodeId,
                        nodeType: val.nodeType,
                        nodeLabel: val.nodeLabel,
                        status: "running",
                        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
                        input: val.input
                      }
                    }));
                    optionsRef.current?.onNodeStarted?.(val);
                  } else if (event.name === "workflow_node_completed") {
                    const val = event.value;
                    setNodeRuns((prev) => {
                      const existing = prev[val.nodeId];
                      return {
                        ...prev,
                        [val.nodeId]: {
                          nodeId: val.nodeId,
                          nodeType: existing?.nodeType ?? "unknown",
                          nodeLabel: existing?.nodeLabel ?? val.nodeId,
                          status: "completed",
                          startedAt: existing?.startedAt,
                          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
                          input: existing?.input,
                          output: val.output
                        }
                      };
                    });
                    setActiveNodeId((curr) => curr === val.nodeId ? null : curr);
                    finalOutput = val.output;
                    setOutput(val.output);
                    optionsRef.current?.onNodeCompleted?.(val);
                  } else if (event.name === "workflow_node_failed") {
                    const val = event.value;
                    setNodeRuns((prev) => {
                      const existing = prev[val.nodeId];
                      return {
                        ...prev,
                        [val.nodeId]: {
                          nodeId: val.nodeId,
                          nodeType: existing?.nodeType ?? "unknown",
                          nodeLabel: existing?.nodeLabel ?? val.nodeId,
                          status: "failed",
                          startedAt: existing?.startedAt,
                          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
                          input: existing?.input,
                          error: val.error
                        }
                      };
                    });
                    setActiveNodeId((curr) => curr === val.nodeId ? null : curr);
                    optionsRef.current?.onNodeFailed?.(val);
                  }
                } else if (event.type === "RUN_FINISHED") {
                  setStatus("completed");
                  setActiveNodeId(null);
                  optionsRef.current?.onFinish?.({
                    runId: assignedRunId || "",
                    output: finalOutput,
                    text: accumulatedText
                  });
                } else if (event.type === "RUN_ERROR") {
                  const runErr = new Error(event.message || event.code || "Workflow run error");
                  setStatus("failed");
                  setError(runErr);
                  setActiveNodeId(null);
                  optionsRef.current?.onError?.(runErr);
                }
              } catch {
              }
            }
          }
        }
        setStatus((prev) => prev === "running" ? "completed" : prev);
        return finalOutput;
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("cancelled");
          return null;
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setStatus("failed");
        setError(errorObj);
        setActiveNodeId(null);
        optionsRef.current?.onError?.(errorObj);
        throw errorObj;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [getAuthToken]
  );
  const start = useCallback19(
    async (input, opts) => {
      const targetWfId = opts?.workflowId || workflowId;
      if (!targetWfId) {
        throw new Error("Workflow ID must be provided to start execution");
      }
      setNodeRuns({});
      setText("");
      setOutput(null);
      setEvents([]);
      setActiveNodeId(null);
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const url = `${cleanBase}/workflows/${targetWfId}/stream`;
      const body = JSON.stringify({
        input: input ?? {},
        dryRun: opts?.dryRun ?? false
      });
      return processStream(url, "POST", body);
    },
    [workflowId, baseUrl, processStream]
  );
  const resume = useCallback19(
    async (targetRunId, sinceSeq) => {
      if (!targetRunId) {
        throw new Error("Run ID is required to resume stream");
      }
      setRunId(targetRunId);
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const query = sinceSeq !== void 0 ? `?since=${sinceSeq}` : "";
      const url = `${cleanBase}/workflows/runs/${targetRunId}/resume${query}`;
      await processStream(url, "GET", void 0, targetRunId);
    },
    [baseUrl, processStream]
  );
  useEffect17(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  return {
    runId,
    status,
    isRunning: status === "running",
    activeNodeId,
    nodeRuns,
    text,
    output,
    error,
    events,
    start,
    cancel,
    resume,
    reset
  };
}

// src/hooks/useWorkflowRuns.ts
import { useCallback as useCallback20, useEffect as useEffect18, useState as useState20 } from "react";
function useWorkflowRuns(workflowId, options) {
  const opts = typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true, page = 1, limit = 20 } = opts;
  const { fetchWithAuth } = usePersonaContext();
  const [runs, setRuns] = useState20([]);
  const [pagination, setPagination] = useState20({
    page,
    limit,
    total: 0,
    totalPages: 0
  });
  const [isLoading, setIsLoading] = useState20(false);
  const [error, setError] = useState20(null);
  const fetchRuns = useCallback20(async () => {
    if (!workflowId) return [];
    setIsLoading(true);
    setError(null);
    try {
      const query = `?page=${page}&limit=${limit}`;
      const res = await fetchWithAuth(`/workflows/${workflowId}/runs${query}`);
      if (!res.ok) {
        throw new Error(`Failed to list workflow runs: ${res.statusText}`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setRuns(items);
      if (data?.pagination) {
        setPagination({
          page: data.pagination.page ?? page,
          limit: data.pagination.limit ?? limit,
          total: data.pagination.total ?? items.length,
          // Backend's paginationEnvelope() names this field `pages`, not
          // `totalPages`.
          totalPages: data.pagination.pages ?? 1
        });
      }
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, workflowId, page, limit]);
  const getRun = useCallback20(
    async (runId) => {
      if (!runId) throw new Error("Run ID is required");
      const res = await fetchWithAuth(`/workflows/runs/${runId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow run (${res.status}): ${res.statusText}`);
      }
      return await res.json();
    },
    [fetchWithAuth]
  );
  const cancelRun = useCallback20(
    async (runId) => {
      if (!runId) throw new Error("Run ID is required");
      const res = await fetchWithAuth(`/workflows/runs/${runId}/cancel`, {
        method: "POST"
      });
      if (!res.ok) {
        throw new Error(`Failed to cancel workflow run (${res.status}): ${res.statusText}`);
      }
      setRuns(
        (prev) => prev.map((r) => r._id === runId ? { ...r, status: "cancelled" } : r)
      );
    },
    [fetchWithAuth]
  );
  useEffect18(() => {
    if (autoFetch && workflowId) {
      void fetchRuns();
    }
  }, [autoFetch, workflowId, fetchRuns]);
  return {
    runs,
    pagination,
    isLoading,
    error,
    refetch: fetchRuns,
    getRun,
    cancelRun
  };
}

// src/hooks/useRenderTool.tsx
import {
  useCallback as useCallback21,
  useEffect as useEffect19,
  useRef as useRef6,
  useSyncExternalStore
} from "react";
import { Fragment, jsx as jsx2 } from "react/jsx-runtime";
function useRenderTool(config) {
  const { toolRegistry, logger } = usePersonaContext();
  const renderRef = useRef6(config.render);
  renderRef.current = config.render;
  const { name } = config;
  useEffect19(() => {
    if (!name) return;
    if (toolRegistry.hasRenderer(name)) {
      logger.warn("useRenderTool: replacing an existing renderer", { name });
    }
    logger.debug("useRenderTool registered", { name });
    return toolRegistry.registerRenderer(
      name,
      (props) => renderRef.current(props)
    );
  }, [name, toolRegistry, logger]);
}
function ToolRenderHost({
  render,
  props
}) {
  return /* @__PURE__ */ jsx2(Fragment, { children: render(props) });
}
function useRenderToolCall() {
  const { toolRegistry } = usePersonaContext();
  const version = useSyncExternalStore(
    toolRegistry.subscribe,
    toolRegistry.getVersion,
    toolRegistry.getVersion
  );
  return useCallback21(
    (toolCall) => {
      const render = toolRegistry.getRenderer(toolCall.toolName);
      if (!render) return void 0;
      const props = buildToolRenderProps(toolCall);
      const respond = toolRegistry.getResponder(toolCall.toolCallId);
      if (respond && props.status !== "complete") props.respond = respond;
      return /* @__PURE__ */ jsx2(
        ToolRenderHost,
        {
          render,
          props
        },
        toolCall.toolCallId
      );
    },
    // `version` re-creates the function when renderers change.
    [toolRegistry, version]
  );
}
function PersonaToolCallView({
  toolCall,
  fallback = null
}) {
  const renderToolCall = useRenderToolCall();
  const node = renderToolCall(toolCall);
  return /* @__PURE__ */ jsx2(Fragment, { children: node ?? fallback });
}

// src/hooks/useFrontendTool.tsx
import { useEffect as useEffect20, useRef as useRef7 } from "react";
function useRegisterFrontendTool(kind, config, handler, render) {
  const { toolRegistry, logger } = usePersonaContext();
  const handlerRef = useRef7(handler);
  handlerRef.current = handler;
  const renderRef = useRef7(render);
  renderRef.current = render;
  const hasRender = !!render;
  const { name, description } = config;
  const schemaJson = JSON.stringify(resolveToolParameters(config.parameters));
  useEffect20(() => {
    if (!name) return;
    if (toolRegistry.getFrontendTool(name)) {
      logger.warn("frontend tool: replacing an existing registration", {
        name
      });
    }
    logger.debug("frontend tool registered", { name, kind });
    const offTool = toolRegistry.registerFrontendTool({
      kind,
      definition: { name, description, parameters: JSON.parse(schemaJson) },
      handler: kind === "handler" ? (args, ctx) => handlerRef.current?.(args, ctx) : void 0
    });
    const offRender = hasRender ? toolRegistry.registerRenderer(
      name,
      (props) => renderRef.current?.(props)
    ) : void 0;
    return () => {
      offTool();
      offRender?.();
    };
  }, [toolRegistry, logger, kind, name, description, schemaJson, hasRender]);
}
function useFrontendTool(config) {
  useRegisterFrontendTool(
    "handler",
    config,
    config.handler,
    config.render
  );
}
function useHumanInTheLoop(config) {
  useRegisterFrontendTool(
    "humanInTheLoop",
    config,
    void 0,
    config.render
  );
}
function useComponent(config) {
  const renderRef = useRef7(config.render);
  renderRef.current = config.render;
  const wrapperRef = useRef7(
    (props) => renderRef.current(props.args, props)
  );
  useRegisterFrontendTool(
    "component",
    config,
    void 0,
    wrapperRef.current
  );
}

// src/hooks/useAttachments.ts
import { useCallback as useCallback22, useEffect as useEffect21, useMemo as useMemo6, useRef as useRef8, useState as useState21 } from "react";
var ATTACHMENT_LIMITS = Object.freeze({
  maxFiles: 4,
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp", "image/gif"])
});
var CACHE_MAX_BYTES = 40 * 1024 * 1024;
var blobCache = /* @__PURE__ */ new Map();
var cacheBytes = 0;
function cacheBlob(fileId, blob) {
  const existing = blobCache.get(fileId);
  if (existing) {
    blobCache.delete(fileId);
    cacheBytes -= existing.size;
  }
  if (blob.size > CACHE_MAX_BYTES) return;
  blobCache.set(fileId, blob);
  cacheBytes += blob.size;
  for (const [key, value] of blobCache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    blobCache.delete(key);
    cacheBytes -= value.size;
  }
}
function cachedBlob(fileId) {
  const blob = blobCache.get(fileId);
  if (blob) {
    blobCache.delete(fileId);
    blobCache.set(fileId, blob);
  }
  return blob;
}
var localSeq = 0;
function useAttachments(options = {}) {
  const { fetchWithAuth, logger } = usePersonaContext();
  const log = useMemo6(() => logger.child("attachments"), [logger]);
  const maxFiles = options.maxFiles ?? ATTACHMENT_LIMITS.maxFiles;
  const maxBytes = options.maxBytes ?? ATTACHMENT_LIMITS.maxBytes;
  const agentId = options.agentId;
  const [attachments, setAttachments] = useState21([]);
  const [error, setError] = useState21(null);
  const attachmentsRef = useRef8(attachments);
  attachmentsRef.current = attachments;
  const controllers = useRef8(/* @__PURE__ */ new Map());
  const update = useCallback22((id, patch) => {
    setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
  }, []);
  const upload = useCallback22(
    async (id, file) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        const form = new FormData();
        form.append("file", file, file.name);
        if (agentId) form.append("agentId", agentId);
        const res = await fetchWithAuth("/files", {
          method: "POST",
          body: form,
          signal: controller.signal
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text ? `Upload failed (${res.status}): ${text.slice(0, 200)}` : `Upload failed (${res.status})`);
        }
        const body = await res.json();
        const data = body?.data ?? body;
        const fileId = data.id ?? data._id;
        if (!fileId) throw new Error("Upload returned no file id");
        cacheBlob(fileId, file);
        update(id, { status: "ready", fileId });
        log.debug("attachment uploaded", { fileId, size: file.size });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        log.warn("attachment upload failed", { error: message });
        update(id, { status: "error", error: message });
      } finally {
        controllers.current.delete(id);
      }
    },
    [agentId, fetchWithAuth, log, update]
  );
  const add = useCallback22(
    (files) => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;
      setError(null);
      const room = maxFiles - attachmentsRef.current.length;
      const rejected = [];
      const accepted = [];
      for (const file of list) {
        if (!ATTACHMENT_LIMITS.mimeTypes.includes(file.type)) {
          rejected.push(`${file.name}: only PNG, JPEG, WebP or GIF images`);
          continue;
        }
        if (file.size > maxBytes) {
          rejected.push(`${file.name}: larger than ${Math.round(maxBytes / (1024 * 1024))} MB`);
          continue;
        }
        if (accepted.length >= room) {
          rejected.push(`At most ${maxFiles} images per message`);
          break;
        }
        accepted.push({
          file,
          entry: {
            id: `att-${Date.now()}-${++localSeq}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            previewUrl: URL.createObjectURL(file),
            status: "uploading"
          }
        });
      }
      if (rejected.length > 0) setError(rejected.join(". "));
      if (accepted.length === 0) return;
      setAttachments((prev) => [...prev, ...accepted.map((a) => a.entry)]);
      for (const { entry, file } of accepted) void upload(entry.id, file);
    },
    [maxBytes, maxFiles, upload]
  );
  const discard = useCallback22((items) => {
    for (const item of items) {
      controllers.current.get(item.id)?.abort();
      controllers.current.delete(item.id);
      URL.revokeObjectURL(item.previewUrl);
    }
  }, []);
  const remove = useCallback22(
    (id) => {
      setError(null);
      discard(attachmentsRef.current.filter((a) => a.id === id));
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [discard]
  );
  const clear = useCallback22(() => {
    setError(null);
    discard(attachmentsRef.current);
    setAttachments([]);
  }, [discard]);
  useEffect21(() => () => discard(attachmentsRef.current), [discard]);
  const ready = useMemo6(
    () => attachments.filter((a) => a.status === "ready" && a.fileId).map((a) => ({ fileId: a.fileId, mimeType: a.mimeType, name: a.name })),
    [attachments]
  );
  return {
    attachments,
    ready,
    isUploading: attachments.some((a) => a.status === "uploading"),
    error,
    accept: ATTACHMENT_LIMITS.mimeTypes.join(","),
    add,
    remove,
    clear
  };
}
function useAttachmentUrl(fileId) {
  const { fetchWithAuth } = usePersonaContext();
  const [state, setState] = useState21({ url: null, isLoading: !!fileId, error: null });
  useEffect21(() => {
    if (!fileId) {
      setState({ url: null, isLoading: false, error: null });
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    const show = (blob) => {
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, isLoading: false, error: null });
    };
    const hit = cachedBlob(fileId);
    if (hit) {
      show(hit);
    } else {
      setState({ url: null, isLoading: true, error: null });
      const controller = new AbortController();
      (async () => {
        try {
          const res = await fetchWithAuth(`/files/${encodeURIComponent(fileId)}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`Image unavailable (${res.status})`);
          const blob = await res.blob();
          if (cancelled) return;
          cacheBlob(fileId, blob);
          show(blob);
        } catch (err) {
          if (cancelled) return;
          setState({ url: null, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) });
        }
      })();
      return () => {
        cancelled = true;
        controller.abort();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, fetchWithAuth]);
  return state;
}

// src/index.ts
import {
  createLogger as createLogger2,
  createNoopLogger,
  setLogLevel,
  getLogLevel,
  isLevelEnabled
} from "@personaai/logger";
var VERSION = "0.22.0";
export {
  ANY_TOOL,
  ARCHITECT_AGENT_ID,
  ATTACHMENT_LIMITS,
  PersonaProvider,
  PersonaToolCallView,
  PersonaToolRegistry,
  VERSION,
  buildToolRenderProps,
  createLogger2 as createLogger,
  createNoopLogger,
  getChannelBadgeLabel,
  getLogLevel,
  getToolCallStatus,
  isLevelEnabled,
  openSSEStream,
  parsePartialJson,
  resolveToolParameters,
  setLogLevel,
  supportsStreamingFetch,
  useAgents,
  useArchitectChat,
  useAttachmentUrl,
  useAttachments,
  useChat,
  useComponent,
  useConnection,
  useFiles,
  useFrontendTool,
  useHumanInTheLoop,
  useKnowledgeBases,
  useMcp,
  useMcpAdmin,
  useMcpConnections,
  useMemory,
  useMessages,
  usePersonaContext,
  useRcpSources,
  useRenderTool,
  useRenderToolCall,
  useSkills,
  useThreads,
  useVoice,
  useWorkflow,
  useWorkflowRuns,
  useWorkflowStream,
  useWorkflows,
  useWorkspaceFiles
};
//# sourceMappingURL=index.js.map