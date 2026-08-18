'use client';

import { useCallback, useRef, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';
import type { PersonaMessage, PersonaStreamingEvent, PersonaToolCall, UseChatOptions } from '../types.js';

export function useChat(options: UseChatOptions = {}) {
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId || defaultAgentId;

  const [messages, setMessages] = useState<PersonaMessage[]>(options.initialMessages || []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

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
    async (contentToSend?: string, overrideOptions?: { agentId?: string; threadId?: string }) => {
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
        const toolCallsMap = new Map<string, PersonaToolCall>();

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
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: accumulatedText,
                          isStreaming: true,
                          toolCalls: Array.from(toolCallsMap.values()),
                        }
                      : msg
                  )
                );
              } else if (event.type === 'TOOL_CALL_START') {
                toolCallsMap.set(event.toolCallId, {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: '',
                });
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, toolCalls: Array.from(toolCallsMap.values()) }
                      : msg
                  )
                );
              } else if (event.type === 'TOOL_CALL_ARGS') {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.args = (existing.args || '') + event.delta;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, toolCalls: Array.from(toolCallsMap.values()) }
                        : msg
                    )
                  );
                }
              } else if (event.type === 'TOOL_CALL_RESULT') {
                const existing = toolCallsMap.get(event.toolCallId);
                if (existing) {
                  existing.result = event.result;
                  existing.isError = event.isError;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, toolCalls: Array.from(toolCallsMap.values()) }
                        : msg
                    )
                  );
                }
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
    setMessages,
  };
}
