'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Check, Copy } from 'lucide-react';
import { cn } from '../utils/cn.js';

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className || '')?.[1];
  const text = String(children).replace(/\n$/, '');

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
      {language && (
        <div className="flex items-center justify-between bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          {language}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopy}
        title="Copy code"
        className={cn(
          'absolute right-2 top-2 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200/70 hover:text-zinc-700 group-hover/code:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
          !language && 'top-2'
        )}
      >
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      </button>
      <pre className="overflow-x-auto bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">
        <code className="whitespace-pre break-words font-mono">{text}</code>
      </pre>
    </div>
  );
}

export interface PersonaMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders assistant message content as Markdown — GFM (tables, strikethrough,
 * task lists), LaTeX ($inline$ / $$block$$ via KaTeX), and fenced code blocks
 * with a copy button.
 *
 * No rehype-raw / rehype-sanitize: react-markdown never parses raw HTML found
 * in the source text by default (it renders as literal escaped text) — that's
 * the actual XSS boundary here, and it's already in effect without either
 * plugin. Adding sanitize on top would need a KaTeX-aware schema (its output
 * classes aren't in rehype-sanitize's default allowlist) for no additional
 * safety, so it's deliberately left out rather than risked being misconfigured.
 */
export function PersonaMarkdown({ content, className }: PersonaMarkdownProps) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-2 text-[13px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="my-2 whitespace-pre-wrap break-words">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:decoration-blue-400"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-3 text-[15px] font-bold text-zinc-900 dark:text-zinc-100">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1 mt-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{children}</h4>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-zinc-300 pl-3 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-800" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-max border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-100 dark:bg-zinc-900">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-zinc-200 px-2.5 py-1.5 font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-zinc-100 px-2.5 py-1.5 text-zinc-600 last:border-b-0 dark:border-zinc-900 dark:text-zinc-400">
              {children}
            </td>
          ),
          code: ({ className: codeClassName, children }) => {
            // Fenced blocks carry a `language-*` className from remark; a bare
            // inline `code` span never does — that's the only reliable signal
            // react-markdown gives us to tell them apart.
            const isBlock = /language-/.test(codeClassName || '');
            if (isBlock) return <CodeBlock className={codeClassName}>{children}</CodeBlock>;
            return (
              <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
