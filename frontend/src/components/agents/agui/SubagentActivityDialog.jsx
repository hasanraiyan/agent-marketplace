'use client';

import { Ban, Check, Loader2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { tryParseJson } from './utils';
import { SubAgentTimeline } from './ToolTrace';

const STATUS_META = {
  running: {
    label: 'Running',
    Icon: Loader2,
    className: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
    iconClassName: 'animate-spin',
  },
  completed: {
    label: 'Completed',
    Icon: Check,
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    Icon: XCircle,
    className: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  },
  denied: {
    label: 'Denied',
    Icon: Ban,
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
  canceled: {
    label: 'Canceled',
    Icon: Ban,
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
};

function getSubagentStatus(tool) {
  if (tool.status !== 'completed') return STATUS_META.running;

  const parsed = tryParseJson(tool.resultText);
  if (parsed?.status === 'error') {
    const message = (parsed.message || '').toLowerCase();
    if (/denied|reject|declin/.test(message)) return STATUS_META.denied;
    return STATUS_META.failed;
  }

  if (!tool.resultText) return STATUS_META.canceled;
  return STATUS_META.completed;
}

// Modal opened by tapping a `task` (subagent) tool card. Keeps the sub-agent's
// reasoning, messages, and tool calls out of the main transcript while still
// giving the user a full, scoped view of what it did.
export function SubagentActivityDialog({ tool, open, onOpenChange }) {
  if (!tool) return null;

  const args = tryParseJson(tool.argumentsText) || {};
  const goal = args.description || args.task || args.goal || 'Subagent task';
  const subagentType = args.subagent_type || args.subagentType;
  const subEvents = Array.isArray(tool.subEvents) ? tool.subEvents : [];
  const status = getSubagentStatus(tool);
  const StatusIcon = status.Icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Subagent activity</DialogTitle>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
            <div className="min-w-0">
              {subagentType ? (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {subagentType} subagent
                </div>
              ) : null}
              <div className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {goal}
              </div>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                status.className,
              )}
            >
              <StatusIcon className={cn('size-3.5', status.iconClassName)} />
              {status.label}
            </span>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-150 bg-slate-50/50 p-3 dark:border-slate-800/60 dark:bg-slate-900/30 scrollbar-thin">
          {subEvents.length > 0 ? (
            <SubAgentTimeline items={subEvents} />
          ) : (
            <div className="flex items-center justify-center py-8 text-xs italic text-slate-400 dark:text-slate-500">
              {status === STATUS_META.running ? 'Waiting for activity…' : 'No activity recorded.'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
