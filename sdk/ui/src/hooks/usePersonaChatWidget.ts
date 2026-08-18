'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useChat, useFiles, useMemory, useThreads } from '@personaai/react';

export interface UsePersonaChatWidgetOptions {
  agentId?: string;
  /** Controlled active thread — omit to let the hook manage it internally. */
  threadId?: string;
  onThreadChange?: (threadId: string | undefined) => void;
  /** Initial sidebar visibility, auto-corrected closed on a mobile viewport on mount. @default true */
  defaultSidebarOpen?: boolean;
}

/**
 * Every stateful/behavioral piece `PersonaChatView` is built on — thread
 * selection, lazy thread creation on the first message, sidebar/files-drawer
 * open state, the present_file auto-open effect — extracted into its own
 * hook. `PersonaChatView` is just one layout built on top of this; a
 * consumer assembling its own layout (composer somewhere else, a floating
 * widget, a custom sidebar) can call this directly instead of reimplementing
 * the same wiring against the raw `useChat`/`useThreads` hooks.
 */
export function usePersonaChatWidget(options: UsePersonaChatWidgetOptions = {}) {
  const { agentId, threadId: controlledThreadId, onThreadChange, defaultSidebarOpen = true } = options;

  const [internalThreadId, setInternalThreadId] = useState<string | undefined>(undefined);
  const activeThreadId = controlledThreadId !== undefined ? controlledThreadId : internalThreadId;

  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);

  // A consumer's sidebar UI (if it renders one as a mobile overlay, matching
  // PersonaSidebar's own behavior) shouldn't default open and cover the
  // whole widget on a narrow viewport. One mount-only check — can't read
  // viewport width during SSR/the initial render without a hydration
  // mismatch, so this trades one extra render for correctness instead.
  useEffect(() => {
    if (defaultSidebarOpen && window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { threads, createThread, deleteThread, renameThread } = useThreads();
  const { files, uploadFile, deleteFile } = useFiles();
  const { memory, getFile: getMemoryFile, deleteFile: deleteMemoryFile } = useMemory();

  const chat = useChat({ agentId, threadId: activeThreadId });

  const setActiveThread = useCallback(
    (id: string | undefined) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );

  const handleSelectThread = useCallback(
    (id: string | undefined) => {
      chat.clear();
      setActiveThread(id);
    },
    [chat, setActiveThread]
  );

  const handleNewChat = useCallback(() => {
    chat.clear();
    setActiveThread(undefined);
  }, [chat, setActiveThread]);

  const handleSend = useCallback(
    async (content?: string) => {
      let tid = activeThreadId;
      if (!tid) {
        try {
          const t = await createThread(agentId);
          tid = t?._id;
          if (tid) setActiveThread(tid);
        } catch {
          /* no-op */
        }
      }
      void chat.sendMessage(content, tid ? { threadId: tid } : undefined);
    },
    [activeThreadId, agentId, createThread, chat, setActiveThread]
  );

  // The agent just called present_file — open the drawer to it rather than
  // leaving a highlighted file behind a closed panel.
  useEffect(() => {
    if (chat.presentedFile) setFilesDrawerOpen(true);
  }, [chat.presentedFile]);

  const handleUploadFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        await uploadFile(fd);
        setFilesDrawerOpen(true);
      } catch {
        /* no-op */
      }
    },
    [uploadFile]
  );

  // useFiles() and useChat() both name their very different `files` field
  // the same thing (uploaded files vs. the agent's own workspace files) —
  // pull useChat's out under its own name before spreading the rest, or the
  // spread below would silently clobber the uploaded-files array with it.
  const { files: workspaceFiles, ...restChat } = chat;

  return {
    // thread selection
    activeThreadId,
    setActiveThread,
    // sidebar / files-drawer UI state
    sidebarOpen,
    setSidebarOpen,
    filesDrawerOpen,
    setFilesDrawerOpen,
    // threads
    threads,
    deleteThread,
    renameThread,
    // uploaded files
    files,
    deleteFile,
    // memory
    memory,
    getMemoryFile,
    deleteMemoryFile,
    // chat — every other useChat field (messages, input, sendMessage,
    // isStreaming, interrupt, todos, etc.) plus the composed handlers below
    ...restChat,
    workspaceFiles,
    // composed handlers (thread-aware wrappers over the raw chat/upload calls)
    handleSelectThread,
    handleNewChat,
    handleSend,
    handleUploadFile,
  };
}
