'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { PersonaToolCall } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { toolGroupKey, type PersonaToolClusterLabels } from '../utils/toolGrouping.js';
import { cn } from '../utils/cn.js';
import { PersonaToolTrace } from './PersonaToolTrace.js';
import {
  AlertCircle,
  Brain,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  Wrench,
} from 'lucide-react';

const DEFAULT_CLUSTER_LABELS: PersonaToolClusterLabels = {
  memory: { title: 'Personalizing memory', icon: Brain },
  file: { title: 'Working with files', icon: FileText },
  search: { title: 'Searching the web', icon: Globe },
  task: { title: 'Running subagents', icon: Bot },
  plan: { title: 'Updating the plan', icon: ListTodo },
  mixed: { title: 'Performing actions', icon: Wrench },
};

// A run of adjacent tool calls collapses into ONE cluster with a header
// derived from what the mix is doing — "Working with files", "Searching the
// web" — instead of a generic "Used N tools". `labels` lets a consumer
// override or extend any of these (or add its own keys — toolGroupKey falls
// back to the raw tool name for anything unrecognized, so a custom label
// keyed by that name works too), falling back to the built-in defaults for
// anything it doesn't cover.
function clusterMeta(tools: PersonaToolCall[], labels?: PersonaToolClusterLabels) {
  const merged = { ...DEFAULT_CLUSTER_LABELS, ...labels };
  const groups = new Set(tools.map(toolGroupKey));
  const key = groups.size === 1 ? [...groups][0] : 'mixed';
  return merged[key] ?? merged.mixed;
}

export interface PersonaToolGroupProps {
  tools: PersonaToolCall[];
  toolRenderers?: ToolRendererMap;
  onOpenFile?: (path: string) => void;
  /** Overrides/extends the default cluster title+icon map (keyed by `toolGroupKey`'s output, or `mixed`). */
  clusterLabels?: PersonaToolClusterLabels;
  /**
   * Whether the parent message is an actively-streaming live run (pass the
   * message's own `isStreaming`). Gates whether `anyRunning` is trusted to
   * mean anything: a reloaded historical message's tool calls have no
   * live "in progress" signal (they're just whatever the server happened to
   * persist), so `!tool.result` there doesn't reliably mean "still running"
   * the way it does mid-stream — without this, a completed historical group
   * could auto-expand on every page load looking like it's re-running.
   * @default false
   */
  isLive?: boolean;
  className?: string;
}

export function PersonaToolGroup({
  tools,
  toolRenderers,
  onOpenFile,
  clusterLabels,
  isLive = false,
  className,
}: PersonaToolGroupProps) {
  const hasError = tools.some((t) => t.isError);
  const anyRunning = isLive && tools.some((t) => !t.result && !t.isError);
  const { title, icon: ClusterIcon = Wrench } = clusterMeta(tools, clusterLabels);

  const [isOpen, setIsOpen] = useState(anyRunning);
  const wasRunningRef = useRef(anyRunning);

  useEffect(() => {
    // Auto-open the moment any step in the group starts running, so the user
    // sees it happen live — never auto-*close* on completion, so a card the
    // user opened to read stays open once the run settles. Gated on isLive
    // (folded into anyRunning above) so a reloaded historical group never
    // auto-opens at all — only ever a real live run does.
    if (anyRunning && !wasRunningRef.current) setIsOpen(true);
    wasRunningRef.current = anyRunning;
  }, [anyRunning]);

  return (
    <div className={cn('my-2 min-w-0', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <div className="flex min-w-0 items-center gap-2">
          {anyRunning ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-blue-500" />
          ) : hasError ? (
            <AlertCircle className="size-4 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          )}
          <ClusterIcon className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <span className="truncate">{title}</span>
          <span className="shrink-0 text-[10px] font-normal text-zinc-400 dark:text-zinc-500">
            {tools.length} step{tools.length > 1 ? 's' : ''}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 pl-4">
          {tools.map((tool) => (
            <PersonaToolTrace
              key={tool.toolCallId}
              toolCall={tool}
              toolRenderers={toolRenderers}
              onOpenFile={onOpenFile}
              isLive={isLive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
