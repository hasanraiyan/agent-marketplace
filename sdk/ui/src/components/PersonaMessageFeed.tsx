'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { PersonaMessage } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { cn } from '../utils/cn.js';
import { PersonaToolTrace } from './PersonaToolTrace.js';
import { PersonaToolGroup } from './PersonaToolGroup.js';
import { PersonaMarkdown } from './PersonaMarkdown.js';
import { groupToolCalls, type PersonaToolClusterLabels } from '../utils/toolGrouping.js';
import { PersonaMessageSkeletonRow } from './PersonaSkeleton.js';
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
        <p className="whitespace-pre-wrap break-words border-t border-zinc-200/60 p-2.5 text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400">
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
  /** Called when a present_file tool card's "Open" button is clicked. */
  onOpenFile?: (path: string) => void;
  greeting?: string;
  showUserAvatar?: boolean;
  showAssistantAvatar?: boolean;
  userAvatar?: React.ReactNode;
  assistantAvatar?: React.ReactNode;
  /** Clusters consecutive tool calls into one collapsible group instead of one card each. @default true */
  groupTools?: boolean;
  /** Overrides/extends the default tool-cluster title+icon map. */
  toolClusterLabels?: PersonaToolClusterLabels;
  className?: string;
}

export function PersonaMessageFeed({
  messages,
  isStreaming,
  isLoading,
  error,
  toolRenderers,
  onReload,
  onOpenFile,
  greeting = 'How can I assist you today?',
  showUserAvatar = true,
  showAssistantAvatar = true,
  userAvatar,
  assistantAvatar,
  groupTools = true,
  toolClusterLabels,
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
      <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4', className)}>
        <PersonaMessageSkeletonRow align="left" />
        <PersonaMessageSkeletonRow align="right" />
        <PersonaMessageSkeletonRow align="left" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center', className)}>
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
    <div className={cn('min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6', className)}>
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
              {!isUser && showAssistantAvatar && (
                assistantAvatar ?? (
                  <div className="mt-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-[var(--persona-assistant-avatar-bg,#f4f4f5)] text-[var(--persona-assistant-avatar-text,#27272a)] shadow-2xs dark:bg-[var(--persona-assistant-avatar-bg,#27272a)] dark:text-[var(--persona-assistant-avatar-text,#e4e4e7)]">
                    <Bot className="size-4" />
                  </div>
                )
              )}

              <div
                className={cn(
                  'group relative min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm',
                  isUser
                    ? 'rounded-tr-xs bg-[var(--persona-user-bg,#18181b)] font-medium text-[var(--persona-user-text,#ffffff)] dark:bg-[var(--persona-user-bg,#f4f4f5)] dark:text-[var(--persona-user-text,#18181b)]'
                    : 'rounded-tl-xs border border-zinc-200/60 bg-[var(--persona-assistant-bg,rgb(244_244_245_/_0.8))] text-[var(--persona-assistant-text,#18181b)] dark:border-zinc-800/60 dark:bg-[var(--persona-assistant-bg,rgb(24_24_27_/_0.7))] dark:text-[var(--persona-assistant-text,#f4f4f5)]'
                )}
              >
                {/* Reasoning / thinking trace, shown before the answer */}
                {!isUser && msg.reasoning && (
                  <ReasoningBlock reasoning={msg.reasoning} isReasoning={msg.isReasoning} />
                )}

                {/* Render tool executions if any. Grouped: consecutive
                    calls cluster into one collapsible "N steps" card
                    instead of one accordion each — a lone call still
                    renders as a plain card, and present_file always stands
                    on its own regardless of what's next to it. */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {groupTools
                      ? groupToolCalls(msg.toolCalls).map((item) =>
                          item.type === 'group' ? (
                            <PersonaToolGroup
                              key={item.tools[0].toolCallId}
                              tools={item.tools}
                              toolRenderers={toolRenderers}
                              onOpenFile={onOpenFile}
                              clusterLabels={toolClusterLabels}
                            />
                          ) : (
                            <PersonaToolTrace
                              key={item.tools[0].toolCallId}
                              toolCall={item.tools[0]}
                              toolRenderers={toolRenderers}
                              onOpenFile={onOpenFile}
                            />
                          )
                        )
                      : msg.toolCalls.map((tc) => (
                          <PersonaToolTrace
                            key={tc.toolCallId}
                            toolCall={tc}
                            toolRenderers={toolRenderers}
                            onOpenFile={onOpenFile}
                          />
                        ))}
                  </div>
                )}

                {/* Message text — Markdown (tables, LaTeX, code blocks) for
                    the assistant; the user's own literal text stays plain,
                    unrendered, so it can't surprise them with formatting
                    they didn't intend. */}
                {isUser ? (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                ) : (
                  <PersonaMarkdown content={msg.content} />
                )}

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

              {isUser && showUserAvatar && (
                userAvatar ?? (
                  <div className="mt-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-[var(--persona-user-avatar-bg,#e4e4e7)] text-[var(--persona-user-avatar-text,#3f3f46)] shadow-2xs dark:bg-[var(--persona-user-avatar-bg,#27272a)] dark:text-[var(--persona-user-avatar-text,#d4d4d8)]">
                    <User className="size-4" />
                  </div>
                )
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
