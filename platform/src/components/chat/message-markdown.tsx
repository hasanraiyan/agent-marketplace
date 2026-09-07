"use client";

import * as React from "react";
import { Streamdown } from "streamdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Every markdown render in the library goes through this one wrapper.
 * `Streamdown` is purpose-built for partial/incomplete markdown mid-stream
 * (unclosed code fences, half-written tables) — the exact problem the
 * NotebookChat.js reference solved by hand, switching between a raw
 * streaming renderer and a full block renderer once a message finished.
 * One renderer, used for both states, is simpler and doesn't need that split.
 */
function MessageMarkdown({
  className,
  content,
}: {
  className?: string;
  content: string;
}) {
  return (
    <Streamdown
      className={cn(
        "max-w-none text-xs/relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        "[&_code]:rounded-none [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-sm [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-2.5",
        "[&_table]:my-2 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1",
        className
      )}
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </Streamdown>
  );
}

export { MessageMarkdown };
