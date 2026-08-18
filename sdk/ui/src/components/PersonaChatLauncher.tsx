'use client';

import React, { useState } from 'react';
import type { PersonaChatViewProps } from '../types.js';
import { cn } from '../utils/cn.js';
import { buildThemeStyles } from '../utils/themeStyles.js';
import { PersonaChatView } from './PersonaChatView.js';
import { MessageCircle, X } from 'lucide-react';

export interface PersonaChatLauncherProps extends PersonaChatViewProps {
  /** @default 'bottom-right' */
  position?: 'bottom-right' | 'bottom-left';
  /** Uncontrolled initial open state. @default false */
  defaultOpen?: boolean;
  /** Controlled open state — omit to let the launcher manage it internally. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Replaces the default chat-bubble icon (shown while closed). */
  fabIcon?: React.ReactNode;
  /** @default '24rem' */
  panelWidth?: string;
  /** @default '36rem' */
  panelHeight?: string;
  fabClassName?: string;
  panelClassName?: string;
}

/**
 * A floating action button that toggles a `PersonaChatView` panel — for
 * mounting a chat bubble on any page (a support-widget-style entry point),
 * rather than a dedicated full-page chat route. Accepts every
 * `PersonaChatViewProps` and passes them straight through to the panel.
 */
export function PersonaChatLauncher({
  position = 'bottom-right',
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  fabIcon,
  panelWidth = '24rem',
  panelHeight = '36rem',
  fabClassName,
  panelClassName,
  theme,
  ...chatViewProps
}: PersonaChatLauncherProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };

  const isRight = position !== 'bottom-left';
  // Set once here, at a common ancestor of both the FAB and the panel — the
  // panel's own PersonaChatView also sets these on its own root (harmless
  // duplication), but the FAB itself is a sibling of that subtree, not a
  // descendant, so it can only pick up the theme if something above both of
  // them provides it.
  const themeStyles = buildThemeStyles(theme);

  return (
    <div style={themeStyles} className="contents">
      {isOpen && (
        <div
          className={cn(
            'fixed bottom-24 z-40 flex max-h-[calc(100vh-7rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950',
            isRight ? 'right-6' : 'left-6',
            panelClassName
          )}
          style={{ width: panelWidth, height: panelHeight }}
        >
          <PersonaChatView {...chatViewProps} theme={theme} className="h-full w-full" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className={cn(
          'fixed bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-[var(--persona-primary,#18181b)] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900',
          isRight ? 'right-6' : 'left-6',
          fabClassName
        )}
      >
        {isOpen ? <X className="size-6" /> : (fabIcon ?? <MessageCircle className="size-6" />)}
      </button>
    </div>
  );
}
