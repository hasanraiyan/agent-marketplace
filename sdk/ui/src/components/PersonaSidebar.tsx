'use client';

import React, { useState, useMemo } from 'react';
import type { PersonaThread } from '@personaai/react';
import { cn } from '../utils/cn.js';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search, ChevronRight } from 'lucide-react';
import { PersonaThreadSkeletonRow } from './PersonaSkeleton.js';

export interface PersonaSidebarProps {
  threads: PersonaThread[];
  activeThreadId?: string;
  onSelectThread: (threadId: string | undefined) => void;
  onCreateThread: () => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  /** Dismisses the sidebar on mobile, where it overlays instead of docking inline. */
  onClose?: () => void;
  /** Shows thread-row placeholders instead of the empty state while the initial list loads. */
  isLoading?: boolean;
  className?: string;
}

function groupThreadsByDate(threads: PersonaThread[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const sevenDaysAgo = today - 7 * 86400000;

  const groups: {
    today: PersonaThread[];
    yesterday: PersonaThread[];
    last7Days: PersonaThread[];
    older: PersonaThread[];
  } = {
    today: [],
    yesterday: [],
    last7Days: [],
    older: [],
  };

  for (const thread of threads) {
    const time = new Date(thread.updatedAt || thread.createdAt).getTime();
    if (time >= today) {
      groups.today.push(thread);
    } else if (time >= yesterday) {
      groups.yesterday.push(thread);
    } else if (time >= sevenDaysAgo) {
      groups.last7Days.push(thread);
    } else {
      groups.older.push(thread);
    }
  }

  return groups;
}

export function PersonaSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onClose,
  isLoading,
  className,
}: PersonaSidebarProps) {
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    return threads.filter((t) =>
      (t.title || 'New Chat').toLowerCase().includes(search.toLowerCase())
    );
  }, [threads, search]);

  const groups = useMemo(() => groupThreadsByDate(filteredThreads), [filteredThreads]);

  function startRename(t: PersonaThread) {
    setRenamingId(t._id);
    setRenameValue(t.title || 'New Chat');
  }

  function commitRename(threadId: string) {
    if (renameValue.trim()) {
      onRenameThread?.(threadId, renameValue.trim());
    }
    setRenamingId(null);
  }

  function renderGroup(title: string, items: PersonaThread[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {title}
        </span>
        <div className="mt-1.5 space-y-0.5">
          {items.map((thread) => {
            const isActive = thread._id === activeThreadId;
            const isRenaming = renamingId === thread._id;

            return (
              <div
                key={thread._id}
                className={cn(
                  'group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all',
                  isActive
                    ? 'bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200'
                )}
              >
                {isRenaming ? (
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(thread._id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="w-full rounded bg-white px-2 py-0.5 text-xs text-zinc-900 outline-none ring-1 ring-blue-500 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => commitRename(thread._id)}
                      className="p-1 text-emerald-500 hover:opacity-80"
                    >
                      <Check className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="p-1 text-red-500 hover:opacity-80"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectThread(thread._id)}
                      className="flex flex-1 items-center gap-2 truncate text-left"
                    >
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          isActive ? 'bg-[var(--persona-primary,#3b82f6)]' : 'bg-transparent'
                        )}
                      />
                      <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{thread.title || 'New Conversation'}</span>
                    </button>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {onRenameThread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(thread);
                          }}
                          className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <Edit2 className="size-3" />
                        </button>
                      )}
                      {onDeleteThread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteThread(thread._id);
                          }}
                          className="rounded p-1 text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — shown whenever the sidebar is overlaying (narrow host,
          not necessarily a narrow viewport — see @container on PersonaChatView's root). */}
      <div
        className="fixed inset-0 z-20 bg-black/30 @3xl/persona-chat:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-72 max-w-[80vw] flex-col border-r border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)] shadow-2xl dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-card,#18181b)]',
          '@3xl/persona-chat:static @3xl/persona-chat:z-auto @3xl/persona-chat:w-60 @3xl/persona-chat:max-w-none @3xl/persona-chat:shadow-none',
          className
        )}
      >
      {/* New Chat */}
      <div className="p-3">
        <button
          type="button"
          onClick={onCreateThread}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#ffffff)] px-4 py-2.5 text-xs font-semibold text-[var(--persona-text,#27272a)] shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.98] dark:border-[var(--persona-border,#3f3f46)] dark:bg-[var(--persona-bg,#27272a)] dark:text-[var(--persona-text,#f4f4f5)] dark:hover:bg-zinc-700"
        >
          <Plus className="size-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search Filter */}
      {threads.length > 5 && (
        <div className="relative my-3">
          <Search className="absolute left-2.5 top-2 size-3.5 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#ffffff)] py-1.5 pl-8 pr-3 text-xs text-[var(--persona-text,#27272a)] placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-bg,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]"
          />
        </div>
      )}

      {/* Grouped Thread List */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {isLoading && filteredThreads.length === 0 ? (
          <div className="space-y-0.5">
            <PersonaThreadSkeletonRow />
            <PersonaThreadSkeletonRow />
            <PersonaThreadSkeletonRow />
          </div>
        ) : filteredThreads.length === 0 ? (
          <p className="p-4 text-center text-xs text-zinc-400">No past conversations.</p>
        ) : (
          <>
            {renderGroup('Today', groups.today)}
            {renderGroup('Yesterday', groups.yesterday)}
            {renderGroup('Previous 7 Days', groups.last7Days)}
            {renderGroup('Older', groups.older)}
          </>
        )}
      </div>
      </aside>
    </>
  );
}
