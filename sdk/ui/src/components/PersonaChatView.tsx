'use client';

import React, { useState, useCallback } from 'react';
import { useChat, useThreads, useFiles, useMemory } from '@personaai/react';
import type { PersonaChatViewProps } from '../types.js';
import { cn } from '../utils/cn.js';
import { PersonaSidebar } from './PersonaSidebar.js';
import { PersonaMessageFeed } from './PersonaMessageFeed.js';
import { PersonaComposer } from './PersonaComposer.js';
import { PersonaFilesDrawer } from './PersonaFilesDrawer.js';
import { PanelLeftClose, PanelLeft, Files, FolderArchive } from 'lucide-react';

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

  const handleSelectThread = useCallback(
    (id: string | undefined) => {
      clear();
      if (onThreadChange) {
        onThreadChange(id);
      } else {
        setInternalThreadId(id);
      }
    },
    [clear, onThreadChange]
  );

  const handleCreateThread = useCallback(async () => {
    clear();
    const newThread = await createThread(agentId);
    if (newThread?._id) {
      handleSelectThread(newThread._id);
    }
  }, [clear, createThread, agentId, handleSelectThread]);

  const handleUploadFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0];
      const formData = new FormData();
      formData.append('file', file);
      try {
        await uploadFile(formData);
        setFilesDrawerOpen(true);
      } catch {
        // Handle error
      }
    },
    [uploadFile]
  );

  // Apply optional custom theme CSS variables
  const themeStyles = theme
    ? ({
        '--persona-primary': theme.primaryColor,
        '--persona-bg': theme.backgroundColor,
        '--persona-card': theme.cardBackgroundColor,
        '--persona-text': theme.textColor,
        borderRadius: theme.borderRadius,
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      style={themeStyles}
      className={cn(
        'relative flex h-[calc(100vh-8rem)] w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white font-sans text-zinc-900 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-100',
        classNames.root,
        className
      )}
    >
      {/* Left Session Sidebar */}
      {sidebarOpen && (
        <PersonaSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onCreateThread={handleCreateThread}
          onDeleteThread={deleteThread}
          className={classNames.sidebar}
        />
      )}

      {/* Main Center Canvas */}
      <div className={cn('relative flex flex-1 flex-col overflow-hidden', classNames.main)}>
        {/* Minimalist Top Canvas Toolbar */}
        <div className="flex h-12 items-center justify-between border-b border-zinc-200/80 px-4 backdrop-blur-sm dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </button>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</span>
          </div>

          {showFilesDrawer && (
            <button
              type="button"
              onClick={() => setFilesDrawerOpen((prev) => !prev)}
              title={filesDrawerOpen ? 'Close files panel' : 'Open files & memory'}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                filesDrawerOpen
                  ? 'bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              <Files className="size-3.5" />
              <span>Artifacts</span>
            </button>
          )}
        </div>

        {/* Message Feed */}
        <PersonaMessageFeed
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          toolRenderers={toolRenderers}
          onReload={reload}
          greeting={greeting}
          className={classNames.messageList}
        />

        {/* Floating Composer */}
        <div className="p-3 md:p-4">
          <PersonaComposer
            input={input}
            onInputChange={setInput}
            onSubmit={() => void sendMessage()}
            onStop={stop}
            isStreaming={isStreaming}
            starterPrompts={messages.length === 0 ? starterPrompts : []}
            onSelectStarter={(prompt) => void sendMessage(prompt)}
            onUploadFile={handleUploadFile}
            className={classNames.composer}
          />
        </div>
      </div>

      {/* Right Files & Artifacts Drawer */}
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
