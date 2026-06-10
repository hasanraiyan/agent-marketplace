'use client';

import { useEffect, useRef, useState } from 'react';
import { BotIcon, Loader2, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAguiChat } from '@/lib/agui/use-agui-chat';
import { getSuggestedPrompts } from './utils';
import { MessageBubble, ThinkingText, NewChatIcon } from './MessageBubble';
import { ToolTrace } from './ToolTrace';
import { ApprovalCard, ClarificationCard } from './ApprovalCard';
import { ChatComposer } from './ChatComposer';

export function AguiAgentChat({
  agent,
  url,
  agentId,
  threadId,
  headers,
  initialMessages = [],
  initialState = {},
  title = 'Sage',
  emptyTitle = 'Sage',
  emptyDescription = 'Tell me what you want to build, change, or explore.',
  className,
  onToolResult,
  onStateChange,
  onNewChat,
  onRunFinished,
  onOpenFile,
  showHeader = true,
  contentClassName,
}) {
  const [input, setInput] = useState('');
  const [resettingChat, setResettingChat] = useState(false);
  const scrollRef = useRef(null);
  const chat = useAguiChat({
    url,
    agentId,
    threadId,
    headers,
    initialMessages,
    initialState,
    onToolResult,
    onRunFinished,
  });

  const startNewChat = async () => {
    setInput('');
    if (!onNewChat) {
      chat.clear();
      return;
    }
    // Parent creates a fresh backend thread; local state resets when the
    // threadId prop changes. Fall back to a local clear only on failure.
    setResettingChat(true);
    try {
      await onNewChat();
    } catch (err) {
      console.error('Failed to start a new chat thread:', err);
      chat.clear();
    } finally {
      setResettingChat(false);
    }
  };

  useEffect(() => {
    onStateChange?.(chat.agentState);
  }, [chat.agentState, onStateChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  const send = () => {
    const text = input;
    setInput('');
    chat.send(text);
  };

  const messageById = (messageId) =>
    chat.messages.find((message) => message.id === messageId);
  const toolById = (toolId) =>
    chat.toolCalls.find((tool) => tool.id === toolId);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col bg-white dark:bg-slate-950',
        className,
      )}
    >
      {showHeader ? (
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#1E60FF]/10 text-[#1E60FF]">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-950 dark:text-white">
              {title}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            onClick={startNewChat}
            disabled={resettingChat}
            title="New Chat"
          >
            {resettingChat ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <NewChatIcon className="size-4" />
            )}
          </Button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {chat.conversation.length === 0 &&
        !chat.pendingApproval &&
        !chat.pendingClarification ? (
          <div
            className={cn(
              'mx-auto flex h-full w-full max-w-4xl flex-col justify-center px-4 py-8 md:py-16',
              contentClassName,
            )}
          >
            <div className="flex flex-col items-start text-left">
              {/* Avatar Circle */}
              <Avatar className="size-16 border border-slate-200/85 dark:border-slate-800">
                <AvatarImage
                  src={agent?.avatarUrl || agent?.avatar}
                  alt={agent?.name || 'Agent'}
                />
                <AvatarFallback className="bg-slate-100 dark:bg-slate-900 text-slate-500">
                  <BotIcon className="size-8 text-slate-400" />
                </AvatarFallback>
              </Avatar>

              {/* Info Card */}
              <div className="mt-6 w-full rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-950">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  {agent?.name || emptyTitle}
                  {agent?.modelName && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800/50">
                      {agent.modelName}
                    </span>
                  )}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {agent?.description || emptyDescription}
                </p>
                {agent?.category && (
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <span>{agent.category}</span>
                  </div>
                )}
              </div>

              {/* Suggested Prompts List */}
              <div className="mt-6 w-full space-y-2">
                {getSuggestedPrompts(agent).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInput(item.prompt);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-700 transition-all duration-200 hover:border-[#1E60FF] hover:bg-[#1E60FF]/5 hover:text-[#1E60FF] dark:border-slate-800/60 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-[#1E60FF] dark:hover:bg-[#1E60FF]/10 dark:hover:text-blue-400 cursor-pointer"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 ml-2">
                      Use Prompt →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'mx-auto w-full max-w-4xl space-y-4',
              contentClassName,
            )}
          >
            {chat.conversation.map((entry, index) => {
              if (entry.type === 'message') {
                const message = messageById(entry.refId);
                const precedingTools = [];
                for (let i = index - 1; i >= 0; i--) {
                  const prev = chat.conversation[i];
                  if (prev.type === 'tool') {
                    const t = toolById(prev.refId);
                    if (t) precedingTools.push(t);
                  } else {
                    break;
                  }
                }

                return message ? (
                  <MessageBubble
                    key={entry.id}
                    message={message}
                    agent={agent}
                    precedingTools={precedingTools}
                    onOpenFile={onOpenFile}
                  />
                ) : null;
              }
              const tool = toolById(entry.refId);
              return tool ? <ToolTrace key={entry.id} tool={tool} /> : null;
            })}
            {chat.pendingApproval ? (
              <ApprovalCard
                approval={chat.pendingApproval}
                onRespond={chat.respondToApproval}
                disabled={chat.isRunning}
              />
            ) : null}
            {chat.isRunning ? <ThinkingText label="Thinking" /> : null}
          </div>
        )}
      </div>

      {chat.error ? (
        <div
          className={cn(
            'mx-auto w-full max-w-4xl px-4 pb-2 text-sm text-red-500',
            contentClassName,
          )}
        >
          {chat.error}
        </div>
      ) : null}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-950/95">
        <div className={cn('mx-auto w-full max-w-4xl space-y-2', contentClassName)}>
          {chat.pendingClarification ? (
            <ClarificationCard
              key={chat.pendingClarification.currentIndex}
              clarification={chat.pendingClarification}
              onRespond={chat.respondToClarification}
              disabled={chat.isRunning}
            />
          ) : null}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={chat.stop}
            isRunning={chat.isRunning}
            disabled={!threadId || !url}
            placeholder={
              chat.pendingApproval
                ? 'Reply with feedback, or use the buttons above...'
                : chat.pendingClarification
                  ? 'Reply directly, or use the choices above...'
                : 'Write a message...'
            }
          />
        </div>
      </div>
    </div>
  );
}
