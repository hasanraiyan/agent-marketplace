'use client';

import React from 'react';
import { FileText, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import type { PersonaLsEntry } from '../../utils/toolPresentation.js';

export interface PersonaLsDirectoryCardProps {
  path: string;
  entries: PersonaLsEntry[];
  status: 'running' | 'completed';
  className?: string;
}

export function PersonaLsDirectoryCard({ path, entries, status, className }: PersonaLsDirectoryCardProps) {
  const done = status === 'completed';

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)]/95 dark:border-zinc-800 dark:bg-zinc-900/95', className)}>
      <div className="flex items-center gap-2.5 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-3.5 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          <Folder className="size-4" />
        </div>
        <span className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">{path}</span>
      </div>

      {!done ? (
        <div className="flex flex-col items-center justify-center p-5 text-center text-zinc-400 dark:text-zinc-500">
          <Loader2 className="mb-1.5 size-6 animate-spin text-blue-500 opacity-70" />
          <span className="text-[11px] font-semibold">Listing Directory Contents...</span>
        </div>
      ) : entries.length > 0 ? (
        <div className="max-h-56 divide-y divide-[var(--persona-border,#e4e4e7)]/70 overflow-auto dark:divide-zinc-800/60">
          {entries.map((item, index) => (
            <div key={index} className="flex items-center justify-between px-3.5 py-2 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20">
              <div className="flex min-w-0 items-center gap-2">
                {item.isDir ? (
                  <Folder className="size-4 shrink-0 text-amber-500" />
                ) : (
                  <FileText className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                )}
                <span className="truncate font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                  item.isDir
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                )}
              >
                {item.isDir ? 'dir' : 'file'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-5 text-center text-zinc-400 dark:text-zinc-500">
          <FolderOpen className="mb-1.5 size-7 opacity-50" />
          <span className="text-[11px] font-bold">Empty Directory</span>
        </div>
      )}
    </div>
  );
}
