'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { PersonaMessage } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { cn } from '../utils/cn.js';
import { PersonaToolTrace } from './PersonaToolTrace.js';
import { Bot, User, Check, Copy, RotateCcw, Sparkles, BrainCircuit, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

function ReasoningBlock({ reasoning, isReasoning }: { reasoning: string; isReasoning?: boolean }) {
  const [isOpen, setIsOpen] = useState(Boolean(isReasoning));

  useEffect(() => {
    if (isReasoning) setIsOpen(true);
  }, [isReasoning]);

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/60 text-xs dark:border-zinc-800/70 dark:bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-zinc-500 transition-colors hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:bg-zinc-900/40"
      >
        <span className="flex items-center gap-1.5">
          {isReasoning ? <Loader2 className="size-3 animate-spin" /> : <BrainCircuit className="size-3" />}
          <span className="font-medium">{isReasoning ? 'Thinking…' : 'Thought process'}</span>
        </span>
        {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      {isOpen && (
        <p className="whitespace-pre-wrap border-t border-zinc-200/60 p-2.5 text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400">
          {reasoning}
        </p>
      )}
    </div>
  );
}

export interface PersonaMessageFeedProps {
  messages: PersonaMessage[];
  isStreaming?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  toolRenderers?: ToolRendererMap;
  onReload?: () => void;
  greeting?: string;
  className?: string;
}

export function PersonaMessageFeed({
  messages,
  isStreaming,
  isLoading,
  error,
  toolRenderers,
  onReload,
  greeting = 'How can I assist you today?',
  className,
}: PersonaMessageFeedProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (messages.length === 0 && isLoading) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-8', className)}>
        <div className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center p-8 text-center', className)}>
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100">
          <Sparkles className="size-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl">
          {greeting}
        </h2>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 space-y-6 overflow-y-auto p-4 md:p-6', className)}>
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 text-sm leading-relaxed',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              {!isUser && (
                <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 shadow-2xs dark:bg-zinc-800 dark:text-zinc-200 mt-0.5">
                  <Bot className="size-4" />
                </div>
              )}

              <div
                className={cn(
                  'group relative max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm',
                  isUser
                    ? 'bg-zinc-900 text-white font-medium rounded-tr-xs dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100/80 text-zinc-900 rounded-tl-xs border border-zinc-200/60 dark:bg-zinc-900/70 dark:text-zinc-100 dark:border-zinc-800/60'
                )}
              >
                {/* Reasoning / thinking trace, shown before the answer */}
                {!isUser && msg.reasoning && (
                  <ReasoningBlock reasoning={msg.reasoning} isReasoning={msg.isReasoning} />
                )}

                {/* Render tool executions if any */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {msg.toolCalls.map((tc) => (
                      <PersonaToolTrace
                        key={tc.toolCallId}
                        toolCall={tc}
                        toolRenderers={toolRenderers}
                      />
                    ))}
                  </div>
                )}

                {/* Message text */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Streaming pulse */}
                {msg.isStreaming && (
                  <span className="inline-block size-2 ml-1 rounded-full bg-blue-500 animate-pulse" />
                )}

                {/* Message action buttons */}
                {!isUser && !msg.isStreaming && msg.content && (
                  <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {onReload && (
                      <button
                        type="button"
                        onClick={onReload}
                        title="Regenerate response"
                        className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      >
                        <RotateCcw className="size-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, msg.id)}
                      title="Copy message"
                      className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {copiedId === msg.id ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-200 text-zinc-700 shadow-2xs dark:bg-zinc-800 dark:text-zinc-300 mt-0.5">
                  <User className="size-4" />
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {error.message || 'Failed to communicate with agent.'}
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>
    </div>
  );
}
