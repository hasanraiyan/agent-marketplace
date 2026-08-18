'use client';

import type { PersonaChatViewProps } from '../types.js';
import { cn } from '../utils/cn.js';
import { usePersonaChatWidget } from '../hooks/usePersonaChatWidget.js';
import { buildThemeStyles } from '../utils/themeStyles.js';
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
  showUserAvatar = true,
  showAssistantAvatar = true,
  userAvatar,
  assistantAvatar,
  groupTools = true,
  toolClusterLabels,
  className,
}: PersonaChatViewProps) {
  const {
    activeThreadId,
    sidebarOpen,
    setSidebarOpen,
    filesDrawerOpen,
    setFilesDrawerOpen,
    threads,
    deleteThread,
    renameThread,
    files,
    deleteFile,
    memory,
    getMemoryFile,
    deleteMemoryFile,
    messages,
    input,
    setInput,
    isStreaming,
    isLoadingHistory,
    error,
    interrupt,
    resumeInterrupt,
    workspaceFiles,
    todos,
    presentedFile,
    openWorkspaceFile,
    stop,
    reload,
    handleSelectThread,
    handleNewChat,
    handleSend,
    handleUploadFile,
  } = usePersonaChatWidget({
    agentId,
    threadId: controlledThreadId,
    onThreadChange,
    defaultSidebarOpen: showSidebar,
  });

  const themeStyles = buildThemeStyles(theme);

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
            showUserAvatar={showUserAvatar}
            showAssistantAvatar={showAssistantAvatar}
            userAvatar={userAvatar}
            assistantAvatar={assistantAvatar}
            groupTools={groupTools}
            toolClusterLabels={toolClusterLabels}
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
          onGetMemoryFile={(path) => getMemoryFile({ path })}
          onDeleteMemoryFile={(path) => deleteMemoryFile({ path })}
          className={classNames.filesDrawer}
        />
      )}
    </div>
  );
}
