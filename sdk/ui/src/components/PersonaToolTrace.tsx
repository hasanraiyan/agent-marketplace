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
  isSubagentTool,
  searchResults,
  parseLsResults,
  parseGrepResults,
  computeFileDiffStats,
  getFilePathFromArgs,
} from '../utils/toolPresentation.js';
import { buildSubagentTimeline } from '../utils/subagentTimeline.js';
import { PersonaSearchResultsCard } from './tool-cards/PersonaSearchResultsCard.js';
import { PersonaReadFileCard } from './tool-cards/PersonaReadFileCard.js';
import { PersonaLsDirectoryCard } from './tool-cards/PersonaLsDirectoryCard.js';
import { PersonaGrepResultsCard } from './tool-cards/PersonaGrepResultsCard.js';
import { PersonaFileDiffCard } from './tool-cards/PersonaFileDiffCard.js';
import { PersonaSubagentActivityDialog } from './PersonaSubagentActivityDialog.js';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Check,
  Loader2,
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

function safeParseJson(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// One compact row per subagent tool call: icon + running/done + humanized
// title, no expandable content — used only in the live "Subagent working"
// preview, never in the full activity dialog (which renders full PersonaToolTrace
// cards instead).
function PersonaSubagentCompactRow({ toolCall }: { toolCall: PersonaToolCall }) {
  const Icon = getToolIcon(toolCall.toolName);
  const running = !toolCall.result && !toolCall.isError;
  const title = getToolTitle(toolCall.toolName, safeParseJson(toolCall.args), running ? 'running' : 'completed');

  return (
    <div className="flex items-center gap-2 text-xs">
      {running ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-orange-500" />
      ) : (
        <Check className="size-3.5 shrink-0 text-emerald-500" />
      )}
      <Icon className="size-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 truncate font-medium text-zinc-600 dark:text-zinc-300">{title}</span>
    </div>
  );
}

// Auto-shown under a running subagent's row (no click required) — the last
// few activity items in compact form, matching the reference frontend's
// "Subagent working" preview. Text entries show only their last 2 lines,
// plain (not Markdown); tool entries are one-line rows, not full cards —
// the full activity dialog is where the rich rendering happens.
function PersonaSubagentLivePreview({ activity }: { activity: PersonaSubagentActivityEntry[] }) {
  const items = useMemo(() => buildSubagentTimeline(activity).slice(-4), [activity]);
  if (items.length === 0) return null;

  return (
    <div className="border-t border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/60 px-3 py-2 dark:border-zinc-800/60 dark:bg-zinc-900/40">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        <Bot className="size-3 animate-pulse text-orange-500" />
        Subagent working
      </div>
      <div className="space-y-1">
        {items.map((item, i) =>
          item.kind === 'text' ? (
            item.text.trim() ? (
              <p key={i} className="whitespace-pre-wrap break-words text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {item.text.trimEnd().split('\n').slice(-2).join('\n')}
              </p>
            ) : null
          ) : (
            <PersonaSubagentCompactRow key={item.toolCall.toolCallId} toolCall={item.toolCall} />
          )
        )}
      </div>
    </div>
  );
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
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const isSubagent = isSubagentTool(toolCall.toolName);
  const subToolUses = useMemo(
    () => (toolCall.subagentActivity || []).filter((e) => e.kind === 'tool_start').length,
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
        onClick={() => (isSubagent ? setDialogOpen(true) : setIsOpen((prev) => !prev))}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ToolIcon className={cn('size-3.5 shrink-0', toolCall.isError ? 'text-red-500' : 'text-zinc-500')} />
          <span className="truncate font-semibold text-zinc-800 dark:text-zinc-200">
            {todos ? `Plan (${todosDone}/${todos.length})` : toolTitle}
            {isSubagent && subToolUses > 0 ? (
              <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
                · {subToolUses} tool {subToolUses === 1 ? 'use' : 'uses'}
              </span>
            ) : null}
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

      {isSubagent && isExecuting && toolCall.subagentActivity?.length ? (
        <PersonaSubagentLivePreview activity={toolCall.subagentActivity} />
      ) : null}

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
        </div>
      ) : null}

      {isSubagent && (
        <PersonaSubagentActivityDialog
          toolCall={toolCall}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          toolRenderers={toolRenderers}
          onOpenFile={onOpenFile}
          isLive={isLive}
        />
      )}
    </div>
  );
}
