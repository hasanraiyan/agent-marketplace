'use client';

import { useRef, useEffect } from 'react';
import { ArrowUp, ChevronDown, ImagePlus, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isRunning,
  disabled,
  placeholder = 'Write a message...',
}) {
  const canSend = value.trim().length > 0 && !disabled && !isRunning;
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set the height to scrollHeight
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-[#3f3f3a] dark:bg-[#272724]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (isRunning) onStop();
            else if (canSend) onSend();
          }
        }}
        disabled={disabled || isRunning}
        placeholder={placeholder}
        rows={1}
        className="max-h-[40vh] min-h-8 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:placeholder:text-[#aaa9a2]"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          disabled
        >
          <ImagePlus className="size-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Flash
            <ChevronDown className="size-3.5 text-slate-400" />
          </button>
          <Button
            type="button"
            size="icon"
            onClick={isRunning ? onStop : onSend}
            disabled={!isRunning && !canSend}
            className={cn(
              'size-10 rounded-full',
              isRunning
                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                : 'bg-[#1E60FF]/10 text-[#1E60FF] hover:bg-[#1E60FF]/15',
            )}
          >
            {isRunning ? (
              <Square className="size-4 fill-current" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
