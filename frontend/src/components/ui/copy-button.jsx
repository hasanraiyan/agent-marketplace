"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A copy-to-clipboard button — the developer-ergonomics affordance every
 * resource id/key on the Developer Studio surface should carry, since this
 * surface exists for people pasting ids into their own code. Consolidates
 * the inline `navigator.clipboard.writeText` + toast pattern that was
 * previously copy-pasted in 8 separate places across the app (credential
 * secret dialog, skill detail, several AG-UI panels) into one component.
 *
 * @param {string} value - The text to copy.
 * @param {string} [label] - What to name it in the toast, e.g. "Agent ID".
 * @param {"icon"|"inline"} [variant] - "icon" (default): bare icon button,
 *   for placing next to a value already shown elsewhere. "inline": shows
 *   the value itself in a monospace chip with a trailing copy icon — for
 *   table cells/detail rows where nothing else renders the id.
 */
export function CopyButton({
  value,
  label = "Value",
  variant = "icon",
  className,
}) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef(null);

  React.useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error(`Couldn't copy ${label.toLowerCase()}.`);
      return;
    }
    setCopied(true);
    toast.success(`${label} copied to clipboard`);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied ? Check : Copy;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${label.toLowerCase()}`}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <span className="truncate">{value}</span>
        <Icon
          className={cn(
            "size-3 shrink-0",
            copied
              ? "text-emerald-500"
              : "text-muted-foreground/70 group-hover:text-foreground",
          )}
        />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={handleCopy}
      title={`Copy ${label.toLowerCase()}`}
    >
      <Icon className={cn("size-3.5", copied && "text-emerald-500")} />
    </Button>
  );
}
