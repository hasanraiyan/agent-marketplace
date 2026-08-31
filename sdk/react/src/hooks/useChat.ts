'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';
import { openSSEStream } from '../streaming.js';
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
  SendMessageOverride,
  UseChatOptions,
} from '../types.js';

// A failed tool call's TOOL_CALL_RESULT content is a JSON envelope
// (`{status:'error',message}`, see aguiTranslator.js's buildToolErrorContent)
// rather than a separate boolean field on the event itself.
function isErrorToolContent(content: string): boolean {
  if (typeof content !== 'string' || !content.trim().startsWith('{')) return false;
  try {
    return JSON.parse(content)?.status === 'error';
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
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; argsText: string; resultText: string; status: 'running' | 'completed' };

// Re-expands the folded/paired persisted shape back into the raw kind-based
// entries `PersonaSubagentActivityEntry` (and everything downstream that
// consumes it — buildSubagentTimeline, the live-preview row, the activity
// dialog) already knows how to render, so no sdk/ui changes are needed.
function persistedTraceToActivityEntries(items: PersistedSubagentTraceItem[]): PersonaSubagentActivityEntry[] {
  const entries: PersonaSubagentActivityEntry[] = [];
  for (const item of items) {
    if (item.type === 'text') {
      if (item.text) entries.push({ kind: 'text', delta: item.text });
    } else {
      entries.push({ kind: 'tool_start', toolName: item.name, args: item.argsText });
      if (item.status === 'completed') {
        entries.push({ kind: 'tool_result', toolName: item.name, result: item.resultText });
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
    if (parsed?.status !== 'success' || typeof parsed.filePath !== 'string') return null;
    return {
      path: parsed.filePath,
      title: typeof parsed.title === 'string' ? parsed.title : parsed.filePath,
      description: typeof parsed.description === 'string' ? parsed.description : '',
    };
  } catch {
    return null;
  }
}

// buildFilesTodosSnapshot (aguiTranslator.js) emits snake_case
// created_at/modified_at on the wire — both from the live STATE_SNAPSHOT
// event and from a reloaded thread's persisted state (checkpoint.service.js
// runs the same function). Normalize to the SDK's usual camelCase shape.
function normalizeWorkspaceFiles(
  raw: Record<string, { content: string; size: number; created_at: string | null; modified_at: string | null }>
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
  if (!pending || typeof pending !== 'object') return null;
  const p = pending as { kind?: string; value?: Record<string, unknown> };
  if (p.kind === 'hitl') {
    return {
      kind: 'hitl',
      actionRequests: (p.value?.actionRequests ?? []) as Extract<
        PersonaInterrupt,
        { kind: 'hitl' }
      >['actionRequests'],
      reviewConfigs: (p.value?.reviewConfigs ?? []) as unknown[],
    };
  }
  if (p.kind === 'clarification') {
    return {
      kind: 'clarification',
      questions: (p.value?.questions ?? []) as Extract<PersonaInterrupt, { kind: 'clarification' }>['questions'],
    };
  }
  return null;
}

export function useChat(options: UseChatOptions = {}) {
  const { defaultAgentId, fetchWithAuth, baseUrl, getAuthToken } = usePersonaContext();
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;

  const [messages, setMessages] = useState<PersonaMessage[]>(options.initialMessages || []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [interrupt, setInterrupt] = useState<PersonaInterrupt | null>(null);
  const [files, setFiles] = useState<Record<string, PersonaWorkspaceFile>>({});
  const [todos, setTodos] = useState<PersonaTodo[]>([]);
  const [presentedFile, setPresentedFile] = useState<PersonaPresentedFile | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedThreadIdRef = useRef<string | undefined>(undefined);

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
    setInterrupt(null);
    setFiles({});
    setTodos([]);
    setPresentedFile(null);
  }, [stop]);

  const loadThreadMessages = useCallback(
    async (id: string) => {
      setIsLoadingHistory(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/threads/${id}/messages`);
        if (!res.ok) throw new Error(`Failed to load thread history: ${res.statusText}`);
        const body = await res.json();
        const data = body?.data ?? body;
        const raw = (data?.messages ?? []) as Array<{
          id?: string;
          role: PersonaMessage['role'];
          content: string;
          toolCalls?: PersonaToolCall[];
        }>;
        const subagentTraces = (data?.subagentTraces ?? {}) as Record<string, PersistedSubagentTraceItem[]>;
        const loaded: PersonaMessage[] = raw.map((m, i) => ({
          id: m.id || `history-${id}-${i}`,
          role: m.role,
          content: m.content,
          createdAt: new Date(),
          toolCalls: m.toolCalls?.map((tc) => {
            const trace = subagentTraces[tc.toolCallId];
            return Array.isArray(trace) && trace.length > 0
              ? { ...tc, subagentActivity: persistedTraceToActivityEntries(trace) }
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

  // Auto-load history the first time a thread with no in-memory messages is
  // selected (switching threads in the sidebar). Skipped for a thread whose
  // messages already live in state — e.g. one just created by handleSend,
  // which sets its placeholder messages in the same render batch as the
  // threadId change, so `messages` there is never empty at effect time.
  useEffect(() => {
    if (!threadId || isStreaming) return;
    if (loadedThreadIdRef.current === threadId) return;
    if (messages.length > 0) return;
    loadedThreadIdRef.current = threadId;
    void loadThreadMessages(threadId);
  }, [threadId, isStreaming, messages.length, loadThreadMessages]);

  const sendMessage = useCallback(
    async (contentToSend?: string, overrideOptions?: SendMessageOverride) => {
      const prompt = (contentToSend ?? input).trim();
      if (!prompt || isStreaming) return;

      const targetAgentId = overrideOptions?.agentId || agentId;
      if (!targetAgentId) {
        const err = new Error('No Agent ID specified for useChat.');
        setError(err);
        options.onError?.(err);
        return;
      }

      const userMessage: PersonaMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: prompt,
        createdAt: new Date(),
      };

      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const placeholderAssistant: PersonaMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        isStreaming: true,
        toolCalls: [],
      };

      const nextMessages = [...messages, userMessage];
      setMessages([...nextMessages, placeholderAssistant]);
      setInput('');
      setIsStreaming(true);
      setError(null);
      setInterrupt(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Marks any reasoning message still flagged streaming as done — for
      // runs that end (abort/error) without a final REASONING_END. Declared
      // outside the try so the finally block can reach it.
      const finalizeReasoning = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.role === 'reasoning' && m.isStreaming ? { ...m, isStreaming: false } : m
          )
        );
      };

      try {
        // Reasoning messages are ephemeral client-side thoughts — never part
        // of the transcript sent back to the server (the backend already has
        // its own persisted copy and would treat them as user turns).
        const payloadMessages = nextMessages
          .filter((m) => m.role !== 'reasoning')
          .map((m) => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.content,
          }));

        // Resolved here, not earlier — everything above this line (the
        // optimistic message + placeholder, clearing input, etc.) already
        // ran synchronously, so a caller passing an in-flight thread-creation
        // promise gets an instant UI update without the message send itself
        // waiting on it any longer than the network call already would.
        const resolvedThreadId = await (overrideOptions?.threadId ?? options.threadId);

        // openSSEStream, not fetchWithAuth: the transport has to be chosen
        // before the request goes out. React Native's fetch never populates
        // response.body and only settles once the whole response has arrived,
        // so discovering the missing body afterwards would already have cost
        // us the stream. See src/streaming.ts.
        const token = getAuthToken ? await getAuthToken() : null;
        const stream = await openSSEStream({
          url: `${baseUrl}/chat`,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            agentId: targetAgentId,
            messages: payloadMessages,
            threadId: resolvedThreadId,
            resume: overrideOptions?.resume,
          }),
          signal: controller.signal,
        });

        if (!stream.ok) {
          throw new Error(`Chat error (${stream.status}): ${stream.errorText ?? 'Stream failed'}`);
        }

        const reader = stream.reader;
        let buffer = '';
        let accumulatedText = '';
        const toolCallsMap = new Map<string, PersonaToolCall>();
        // Reasoning streams as its own `role: 'reasoning'` message per phase
        // (REASONING_MESSAGE_START … CONTENT … REASONING_END), never merged
        // into the assistant message or into a single accumulated blob —
        // mirrors the web timeline where each phase is a separate "Thoughts"
        // bubble. Each phase's message is inserted directly above the assistant
        // message so thoughts render above the answer, not underneath it.
        //
        // A monotonic counter shared by reasoning phases AND tool calls stamps
        // each with a `seq` in stream order (the backend emits REASONING_END
        // right before the next TOOL_CALL_CHUNK, then the next phase after the
        // result). Clients sort by it to interleave thoughts and tool calls
        // chronologically instead of stacking all thoughts above the answer.
        let streamSeq = 0;
        let activeReasoningId: string | null = null;
        const reasoningById = new Map<string, { content: string }>();

        const patchAssistant = (patch: Partial<PersonaMessage>) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, toolCalls: Array.from(toolCallsMap.values()), ...patch }
                : msg
            )
          );
        };

        const insertReasoningMessage = (id: string, seq: number) => {
          const msg: PersonaMessage = {
            id,
            role: 'reasoning',
            content: '',
            createdAt: new Date(),
            isStreaming: true,
            seq,
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

          buffer += value ?? '';
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const raw = trimmed.replace(/^data:\s*/, '');
            if (raw === '[DONE]') break;

            try {
              const event = JSON.parse(raw) as PersonaStreamingEvent;
              options.onEvent?.(event);

              if (event.type === 'TEXT_MESSAGE_CHUNK' && event.delta) {
                accumulatedText += event.delta;
                patchAssistant({ content: accumulatedText, isStreaming: true });
              } else if (event.type === 'TOOL_CALL_CHUNK' && event.toolCallId) {
                // The backend streams tool calls as accumulating chunks
                // (id/name arrive on the first chunk, args stream in pieces
                // across subsequent ones) rather than separate start/args
                // events.
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.args = (existing.args || '') + (event.delta || '');
                } else {
                  toolCallsMap.set(event.toolCallId, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolCallName || '',
                    args: event.delta || '',
                    seq: streamSeq++,
                  });
                }
                patchAssistant({});
              } else if (event.type === 'TOOL_CALL_RESULT') {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.content;
                  existing.isError = isErrorToolContent(event.content);
                  if (existing.toolName === 'present_file' && !existing.isError) {
                    const presented = parsePresentedFile(event.content);
                    if (presented) setPresentedFile(presented);
                  }
                  patchAssistant({});
                }
              } else if (event.type === 'STATE_SNAPSHOT') {
                setFiles(normalizeWorkspaceFiles(event.snapshot.files));
                setTodos(event.snapshot.todos);
              } else if (event.type === 'REASONING_MESSAGE_START' && event.messageId) {
                // A fresh reasoning phase — its own message, regardless of how
                // many phases this run produces. seq stamps it into stream
                // order against the tool calls it brackets.
                activeReasoningId = event.messageId;
                reasoningById.set(event.messageId, { content: '' });
                insertReasoningMessage(event.messageId, streamSeq++);
              } else if (event.type === 'REASONING_MESSAGE_CONTENT') {
                // Defensive: if the backend ever skips REASONING_MESSAGE_START,
                // lazily open the message on the first content chunk.
                let rid: string = event.messageId || activeReasoningId || '';
                if (!rid || !reasoningById.has(rid)) {
                  rid =
                    rid || `reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  activeReasoningId = rid;
                  reasoningById.set(rid, { content: '' });
                  insertReasoningMessage(rid, streamSeq++);
                }
                const entry = reasoningById.get(rid)!;
                entry.content += event.delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === rid ? { ...m, content: entry.content, isStreaming: true } : m
                  )
                );
              } else if (event.type === 'REASONING_END') {
                const rid = activeReasoningId;
                activeReasoningId = null;
                if (rid) {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === rid ? { ...m, isStreaming: false } : m))
                  );
                }
              } else if (event.type === 'CUSTOM') {
                if (event.name === 'hitl_request') {
                  const value = event.value as Extract<PersonaInterrupt, { kind: 'hitl' }>;
                  setInterrupt({
                    kind: 'hitl',
                    actionRequests: value.actionRequests,
                    reviewConfigs: value.reviewConfigs,
                  });
                } else if (event.name === 'clarification_request') {
                  const value = event.value as Extract<PersonaInterrupt, { kind: 'clarification' }>;
                  setInterrupt({ kind: 'clarification', questions: value.questions });
                } else if (event.name === 'subagent_activity') {
                  const { toolCallId, ...entry } = event.value as { toolCallId: string } & PersonaSubagentActivityEntry;
                  const existing = toolCallsMap.get(toolCallId);
                  if (existing) {
                    existing.subagentActivity = [...(existing.subagentActivity || []), entry];
                    patchAssistant({});
                  }
                }
                // 'mcp_app' custom events carry no chat-transcript UI here —
                // consumers that render MCP widgets read them via onEvent.
              } else if (event.type === 'RUN_ERROR') {
                throw new Error(event.message || 'Stream error from agent');
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith('Stream error')) {
                throw e;
              }
            }
          }
        }

        const finalMessage: PersonaMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: accumulatedText,
          createdAt: new Date(),
          isStreaming: false,
          toolCalls: Array.from(toolCallsMap.values()),
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? finalMessage : msg))
        );

        options.onFinish?.(finalMessage);
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
            )
          );
          return;
        }

        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        options.onError?.(errorObj);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    msg.content || `⚠️ Error: ${errorObj.message || 'Failed to get response.'}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        // A run that ends without a final REASONING_END (abort, error) must
        // still flip its in-flight reasoning messages to done.
        finalizeReasoning();
      }
    },
    [agentId, baseUrl, getAuthToken, input, isStreaming, messages, options]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      void sendMessage();
    },
    [sendMessage]
  );

  const reload = useCallback(() => {
    if (messages.length === 0 || isStreaming) return;
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;

    const lastUserMessage = messages[lastUserIndex];
    setMessages(messages.slice(0, lastUserIndex));
    void sendMessage(lastUserMessage.content);
  }, [isStreaming, messages, sendMessage]);

  // Unpauses a paused HITL/clarification run. `displayContent` becomes the
  // visible user-turn bubble (e.g. "Approved", or the typed clarification
  // answer) — the server resolves the actual resume value from `resume`
  // itself, `displayContent` is only ever used for its own transcript text.
  const resumeInterrupt = useCallback(
    (resume: PersonaResumeValue, displayContent: string) => sendMessage(displayContent, { resume }),
    [sendMessage]
  );

  const dismissPresentedFile = useCallback(() => setPresentedFile(null), []);

  // Manually re-open a workspace file — e.g. a present_file tool card's
  // "Open" button, after the auto-opened drawer was closed or a different
  // file was selected since.
  const openWorkspaceFile = useCallback(
    (path: string) => setPresentedFile({ path, title: path.split('/').pop() || path, description: '' }),
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
    loadThreadMessages,
  };
}
