"use client";

import * as React from "react";
import { TerminalIcon } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Spinner } from "@/components/ui/spinner";
import type { ChatToolCall } from "@/components/chat";

// Matches ANSI/CSI escape codes (e.g. from `curl -v`), which render as
// literal garbage (␛[1m...) instead of formatting in a plain <div>.
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, "");
}

interface SandboxTerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolCalls: ChatToolCall[];
}

function parseCommand(args: string | undefined): string {
  if (!args) return "";
  try {
    const parsed = JSON.parse(args) as { command?: unknown };
    return typeof parsed.command === "string" ? parsed.command : args;
  } catch {
    return args;
  }
}

/**
 * The sandbox's shell tool always returns `{ output, exitCode }`
 * (CodeSandboxBackend.execute, agent-backend/src/modules/sandbox) — but AG-UI
 * result payloads are opaque JSON strings by the time they reach the
 * frontend, so this stays defensive rather than assuming the shape.
 */
function parseResult(result: string | undefined): { output: string; exitCode: number | null } {
  if (!result) return { output: "", exitCode: null };
  try {
    const parsed = JSON.parse(result) as { output?: unknown; exitCode?: unknown };
    if (typeof parsed.output === "string") {
      return {
        output: parsed.output,
        exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : null,
      };
    }
  } catch {
    // not the { output, exitCode } shape — fall through to raw text
  }
  return { output: result, exitCode: null };
}

/**
 * Read-only, live transcript of the agent's sandbox activity — a terminal-
 * styled view over the same `execute` tool calls already streaming into the
 * chat (see agent-chat.tsx's `onToolCallsChange`). No polling, no fetch: a
 * pure derived view, so it stays in sync with the conversation for free.
 */
export function SandboxTerminalDialog({
  open,
  onOpenChange,
  toolCalls,
}: SandboxTerminalDialogProps) {
  const isMobile = useIsMobile();

  const entries = React.useMemo(
    () => toolCalls.filter((tc) => tc.name === "execute"),
    [toolCalls]
  );

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, entries]);

  const transcript = (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto bg-black px-4 py-3 font-mono text-xs text-zinc-100"
    >
      {entries.length === 0 ? (
        <p className="text-zinc-500">
          No commands have run yet — they&apos;ll appear here as the agent uses the sandbox.
        </p>
      ) : (
        entries.map((tc) => {
          const command = parseCommand(tc.args);
          const { output, exitCode } = parseResult(tc.result);
          return (
            <div key={tc.id} className="mb-3 whitespace-pre-wrap break-words">
              <div className="text-emerald-400">
                <span className="text-zinc-500">$ </span>
                {command}
              </div>
              {tc.status === "running" && !output ? (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400">
                  <Spinner className="size-3 text-zinc-400" />
                  running
                </div>
              ) : output ? (
                <div className="text-zinc-300">{stripAnsi(output)}</div>
              ) : null}
              {tc.status === "error" && (
                <div className="text-red-400">command failed</div>
              )}
              {exitCode !== null && exitCode !== 0 && (
                <div className="text-red-400">[exit {exitCode}]</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="w-full rounded-t-lg p-0 flex flex-col gap-0 overflow-hidden outline-none data-[side=bottom]:h-[96vh] data-[side=bottom]:min-h-[96vh] data-[side=bottom]:max-h-[96vh]"
        >
          <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3 bg-muted/20 shrink-0">
            <div>
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <TerminalIcon className="size-4 text-primary" />
                Sandbox Terminal
              </SheetTitle>
            </div>
          </SheetHeader>

          {transcript}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] h-[80vh] p-0 flex flex-col gap-0 overflow-hidden outline-none">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3 bg-muted/20 shrink-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <TerminalIcon className="size-4 text-primary" />
              Sandbox Terminal
            </DialogTitle>
          </div>
        </DialogHeader>

        {transcript}
      </DialogContent>
    </Dialog>
  );
}
