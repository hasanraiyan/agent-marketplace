'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';
import type {
  PersonaInterrupt,
  PersonaMessage,
  PersonaResumeValue,
  PersonaStreamingEvent,
  PersonaSubagentActivityEntry,
  PersonaToolCall,
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
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId || defaultAgentId;
  const threadId = options.threadId;

  const [messages, setMessages] = useState<PersonaMessage[]>(options.initialMessages || []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [interrupt, setInterrupt] = useState<PersonaInterrupt | null>(null);

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
        const loaded: PersonaMessage[] = raw.map((m, i) => ({
          id: m.id || `history-${id}-${i}`,
          role: m.role,
          content: m.content,
          createdAt: new Date(),
          toolCalls: m.toolCalls,
        }));
        setMessages(loaded);
        // Re-show the approval/clarification card on reload if this thread
        // is currently paused — otherwise it wouldn't reappear until the
        // next live stream re-surfaces it.
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

      try {
        const payloadMessages = nextMessages.map((m) => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: m.content,
        }));

        const response = await fetchWithAuth('/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId: targetAgentId,
            messages: payloadMessages,
            threadId: overrideOptions?.threadId || options.threadId,
            resume: overrideOptions?.resume,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Stream failed');
          throw new Error(`Chat error (${response.status}): ${errText}`);
        }

        if (!response.body) {
          throw new Error('No response body received for streaming.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulatedText = '';
        let accumulatedReasoning = '';
        const toolCallsMap = new Map<string, PersonaToolCall>();

        const patchAssistant = (patch: Partial<PersonaMessage>) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, toolCalls: Array.from(toolCallsMap.values()), ...patch }
                : msg
            )
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
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
                  });
                }
                patchAssistant({});
              } else if (event.type === 'TOOL_CALL_RESULT') {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.content;
                  existing.isError = isErrorToolContent(event.content);
                  patchAssistant({});
                }
              } else if (event.type === 'REASONING_MESSAGE_CONTENT') {
                accumulatedReasoning += event.delta;
                patchAssistant({ reasoning: accumulatedReasoning, isReasoning: true });
              } else if (event.type === 'REASONING_END') {
                patchAssistant({ isReasoning: false });
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
          ...(accumulatedReasoning ? { reasoning: accumulatedReasoning, isReasoning: false } : {}),
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
      }
    },
    [agentId, fetchWithAuth, input, isStreaming, messages, options]
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
    loadThreadMessages,
  };
}
