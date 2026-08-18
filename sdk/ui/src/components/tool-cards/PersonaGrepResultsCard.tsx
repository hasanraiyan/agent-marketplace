'use client';

import React, { useMemo } from 'react';
import { FileCode, FileText, Search } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import type { PersonaGrepMatch } from '../../utils/toolPresentation.js';

export interface PersonaGrepResultsCardProps {
  query: string;
  path: string;
  matches: PersonaGrepMatch[];
  status: 'running' | 'completed';
  className?: string;
}

const CODE_EXTENSIONS = new Set(['JS', 'JSX', 'TS', 'TSX', 'JSON', 'HTML', 'CSS', 'PY', 'SH', 'GO', 'RS', 'MD']);

function escapeRegex(value: string): string {
  return value.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  try {
    const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="rounded-[2px] bg-yellow-100 px-0.5 font-semibold text-zinc-900 dark:bg-yellow-500/35 dark:text-zinc-100">
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

export function PersonaGrepResultsCard({ query, path, matches, status, className }: PersonaGrepResultsCardProps) {
  const done = status === 'completed';

  const fileGroups = useMemo(() => {
    const groups = new Map<string, PersonaGrepMatch[]>();
    for (const match of matches) {
      const list = groups.get(match.file) ?? [];
      list.push(match);
      groups.set(match.file, list);
    }
    return [...groups.entries()];
  }, [matches]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Grep:</span>
        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-400">
          <Search className="size-3" />
          &quot;{query}&quot;
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">in</span>
        <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {path}
        </span>
      </div>

      {!done ? (
        <div className="space-y-1.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Grep Searching...</div>
          <div className="h-8 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
        </div>
      ) : fileGroups.length > 0 ? (
        <div className="max-h-60 space-y-2.5 overflow-auto pr-1">
          {fileGroups.map(([filePath, fileMatches]) => {
            const fileName = filePath.split('/').pop() || filePath;
            const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FILE';
            const FileIcon = ext && CODE_EXTENSIONS.has(ext) ? FileCode : FileText;

            return (
              <div key={filePath} className="overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] dark:border-zinc-800/80 dark:bg-zinc-950">
                <div className="flex items-center gap-2 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/60 px-3 py-1.5 dark:border-zinc-850 dark:bg-zinc-900/40">
                  <FileIcon className="size-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{filePath}</span>
                  <span className="ml-auto rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-bold text-zinc-500 dark:bg-zinc-850 dark:text-zinc-400">
                    {fileMatches.length} {fileMatches.length === 1 ? 'match' : 'matches'}
                  </span>
                </div>
                <div className="divide-y divide-zinc-50 font-mono text-[11px] leading-relaxed dark:divide-zinc-850">
                  {fileMatches.map((match, i) => (
                    <div key={i} className="flex hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30">
                      {match.line > 0 && (
                        <div className="w-9 shrink-0 select-none border-r border-[var(--persona-border,#e4e4e7)] py-1.5 pr-2.5 text-right font-bold text-zinc-400 dark:border-zinc-850 dark:text-zinc-600">
                          {match.line}
                        </div>
                      )}
                      <div className="flex-1 whitespace-pre-wrap break-all py-1.5 pl-3 pr-2 text-zinc-600 dark:text-zinc-300">
                        <HighlightMatch text={match.content} query={query} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs italic text-zinc-500 dark:text-zinc-400">No matches found.</div>
      )}
    </div>
  );
}
