'use client';

import { cn } from '../utils/cn.js';

export interface PersonaSkeletonProps {
  className?: string;
}

/**
 * Shimmering placeholder block, themed the same way as every other surface
 * (`--persona-border` for the base tone) so it reads correctly against a
 * custom `theme` instead of assuming the default zinc palette.
 */
export function PersonaSkeleton({ className }: PersonaSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-[var(--persona-border,#e4e4e7)]/70 dark:bg-[var(--persona-border,#27272a)]/70',
        className
      )}
    />
  );
}

/** Placeholder for a single chat bubble row, matching PersonaMessageFeed's real layout. */
export function PersonaMessageSkeletonRow({ align = 'left' }: { align?: 'left' | 'right' }) {
  return (
    <div className={cn('flex items-start gap-2.5', align === 'right' && 'flex-row-reverse')}>
      <PersonaSkeleton className="size-8 shrink-0 rounded-xl" />
      <div className={cn('flex max-w-[70%] flex-col gap-1.5', align === 'right' && 'items-end')}>
        <PersonaSkeleton className="h-3 w-40" />
        <PersonaSkeleton className="h-3 w-56" />
      </div>
    </div>
  );
}

/** Placeholder for a single thread row in PersonaSidebar. */
export function PersonaThreadSkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <PersonaSkeleton className="size-1.5 shrink-0 rounded-full" />
      <PersonaSkeleton className="h-3 w-full" />
    </div>
  );
}

/** Placeholder for a single file/memory row in PersonaFilesDrawer. */
export function PersonaFileSkeletonRow() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60">
      <PersonaSkeleton className="size-4 shrink-0 rounded" />
      <PersonaSkeleton className="h-3 w-2/3" />
    </div>
  );
}
