"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  BotIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  FileCode,
  FileJson,
  FileText,
  Globe,
  Hash,
  ImagePlus,
  Loader2,
  PencilLine,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  Terminal,
  Type,
  Wrench,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAguiChat } from "@/lib/agui/use-agui-chat";
import Editor from "@monaco-editor/react";
import SimpleEditor from "react-simple-code-editor";
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
import "prismjs/themes/prism.css";
import { useTheme } from "next-themes";

function getFileIcon(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return <FileCode className="size-4 text-amber-400" />;
    case "json":
      return <FileJson className="size-4 text-amber-500" />;
    case "py":
      return <Code className="size-4 text-blue-500" />;
    case "md":
      return <FileText className="size-4 text-slate-400" />;
    case "css":
    case "scss":
      return <Hash className="size-4 text-pink-500" />;
    case "html":
      return <Globe className="size-4 text-orange-500" />;
    case "sh":
    case "bash":
    case "zsh":
      return <Terminal className="size-4 text-emerald-500" />;
    case "c":
    case "cpp":
    case "h":
      return <FileCode className="size-4 text-slate-600" />;
    default:
      return <FileText className="size-4 text-slate-400" />;
  }
}

function getLanguage(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "markup";
    case "sh":
    case "bash":
      return "bash";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "markup";
  }
}

function tryParseJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getSuggestedPrompts(agent) {
  const name = (agent?.name || "Agent").toLowerCase();
  const category = (agent?.category || "").toLowerCase();

  if (name.includes("architect") || name.includes("sage")) {
    return [
      {
        title: "Build a new coding assistant agent",
        prompt: "Help me design a new Python Coding Assistant agent. I want it to focus on writing clean code and using web search.",
      },
      {
        title: "Optimize an existing agent's prompt",
        prompt: "I want to improve the system prompt of my writing assistant agent. Can you help me make it sound more professional?",
      },
      {
        title: "Explain how skills and providers work",
        prompt: "What is the difference between an Agent's Skills and its Model Provider? How do I configure Tavily search?",
      },
    ];
  }

  if (
    category.includes("code") ||
    category.includes("dev") ||
    category.includes("software") ||
    name.includes("code") ||
    name.includes("dev")
  ) {
    return [
      {
        title: "Find a bug in my code",
        prompt: "I have a bug in my React component where state updates are lagging. Can you help me debug it?",
      },
      {
        title: "Write a utility function",
        prompt: "Write a high-performance helper function in TypeScript to parse and format nested JSON structures.",
      },
      {
        title: "Explain a software concept",
        prompt: "Can you explain the difference between client-side rendering (CSR) and server-side rendering (SSR) in Next.js?",
      },
    ];
  }

  return [
    {
      title: "Explore capabilities",
      prompt: `What are your core capabilities as a ${agent?.name || "Agent"} agent, and how can you help me today?`,
    },
    {
      title: "Start a planning session",
      prompt: "Help me brainstorm and write a structured project outline for my next task.",
    },
    {
      title: "Analyze some text or data",
      prompt: "I'd like to share some text/code with you to get your feedback and suggestions for improvement.",
    },
  ];
}

function queryFromArgs(argsText) {
  const parsed = tryParseJson(argsText);
  const value =
    parsed?.query ||
    parsed?.q ||
    parsed?.search_query ||
    parsed?.text ||
    parsed?.input;
  if (value) return String(value);
  return argsText?.trim().startsWith("{") ? "" : argsText?.trim() || "";
}

function toolTitle(tool) {
  const name = tool.name?.toLowerCase() || "tool";
  const query = queryFromArgs(tool.argumentsText);

  if (name.includes("search") || name.includes("google")) {
    if (query) {
      return tool.status === "completed"
        ? `Searched the web for "${query}"`
        : `Searching the web for "${query}"`;
    }
    return tool.status === "completed"
      ? "Searched the web"
      : "Searching the web";
  }

  if (name.includes("todo")) return "Updated the plan";
  if (name.includes("file") || name === "ls" || name === "glob") {
    return tool.status === "completed" ? "Updated files" : "Working with files";
  }

  return name
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function searchResults(tool) {
  const parsed = tryParseJson(tool.resultText);
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed)) return parsed;
  return [];
}

function MessageBubble({ message, agent }) {
  const isUser = message.role === "user";

  if (message.role === "reasoning") {
    return <ReasoningBubble message={message} />;
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
        {!isUser && agent ? (
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Avatar className="size-6">
              <AvatarImage
                src={agent.avatarUrl || agent.avatar}
                alt={agent.name}
              />
              <AvatarFallback className="bg-slate-100 text-slate-500">
                <BotIcon className="size-3" />
              </AvatarFallback>
            </Avatar>
            {agent.name || "Agent"}
          </div>
        ) : null}
        <div
          className={cn(
            "prose prose-sm max-w-none break-words prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1",
            isUser ? "prose-invert" : "dark:prose-invert",
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function ReasoningBubble({ message, active = false }) {
  const [open, setOpen] = useState(active);

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

function ThinkingText({ label = "Thinking" }) {
  return (
    <span className="inline-flex animate-pulse items-center text-sm font-medium text-slate-500 dark:text-slate-400">
      {label}
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

function ToolTrace({ tool }) {
  const [open, setOpen] = useState(false);
  const done = tool.status === "completed";
  const results = searchResults(tool);
  const parsedResult = tryParseJson(tool.resultText);
  const isError = parsedResult?.status === "error";
  const isSearch = tool.name?.toLowerCase().includes("search");
  const isExpandable = Boolean(tool.resultText || tool.argumentsText);
  const Icon = isError
    ? AlertCircle
    : isSearch
      ? Globe
      : tool.name?.includes("file")
        ? FileText
        : Wrench;

  return (
    <div className="max-w-[92%]">
      <button
        type="button"
        onClick={() => isExpandable && setOpen((value) => !value)}
        className="group flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex w-6 flex-col items-center pt-0.5">
          <Icon
            className={cn(
              "size-[18px]",
              isError
                ? "text-red-500"
                : done
                  ? "text-slate-400"
                  : "animate-pulse text-orange-500",
            )}
          />
          <span className="mt-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {toolTitle(tool)}
            </span>
            {isExpandable ? (
              open ? (
                <ChevronUp className="size-4 text-slate-400" />
              ) : (
                <ChevronDown className="size-4 text-slate-400" />
              )
            ) : null}
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium",
                isError
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-[#1E60FF]/10 text-[#1E60FF]",
              )}
            >
              {isError
                ? "Failed"
                : isSearch && done && results.length
                  ? `${results.length} results`
                  : done
                    ? "Result"
                    : "Running"}
            </span>
          </span>
        </span>
      </button>

      {isError ? (
        <div className="ml-8 mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {parsedResult.message || "The tool call failed."}
        </div>
      ) : null}

      {open ? (
        <div className="ml-8 mt-1 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/70">
          {results.length ? (
            <div className="max-h-48 overflow-auto">
              {results.map((result, index) => (
                <a
                  key={result.url || index}
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white dark:hover:bg-slate-800"
                >
                  <Search className="size-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                    {result.title || result.url}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {getDomain(result.url || "")}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-600 dark:text-slate-300">
              {tool.resultText || tool.argumentsText || "No result yet."}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}

function prettyToolName(name) {
  return (name || "tool")
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function ApprovalCard({ approval, onRespond, disabled }) {
  const actions = approval?.actionRequests || [];
  if (!actions.length) return null;

  const approve = () =>
    onRespond(
      actions.map(() => ({ type: "approve" })),
      { displayText: "Approved" },
    );
  const reject = () =>
    onRespond(
      actions.map(() => ({
        type: "reject",
        message: "User rejected the action.",
      })),
      { displayText: "Rejected" },
    );

  return (
    <div className="max-w-[92%] rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
        <ShieldAlert className="size-4" />
        Approval required
      </div>
      <div className="mt-3 space-y-3">
        {actions.map((action, index) => (
          <div
            key={index}
            className="rounded-xl border border-amber-200/70 bg-white/70 p-3 dark:border-amber-500/20 dark:bg-slate-900/50"
          >
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {prettyToolName(action.name)}
            </div>
            {action.args && Object.keys(action.args).length > 0 ? (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-600 dark:text-slate-300">
                {JSON.stringify(action.args, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={approve}
          disabled={disabled}
          className="rounded-full bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
        >
          <Check className="mr-1 size-4" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={reject}
          disabled={disabled}
          className="rounded-full px-4 font-bold"
        >
          <X className="mr-1 size-4" />
          Reject
        </Button>
        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
          or reply below with feedback
        </span>
      </div>
    </div>
  );
}

function ClarificationCard({ clarification, onRespond, disabled }) {
  const question = clarification?.questions?.[clarification.currentIndex || 0];
  const currentIndex = clarification?.currentIndex || 0;
  const total = clarification?.questions?.length || 0;

  if (!question) return null;

  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#f7f7f5] shadow-[0_16px_40px_rgba(15,23,42,0.10)] dark:border-[#3f3f3a] dark:bg-[#33332f] dark:shadow-none">
      <div className="flex h-14 items-center gap-3 px-5">
        <div className="min-w-0 flex-1 text-[15px] font-semibold leading-5 text-slate-950 dark:text-[#f2f2ec]">
          {question.text}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500 dark:text-[#aaa9a2]">
          {total > 1 ? (
            <>
              <button
                type="button"
                disabled
                className="flex size-6 items-center justify-center rounded-md opacity-45"
                aria-label="Previous question"
              >
                <ChevronDown className="size-4 rotate-90" />
              </button>
              <span className="tabular-nums">
                {currentIndex + 1} of {total}
              </span>
              <button
                type="button"
                disabled
                className="flex size-6 items-center justify-center rounded-md opacity-45"
                aria-label="Next question"
              >
                <ChevronDown className="size-4 -rotate-90" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onRespond({ skipped: true })}
            disabled={disabled}
            className="ml-1 flex size-7 items-center justify-center rounded-md hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
            aria-label="Dismiss clarification"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="px-2 pb-2">
        {(question.options || []).map((option, index) => (
          <button
            key={`${question.id}-${option}-${index}`}
            type="button"
            onClick={() =>
              onRespond({
                answer: option,
                optionIndex: index,
                freeform: false,
              })
            }
            disabled={disabled}
            className={cn(
              "group flex h-[52px] w-full items-center gap-3 border-b border-slate-200/80 px-3 text-left transition last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#464640]",
              index === 0
                ? "rounded-xl bg-white/55 dark:bg-white/[0.06]"
                : "hover:bg-white/45 dark:hover:bg-white/[0.05]",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-sm font-semibold text-slate-600 group-hover:bg-slate-300 dark:bg-[#474742] dark:text-[#d5d3ca] dark:group-hover:bg-[#55554f]">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-800 dark:text-[#dedcd3]">
              {option}
            </span>
            <ArrowRight className="size-4 text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-[#a4a199]" />
          </button>
        ))}

        {question.allowCustom !== false ? (
          <div className="flex h-[52px] items-center gap-3 px-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-600 dark:bg-[#474742] dark:text-[#d5d3ca]">
              <PencilLine className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-500 dark:text-[#aaa9a2]">
              Something else
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isRunning,
  disabled,
  placeholder = "Write a message...",
}) {
  const canSend = value.trim().length > 0 && !disabled && !isRunning;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-[#3f3f3a] dark:bg-[#272724]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (isRunning) onStop();
            else if (canSend) onSend();
          }
        }}
        disabled={disabled || isRunning}
        placeholder={placeholder}
        rows={1}
        className="max-h-32 min-h-8 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:placeholder:text-[#aaa9a2]"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          disabled
        >
          <ImagePlus className="size-4" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Flash
            <ChevronDown className="size-3.5 text-slate-400" />
          </button>
          <Button
            type="button"
            size="icon"
            onClick={isRunning ? onStop : onSend}
            disabled={!isRunning && !canSend}
            className={cn(
              "size-10 rounded-full",
              isRunning
                ? "bg-red-50 text-red-500 hover:bg-red-100"
                : "bg-[#1E60FF]/10 text-[#1E60FF] hover:bg-[#1E60FF]/15",
            )}
          >
            {isRunning ? (
              <Square className="size-4 fill-current" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AguiFilesPanel({ state, open, onOpenChange }) {
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  const files = Object.entries(state?.files || {}).map(([path, data]) => ({
    path,
    content: data?.content || "",
    size: data?.size || 0,
  }));
  const active = files.find((file) => file.path === selected);

  const handleCopy = () => {
    if (!active) return;
    navigator.clipboard.writeText(active.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  if (!files.length) return null;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-slate-200 bg-white transition-all duration-300 lg:static lg:z-0 dark:border-slate-800 dark:bg-slate-950",
        open
          ? "translate-x-0 shadow-2xl lg:shadow-none lg:w-[450px] xl:w-[600px]"
          : "translate-x-full lg:w-0 lg:translate-x-0 lg:border-none lg:opacity-0",
        "overflow-hidden",
      )}
    >
      <div className="flex h-14 shrink-0 flex-col items-start justify-center px-4 dark:border-slate-800">
        <div className="flex w-full items-center gap-2">
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Project Explorer</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-8"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="text-[11px] font-bold text-slate-400">{files.length}</div>
      </div>
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
            {getFileIcon(active.path)}
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
              {active.path}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleCopy}
                title="Copy code"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Code className="size-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSelected(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-white p-4">
            <SimpleEditor
              value={active.content}
              onValueChange={() => {}}
              highlight={(code) => {
                const lang = getLanguage(active.path);
                const grammar = Prism.languages[lang] || Prism.languages.markup;
                return Prism.highlight(code, grammar, lang);
              }}
              padding={10}
              readOnly
              textareaClassName="focus:outline-none"
              className="focus:outline-none"
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: 13,
                outline: "none",
                minHeight: "100%",
                color: "#1a1a1a",
                caretColor: "transparent",
              }}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 border-y border-slate-100 bg-slate-50/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
            Files
          </div>
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelected(file.path)}
                className="group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="mt-0.5">{getFileIcon(file.path)}</div>
                <div className="min-w-0 flex-1">
                  <div className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {file.path.split("/").pop()}
                  </div>
                  <div className="block truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    {file.path}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function AguiAgentChat({
  agent,
  url,
  agentId,
  threadId,
  headers,
  initialMessages = [],
  initialState = {},
  title = "Sage",
  emptyTitle = "Sage",
  emptyDescription = "Tell me what you want to build, change, or explore.",
  className,
  onToolResult,
  onStateChange,
  onNewChat,
  onRunFinished,
  showHeader = true,
  contentClassName,
}) {
  const [input, setInput] = useState("");
  const [resettingChat, setResettingChat] = useState(false);
  const scrollRef = useRef(null);
  const chat = useAguiChat({
    url,
    agentId,
    threadId,
    headers,
    initialMessages,
    initialState,
    onToolResult,
    onRunFinished,
  });

  const startNewChat = async () => {
    setInput("");
    if (!onNewChat) {
      chat.clear();
      return;
    }
    // Parent creates a fresh backend thread; local state resets when the
    // threadId prop changes. Fall back to a local clear only on failure.
    setResettingChat(true);
    try {
      await onNewChat();
    } catch (err) {
      console.error("Failed to start a new chat thread:", err);
      chat.clear();
    } finally {
      setResettingChat(false);
    }
  };

  useEffect(() => {
    onStateChange?.(chat.agentState);
  }, [chat.agentState, onStateChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  const send = () => {
    const text = input;
    setInput("");
    chat.send(text);
  };

  const messageById = (messageId) =>
    chat.messages.find((message) => message.id === messageId);
  const toolById = (toolId) =>
    chat.toolCalls.find((tool) => tool.id === toolId);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-white dark:bg-slate-950",
        className,
      )}
    >
      {showHeader ? (
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#1E60FF]/10 text-[#1E60FF]">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-950 dark:text-white">
              {title}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            onClick={startNewChat}
            disabled={resettingChat}
            title="New Chat"
          >
            {resettingChat ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <NewChatIcon className="size-4" />
            )}
          </Button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {chat.conversation.length === 0 &&
        !chat.pendingApproval &&
        !chat.pendingClarification ? (
          <div
            className={cn(
              "mx-auto flex h-full w-full max-w-4xl flex-col justify-center px-4 py-8 md:py-16",
              contentClassName,
            )}
          >
            <div className="flex flex-col items-start text-left">
              {/* Avatar Circle */}
              <Avatar className="size-16 border border-slate-200/85 dark:border-slate-800">
                <AvatarImage
                  src={agent?.avatarUrl || agent?.avatar}
                  alt={agent?.name || "Agent"}
                />
                <AvatarFallback className="bg-slate-100 dark:bg-slate-900 text-slate-500">
                  <BotIcon className="size-8 text-slate-400" />
                </AvatarFallback>
              </Avatar>

              {/* Info Card */}
              <div className="mt-6 w-full rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-950">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  {agent?.name || emptyTitle}
                  {agent?.modelName && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800/50">
                      {agent.modelName}
                    </span>
                  )}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {agent?.description || emptyDescription}
                </p>
                {agent?.category && (
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <span>{agent.category}</span>
                  </div>
                )}
              </div>

              {/* Suggested Prompts List */}
              <div className="mt-6 w-full space-y-2">
                {getSuggestedPrompts(agent).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInput(item.prompt);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-700 transition-all duration-200 hover:border-[#1E60FF] hover:bg-[#1E60FF]/5 hover:text-[#1E60FF] dark:border-slate-800/60 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-[#1E60FF] dark:hover:bg-[#1E60FF]/10 dark:hover:text-blue-400 cursor-pointer"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 ml-2">
                      Use Prompt →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto w-full max-w-4xl space-y-4",
              contentClassName,
            )}
          >
            {chat.conversation.map((entry) => {
              if (entry.type === "message") {
                const message = messageById(entry.refId);
                return message ? (
                  <MessageBubble
                    key={entry.id}
                    message={message}
                    agent={agent}
                  />
                ) : null;
              }
              const tool = toolById(entry.refId);
              return tool ? <ToolTrace key={entry.id} tool={tool} /> : null;
            })}
            {chat.pendingApproval ? (
              <ApprovalCard
                approval={chat.pendingApproval}
                onRespond={chat.respondToApproval}
                disabled={chat.isRunning}
              />
            ) : null}
            {chat.isRunning ? <ThinkingText label="Thinking" /> : null}
          </div>
        )}
      </div>

      {chat.error ? (
        <div
          className={cn(
            "mx-auto w-full max-w-4xl px-4 pb-2 text-sm text-red-500",
            contentClassName,
          )}
        >
          {chat.error}
        </div>
      ) : null}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-950/95">
        <div className={cn("mx-auto w-full max-w-4xl space-y-2", contentClassName)}>
          {chat.pendingClarification ? (
            <ClarificationCard
              key={chat.pendingClarification.currentIndex}
              clarification={chat.pendingClarification}
              onRespond={chat.respondToClarification}
              disabled={chat.isRunning}
            />
          ) : null}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={chat.stop}
            isRunning={chat.isRunning}
            disabled={!threadId || !url}
            placeholder={
              chat.pendingApproval
                ? "Reply with feedback, or use the buttons above..."
                : chat.pendingClarification
                  ? "Reply directly, or use the choices above..."
                : "Write a message..."
            }
          />
        </div>
      </div>
    </div>
  );
}
