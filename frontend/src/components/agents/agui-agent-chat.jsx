"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  ArrowUp,
  BotIcon,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Square,
  Wrench,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAguiChat } from "@/lib/agui/use-agui-chat";

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
        <div className="prose prose-sm max-w-none break-words dark:prose-invert prose-p:my-2 prose-pre:my-3 prose-ul:my-2 prose-ol:my-2">
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
        <div className="ml-3 border-l border-slate-200 pl-3 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
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

function ToolTrace({ tool }) {
  const [open, setOpen] = useState(false);
  const done = tool.status === "completed";
  const results = searchResults(tool);
  const isSearch = tool.name?.toLowerCase().includes("search");
  const isExpandable = Boolean(tool.resultText || tool.argumentsText);
  const Icon = isSearch
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
              done ? "text-slate-400" : "animate-pulse text-orange-500",
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
            <span className="rounded-md bg-[#1E60FF]/10 px-2 py-0.5 text-[11px] font-medium text-[#1E60FF]">
              {isSearch && done && results.length
                ? `${results.length} results`
                : done
                  ? "Result"
                  : "Running"}
            </span>
          </span>
        </span>
      </button>

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

function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isRunning,
  disabled,
}) {
  const canSend = value.trim().length > 0 && !disabled && !isRunning;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-800">
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
        placeholder="Write a message..."
        rows={1}
        className="max-h-32 min-h-8 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-slate-400 disabled:opacity-60"
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

export function AguiFilesPanel({ state }) {
  const [selected, setSelected] = useState(null);
  const files = Object.entries(state?.files || {}).map(([path, data]) => ({
    path,
    content: data?.content || "",
    size: data?.size || 0,
  }));
  const active = files.find((file) => file.path === selected);

  if (!files.length) return null;

  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <FileText className="size-4 text-slate-500" />
        <span className="text-sm font-bold">Files</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
          {files.length}
        </span>
      </div>
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {active.path}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSelected(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6">
            {active.content || "(empty file)"}
          </pre>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setSelected(file.path)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FileText className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {file.path.split("/").pop()}
                </span>
                <span className="block truncate font-mono text-xs text-slate-500">
                  {file.path}
                </span>
              </span>
            </button>
          ))}
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
  title = "Sage",
  emptyTitle = "Sage",
  emptyDescription = "Tell me what you want to build, change, or explore.",
  className,
  onToolResult,
  onStateChange,
  showHeader = true,
  contentClassName,
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const chat = useAguiChat({
    url,
    agentId,
    threadId,
    headers,
    onToolResult,
  });

  useEffect(() => {
    onStateChange?.(chat.agentState);
  }, [chat.agentState, onStateChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.conversation, chat.messages, chat.toolCalls, chat.isRunning]);

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
            onClick={() => {
              setInput("");
              chat.clear();
            }}
            title="New Chat"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {chat.conversation.length === 0 ? (
          <div
            className={cn(
              "mx-auto flex h-full w-full max-w-4xl items-center justify-center text-center",
              contentClassName,
            )}
          >
            <div className="max-w-sm">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#1E60FF]/10 text-[#1E60FF]">
                <Sparkles className="size-5" />
              </div>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                {emptyTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {emptyDescription}
              </p>
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
            {chat.isRunning ? (
              <div className="max-w-[92%]">
                <ThinkingText label="Thinking" />
              </div>
            ) : null}
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
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className={cn("mx-auto w-full max-w-4xl", contentClassName)}>
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={chat.stop}
            isRunning={chat.isRunning}
            disabled={!threadId || !url}
          />
        </div>
      </div>
    </div>
  );
}
