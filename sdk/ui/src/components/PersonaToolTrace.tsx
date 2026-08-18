'use client';

import React, { useState, useMemo } from 'react';
import type { PersonaSubagentActivityEntry, PersonaToolCall } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { cn } from '../utils/cn.js';
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Bot,
  FileText,
} from 'lucide-react';

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
  className?: string;
}

export function PersonaToolTrace({
  toolCall,
  toolRenderers,
  onOpenFile,
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

  const isExecuting = !toolCall.result && !toolCall.isError;

  const subagentGroups = useMemo(
    () => (toolCall.subagentActivity?.length ? groupSubagentActivity(toolCall.subagentActivity) : []),
    [toolCall.subagentActivity]
  );

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
          'my-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-2.5 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40',
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
        'my-2 min-w-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-mono transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60"
      >
        <div className="flex items-center gap-2">
          <Wrench className="size-3.5 text-zinc-500" />
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {toolCall.toolName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isExecuting ? (
            <span className="flex items-center gap-1 text-[11px] text-blue-500">
              <Loader2 className="size-3 animate-spin" />
              <span>Running...</span>
            </span>
          ) : toolCall.isError ? (
            <span className="flex items-center gap-1 text-[11px] text-red-500">
              <AlertCircle className="size-3" />
              <span>Error</span>
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

      {isOpen && (
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
      )}
    </div>
  );
}
