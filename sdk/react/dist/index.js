// src/context/PersonaContext.tsx
import { createContext, useContext, useMemo } from "react";
import { jsx } from "react/jsx-runtime";
var PersonaContext = createContext(null);
function PersonaProvider({
  baseUrl,
  getAuthToken,
  defaultAgentId,
  children
}) {
  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/+$/, ""), [baseUrl]);
  const value = useMemo(() => {
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
  return /* @__PURE__ */ jsx(PersonaContext.Provider, { value, children });
}
function usePersonaContext() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error("usePersonaContext must be used within a <PersonaProvider>");
  }
  return context;
}

// src/hooks/useChat.ts
import { useCallback, useRef, useState } from "react";
function useChat(options = {}) {
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId || defaultAgentId;
  const [messages, setMessages] = useState(options.initialMessages || []);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);
  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);
  const sendMessage = useCallback(
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
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const payloadMessages = nextMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }));
        const response = await fetchWithAuth("/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            agentId: targetAgentId,
            messages: payloadMessages,
            threadId: overrideOptions?.threadId || options.threadId
          }),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => "Stream failed");
          throw new Error(`Chat error (${response.status}): ${errText}`);
        }
        if (!response.body) {
          throw new Error("No response body received for streaming.");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let accumulatedText = "";
        const toolCallsMap = /* @__PURE__ */ new Map();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
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
                setMessages(
                  (prev) => prev.map(
                    (msg) => msg.id === assistantMessageId ? {
                      ...msg,
                      content: accumulatedText,
                      isStreaming: true,
                      toolCalls: Array.from(toolCallsMap.values())
                    } : msg
                  )
                );
              } else if (event.type === "TOOL_CALL_START") {
                toolCallsMap.set(event.toolCallId, {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: ""
                });
                setMessages(
                  (prev) => prev.map(
                    (msg) => msg.id === assistantMessageId ? { ...msg, toolCalls: Array.from(toolCallsMap.values()) } : msg
                  )
                );
              } else if (event.type === "TOOL_CALL_ARGS") {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.args = (existing.args || "") + event.delta;
                  setMessages(
                    (prev) => prev.map(
                      (msg) => msg.id === assistantMessageId ? { ...msg, toolCalls: Array.from(toolCallsMap.values()) } : msg
                    )
                  );
                }
              } else if (event.type === "TOOL_CALL_RESULT") {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.result;
                  existing.isError = event.isError;
                  setMessages(
                    (prev) => prev.map(
                      (msg) => msg.id === assistantMessageId ? { ...msg, toolCalls: Array.from(toolCallsMap.values()) } : msg
                    )
                  );
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
      }
    },
    [agentId, fetchWithAuth, input, isStreaming, messages, options]
  );
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);
  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      void sendMessage();
    },
    [sendMessage]
  );
  const reload = useCallback(() => {
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
  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    isStreaming,
    isLoading: isStreaming,
    error,
    stop,
    reload,
    clear,
    setMessages
  };
}

// src/hooks/useMemory.ts
import { useCallback as useCallback2, useEffect, useState as useState2 } from "react";
function useMemory(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [memory, setMemory] = useState2({ user: [], agents: {} });
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
      return { user: [], agents: {} };
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
      if (!res.ok) throw new Error(`Failed to get memory file: ${res.statusText}`);
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
      if (!res.ok) throw new Error(`Failed to write memory file: ${res.statusText}`);
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
      if (!res.ok) throw new Error(`Failed to delete memory file: ${res.statusText}`);
      void fetchMemory();
    },
    [fetchWithAuth, fetchMemory]
  );
  useEffect(() => {
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
import { useCallback as useCallback3, useEffect as useEffect2, useState as useState3 } from "react";
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
      const items = Array.isArray(data) ? data : data?.threads || data?.items || [];
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
      if (!res.ok) throw new Error(`Failed to create thread: ${res.statusText}`);
      const created = await res.json();
      void fetchThreads();
      return created;
    },
    [fetchWithAuth, defaultAgentId, fetchThreads]
  );
  const deleteThread = useCallback3(
    async (threadId) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete thread: ${res.statusText}`);
      setThreads((prev) => prev.filter((t) => t._id !== threadId));
    },
    [fetchWithAuth]
  );
  useEffect2(() => {
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
    deleteThread
  };
}

// src/hooks/useAgents.ts
import { useCallback as useCallback4, useEffect as useEffect3, useState as useState4 } from "react";
function useAgents(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = useState4([]);
  const [isLoading, setIsLoading] = useState4(false);
  const [error, setError] = useState4(null);
  const fetchAgents = useCallback4(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/agents");
      if (!res.ok) throw new Error(`Failed to list agents: ${res.statusText}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.agents || data?.items || [];
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
  useEffect3(() => {
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
import { useCallback as useCallback5, useEffect as useEffect4, useState as useState5 } from "react";
function useConnection(autoCheck = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [health, setHealth] = useState5(null);
  const [isConnected, setIsConnected] = useState5(false);
  const [isLoading, setIsLoading] = useState5(false);
  const checkHealth = useCallback5(async () => {
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
  useEffect4(() => {
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

// src/index.ts
var VERSION = "0.1.1";
export {
  PersonaProvider,
  VERSION,
  useAgents,
  useChat,
  useConnection,
  useMemory,
  usePersonaContext,
  useThreads
};
//# sourceMappingURL=index.js.map