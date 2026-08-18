'use client';

import React, { useEffect, useState } from 'react';
import type {
  PersonaFileItem,
  PersonaMemoryList,
  PersonaMemoryFile,
  PersonaWorkspaceFile,
  PersonaTodo,
  PersonaPresentedFile,
} from '@personaai/react';
import { cn } from '../utils/cn.js';
import { PersonaFileSkeletonRow } from './PersonaSkeleton.js';
import {
  Files,
  Brain,
  FolderKanban,
  X,
  Trash2,
  FileText,
  Check,
  Copy,
  Loader2,
  CircleDashed,
  CircleDotDashed,
  CircleCheck,
} from 'lucide-react';

export interface PersonaFilesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: PersonaFileItem[];
  memory: PersonaMemoryList;
  /** The agent's own virtual workspace files (deepagents' write_file/read_file), distinct from uploads. */
  workspaceFiles?: Record<string, PersonaWorkspaceFile>;
  todos?: PersonaTodo[];
  /** Set when the agent calls `present_file` — auto-opens the Workspace tab on that file. */
  presentedFile?: PersonaPresentedFile | null;
  onDeleteFile?: (fileId: string) => void;
  onGetMemoryFile?: (path: string) => Promise<PersonaMemoryFile>;
  onDeleteMemoryFile?: (path: string) => Promise<void>;
  /** Shows row placeholders on the Files tab instead of the empty state while the initial list loads. */
  isFilesLoading?: boolean;
  /** Shows row placeholders on the Memory tab instead of the empty state while the initial list loads. */
  isMemoryLoading?: boolean;
  className?: string;
}

const TODO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: CircleDashed,
  in_progress: CircleDotDashed,
  completed: CircleCheck,
};

export function PersonaFilesDrawer({
  isOpen,
  onClose,
  files,
  memory,
  workspaceFiles = {},
  todos = [],
  presentedFile,
  onDeleteFile,
  onGetMemoryFile,
  onDeleteMemoryFile,
  isFilesLoading,
  isMemoryLoading,
  className,
}: PersonaFilesDrawerProps) {
  const [tab, setTab] = useState<'files' | 'workspace' | 'memory'>('files');
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<PersonaMemoryFile | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [copied, setCopied] = useState(false);

  const workspaceEntries = Object.entries(workspaceFiles);

  // The agent just called present_file — jump straight to it rather than
  // leaving the user to notice a badge and go find it themselves.
  useEffect(() => {
    if (!presentedFile) return;
    setTab('workspace');
    setSelectedWorkspacePath(presentedFile.path);
  }, [presentedFile]);

  if (!isOpen) return null;

  async function viewMemoryFile(path: string) {
    if (!onGetMemoryFile) return;
    setLoadingMemory(true);
    try {
      const data = await onGetMemoryFile(path);
      setSelectedMemory(data);
    } catch {
      setSelectedMemory({ path, content: 'Could not load memory file.' });
    } finally {
      setLoadingMemory(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedWorkspaceFile = selectedWorkspacePath ? workspaceFiles[selectedWorkspacePath] : undefined;

  return (
    <>
      {/* Backdrop — shown whenever the drawer is overlaying (narrow host,
          not necessarily a narrow viewport — see @container on PersonaChatView's root).
          absolute, not fixed: contained within PersonaChatView's own
          (relative) root instead of the whole browser viewport, so this
          stays scoped to a small host like PersonaChatLauncher's floating
          panel instead of covering the entire page. */}
      <div
        className="absolute inset-0 z-20 bg-black/30 @5xl/persona-chat:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          // absolute + @min-[40rem] (not fixed + sm:): scoped to
          // PersonaChatView's own (relative, @container) root, same reason.
          'absolute inset-y-0 right-0 z-30 flex w-full max-w-xs flex-col border-l border-[var(--persona-border,#e4e4e7)]/80 bg-[var(--persona-bg,#ffffff)] shadow-2xl dark:border-[var(--persona-border,#27272a)]/80 dark:bg-[var(--persona-bg,#09090b)] @min-[40rem]/persona-chat:max-w-sm',
          '@5xl/persona-chat:static @5xl/persona-chat:z-auto @5xl/persona-chat:w-80 @5xl/persona-chat:max-w-none @5xl/persona-chat:shrink-0 @5xl/persona-chat:bg-[var(--persona-card,#fafafa)]/50 @5xl/persona-chat:shadow-none @5xl/persona-chat:backdrop-blur-md dark:@5xl/persona-chat:bg-[var(--persona-card,#09090b)]/50',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--persona-border,#e4e4e7)]/80 p-3 dark:border-[var(--persona-border,#27272a)]/80">
          {/* Tab switcher */}
          <div className="flex min-w-0 rounded-xl bg-[var(--persona-border,#e4e4e7)]/60 p-0.5 dark:bg-[var(--persona-border,#27272a)]/60">
            <button
              type="button"
              onClick={() => setTab('files')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all',
                tab === 'files'
                  ? 'bg-[var(--persona-card,#ffffff)] text-[var(--persona-text,#18181b)] shadow-xs dark:bg-[var(--persona-card,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <Files className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Files</span>
              {files.length > 0 && <span className="text-[10px] opacity-70">({files.length})</span>}
            </button>

            <button
              type="button"
              onClick={() => setTab('workspace')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all',
                tab === 'workspace'
                  ? 'bg-[var(--persona-card,#ffffff)] text-[var(--persona-text,#18181b)] shadow-xs dark:bg-[var(--persona-card,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <FolderKanban className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Workspace</span>
              {workspaceEntries.length > 0 && (
                <span className="text-[10px] opacity-70">({workspaceEntries.length})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab('memory')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all',
                tab === 'memory'
                  ? 'bg-[var(--persona-card,#ffffff)] text-[var(--persona-text,#18181b)] shadow-xs dark:bg-[var(--persona-card,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <Brain className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Memory</span>
              {memory?.userFiles?.length > 0 && (
                <span className="text-[10px] opacity-70">({memory.userFiles.length})</span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'files' ? (
            /* Uploaded files list */
            <div className="space-y-2">
              {isFilesLoading && files.length === 0 ? (
                <>
                  <PersonaFileSkeletonRow />
                  <PersonaFileSkeletonRow />
                  <PersonaFileSkeletonRow />
                </>
              ) : files.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-400">No uploaded files yet.</p>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 shadow-2xs dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-blue-500" />
                      <div className="min-w-0 truncate">
                        <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                          {file.originalName}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                        </span>
                      </div>
                    </div>

                    {onDeleteFile && (
                      <button
                        type="button"
                        onClick={() => onDeleteFile(file.id)}
                        className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : tab === 'workspace' ? (
            /* Agent's own virtual workspace — plan (todos) + files it wrote */
            <div className="space-y-4">
              {selectedWorkspaceFile ? (
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80">
                    <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedWorkspacePath}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedWorkspaceFile.content)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedWorkspacePath(null)}
                        className="text-[11px] text-blue-500 hover:underline"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {selectedWorkspaceFile.content}
                  </pre>
                </div>
              ) : (
                <>
                  {todos.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Plan
                      </span>
                      {todos.map((todo, i) => {
                        const Icon = TODO_ICON[todo.status] ?? CircleDashed;
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2 text-xs dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60"
                          >
                            <Icon
                              className={cn(
                                'mt-0.5 size-3.5 shrink-0',
                                todo.status === 'completed'
                                  ? 'text-emerald-500'
                                  : todo.status === 'in_progress'
                                    ? 'text-blue-500'
                                    : 'text-zinc-400'
                              )}
                            />
                            <span
                              className={cn(
                                'text-zinc-700 dark:text-zinc-300',
                                todo.status === 'completed' && 'text-zinc-400 line-through dark:text-zinc-500'
                              )}
                            >
                              {todo.content}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {workspaceEntries.length === 0 ? (
                    <p className="py-8 text-center text-xs text-zinc-400">
                      No workspace files yet — files the agent creates show up here.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {todos.length > 0 && (
                        <span className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Files
                        </span>
                      )}
                      {workspaceEntries.map(([path, file]) => (
                        <button
                          key={path}
                          type="button"
                          onClick={() => setSelectedWorkspacePath(path)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60 dark:hover:bg-zinc-900"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="size-3.5 shrink-0 text-amber-500" />
                            <span className="truncate text-zinc-800 dark:text-zinc-200">{path}</span>
                          </div>
                          <span className="shrink-0 text-[10px] text-zinc-400">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Memory inspector */
            <div className="space-y-3">
              {selectedMemory ? (
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80">
                    <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedMemory.path}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedMemory.content)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMemory(null)}
                        className="text-[11px] text-blue-500 hover:underline"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {selectedMemory.content}
                  </pre>
                </div>
              ) : isMemoryLoading && (memory?.userFiles?.length ?? 0) === 0 && (memory?.agentMemories?.length ?? 0) === 0 ? (
                <div className="space-y-2">
                  <PersonaFileSkeletonRow />
                  <PersonaFileSkeletonRow />
                  <PersonaFileSkeletonRow />
                </div>
              ) : (memory?.userFiles?.length ?? 0) === 0 && (memory?.agentMemories?.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-400">No persistent memory files recorded.</p>
              ) : (
                <div className="space-y-4">
                  {(memory?.userFiles?.length ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      {memory.userFiles.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => viewMemoryFile(f.path)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60 dark:hover:bg-zinc-900"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Brain className="size-3.5 shrink-0 text-purple-500" />
                            <span className="truncate text-zinc-800 dark:text-zinc-200">{f.path}</span>
                          </div>
                          {loadingMemory && <Loader2 className="size-3 shrink-0 animate-spin text-zinc-400" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {memory?.agentMemories?.map((group) => (
                    <div key={group.agentId} className="space-y-1.5">
                      <span className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {group.agentName || 'Unknown Agent'}
                      </span>
                      {group.files.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => viewMemoryFile(f.path)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60 dark:hover:bg-zinc-900"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Brain className="size-3.5 shrink-0 text-purple-500" />
                            <span className="truncate text-zinc-800 dark:text-zinc-200">{f.path}</span>
                          </div>
                          {loadingMemory && <Loader2 className="size-3 shrink-0 animate-spin text-zinc-400" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
