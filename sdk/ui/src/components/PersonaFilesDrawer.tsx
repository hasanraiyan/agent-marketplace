'use client';

import React, { useState } from 'react';
import type { PersonaFileItem, PersonaMemoryList, PersonaMemoryFile } from '@personaai/react';
import { cn } from '../utils/cn.js';
import { Files, Brain, X, Download, Trash2, FileText, Check, Copy, Loader2 } from 'lucide-react';

export interface PersonaFilesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: PersonaFileItem[];
  memory: PersonaMemoryList;
  onDeleteFile?: (fileId: string) => void;
  onGetMemoryFile?: (path: string) => Promise<PersonaMemoryFile>;
  onDeleteMemoryFile?: (path: string) => Promise<void>;
  className?: string;
}

export function PersonaFilesDrawer({
  isOpen,
  onClose,
  files,
  memory,
  onDeleteFile,
  onGetMemoryFile,
  onDeleteMemoryFile,
  className,
}: PersonaFilesDrawerProps) {
  const [tab, setTab] = useState<'files' | 'memory'>('files');
  const [selectedMemory, setSelectedMemory] = useState<PersonaMemoryFile | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [copied, setCopied] = useState(false);

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

  return (
    <aside
      className={cn(
        'flex w-80 shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50/50 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200/80 p-3 dark:border-zinc-800/80">
        {/* Tab switcher */}
        <div className="flex rounded-xl bg-zinc-200/60 p-0.5 dark:bg-zinc-800/60">
          <button
            type="button"
            onClick={() => setTab('files')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
              tab === 'files'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <Files className="size-3.5" />
            <span>Files</span>
            {files.length > 0 && <span className="text-[10px] opacity-70">({files.length})</span>}
          </button>

          <button
            type="button"
            onClick={() => setTab('memory')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
              tab === 'memory'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            <Brain className="size-3.5" />
            <span>Memory</span>
            {memory?.user?.length > 0 && <span className="text-[10px] opacity-70">({memory.user.length})</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'files' ? (
          /* Files list */
          <div className="space-y-2">
            {files.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">No uploaded files yet.</p>
            ) : (
              files.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-2.5 shadow-2xs dark:border-zinc-800/70 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 shrink-0 text-blue-500" />
                    <div className="truncate">
                      <span className="block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                        {file.filename}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {file.sizeBytes ? `${(file.sizeBytes / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                  </div>

                  {onDeleteFile && (
                    <button
                      type="button"
                      onClick={() => onDeleteFile(file._id)}
                      className="rounded p-1 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Memory inspector */
          <div className="space-y-3">
            {selectedMemory ? (
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
                  <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {selectedMemory.path}
                  </span>
                  <div className="flex items-center gap-1">
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
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {selectedMemory.content}
                </pre>
              </div>
            ) : memory?.user?.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">No persistent memory files recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {memory?.user?.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => viewMemoryFile(f.path)}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Brain className="size-3.5 text-purple-500" />
                      <span className="truncate text-zinc-800 dark:text-zinc-200">{f.path}</span>
                    </div>
                    {loadingMemory && <Loader2 className="size-3 animate-spin text-zinc-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
