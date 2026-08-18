'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface PersonaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Minimal, dependency-free modal primitive (no Radix/headlessui in sdk/ui's
 * deps) — a portal to `document.body`, a click-outside/Escape-to-close
 * overlay, and a body scroll lock while open. Consumers own their own
 * header/body layout inside `children`; this only owns the chrome.
 */
export function PersonaDialog({ open, onOpenChange, children, className }: PersonaDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          'relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] shadow-2xl dark:border-zinc-800 dark:bg-zinc-950',
          className
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
