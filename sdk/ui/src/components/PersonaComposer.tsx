'use client';

import React, { useRef, useEffect } from 'react';
import type { StarterPromptItem } from '../types.js';
import { cn } from '../utils/cn.js';
import { Send, Square, Paperclip, ArrowUp } from 'lucide-react';

export interface PersonaComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  starterPrompts?: StarterPromptItem[];
  onSelectStarter?: (prompt: string) => void;
  onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export function PersonaComposer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder = 'Ask anything...',
  starterPrompts = [],
  onSelectStarter,
  onUploadFile,
  className,
}: PersonaComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming && !disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className={cn('relative w-full max-w-3xl mx-auto', className)}>
      {/* Quick Action Badges */}
      {starterPrompts.length > 0 && !input && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
          {starterPrompts.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelectStarter?.(item.prompt)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-2xs backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Floating Card Container — explicit bg-white so children inherit correctly */}
      <div className="relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-400/20 dark:border-zinc-700 dark:bg-zinc-900">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          style={{ color: '#111827' }}
          className="w-full resize-none bg-transparent px-2.5 pt-1.5 pb-2 text-sm leading-relaxed placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500 dark:!text-zinc-100"
        />

        {/* Toolbar: Attachments on left, Send/Stop on right */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              onChange={onUploadFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach document or receipt"
              className="rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Paperclip className="size-4" />
            </button>
          </div>

          <div>
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex size-8 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-95"
              >
                <Square className="size-3.5 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!input.trim() || disabled}
                className="flex size-8 items-center justify-center rounded-xl bg-[var(--persona-primary,#27272a)] text-white shadow-sm transition-all hover:brightness-90 disabled:pointer-events-none disabled:opacity-25 active:scale-95 dark:bg-[var(--persona-primary,#e4e4e7)] dark:text-zinc-900 dark:hover:brightness-110"
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
