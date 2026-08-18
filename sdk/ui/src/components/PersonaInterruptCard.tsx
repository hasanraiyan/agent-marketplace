'use client';

import React, { useState } from 'react';
import type { PersonaInterrupt, PersonaResumeValue } from '@personaai/react';
import { cn } from '../utils/cn.js';
import { ShieldAlert, HelpCircle, Check, X } from 'lucide-react';

export interface PersonaInterruptCardProps {
  interrupt: PersonaInterrupt;
  onRespond: (resume: PersonaResumeValue, displayContent: string) => void;
  isStreaming?: boolean;
  className?: string;
}

export function PersonaInterruptCard({
  interrupt,
  onRespond,
  isStreaming,
  className,
}: PersonaInterruptCardProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  if (interrupt.kind === 'hitl') {
    const approveAll = () => {
      onRespond(
        { decisions: interrupt.actionRequests.map(() => ({ type: 'approve' })) },
        'Approved'
      );
    };
    const rejectAll = () => {
      onRespond(
        {
          decisions: interrupt.actionRequests.map(() => ({
            type: 'reject',
            message: 'User declined the action.',
          })),
        },
        'Rejected'
      );
    };

    return (
      <div
        className={cn(
          'mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30',
          className
        )}
      >
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
          <ShieldAlert className="size-4" />
          Approval needed
        </div>
        <ul className="mb-3 space-y-1 font-mono text-xs text-amber-900/80 dark:text-amber-200/80">
          {interrupt.actionRequests.map((action, i) => (
            <li key={i}>• {action.name}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isStreaming}
            onClick={approveAll}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Approve
          </button>
          <button
            type="button"
            disabled={isStreaming}
            onClick={rejectAll}
            className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
          >
            <X className="size-3.5" /> Reject
          </button>
        </div>
      </div>
    );
  }

  const submit = () => {
    const orderedAnswers = interrupt.questions.map((_, i) => answers[i] ?? '');
    const summary = interrupt.questions
      .map((q, i) => `${q.text}: ${answers[i] ?? ''}`)
      .join('\n');
    onRespond({ answers: orderedAnswers, text: summary }, summary);
  };

  const canSubmit = !interrupt.questions.some((q, i) => q.required && !answers[i]?.trim());

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-3xl rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300">
        <HelpCircle className="size-4" />A few questions before I continue
      </div>
      <div className="space-y-3">
        {interrupt.questions.map((q, i) => (
          <div key={q.id}>
            <p className="mb-1.5 text-xs font-medium text-blue-900 dark:text-blue-200">{q.text}</p>
            {q.options.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [i]: opt }))}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors',
                      answers[i] === opt
                        ? 'bg-blue-600 text-white ring-blue-600'
                        : 'bg-white text-blue-700 ring-blue-200 hover:bg-blue-100 dark:bg-zinc-900 dark:text-blue-300 dark:ring-blue-900/60'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {q.allowCustom && (
              <input
                value={q.options.includes(answers[i] ?? '') ? '' : answers[i] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                placeholder="Or type your own answer..."
                className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-blue-400 dark:border-blue-900/60 dark:bg-zinc-900 dark:text-zinc-100"
              />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={isStreaming || !canSubmit}
        onClick={submit}
        className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
