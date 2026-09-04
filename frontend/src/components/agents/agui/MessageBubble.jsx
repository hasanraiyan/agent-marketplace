"use client";

import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ExpandableContent } from "./ExpandableContent";
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

function formatElapsed(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

// Claude-style thinking block, adapted from JimLiu/claude-agent-kit (MIT)
// thinking-details.tsx: italic collapsible header, auto-open while streaming,
// auto-collapse when done, long traces fade behind [Show more].
function ReasoningBubble({ message, isStreaming = false }) {
  // Open state derives from the live stream (open while thinking,
  // collapsed when done) unless the user toggles it manually.
  const [manualOpen, setManualOpen] = useState(null);
  const open = manualOpen ?? isStreaming;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isStreaming) return;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [isStreaming]);

  const startedAt =
    typeof message.timestamp === "number" ? message.timestamp : now;
  const liveElapsed = formatElapsed(Math.max(0, now - startedAt));
  // Shown once the backend stamps reasoning with a duration; until then a
  // finished block simply reads "Thought".
  const doneElapsed =
    typeof message.durationMs === "number"
      ? formatElapsed(message.durationMs)
      : null;

  return (
    <div className="max-w-[92%] text-slate-500 dark:text-slate-400">
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[13px] font-medium italic opacity-80 transition-opacity select-none hover:opacity-100"
      >
        {isStreaming ? (
          <ThinkingIndicator />
        ) : (
          <span>
            {message.content
              ? `Thought${doneElapsed ? ` for ${doneElapsed}` : ""}`
              : "Thinking"}
          </span>
        )}
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>
      {open ? (
        <div className="ml-1 border-l-2 border-slate-200 pl-3 text-sm leading-6 font-normal dark:border-slate-700">
          {message.content ? (
            <ExpandableContent maxHeight={250}>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 text-slate-500 dark:text-slate-400">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </ExpandableContent>
          ) : (
            <span className="text-[13px] italic opacity-70">
              {isStreaming
                ? `Started ${liveElapsed} ago`
                : "No reasoning captured."}
            </span>
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
export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
}) {
  const isUser = message.role === "user";

  if (message.role === "reasoning") {
    return <ReasoningBubble message={message} isStreaming={isStreaming} />;
  }

  if (!isUser && !message.content) return null;

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "min-w-0 text-[15px] leading-7",
          isUser
            ? "max-w-[75%] rounded-2xl rounded-br-md bg-[#1E60FF] px-4 py-3 text-white shadow-sm"
            : "max-w-[92%] text-slate-900 dark:text-slate-100",
        )}
      >
        <div
          className={cn(
            "prose prose-sm max-w-none break-words prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1",
            isUser
              ? "prose-invert [&_*]:text-white text-white"
              : "dark:prose-invert",
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
      </div>
    </div>
  );
});
