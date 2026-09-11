"use client";

import * as React from "react";
import { CopyIcon, CheckIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MermaidExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mermaidText: string;
}

export function MermaidExportDialog({
  open,
  onOpenChange,
  mermaidText,
}: MermaidExportDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mermaidText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <TreeStructureIcon className="size-5 text-primary" />
            <DialogTitle>Mermaid Flowchart Export</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Use this Mermaid markdown diagram to embed your workflow in GitHub READMEs, PRs, or docs.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <pre className="p-4 rounded-lg bg-muted/60 border border-border font-mono text-xs overflow-x-auto max-h-96 text-foreground">
            {mermaidText || "(No nodes to display)"}
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="absolute top-2.5 right-2.5 h-7 gap-1.5 px-2.5 text-xs bg-background/90 backdrop-blur"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon className="size-3" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
