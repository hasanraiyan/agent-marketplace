"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-css";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import { cn } from "@/lib/utils";

function ReasoningBubble({ message }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-[92%]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Thoughts
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>
      {open ? (
        <div className="ml-3 border-l border-slate-200 pl-3 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400 prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <ThinkingText label="Thinking" />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ThinkingText() {
  return (
    <span className="inline-flex items-center py-1.5">
      <span className="inline-flex gap-1.2">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce" />
      </span>
    </span>
  );
}

export function NewChatIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const getGrammar = (lang) => {
    const l = lang.toLowerCase();
    if (l === "js" || l === "javascript") return Prism.languages.javascript;
    if (l === "ts" || l === "typescript") return Prism.languages.typescript;
    if (l === "py" || l === "python") return Prism.languages.python;
    if (l === "json") return Prism.languages.json;
    if (l === "html") return Prism.languages.markup;
    if (l === "css") return Prism.languages.css;
    if (l === "md" || l === "markdown") return Prism.languages.markdown;
    if (l === "bash" || l === "sh") return Prism.languages.bash;
    if (l === "sql") return Prism.languages.sql;
    if (l === "yaml" || l === "yml") return Prism.languages.yaml;
    return Prism.languages[l] || Prism.languages.markup;
  };

  const highlighted = (() => {
    try {
      const grammar = getGrammar(language);
      if (grammar) {
        return Prism.highlight(value, grammar, language);
      }
    } catch (e) {
      console.error(e);
    }
    return value;
  })();

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D1117] shadow-xs">
      <div className="flex items-center justify-between bg-slate-100/80 dark:bg-[#161B22]/80 px-4 py-1.5 text-xs text-slate-500 dark:text-slate-400 font-sans select-none border-b border-slate-200 dark:border-slate-800">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-green-600 dark:text-green-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto scrollbar-thin select-text">
        <pre className="m-0 bg-transparent p-0 font-mono text-[13px] leading-6 text-slate-800 dark:text-[#E6EDF2]">
          {highlighted !== value ? (
            <code
              className={`language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          ) : (
            <code className={`language-${language}`}>{value}</code>
          )}
        </pre>
      </div>
    </div>
  );
}

const markdownComponents = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const codeValue = String(children).replace(/\n$/, "");

    if (!inline) {
      return <CodeBlock language={language || "text"} value={codeValue} />;
    }

    return (
      <code
        className={cn(
          "px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono break-all",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
};

// Memoized: during token streaming only the active message object changes
// identity (replaceById keeps the rest), so re-parsing every bubble's markdown
// on every frame is pure waste.
export const MessageBubble = memo(function MessageBubble({ message, agent }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  if (message.role === "reasoning") {
    return <ReasoningBubble message={message} />;
  }

  if (!isUser && !message.content) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  // ── User turn: a quiet bubble on the right, plain text preserved ────────
  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[78%] rounded-[20px] rounded-br-lg bg-zinc-100 px-4 py-2.5 font-sans text-[15px] leading-7 tracking-[-0.005em] text-zinc-900 antialiased [font-feature-settings:'cv11','ss01','ss03'] dark:bg-zinc-800 dark:text-zinc-100">
          <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap prose-p:my-0 prose-zinc dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // ── Assistant turn: avatar + name, then comfortable prose ───────────────
  const avatar = agent?.avatarUrl || agent?.avatar;
  const name = agent?.name || "Assistant";
  return (
    <div className="group/msg flex w-full gap-3">
      <div className="mt-0.5 size-7 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:ring-zinc-700">
        {avatar ? (
          <img src={avatar} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-[11px] font-bold text-zinc-500">
            {name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-sans text-[12px] font-semibold tracking-[0.01em] text-zinc-500 dark:text-zinc-400">
          {name}
        </div>
        <div
          className={cn(
            "prose prose-zinc max-w-none break-words font-sans text-[15.5px] leading-[1.75] tracking-[-0.006em] text-zinc-900 antialiased [font-feature-settings:'cv11','ss01','ss03'] dark:prose-invert dark:text-zinc-100",
            "prose-p:my-2.5 prose-li:my-1 prose-ul:my-2.5 prose-ol:my-2.5 prose-ul:pl-5 prose-ol:pl-5 prose-li:marker:text-zinc-400",
            "prose-headings:font-display prose-headings:font-medium prose-headings:tracking-[-0.01em] prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100 prose-h1:text-[22px] prose-h1:mt-5 prose-h1:mb-2 prose-h2:text-[19px] prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-[16.5px] prose-h3:mt-4 prose-h3:mb-1.5",
            "prose-code:font-mono prose-code:text-[13px] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
            "prose-strong:font-semibold prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-a:text-[#1E60FF] prose-a:no-underline hover:prose-a:underline",
            "prose-blockquote:border-l-2 prose-blockquote:border-zinc-200 prose-blockquote:pl-4 prose-blockquote:text-zinc-600 prose-blockquote:not-italic",
            "prose-hr:my-4 prose-hr:border-zinc-200",
            "prose-table:my-3 prose-table:text-[13.5px] prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold prose-td:px-3 prose-td:py-1.5 prose-tr:border-zinc-200",
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
          <button
            type="button"
            onClick={copy}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 cursor-pointer"
            title="Copy"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-green-600" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
