'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useChat, useThreads, useFiles, useMemory } from '@personaai/react';
import type { PersonaChatViewProps } from '../types.js';
import { cn } from '../utils/cn.js';
import { PersonaSidebar } from './PersonaSidebar.js';
import { PersonaMessageFeed } from './PersonaMessageFeed.js';
import { PersonaComposer } from './PersonaComposer.js';
import { PersonaFilesDrawer } from './PersonaFilesDrawer.js';
import { PersonaInterruptCard } from './PersonaInterruptCard.js';
import { PanelLeftClose, PanelLeft, Files } from 'lucide-react';

export function PersonaChatView({
  agentId,
  threadId: controlledThreadId,
  onThreadChange,
  greeting = 'How can I assist you today?',
  title = 'AI Assistant',
  starterPrompts = [],
  toolRenderers,
  classNames = {},
  theme,
  showSidebar = true,
  showFilesDrawer = true,
  className,
}: PersonaChatViewProps) {
  const [internalThreadId, setInternalThreadId] = useState<string | undefined>(undefined);
  const activeThreadId = controlledThreadId !== undefined ? controlledThreadId : internalThreadId;

  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);

  // The sidebar renders as a full-screen overlay below the md breakpoint
  // (see PersonaSidebar) — defaulting it open there would cover the entire
  // chat on first load. Desktop keeps its default; this only corrects the
  // initial state for a narrow viewport, one mount-only check (can't read
  // viewport width during SSR/the initial render without a hydration
  // mismatch, so this trades one extra render for correctness instead).
  useEffect(() => {
    if (showSidebar && window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { threads, createThread, deleteThread, renameThread } = useThreads();
  const { files, uploadFile, deleteFile } = useFiles();
  const { memory, getFile, deleteFile: deleteMemoryFile } = useMemory();

  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    isLoadingHistory,
    error,
    interrupt,
    resumeInterrupt,
    files: workspaceFiles,
    todos,
    presentedFile,
    openWorkspaceFile,
    stop,
    reload,
    clear,
  } = useChat({ agentId, threadId: activeThreadId });

  const setActiveThread = useCallback(
    (id: string | undefined) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );

  const handleSelectThread = useCallback(
    (id: string | undefined) => { clear(); setActiveThread(id); },
    [clear, setActiveThread]
  );

  const handleNewChat = useCallback(() => {
    clear(); setActiveThread(undefined);
  }, [clear, setActiveThread]);

  const handleSend = useCallback(
    async (content?: string) => {
      let tid = activeThreadId;
      if (!tid) {
        try {
          const t = await createThread(agentId);
          tid = t?._id;
          if (tid) setActiveThread(tid);
        } catch { /* no-op */ }
      }
      void sendMessage(content, tid ? { threadId: tid } : undefined);
    },
    [activeThreadId, agentId, createThread, sendMessage, setActiveThread]
  );

  // The agent just called present_file — open the drawer to it rather than
  // leaving a highlighted file behind a closed panel.
  useEffect(() => {
    if (presentedFile) setFilesDrawerOpen(true);
  }, [presentedFile]);

  const handleUploadFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try { await uploadFile(fd); setFilesDrawerOpen(true); } catch { /* no-op */ }
    },
    [uploadFile]
  );

  const themeStyles = theme ? ({
    '--persona-primary': theme.primaryColor,
    '--persona-bg': theme.backgroundColor,
    '--persona-card': theme.cardBackgroundColor,
    '--persona-text': theme.textColor,
    borderRadius: theme.borderRadius,
  } as React.CSSProperties) : undefined;

  return (
    <div
      style={themeStyles}
      className={cn(
        // Fill whatever height the host container provides — no internal height set
        'flex w-full overflow-hidden bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100',
        // Host page is responsible for the height; component just fills it
        'h-full min-h-0',
        classNames.root,
        className
      )}
    >
      {/* ── Left sidebar ── */}
      {sidebarOpen && (
        <PersonaSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onCreateThread={handleNewChat}
          onDeleteThread={deleteThread}
          onRenameThread={renameThread}
          onClose={() => setSidebarOpen(false)}
          className={classNames.sidebar}
        />
      )}

      {/* ── Main canvas ── */}
      <div className={cn('flex min-h-0 flex-1 flex-col', classNames.main)}>

        {/* Toolbar */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </button>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
          </div>

          {showFilesDrawer && (
            <button
              type="button"
              onClick={() => setFilesDrawerOpen((p) => !p)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                filesDrawerOpen
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              <Files className="size-3.5" />
              <span>Artifacts</span>
            </button>
          )}
        </div>

        {/* Message feed — takes remaining space and scrolls internally.
            No overflow-y-auto here: PersonaMessageFeed's own root already
            scrolls itself (it's a standalone exported component too), so
            wrapping it in a second scrollable div nested that scroll
            behavior for no reason and could show a stray inner scrollbar.
            This wrapper just needs to be the flex context flex-1 sizes
            against. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <PersonaMessageFeed
            messages={messages}
            isStreaming={isStreaming}
            isLoading={isLoadingHistory}
            error={error}
            toolRenderers={toolRenderers}
            onReload={reload}
            onOpenFile={openWorkspaceFile}
            greeting={greeting}
            className={classNames.messageList}
          />
        </div>

        {/* Paused HITL approval / clarification question */}
        {interrupt && (
          <div className="shrink-0 border-t border-zinc-100 bg-white px-3 pt-3 dark:border-zinc-800 dark:bg-zinc-950">
            <PersonaInterruptCard
              interrupt={interrupt}
              isStreaming={isStreaming}
              onRespond={(resume, displayContent) => void resumeInterrupt(resume, displayContent)}
            />
          </div>
        )}

        {/* Composer — always visible at bottom, never clipped */}
        <div className={cn(
          'shrink-0 border-t border-zinc-100 bg-white px-3 pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950',
          classNames.composer
        )}>
          <PersonaComposer
            input={input}
            onInputChange={setInput}
            onSubmit={() => void handleSend()}
            onStop={stop}
            isStreaming={isStreaming}
            starterPrompts={messages.length === 0 ? starterPrompts : []}
            onSelectStarter={(p) => void handleSend(p)}
            onUploadFile={handleUploadFile}
          />
        </div>
      </div>

      {/* ── Right files drawer ── */}
      {showFilesDrawer && (
        <PersonaFilesDrawer
          isOpen={filesDrawerOpen}
          onClose={() => setFilesDrawerOpen(false)}
          files={files}
          memory={memory}
          workspaceFiles={workspaceFiles}
          todos={todos}
          presentedFile={presentedFile}
          onDeleteFile={deleteFile}
          onGetMemoryFile={(path) => getFile({ path })}
          onDeleteMemoryFile={(path) => deleteMemoryFile({ path })}
          className={classNames.filesDrawer}
        />
      )}
    </div>
  );
}
