'use client';

import React, { useState, useMemo } from 'react';
import type { PersonaToolCall } from '@personaai/react';
import type { ToolRendererMap } from '../types.js';
import { cn } from '../utils/cn.js';
import { Wrench, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface PersonaToolTraceProps {
  toolCall: PersonaToolCall;
  toolRenderers?: ToolRendererMap;
  className?: string;
}

export function PersonaToolTrace({
  toolCall,
  toolRenderers,
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

  return (
    <div
      className={cn(
        'my-2 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40',
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
              <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {typeof parsedArgs === 'object' ? JSON.stringify(parsedArgs, null, 2) : toolCall.args}
              </pre>
            </div>
          )}

          {toolCall.result && (
            <div>
              <span className="text-zinc-500 block mb-1">Result:</span>
              <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                {typeof parsedResult === 'object' ? JSON.stringify(parsedResult, null, 2) : toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
