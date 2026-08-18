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
            // z-[9999]: a floating widget mounted into an arbitrary host page
            // has to reliably beat that page's OWN header/nav z-index (which
            // this can't know ahead of time) — the old bespoke chat widgets
            // this SDK replaces used the same value for the same reason.
            'fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[var(--persona-bg,#ffffff)] shadow-2xl animate-[persona-drawer-up_0.25s_ease-out] dark:bg-[var(--persona-bg,#09090b)]',
            // Below sm (640px): a true full-screen takeover, not a small
            // floating card leaving gaps a host page's own fixed/sticky
            // header can render through — see PersonaChatView's own
            // @container comment for the matching reasoning on its sidebar.
            // Width/height only take effect at sm+ (arbitrary-value classes
            // bound to the CSS vars set below) — full-screen below sm
            // ignores them entirely via inset-0 above, same reasoning.
            'sm:inset-auto sm:bottom-24 sm:h-[var(--persona-panel-h)] sm:w-[var(--persona-panel-w)] sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-2rem)] sm:animate-none sm:rounded-2xl sm:border sm:border-[var(--persona-border,#e4e4e7)] sm:dark:border-[var(--persona-border,#27272a)]',
            isRight ? 'sm:right-6' : 'sm:left-6',
            panelClassName
          )}
          style={{ '--persona-panel-w': panelWidth, '--persona-panel-h': panelHeight } as React.CSSProperties}
        >
          <PersonaChatView {...chatViewProps} theme={theme} className="h-full w-full" />
        </div>
      )}

      {/* Mobile-only close button — the full-screen panel above covers the
          FAB entirely below sm, so without this there'd be no way to close
          it. top-14, not top-4: PersonaChatView's own toolbar (h-11) already
          has a right-aligned "Artifacts" button in that same top-right
          corner — sitting below it instead of on top of it. */}
      {isOpen && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="fixed right-4 top-14 z-[10000] flex size-9 items-center justify-center rounded-full bg-[var(--persona-primary,#18181b)] text-white shadow-lg sm:hidden dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900"
        >
          <X className="size-5" />
        </button>
      )}

      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className={cn(
          'fixed bottom-6 z-[9999] items-center justify-center rounded-full bg-[var(--persona-primary,#18181b)] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900',
          // Open on mobile: the full-screen panel already covers this and
          // the dedicated close button above handles closing, so showing
          // this too would just float on top of the panel's own content.
          // Every other state (closed on mobile, either state on sm+,
          // where the panel never covers the FAB) shows it as normal.
          isOpen ? 'hidden sm:flex' : 'flex',
          isRight ? 'right-6' : 'left-6',
          fabClassName
        )}
      >
        {isOpen ? <X className="size-6" /> : (fabIcon ?? <MessageCircle className="size-6" />)}
      </button>
    </div>
  );
}
