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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageMarkdown } from "./message-markdown";
import type { ChatWorkspaceFile } from "./types";

// Extension -> fence language tag, so Shiki (via the `code` plugin wired into
// MessageMarkdown) highlights it the same way a fenced code block in chat
// would. Falls back to the bare extension for anything not listed here —
// Shiki accepts most language ids directly (e.g. "py", "go", "rs").
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

function getExtension(path: string | undefined): string {
  if (!path) return "";
  const match = /\.([a-zA-Z0-9]+)$/.exec(path);
  return match ? match[1].toLowerCase() : "";
}

function fence(content: string, language: string): string {
  return "```" + language + "\n" + content + "\n```";
}

/**
 * Shown when the agent calls present_file — the file's live content.
 * Markdown files get a Preview/Code toggle (rendered as real markdown, or as
 * syntax-highlighted literal source); every other extension is shown as a
 * single syntax-highlighted block, both routed through the same
 * MessageMarkdown/Shiki pipeline used for chat messages rather than a
 * separate renderer.
 */
function WorkspaceFilePanel({
  file,
  onOpenChange,
}: {
  file: ChatWorkspaceFile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const extension = getExtension(file?.path);
  const isMarkdown = extension === "md" || extension === "mdx";
  const content = file?.content ?? "";
  const language = EXTENSION_LANGUAGE_MAP[extension] ?? extension ?? "text";
  const isMobile = useIsMobile();

  const titleRow = (
    <SheetTitle className="flex min-w-0 items-center gap-2">
      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{file?.title ?? file?.path}</span>
    </SheetTitle>
  );

  return (
    <Sheet open={!!file} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="w-full sm:max-w-lg data-[side=bottom]:min-h-[60%] data-[side=bottom]:max-h-[85vh]"
      >
        {!file ? (
          <>
            <SheetHeader className="border-b border-border">{titleRow}</SheetHeader>
            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
              <p className="text-xs text-muted-foreground">Loading…</p>
            </div>
          </>
        ) : isMarkdown ? (
          <Tabs defaultValue="preview" className="flex flex-1 flex-col gap-0">
            <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border">
              {titleRow}
              <TabsList className="mr-8 shrink-0">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>
            </SheetHeader>
            {file.description && (
              <SheetDescription className="px-4">{file.description}</SheetDescription>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <TabsContent value="preview">
                <MessageMarkdown content={content} />
              </TabsContent>
              <TabsContent value="code">
                <MessageMarkdown content={fence(content, "markdown")} />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <>
            <SheetHeader className="border-b border-border">
              {titleRow}
              {file.description && <SheetDescription>{file.description}</SheetDescription>}
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <MessageMarkdown content={fence(content, language)} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export { WorkspaceFilePanel };
