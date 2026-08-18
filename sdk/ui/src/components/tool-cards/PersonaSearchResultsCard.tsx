'use client';

import React from 'react';
import { cn } from '../../utils/cn.js';
import { getDomain, type PersonaSearchResult } from '../../utils/toolPresentation.js';

export interface PersonaSearchResultsCardProps {
  results: PersonaSearchResult[];
  status: 'running' | 'completed';
  className?: string;
}

export function PersonaSearchResultsCard({ results, status, className }: PersonaSearchResultsCardProps) {
  if (status !== 'completed') {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Searching...
        </div>
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
          <div className="h-8 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40" />
        </div>
      </div>
    );
  }

  if (!results.length) {
    return <div className={cn('text-xs italic text-zinc-500 dark:text-zinc-400', className)}>No search results found.</div>;
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Search Results
      </div>
      <div className="max-h-48 space-y-1.5 overflow-auto">
        {results.map((result, index) => (
          <a
            key={result.url || index}
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] px-3 py-2 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-zinc-800/60 dark:bg-zinc-950 dark:hover:border-blue-500/30 dark:hover:bg-blue-950/10"
          >
            <img
              src={`https://www.google.com/s2/favicons?sz=32&domain=${getDomain(result.url || '')}`}
              alt=""
              className="size-3.5 shrink-0 rounded-sm"
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {result.title || result.url}
            </span>
            <span className="shrink-0 rounded border border-zinc-150 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
              {getDomain(result.url || '')}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
