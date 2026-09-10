"use client";

import * as React from "react";
import { Streamdown } from "streamdown";
import remarkGfm from "remark-gfm";
import { code } from "@streamdown/code";
import { cn } from "@/lib/utils";

interface DocsRendererProps {
  content: string;
  className?: string;
}

export function DocsRenderer({ content, className }: DocsRendererProps) {
  return (
    <div
      className={cn(
        "docs-content w-full max-w-none text-foreground",
        className
      )}
    >
      <Streamdown
        className={cn(
          "text-sm/relaxed space-y-4",
          // Headings
          "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2",
          "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-border/60 [&_h2]:pb-1.5",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mt-6 [&_h3]:mb-2",
          "[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-1",
          // Paragraphs & Lists
          "[&_p]:my-3 [&_p]:leading-7",
          "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5",
          "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5",
          "[&_li]:leading-relaxed",
          // Links: high-contrast blue
          "[&_a]:text-blue-600 dark:text-blue-400 [&_a]:underline [&_a]:underline-offset-4 [&_a]:font-medium hover:[&_a]:text-blue-700 dark:hover:[&_a]:text-blue-300",
          // Inline code chips
          "[&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[13px] [&_code:not(pre_code)]:border [&_code:not(pre_code)]:border-border/60 [&_code:not(pre_code)]:font-medium",
          // Fenced Code blocks
          "[&_[data-streamdown=code-block]]:my-5 [&_[data-streamdown=code-block]]:rounded-lg [&_[data-streamdown=code-block]]:border [&_[data-streamdown=code-block]]:border-border [&_[data-streamdown=code-block]]:overflow-hidden [&_[data-streamdown=code-block]]:shadow-xs",
          "[&_[data-streamdown=code-block-header]]:bg-muted/80 [&_[data-streamdown=code-block-header]]:px-4 [&_[data-streamdown=code-block-header]]:py-2 [&_[data-streamdown=code-block-header]]:border-b [&_[data-streamdown=code-block-header]]:border-border [&_[data-streamdown=code-block-header]]:text-xs [&_[data-streamdown=code-block-header]]:font-mono",
          "[&_[data-streamdown=code-block-body]]:p-4 [&_[data-streamdown=code-block-body]]:text-[13px] [&_[data-streamdown=code-block-body]]:font-mono [&_[data-streamdown=code-block-body]]:leading-relaxed",
          // Blockquotes / callouts
          "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-600 [&_blockquote]:bg-blue-50/60 dark:bg-blue-950/20 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:rounded-r-md [&_blockquote]:text-foreground/90 [&_blockquote_p]:my-1",
          // Tables
          "[&_table]:w-full [&_table]:my-6 [&_table]:border-collapse [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:text-sm",
          "[&_th]:bg-muted/60 [&_th]:border [&_th]:border-border [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold",
          "[&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2.5 [&_td]:leading-relaxed",
          "[&_tr:nth-child(even)]:bg-muted/30",
          // Horizontal rule
          "[&_hr]:my-8 [&_hr]:border-border"
        )}
        remarkPlugins={[remarkGfm]}
        plugins={{ code }}
      >
        {content}
      </Streamdown>
    </div>
  );
}
