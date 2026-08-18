'use client';

import React, { useState, useMemo } from 'react';
import type { PersonaSubagentActivityEntry, PersonaToolCall, PersonaTodo } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { cn } from '../utils/cn.js';
import {
  getToolIcon,
  getToolTitle,
  isWebSearchTool,
  isReadFileTool,
  isLsTool,
  isGrepTool,
  isFileWriteTool,
  isFileEditTool,
  searchResults,
  parseLsResults,
  parseGrepResults,
  computeFileDiffStats,
  getFilePathFromArgs,
} from '../utils/toolPresentation.js';
import { PersonaSearchResultsCard } from './tool-cards/PersonaSearchResultsCard.js';
import { PersonaReadFileCard } from './tool-cards/PersonaReadFileCard.js';
import { PersonaLsDirectoryCard } from './tool-cards/PersonaLsDirectoryCard.js';
import { PersonaGrepResultsCard } from './tool-cards/PersonaGrepResultsCard.js';
import { PersonaFileDiffCard } from './tool-cards/PersonaFileDiffCard.js';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Bot,
  FileText,
  Circle,
  Clock,
} from 'lucide-react';

function isTodoTool(name: string): boolean {
  return name.toLowerCase().includes('todo');
}

// write_todos' result confirms the applied list (`{update:{todos}}` or
// `{todos}`, Command-update shaped); its args carry the same list while
// still streaming, before a result exists. Prefer the result once present.
function parseTodos(args: unknown, result: unknown): PersonaTodo[] | null {
  const fromResult = (result && typeof result === 'object' ? (result as Record<string, unknown>) : null);
  const resultTodos = fromResult
    ? ((fromResult.update as Record<string, unknown> | undefined)?.todos ?? fromResult.todos)
    : undefined;
  const raw = Array.isArray(resultTodos)
    ? resultTodos
    : Array.isArray((args as Record<string, unknown> | undefined)?.todos)
      ? (args as Record<string, unknown>).todos
      : null;
  if (!Array.isArray(raw)) return null;

  const todos = (raw as unknown[])
    .map((t) => {
      const todo = t as Record<string, unknown>;
      return {
        content: typeof todo?.content === 'string' ? todo.content : '',
        status: typeof todo?.status === 'string' ? todo.status : 'pending',
      };
    })
    .filter((t) => t.content);
  return todos.length ? todos : null;
}

function PersonaTodoChecklist({ todos }: { todos: PersonaTodo[] }) {
  return (
    <ul className="space-y-0">
      {todos.map((todo, i) => {
        const isCompleted = todo.status === 'completed';
        const isInProgress = todo.status === 'in_progress';
        const Icon = isCompleted ? CheckCircle2 : isInProgress ? Clock : Circle;

        return (
          <li key={`${i}-${todo.content}`} className="flex items-start gap-2 py-[3px]">
            <Icon
              className={cn(
                'mt-0.5 size-3.5 shrink-0',
                isCompleted
                  ? 'fill-blue-600 text-white dark:fill-blue-400 dark:text-zinc-900'
                  : isInProgress
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-300 dark:text-zinc-600'
              )}
            />
            <span
              className={cn(
                'min-w-0 flex-1 break-words text-xs leading-5',
                isCompleted
                  ? 'text-zinc-400 line-through dark:text-zinc-500'
                  : isInProgress
                    ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-700 dark:text-zinc-300'
              )}
            >
              {todo.content}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// Consecutive live-token deltas from the subagent's own model stream arrive
// as one entry per chunk — merge adjacent 'text' entries into one paragraph
// rather than rendering dozens of one-word timeline rows.
function groupSubagentActivity(entries: PersonaSubagentActivityEntry[]) {
  const groups: Array<
    | { kind: 'text'; text: string }
    | { kind: 'tool_start'; toolName?: string; args?: string }
    | { kind: 'tool_result'; toolName?: string; result?: string }
  > = [];
  for (const entry of entries) {
    if (entry.kind === 'text') {
      const last = groups[groups.length - 1];
      if (last?.kind === 'text') {
        last.text += entry.delta || '';
      } else {
        groups.push({ kind: 'text', text: entry.delta || '' });
      }
    } else if (entry.kind === 'tool_start') {
      groups.push({ kind: 'tool_start', toolName: entry.toolName, args: entry.args });
    } else {
      groups.push({ kind: 'tool_result', toolName: entry.toolName, result: entry.result });
    }
  }
  return groups;
}

export interface PersonaToolTraceProps {
  toolCall: PersonaToolCall;
  toolRenderers?: ToolRendererMap;
  /** Called when the user clicks "Open" on a present_file card. */
  onOpenFile?: (path: string) => void;
  /**
   * Whether the parent message is an actively-streaming live run (pass the
   * message's own `isStreaming`). A reloaded historical tool call has no
   * live "in progress" signal — `!toolCall.result` there doesn't reliably
   * mean "still running" the way it does mid-stream — so without this a
   * completed historical call could show "Running..." with a spinner on
   * every page load. @default false
   */
  isLive?: boolean;
  className?: string;
}

export function PersonaToolTrace({
  toolCall,
  toolRenderers,
  onOpenFile,
  isLive = false,
  className,
}: PersonaToolTraceProps) {
  const [isOpen, setIsOpen] = useState(false);

  const parsedArgs = useMemo(() => {
    if (!toolCall.args) return undefined;
    try {
      return JSON.parse(toolCall.args);
    } catch {
      return toolCall.args;
    }
  }, [toolCall.args]);

  const parsedResult = useMemo(() => {
    if (!toolCall.result) return undefined;
    try {
      return JSON.parse(toolCall.result);
    } catch {
      return toolCall.result;
    }
  }, [toolCall.result]);

  const isExecuting = isLive && !toolCall.result && !toolCall.isError;
  const status: 'running' | 'completed' = isExecuting ? 'running' : 'completed';

  const isTodo = isTodoTool(toolCall.toolName);
  const todos = useMemo(
    () => (isTodo ? parseTodos(parsedArgs, parsedResult) : null),
    [isTodo, parsedArgs, parsedResult]
  );
  const todosDone = todos ? todos.filter((t) => t.status === 'completed').length : 0;

  const subagentGroups = useMemo(
    () => (toolCall.subagentActivity?.length ? groupSubagentActivity(toolCall.subagentActivity) : []),
    [toolCall.subagentActivity]
  );

  const ToolIcon = getToolIcon(toolCall.toolName);
  const toolTitle = getToolTitle(toolCall.toolName, parsedArgs, status);

  const diffStats = !toolCall.isError ? computeFileDiffStats(toolCall.toolName, parsedArgs) : null;
  const isLs = isLsTool(toolCall.toolName);
  const isRead = isReadFileTool(toolCall.toolName);
  const isSearch = isWebSearchTool(toolCall.toolName);
  const isGrep = isGrepTool(toolCall.toolName);
  const isDiff = (isFileWriteTool(toolCall.toolName) || isFileEditTool(toolCall.toolName)) && diffStats !== null;

  const results = useMemo(() => (isSearch ? searchResults(parsedResult) : []), [isSearch, parsedResult]);
  const lsEntries = useMemo(() => (isLs ? parseLsResults(parsedResult) : []), [isLs, parsedResult]);
  const grepMatches = useMemo(() => (isGrep ? parseGrepResults(parsedResult) : []), [isGrep, parsedResult]);
  const grepArgs = (typeof parsedArgs === 'object' && parsedArgs) || {};
  const grepQuery = String((grepArgs as Record<string, unknown>).pattern ?? (grepArgs as Record<string, unknown>).Query ?? (grepArgs as Record<string, unknown>).query ?? '');
  const grepPath = String((grepArgs as Record<string, unknown>).path ?? (grepArgs as Record<string, unknown>).SearchPath ?? (grepArgs as Record<string, unknown>).searchPath ?? '/');
  const readFilePath = isRead ? getFilePathFromArgs(parsedArgs) : '';

  // Custom tool renderer delegation
  const CustomRenderer = toolRenderers?.[toolCall.toolName] || toolRenderers?.default;
  if (CustomRenderer && toolCall.result) {
    return (
      <div className={cn('my-2', className)}>
        <CustomRenderer
          toolCall={toolCall}
          args={parsedArgs}
          result={parsedResult}
          isExecuting={isExecuting}
          isError={toolCall.isError}
        />
      </div>
    );
  }

  // present_file's whole purpose is "highlight this file for the user" — a
  // generic JSON-args/JSON-result accordion defeats that. Render a compact
  // open-file card instead, matching persona.hasanraiyan.me's own frontend.
  if (toolCall.toolName === 'present_file' && !toolCall.isError) {
    const args = (typeof parsedArgs === 'object' && parsedArgs) || {};
    const filePath = args.filePath || args.path || '';
    const fileName = filePath.split('/').pop() || filePath || 'file';
    const description = args.description || '';

    return (
      <div
        className={cn(
          'my-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/80 bg-[var(--persona-card,#fafafa)]/50 p-2.5 text-xs dark:border-[var(--persona-border,#27272a)]/80 dark:bg-[var(--persona-card,#18181b)]/40',
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {fileName}
            </div>
            <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
              {description || filePath}
            </p>
          </div>
        </div>
        {filePath && (
          <button
            type="button"
            onClick={() => onOpenFile?.(filePath)}
            className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Open
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'my-2 min-w-0 overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)]/80 bg-[var(--persona-card,#fafafa)]/50 text-xs dark:border-[var(--persona-border,#27272a)]/80 dark:bg-[var(--persona-card,#18181b)]/40',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ToolIcon className={cn('size-3.5 shrink-0', toolCall.isError ? 'text-red-500' : 'text-zinc-500')} />
          <span className="truncate font-semibold text-zinc-800 dark:text-zinc-200">
            {todos ? `Plan (${todosDone}/${todos.length})` : toolTitle}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The Plan title already carries its own status (x/y) — no badge. */}
          {todos ? null : diffStats ? (
            <span className="font-mono text-[11px] font-bold tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">+{diffStats.added}</span>{' '}
              <span className="text-red-500 dark:text-red-400">-{diffStats.removed}</span>
            </span>
          ) : isExecuting ? (
            <span className="flex items-center gap-1 text-[11px] text-blue-500">
              <Loader2 className="size-3 animate-spin" />
              <span>Running...</span>
            </span>
          ) : toolCall.isError ? (
            <span className="flex items-center gap-1 text-[11px] text-red-500">
              <AlertCircle className="size-3" />
              <span>Error</span>
            </span>
          ) : isSearch && results.length ? (
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              {results.length} results
            </span>
          ) : isGrep && grepMatches.length ? (
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              {grepMatches.length} matches
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-emerald-500">
              <CheckCircle2 className="size-3" />
              <span>Complete</span>
            </span>
          )}
          {isOpen ? <ChevronDown className="size-3.5 text-zinc-400" /> : <ChevronRight className="size-3.5 text-zinc-400" />}
        </div>
      </button>

      {toolCall.isError && (
        <div className="border-t border-red-200/60 bg-red-50 px-3 py-2 text-[11px] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {(typeof parsedResult === 'object' && parsedResult && (parsedResult as Record<string, unknown>).message
            ? String((parsedResult as Record<string, unknown>).message)
            : toolCall.result) || 'The tool call failed.'}
        </div>
      )}

      {isOpen && todos ? (
        <div className="border-t border-zinc-200/60 p-3 dark:border-zinc-800/60">
          <PersonaTodoChecklist todos={todos} />
        </div>
      ) : isOpen && isLs ? (
        <div className="border-t border-zinc-200/60 p-3 dark:border-zinc-800/60">
          <PersonaLsDirectoryCard path={grepArgs && (grepArgs as Record<string, unknown>).path ? String((grepArgs as Record<string, unknown>).path) : '/'} entries={lsEntries} status={status} />
        </div>
      ) : isOpen && isRead ? (
        <div className="border-t border-zinc-200/60 p-3 dark:border-zinc-800/60">
          <PersonaReadFileCard filePath={readFilePath} content={typeof parsedResult === 'string' ? parsedResult : toolCall.result || ''} status={status} />
        </div>
      ) : isOpen && isDiff ? (
        <div className="border-t border-zinc-200/60 p-3 dark:border-zinc-800/60">
          {isFileEditTool(toolCall.toolName) ? (
            <PersonaFileDiffCard
              filePath={getFilePathFromArgs(parsedArgs)}
              oldContent={String((grepArgs as Record<string, unknown>).old_string ?? '')}
              newContent={String((grepArgs as Record<string, unknown>).new_string ?? '')}
              note={(grepArgs as Record<string, unknown>).replace_all ? 'Replacing all occurrences' : undefined}
            />
          ) : (
            <PersonaFileDiffCard
              filePath={getFilePathFromArgs(parsedArgs)}
              oldContent=""
              newContent={String((grepArgs as Record<string, unknown>).content ?? '')}
            />
          )}
        </div>
      ) : isOpen && isGrep ? (
        <div className="border-t border-zinc-200/60 p-3 dark:border-zinc-800/60">
          <PersonaGrepResultsCard query={grepQuery} path={grepPath} matches={grepMatches} status={status} />
        </div>
      ) : isOpen && isSearch ? (
        <div className="border-t border-zinc-200/60 p-3 dark:border-zinc-800/60">
          <PersonaSearchResultsCard results={results} status={status} />
        </div>
      ) : isOpen ? (
        <div className="border-t border-zinc-200/60 p-3 space-y-2 font-mono text-[11px] dark:border-zinc-800/60">
          {toolCall.args && (
            <div>
              <span className="text-zinc-500 block mb-1">Arguments:</span>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {typeof parsedArgs === 'object' ? JSON.stringify(parsedArgs, null, 2) : toolCall.args}
              </pre>
            </div>
          )}

          {toolCall.result && (
            <div>
              <span className="text-zinc-500 block mb-1">Result:</span>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {typeof parsedResult === 'object' ? JSON.stringify(parsedResult, null, 2) : toolCall.result}
              </pre>
            </div>
          )}

          {subagentGroups.length > 0 && (
            <div>
              <span className="text-zinc-500 mb-1 flex items-center gap-1">
                <Bot className="size-3" />
                Subagent activity:
              </span>
              <div className="space-y-1.5 border-l-2 border-zinc-200 pl-2.5 dark:border-zinc-800">
                {subagentGroups.map((group, i) =>
                  group.kind === 'text' ? (
                    <p key={i} className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                      {group.text}
                    </p>
                  ) : group.kind === 'tool_start' ? (
                    <div key={i} className="flex items-center gap-1 text-zinc-500">
                      <ArrowRight className="size-3 shrink-0" />
                      <span className="font-semibold">{group.toolName}</span>
                      {group.args && <span className="truncate opacity-70">({group.args})</span>}
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                      <span className="truncate opacity-90">{group.toolName}: {group.result}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
