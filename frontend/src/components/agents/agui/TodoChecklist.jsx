'use client';

import { CircleCheck, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TodoStatusIcon({ status }) {
  if (status === 'completed') {
    return <CircleCheck className="size-4 shrink-0 text-emerald-500" />;
  }
  if (status === 'in_progress') {
    return <Loader2 className="size-4 shrink-0 animate-spin text-[#1E60FF]" />;
  }
  return (
    <Circle className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
  );
}

export function TodoChecklist({ todos, className, showProgress = false }) {
  if (!todos?.length) return null;
  const todosDone = todos.filter((todo) => todo.status === 'completed').length;
  const percentage = Math.round((todosDone / todos.length) * 100);

  return (
    <div className={cn('space-y-3.5', className)}>
      {showProgress && (
        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-850 dark:bg-slate-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Roadmap Progress</span>
            <span className="tabular-nums font-mono text-xs text-slate-600 dark:text-slate-350">{todosDone}/{todos.length} ({percentage}%)</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#1E60FF] transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {todos.map((todo, index) => {
          const isCompleted = todo.status === 'completed';
          const isInProgress = todo.status === 'in_progress';

          return (
            <li
              key={`${index}-${todo.content}`}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-2.5 transition-all duration-200',
                isCompleted
                  ? 'border-slate-100 bg-slate-50/40 opacity-70 dark:border-slate-800/40 dark:bg-slate-900/10'
                  : isInProgress
                    ? 'border-blue-100 bg-blue-50/20 shadow-[0_2px_8px_-3px_rgba(30,96,255,0.08)] dark:border-blue-900/30 dark:bg-blue-950/10 border-l-2 border-l-[#1E60FF]'
                    : 'border-slate-100 bg-white dark:border-slate-850 dark:bg-slate-950'
              )}
            >
              <span className="mt-0.5 shrink-0">
                <TodoStatusIcon status={todo.status} />
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200',
                  isCompleted && 'text-slate-400 line-through dark:text-slate-500',
                  isInProgress && 'font-bold text-slate-900 dark:text-white'
                )}
              >
                {todo.content}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
