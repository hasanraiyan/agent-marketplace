'use client';

import { FileText, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tryParseJson, parseLsResults } from '../utils';

export function LsDirectoryCard({ tool }) {
  const args = tryParseJson(tool.argumentsText) || {};
  const path = args.path || args.dir || args.directory || '/';
  const items = parseLsResults(tool.resultText);
  const done = tool.status === 'completed';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
      {/* Directory Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Folder className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {path}
              </span>
              <span className="shrink-0 rounded bg-slate-105 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                LIST
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Contents */}
      {!done ? (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-400 dark:text-slate-500">
          <Loader2 className="size-6 animate-spin mb-1.5 opacity-55 text-blue-500" />
          <span className="text-[11px] font-semibold">Listing Directory Contents...</span>
        </div>
      ) : items.length > 0 ? (
        <div className="max-h-56 overflow-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.isDir ? (
                  <Folder className="size-4 shrink-0 text-amber-500" />
                ) : (
                  <FileText className="size-4 shrink-0 text-slate-450 dark:text-slate-500" />
                )}
                <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                  {item.name}
                </span>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                  item.isDir
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {item.isDir ? 'dir' : 'file'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-5 text-center text-slate-450 dark:text-slate-500">
          <FolderOpen className="size-7 mb-1.5 opacity-55 text-slate-450 dark:text-slate-500" />
          <span className="text-[11px] font-bold">Empty Directory</span>
        </div>
      )}
    </div>
  );
}
