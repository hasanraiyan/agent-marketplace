"use client";

import * as React from "react";
import { FileTextIcon } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { ChatWorkspaceFile } from "./types";

/** Shown when the agent calls present_file — the file's live content. */
function WorkspaceFilePanel({
  file,
  onOpenChange,
}: {
  file: ChatWorkspaceFile | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!file} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{file?.title ?? file?.path}</span>
          </SheetTitle>
          {file?.description && (
            <SheetDescription>{file.description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-relaxed">
            {file?.content ?? "Loading…"}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { WorkspaceFilePanel };
