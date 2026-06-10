'use client';

import {
  ArrowRight,
  Check,
  ChevronDown,
  PencilLine,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getFileSystemActionDetails, prettyToolName } from './utils';
import { FileSystemActionCard, ActionArguments } from './ToolTrace';

export function ApprovalCard({ approval, onRespond, disabled }) {
  const actions = approval?.actionRequests || [];
  if (!actions.length) return null;

  const approve = () => onRespond(actions.map(() => ({ type: 'approve' })));
  const reject = () =>
    onRespond(
      actions.map(() => ({
        type: 'reject',
        message: 'User rejected the action.',
      })),
    );

  return (
    <div className="max-w-[92%] rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-[0_8px_30px_rgb(251,191,36,0.03)] dark:border-amber-500/20 dark:bg-amber-950/10">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-850 dark:text-amber-400">
        <div className="flex size-5.5 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-455">
          <ShieldAlert className="size-3.5 animate-pulse" />
        </div>
        Approval Required
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        The agent wants to execute the following actions. Please review them:
      </p>

      <div className="mt-3 space-y-3.5">
        {actions.map((action, index) => {
          const fsDetails = getFileSystemActionDetails(action);
          if (fsDetails) {
            return <FileSystemActionCard key={index} action={action} />;
          }

          return (
            <div
              key={index}
              className="rounded-xl border border-amber-200/50 bg-white/80 p-3 dark:border-amber-500/20 dark:bg-slate-900/50"
            >
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {prettyToolName(action.name)}
              </div>
              <ActionArguments args={action.args} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={approve}
          disabled={disabled}
          className="rounded-full bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-transform duration-100"
        >
          <Check className="mr-1 size-4" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={reject}
          disabled={disabled}
          className="rounded-full px-4 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-transform duration-100"
        >
          <X className="mr-1 size-4" />
          Reject
        </Button>
        <span className="ml-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
          or reply below with feedback
        </span>
      </div>
    </div>
  );
}

export function ClarificationCard({ clarification, onRespond, disabled }) {
  const question = clarification?.questions?.[clarification.currentIndex || 0];
  const currentIndex = clarification?.currentIndex || 0;
  const total = clarification?.questions?.length || 0;

  if (!question) return null;

  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#f7f7f5] shadow-[0_16px_40px_rgba(15,23,42,0.10)] dark:border-[#3f3f3a] dark:bg-[#33332f] dark:shadow-none">
      <div className="flex h-14 items-center gap-3 px-5">
        <div className="min-w-0 flex-1 text-[15px] font-semibold leading-5 text-slate-950 dark:text-[#f2f2ec]">
          {question.text}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500 dark:text-[#aaa9a2]">
          {total > 1 ? (
            <>
              <button
                type="button"
                disabled
                className="flex size-6 items-center justify-center rounded-md opacity-45"
                aria-label="Previous question"
              >
                <ChevronDown className="size-4 rotate-90" />
              </button>
              <span className="tabular-nums">
                {currentIndex + 1} of {total}
              </span>
              <button
                type="button"
                disabled
                className="flex size-6 items-center justify-center rounded-md opacity-45"
                aria-label="Next question"
              >
                <ChevronDown className="size-4 -rotate-90" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onRespond({ skipped: true })}
            disabled={disabled}
            className="ml-1 flex size-7 items-center justify-center rounded-md hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
            aria-label="Dismiss clarification"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-2 pb-2">
        {(question.options || []).map((option, index) => (
          <button
            key={`${question.id}-${option}-${index}`}
            type="button"
            onClick={() =>
              onRespond({
                answer: option,
                optionIndex: index,
                freeform: false,
              })
            }
            disabled={disabled}
            className={cn(
              'group flex h-[52px] w-full items-center gap-3 border-b border-slate-200/80 px-3 text-left transition last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#464640]',
              index === 0
                ? 'rounded-xl bg-white/55 dark:bg-white/[0.06]'
                : 'hover:bg-white/45 dark:hover:bg-white/[0.05]',
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-sm font-semibold text-slate-600 group-hover:bg-slate-300 dark:bg-[#474742] dark:text-[#d5d3ca] dark:group-hover:bg-[#55554f]">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-800 dark:text-[#dedcd3]">
              {option}
            </span>
            <ArrowRight className="size-4 text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-[#a4a199]" />
          </button>
        ))}

        {question.allowCustom !== false ? (
          <div className="flex h-[52px] items-center gap-3 px-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-600 dark:bg-[#474742] dark:text-[#d5d3ca]">
              <PencilLine className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-500 dark:text-[#aaa9a2]">
              Something else
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
