"use client";

import * as React from "react";
import { TerminalIcon } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Spinner } from "@/components/ui/spinner";
import type { PersonaSandboxCommand } from "@personaai/react";

// Matches ANSI/CSI escape codes (e.g. from `curl -v`), which render as
// literal garbage (␛[1m...) instead of formatting in a plain <div>.
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, "");
}

export interface SandboxTerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `useChat()`'s own `sandboxCommands` — already parsed `execute` tool calls, no adapter needed. */
  commands: PersonaSandboxCommand[];
}

/**
 * Read-only, live transcript of the agent's sandbox activity — a terminal-
 * styled view directly over `@personaai/react`'s `useChat()`'s own
 * `sandboxCommands` (derived from the same `execute` tool calls already
 * streaming into the chat). No polling, no fetch: a pure derived view, so
 * it stays in sync with the conversation for free.
 */
export function SandboxTerminalDialog({ open, onOpenChange, commands }: SandboxTerminalDialogProps) {
  const isMobile = useIsMobile();

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, commands]);

  const transcript = (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto bg-black px-4 py-3 font-mono text-xs text-zinc-100"
    >
      {commands.length === 0 ? (
        <p className="text-zinc-500">
          No commands have run yet — they&apos;ll appear here as the agent uses the sandbox.
        </p>
      ) : (
        commands.map((cmd) => (
          <div key={cmd.toolCallId} className="mb-3 whitespace-pre-wrap break-words">
            <div className="text-emerald-400">
              <span className="text-zinc-500">$ </span>
              {cmd.command}
            </div>
            {cmd.status === "running" && !cmd.output ? (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400">
                <Spinner className="size-3 text-zinc-400" />
                running
              </div>
            ) : cmd.output ? (
              <div className="text-zinc-300">{stripAnsi(cmd.output)}</div>
            ) : null}
            {cmd.status === "error" && <div className="text-red-400">command failed</div>}
            {cmd.exitCode != null && cmd.exitCode !== 0 && (
              <div className="text-red-400">[exit {cmd.exitCode}]</div>
            )}
          </div>
        ))
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex w-full flex-col gap-0 overflow-hidden rounded-t-lg p-0 outline-none data-[side=bottom]:h-[96vh] data-[side=bottom]:min-h-[96vh] data-[side=bottom]:max-h-[96vh]"
        >
          <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <TerminalIcon className="size-4 text-primary" />
              Sandbox Terminal
            </SheetTitle>
          </SheetHeader>
          {transcript}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[95vw] flex-col gap-0 overflow-hidden p-0 outline-none sm:max-w-4xl">
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <TerminalIcon className="size-4 text-primary" />
            Sandbox Terminal
          </DialogTitle>
        </DialogHeader>
        {transcript}
      </DialogContent>
    </Dialog>
  );
}
