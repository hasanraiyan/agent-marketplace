"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * One-click copy for values that are tedious to select by hand (Key IDs,
 * the one-time minted secret). Swaps the icon to a check for ~1.6s.
 */
function CopyButton({
  value,
  label = "Copy",
  className,
  variant = "ghost",
  size = "sm",
}: {
  value: string;
  label?: string;
  className?: string;
  variant?: "ghost" | "outline" | "secondary" | "default" | "destructive" | "link";
  size?: "xs" | "sm" | "default" | "lg";
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (permission, non-secure context) — no-op.
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      aria-label={`${label}: copy to clipboard`}
      title={`Copy ${label}`}
      className={cn("gap-1", copied && "text-primary", className)}
    >
      {copied ? (
        <CheckIcon weight="bold" />
      ) : (
        <CopyIcon />
      )}
      {label && <span>{label}</span>}
    </Button>
  );
}

export { CopyButton };
