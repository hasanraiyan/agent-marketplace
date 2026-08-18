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
import { useCallback, useEffect, useRef, useState } from "react";
function isErrorToolContent(content) {
  if (typeof content !== "string" || !content.trim().startsWith("{")) return false;
  try {
    return JSON.parse(content)?.status === "error";
  } catch {
    return false;
  }
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
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;
  const [messages, setMessages] = useState(options.initialMessages || []);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState(null);
  const [interrupt, setInterrupt] = useState(null);
  const abortControllerRef = useRef(null);
  const loadedThreadIdRef = useRef(void 0);
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
  const loadThreadMessages = useCallback(
    async (id) => {
      setIsLoadingHistory(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/threads/${id}/messages`);
        if (!res.ok) throw new Error(`Failed to load thread history: ${res.statusText}`);
        const body = await res.json();
        const data = body?.data ?? body;
        const raw = data?.messages ?? [];
        const loaded = raw.map((m, i) => ({
          id: m.id || `history-${id}-${i}`,
          role: m.role,
          content: m.content,
          createdAt: /* @__PURE__ */ new Date(),
          toolCalls: m.toolCalls
        }));
        setMessages(loaded);
        setInterrupt(normalizePendingInterrupt(data?.pendingInterrupt));
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
  useEffect(() => {
    if (!threadId || isStreaming) return;
    if (loadedThreadIdRef.current === threadId) return;
    if (messages.length > 0) return;
    loadedThreadIdRef.current = threadId;
    void loadThreadMessages(threadId);
  }, [threadId, isStreaming, messages.length, loadThreadMessages]);
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
      setInterrupt(null);
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
            threadId: overrideOptions?.threadId || options.threadId,
            resume: overrideOptions?.resume
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
        let accumulatedReasoning = "";
        const toolCallsMap = /* @__PURE__ */ new Map();
        const patchAssistant = (patch) => {
          setMessages(
            (prev) => prev.map(
              (msg) => msg.id === assistantMessageId ? { ...msg, toolCalls: Array.from(toolCallsMap.values()), ...patch } : msg
            )
          );
        };
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
                patchAssistant({ content: accumulatedText, isStreaming: true });
              } else if (event.type === "TOOL_CALL_CHUNK" && event.toolCallId) {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.args = (existing.args || "") + (event.delta || "");
                } else {
                  toolCallsMap.set(event.toolCallId, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolCallName || "",
                    args: event.delta || ""
                  });
                }
                patchAssistant({});
              } else if (event.type === "TOOL_CALL_RESULT") {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.content;
                  existing.isError = isErrorToolContent(event.content);
                  patchAssistant({});
                }
              } else if (event.type === "REASONING_MESSAGE_CONTENT") {
                accumulatedReasoning += event.delta;
                patchAssistant({ reasoning: accumulatedReasoning, isReasoning: true });
              } else if (event.type === "REASONING_END") {
                patchAssistant({ isReasoning: false });
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
          toolCalls: Array.from(toolCallsMap.values()),
          ...accumulatedReasoning ? { reasoning: accumulatedReasoning, isReasoning: false } : {}
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
  const resumeInterrupt = useCallback(
    (resume, displayContent) => sendMessage(displayContent, { resume }),
    [sendMessage]
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
  const [memory, setMemory] = useState2({ userFiles: [], agentMemories: [] });
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
      if (!res.ok) throw new Error(`Failed to create thread: ${res.statusText}`);
      const data = await res.json();
      const created = data?.data ?? data;
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
  const bulkDeleteThreads = useCallback3(
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
      if (!res.ok) throw new Error(`Failed to update thread: ${res.statusText}`);
      const data = await res.json();
      const updated = data?.data ?? data;
      setThreads((prev) => prev.map((t) => t._id === threadId ? { ...t, ...updated } : t));
      return updated;
    },
    [fetchWithAuth]
  );
  const renameThread = useCallback3(
    (threadId, title) => updateThread(threadId, { title }),
    [updateThread]
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
    getThread
  };
}

// src/hooks/useFiles.ts
import { useCallback as useCallback4, useEffect as useEffect4, useState as useState4 } from "react";
function useFiles(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState4([]);
  const [isLoading, setIsLoading] = useState4(false);
  const [isUploading, setIsUploading] = useState4(false);
  const [error, setError] = useState4(null);
  const fetchFiles = useCallback4(async () => {
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
  const uploadFile = useCallback4(
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
  const deleteFile = useCallback4(
    async (fileId) => {
      const res = await fetchWithAuth(`/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    },
    [fetchWithAuth]
  );
  const bulkDeleteFiles = useCallback4(
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
  const getDownloadUrl = useCallback4(
    (fileId) => {
      return `/files/${fileId}`;
    },
    []
  );
  useEffect4(() => {
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
import { useCallback as useCallback5, useEffect as useEffect5, useState as useState5 } from "react";
function useAgents(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = useState5([]);
  const [isLoading, setIsLoading] = useState5(false);
  const [error, setError] = useState5(null);
  const fetchAgents = useCallback5(async () => {
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
  useEffect5(() => {
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
import { useCallback as useCallback6, useEffect as useEffect6, useState as useState6 } from "react";
function useConnection(autoCheck = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [health, setHealth] = useState6(null);
  const [isConnected, setIsConnected] = useState6(false);
  const [isLoading, setIsLoading] = useState6(false);
  const checkHealth = useCallback6(async () => {
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
  useEffect6(() => {
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
var VERSION = "0.2.0";
export {
  PersonaProvider,
  VERSION,
  useAgents,
  useChat,
  useConnection,
  useFiles,
  useMemory,
  usePersonaContext,
  useThreads
};
//# sourceMappingURL=index.js.map