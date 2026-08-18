'use client';

import React, { useMemo } from 'react';
import { FileCode, FileText } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { computeLineDiff } from '../../utils/toolPresentation.js';

export interface PersonaFileDiffCardProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  note?: string;
  className?: string;
}

const CODE_EXTENSIONS = new Set(['JS', 'JSX', 'TS', 'TSX', 'JSON', 'HTML', 'CSS', 'PY', 'SH', 'GO', 'RS', 'MD']);

export function PersonaFileDiffCard({ filePath, oldContent, newContent, note, className }: PersonaFileDiffCardProps) {
  const rows = useMemo(
    () => computeLineDiff(oldContent.split('\n'), newContent.split('\n')),
    [oldContent, newContent]
  );

  const added = rows.filter((r) => r.type === 'add').length;
  const removed = rows.filter((r) => r.type === 'remove').length;

  const fileName = filePath.split('/').pop() || filePath;
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FILE';
  const FileIcon = ext && CODE_EXTENSIONS.has(ext) ? FileCode : FileText;

  let oldNo = 1;
  let newNo = 1;

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] dark:border-zinc-800 dark:bg-zinc-950', className)}>
      {filePath && (
        <div className="flex items-center justify-between border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-3.5 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FileIcon className="size-4" />
            </div>
            <span className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{filePath}</span>
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>{' '}
            <span className="text-red-500 dark:text-red-400">-{removed}</span>
          </span>
        </div>
      )}

      {note && (
        <div className="border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/40 px-3.5 py-1.5 text-[10px] font-semibold text-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/20 dark:text-zinc-500">
          {note}
        </div>
      )}

      <div className="max-h-72 overflow-auto font-mono text-[11.5px] leading-5">
        {rows.map((row, index) => {
          const displayOldNo = row.type !== 'add' ? oldNo++ : null;
          const displayNewNo = row.type !== 'remove' ? newNo++ : null;
          return (
            <div
              key={index}
              className={cn(
                'flex',
                row.type === 'add' && 'bg-emerald-50 dark:bg-emerald-500/10',
                row.type === 'remove' && 'bg-red-50 dark:bg-red-500/10'
              )}
            >
              <span className="w-8 shrink-0 select-none border-r border-[var(--persona-border,#e4e4e7)] px-1.5 text-right text-zinc-350 dark:border-zinc-800/80 dark:text-zinc-600">
                {displayOldNo ?? ''}
              </span>
              <span className="w-8 shrink-0 select-none border-r border-[var(--persona-border,#e4e4e7)] px-1.5 text-right text-zinc-350 dark:border-zinc-800/80 dark:text-zinc-600">
                {displayNewNo ?? ''}
              </span>
              <span
                className={cn(
                  'w-4 shrink-0 select-none text-center font-bold',
                  row.type === 'add' && 'text-emerald-600 dark:text-emerald-400',
                  row.type === 'remove' && 'text-red-500 dark:text-red-400'
                )}
              >
                {row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ''}
              </span>
              <span className="flex-1 whitespace-pre px-1.5 text-zinc-700 dark:text-zinc-300">{row.line || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
