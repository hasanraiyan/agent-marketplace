'use client';

import React, { useState, useCallback } from 'react';
import { useChat, useThreads, useFiles, useMemory } from '@personaai/react';
import type { PersonaChatViewProps } from '../types.js';
import { cn } from '../utils/cn.js';
import { PersonaSidebar } from './PersonaSidebar.js';
import { PersonaMessageFeed } from './PersonaMessageFeed.js';
import { PersonaComposer } from './PersonaComposer.js';
import { PersonaFilesDrawer } from './PersonaFilesDrawer.js';
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

  const { threads, createThread, deleteThread } = useThreads();
  const { files, uploadFile, deleteFile } = useFiles();
  const { memory, getFile, deleteFile: deleteMemoryFile } = useMemory();

  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    error,
    stop,
    reload,
    clear,
  } = useChat({
    agentId,
    threadId: activeThreadId,
  });

  // ── Thread helpers ────────────────────────────────────────────────────────

  const setActiveThread = useCallback(
    (id: string | undefined) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );

  const handleSelectThread = useCallback(
    (id: string | undefined) => {
      clear();
      setActiveThread(id);
    },
    [clear, setActiveThread]
  );

  const handleNewChat = useCallback(() => {
    clear();
    setActiveThread(undefined);
  }, [clear, setActiveThread]);

  // Create thread lazily on first message send
  const handleSend = useCallback(
    async (content?: string) => {
      let tid = activeThreadId;
      if (!tid) {
        try {
          const newThread = await createThread(agentId);
          tid = newThread?._id;
          if (tid) setActiveThread(tid);
        } catch {
          // proceed without thread
        }
      }
      void sendMessage(content, tid ? { threadId: tid } : undefined);
    },
    [activeThreadId, agentId, createThread, sendMessage, setActiveThread]
  );

  // ── File upload ───────────────────────────────────────────────────────────

  const handleUploadFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        await uploadFile(formData);
        setFilesDrawerOpen(true);
      } catch { /* silently ignore */ }
    },
    [uploadFile]
  );

  // ── Custom theme CSS vars ─────────────────────────────────────────────────

  const themeStyles = theme
    ? ({
        '--persona-primary': theme.primaryColor,
        '--persona-bg': theme.backgroundColor,
        '--persona-card': theme.cardBackgroundColor,
        '--persona-text': theme.textColor,
        borderRadius: theme.borderRadius,
      } as React.CSSProperties)
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={themeStyles}
      className={cn(
        // Full-height native feel — fills whatever container the host page gives
        'flex h-full w-full overflow-hidden bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100',
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
          className={cn('hidden md:flex', classNames.sidebar)}
        />
      )}

      {/* ── Main canvas ── */}
      <div className={cn('flex flex-1 flex-col overflow-hidden', classNames.main)}>

        {/* Top toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </button>
            <span className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
              {title}
            </span>
          </div>

          {showFilesDrawer && (
            <button
              type="button"
              onClick={() => setFilesDrawerOpen((p) => !p)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
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

        {/* Message feed — flex-1 + overflow-y-auto so it scrolls internally */}
        <PersonaMessageFeed
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          toolRenderers={toolRenderers}
          onReload={reload}
          greeting={greeting}
          className={cn('flex-1 overflow-y-auto', classNames.messageList)}
        />

        {/* Composer — pinned to bottom, never shrinks */}
        <div className={cn('shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800/60 md:p-4', classNames.composer)}>
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

      {/* ── Right artifacts drawer ── */}
      {showFilesDrawer && (
        <PersonaFilesDrawer
          isOpen={filesDrawerOpen}
          onClose={() => setFilesDrawerOpen(false)}
          files={files}
          memory={memory}
          onDeleteFile={deleteFile}
          onGetMemoryFile={(path) => getFile({ path })}
          onDeleteMemoryFile={(path) => deleteMemoryFile({ path })}
          className={classNames.filesDrawer}
        />
      )}
    </div>
  );
}
