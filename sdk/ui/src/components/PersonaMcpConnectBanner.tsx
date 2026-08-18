'use client';

import type { PersonaMcpConnection } from '@personaai/react';
import { Link2 } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface PersonaMcpConnectBannerProps {
  connections: PersonaMcpConnection[];
  className?: string;
}

/**
 * One "Connect" prompt per MCP the agent needs that the current user hasn't
 * authorized yet — the affordance that didn't exist at all before
 * `useMcpConnections`: a tool call against one of these used to just
 * silently not work, with nothing anywhere telling the user why.
 *
 * A plain `<a>`, not a click handler: `authorizeUrl` is a real OAuth
 * authorization URL, and a same-tab navigation there and back (the OAuth
 * server redirects to `returnTo` once consent completes) is the correct,
 * standards-based way to start that flow — nothing here needs to be a popup
 * or an XHR.
 */
export function PersonaMcpConnectBanner({ connections, className }: PersonaMcpConnectBannerProps) {
  if (connections.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {connections.map((connection) => (
        <a
          key={connection.mcpId}
          href={connection.authorizeUrl ?? undefined}
          className={cn(
            'flex items-center gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)] px-3 py-2 text-xs transition-colors hover:bg-[var(--persona-border,#e4e4e7)]/40 dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-card,#18181b)] dark:hover:bg-[var(--persona-border,#27272a)]/40',
            !connection.authorizeUrl && 'pointer-events-none opacity-50'
          )}
        >
          <Link2 className="size-3.5 shrink-0 text-[var(--persona-primary,#3b82f6)]" />
          <span className="min-w-0 flex-1 truncate text-[var(--persona-text,#27272a)] dark:text-[var(--persona-text,#e4e4e7)]">
            Connect <span className="font-semibold">{connection.name}</span> to unlock more of
            what I can do
          </span>
          <span className="shrink-0 rounded-lg bg-[var(--persona-primary,#18181b)] px-2.5 py-1 font-semibold text-white dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900">
            Connect
          </span>
        </a>
      ))}
    </div>
  );
}
