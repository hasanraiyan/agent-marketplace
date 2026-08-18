'use client';

import React, { useMemo } from 'react';
import type { PersonaToolCall } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { cn } from '../utils/cn.js';
import { PersonaDialog } from './PersonaDialog.js';
import { PersonaMarkdown } from './PersonaMarkdown.js';
import { PersonaToolTrace } from './PersonaToolTrace.js';
import { buildSubagentTimeline, classifySubagentStatus, type PersonaSubagentStatus } from '../utils/subagentTimeline.js';
import { Ban, Check, Loader2, XCircle } from 'lucide-react';

const STATUS_META: Record<PersonaSubagentStatus, { label: string; icon: typeof Check; className: string; spin?: boolean }> = {
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
    spin: true,
  },
  completed: {
    label: 'Completed',
    icon: Check,
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  },
  denied: {
    label: 'Denied',
    icon: Ban,
    className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  },
  canceled: {
    label: 'Canceled',
    icon: Ban,
    className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export interface PersonaSubagentActivityDialogProps {
  toolCall: PersonaToolCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolRenderers?: ToolRendererMap;
  onOpenFile?: (path: string) => void;
  isLive?: boolean;
}

export function PersonaSubagentActivityDialog({
  toolCall,
  open,
  onOpenChange,
  toolRenderers,
  onOpenFile,
  isLive = false,
}: PersonaSubagentActivityDialogProps) {
  const args = useMemo(() => {
    if (!toolCall?.args) return {};
    try {
      return asRecord(JSON.parse(toolCall.args));
    } catch {
      return {};
    }
  }, [toolCall?.args]);

  const timeline = useMemo(
    () => (toolCall?.subagentActivity?.length ? buildSubagentTimeline(toolCall.subagentActivity) : []),
    [toolCall?.subagentActivity]
  );

  if (!toolCall) return null;

  const goal = String(args.description || args.task || args.goal || 'Subagent task');
  const subagentType = args.subagent_type || args.subagentType;
  const status = classifySubagentStatus(toolCall, isLive);
  const { label, icon: StatusIcon, className: statusClassName, spin } = STATUS_META[status];

  return (
    <PersonaDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-4 py-3 pr-10 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <div className="min-w-0">
          {subagentType ? (
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {String(subagentType)} subagent
            </div>
          ) : null}
          <div className="mt-0.5 truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{goal}</div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
            statusClassName
          )}
        >
          <StatusIcon className={cn('size-3.5', spin && 'animate-spin')} />
          {label}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {timeline.length > 0 ? (
          <div className="space-y-2">
            {timeline.map((item, i) =>
              item.kind === 'text' ? (
                item.text ? <PersonaMarkdown key={i} content={item.text} /> : null
              ) : (
                <PersonaToolTrace
                  key={item.toolCall.toolCallId}
                  toolCall={item.toolCall}
                  toolRenderers={toolRenderers}
                  onOpenFile={onOpenFile}
                  isLive={isLive}
                />
              )
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-xs italic text-zinc-400 dark:text-zinc-500">
            {status === 'running' ? 'Waiting for activity…' : 'No activity recorded.'}
          </div>
        )}
      </div>
    </PersonaDialog>
  );
}
