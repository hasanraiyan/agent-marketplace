// src/utils/cn.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/components/PersonaChatView.tsx
import { useState as useState5, useCallback } from "react";
import { useChat, useThreads, useFiles, useMemory } from "@personaai/react";

// src/components/PersonaSidebar.tsx
import { useState, useMemo } from "react";
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search } from "lucide-react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function groupThreadsByDate(threads) {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 864e5;
  const sevenDaysAgo = today - 7 * 864e5;
  const groups = {
    today: [],
    yesterday: [],
    last7Days: [],
    older: []
  };
  for (const thread of threads) {
    const time = new Date(thread.updatedAt || thread.createdAt).getTime();
    if (time >= today) {
      groups.today.push(thread);
    } else if (time >= yesterday) {
      groups.yesterday.push(thread);
    } else if (time >= sevenDaysAgo) {
      groups.last7Days.push(thread);
    } else {
      groups.older.push(thread);
    }
  }
  return groups;
}
function PersonaSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  className
}) {
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    return threads.filter(
      (t) => (t.title || "New Chat").toLowerCase().includes(search.toLowerCase())
    );
  }, [threads, search]);
  const groups = useMemo(() => groupThreadsByDate(filteredThreads), [filteredThreads]);
  function startRename(t) {
    setRenamingId(t._id);
    setRenameValue(t.title || "New Chat");
  }
  function commitRename(threadId) {
    if (renameValue.trim()) {
      onRenameThread?.(threadId, renameValue.trim());
    }
    setRenamingId(null);
  }
  function renderGroup(title, items) {
    if (items.length === 0) return null;
    return /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
      /* @__PURE__ */ jsx("span", { className: "px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: title }),
      /* @__PURE__ */ jsx("div", { className: "mt-1.5 space-y-0.5", children: items.map((thread) => {
        const isActive = thread._id === activeThreadId;
        const isRenaming = renamingId === thread._id;
        return /* @__PURE__ */ jsx(
          "div",
          {
            className: cn(
              "group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all",
              isActive ? "bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
            ),
            children: isRenaming ? /* @__PURE__ */ jsxs("div", { className: "flex flex-1 items-center gap-1", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  autoFocus: true,
                  value: renameValue,
                  onChange: (e) => setRenameValue(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") commitRename(thread._id);
                    if (e.key === "Escape") setRenamingId(null);
                  },
                  className: "w-full rounded bg-white px-2 py-0.5 text-xs text-zinc-900 outline-none ring-1 ring-blue-500 dark:bg-zinc-950 dark:text-zinc-100"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => commitRename(thread._id),
                  className: "p-1 text-emerald-500 hover:opacity-80",
                  children: /* @__PURE__ */ jsx(Check, { className: "size-3" })
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setRenamingId(null),
                  className: "p-1 text-red-500 hover:opacity-80",
                  children: /* @__PURE__ */ jsx(X, { className: "size-3" })
                }
              )
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => onSelectThread(thread._id),
                  className: "flex flex-1 items-center gap-2 truncate text-left",
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: cn(
                          "size-1.5 shrink-0 rounded-full",
                          isActive ? "bg-blue-500" : "bg-transparent"
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx(MessageSquare, { className: "size-3.5 shrink-0 opacity-60" }),
                    /* @__PURE__ */ jsx("span", { className: "truncate", children: thread.title || "New Conversation" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                onRenameThread && /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      startRename(thread);
                    },
                    className: "rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                    children: /* @__PURE__ */ jsx(Edit2, { className: "size-3" })
                  }
                ),
                onDeleteThread && /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      onDeleteThread(thread._id);
                    },
                    className: "rounded p-1 text-zinc-400 hover:text-red-500",
                    children: /* @__PURE__ */ jsx(Trash2, { className: "size-3" })
                  }
                )
              ] })
            ] })
          },
          thread._id
        );
      }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(
    "aside",
    {
      className: cn(
        "flex w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-zinc-50/50 p-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/50",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onCreateThread,
            className: "flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            children: [
              /* @__PURE__ */ jsx(Plus, { className: "size-3.5" }),
              /* @__PURE__ */ jsx("span", { children: "New Chat" })
            ]
          }
        ),
        threads.length > 5 && /* @__PURE__ */ jsxs("div", { className: "relative my-3", children: [
          /* @__PURE__ */ jsx(Search, { className: "absolute left-2.5 top-2 size-3.5 text-zinc-400" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: search,
              onChange: (e) => setSearch(e.target.value),
              placeholder: "Search conversations...",
              className: "w-full rounded-xl border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-3 flex-1 overflow-y-auto pr-1 scrollbar-thin", children: filteredThreads.length === 0 ? /* @__PURE__ */ jsx("p", { className: "p-4 text-center text-xs text-zinc-400", children: "No past conversations." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          renderGroup("Today", groups.today),
          renderGroup("Yesterday", groups.yesterday),
          renderGroup("Previous 7 Days", groups.last7Days),
          renderGroup("Older", groups.older)
        ] }) })
      ]
    }
  );
}

// src/components/PersonaMessageFeed.tsx
import { useState as useState3, useRef, useEffect } from "react";

// src/components/PersonaToolTrace.tsx
import { useState as useState2, useMemo as useMemo2 } from "react";
import { Wrench, ChevronDown, ChevronRight as ChevronRight2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function PersonaToolTrace({
  toolCall,
  toolRenderers,
  className
}) {
  const [isOpen, setIsOpen] = useState2(false);
  const parsedArgs = useMemo2(() => {
    if (!toolCall.args) return void 0;
    try {
      return JSON.parse(toolCall.args);
    } catch {
      return toolCall.args;
    }
  }, [toolCall.args]);
  const parsedResult = useMemo2(() => {
    if (!toolCall.result) return void 0;
    try {
      return JSON.parse(toolCall.result);
    } catch {
      return toolCall.result;
    }
  }, [toolCall.result]);
  const isExecuting = !toolCall.result && !toolCall.isError;
  const CustomRenderer = toolRenderers?.[toolCall.toolName] || toolRenderers?.default;
  if (CustomRenderer && toolCall.result) {
    return /* @__PURE__ */ jsx2("div", { className: cn("my-2", className), children: /* @__PURE__ */ jsx2(
      CustomRenderer,
      {
        toolCall,
        args: parsedArgs,
        result: parsedResult,
        isExecuting,
        isError: toolCall.isError
      }
    ) });
  }
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      className: cn(
        "my-2 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs2(
          "button",
          {
            type: "button",
            onClick: () => setIsOpen((prev) => !prev),
            className: "flex w-full items-center justify-between px-3 py-2 text-left font-mono transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60",
            children: [
              /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx2(Wrench, { className: "size-3.5 text-zinc-500" }),
                /* @__PURE__ */ jsx2("span", { className: "font-semibold text-zinc-800 dark:text-zinc-200", children: toolCall.toolName })
              ] }),
              /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
                isExecuting ? /* @__PURE__ */ jsxs2("span", { className: "flex items-center gap-1 text-[11px] text-blue-500", children: [
                  /* @__PURE__ */ jsx2(Loader2, { className: "size-3 animate-spin" }),
                  /* @__PURE__ */ jsx2("span", { children: "Running..." })
                ] }) : toolCall.isError ? /* @__PURE__ */ jsxs2("span", { className: "flex items-center gap-1 text-[11px] text-red-500", children: [
                  /* @__PURE__ */ jsx2(AlertCircle, { className: "size-3" }),
                  /* @__PURE__ */ jsx2("span", { children: "Error" })
                ] }) : /* @__PURE__ */ jsxs2("span", { className: "flex items-center gap-1 text-[11px] text-emerald-500", children: [
                  /* @__PURE__ */ jsx2(CheckCircle2, { className: "size-3" }),
                  /* @__PURE__ */ jsx2("span", { children: "Complete" })
                ] }),
                isOpen ? /* @__PURE__ */ jsx2(ChevronDown, { className: "size-3.5 text-zinc-400" }) : /* @__PURE__ */ jsx2(ChevronRight2, { className: "size-3.5 text-zinc-400" })
              ] })
            ]
          }
        ),
        isOpen && /* @__PURE__ */ jsxs2("div", { className: "border-t border-zinc-200/60 p-3 space-y-2 font-mono text-[11px] dark:border-zinc-800/60", children: [
          toolCall.args && /* @__PURE__ */ jsxs2("div", { children: [
            /* @__PURE__ */ jsx2("span", { className: "text-zinc-500 block mb-1", children: "Arguments:" }),
            /* @__PURE__ */ jsx2("pre", { className: "overflow-x-auto rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedArgs === "object" ? JSON.stringify(parsedArgs, null, 2) : toolCall.args })
          ] }),
          toolCall.result && /* @__PURE__ */ jsxs2("div", { children: [
            /* @__PURE__ */ jsx2("span", { className: "text-zinc-500 block mb-1", children: "Result:" }),
            /* @__PURE__ */ jsx2("pre", { className: "overflow-x-auto rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedResult === "object" ? JSON.stringify(parsedResult, null, 2) : toolCall.result })
          ] })
        ] })
      ]
    }
  );
}

// src/components/PersonaMessageFeed.tsx
import { Bot, User, Check as Check2, Copy, RotateCcw, Sparkles } from "lucide-react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function PersonaMessageFeed({
  messages,
  isStreaming,
  error,
  toolRenderers,
  onReload,
  greeting = "How can I assist you today?",
  className
}) {
  const [copiedId, setCopiedId] = useState3(null);
  const scrollEndRef = useRef(null);
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);
  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2e3);
  }
  if (messages.length === 0) {
    return /* @__PURE__ */ jsxs3("div", { className: cn("flex flex-1 flex-col items-center justify-center p-8 text-center", className), children: [
      /* @__PURE__ */ jsx3("div", { className: "mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100", children: /* @__PURE__ */ jsx3(Sparkles, { className: "size-6" }) }),
      /* @__PURE__ */ jsx3("h2", { className: "text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl", children: greeting })
    ] });
  }
  return /* @__PURE__ */ jsx3("div", { className: cn("flex-1 space-y-6 overflow-y-auto p-4 md:p-6", className), children: /* @__PURE__ */ jsxs3("div", { className: "mx-auto max-w-3xl space-y-6", children: [
    messages.map((msg) => {
      const isUser = msg.role === "user";
      return /* @__PURE__ */ jsxs3(
        "div",
        {
          className: cn(
            "flex gap-3 text-sm leading-relaxed",
            isUser ? "justify-end" : "justify-start"
          ),
          children: [
            !isUser && /* @__PURE__ */ jsx3("div", { className: "flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 shadow-2xs dark:bg-zinc-800 dark:text-zinc-200 mt-0.5", children: /* @__PURE__ */ jsx3(Bot, { className: "size-4" }) }),
            /* @__PURE__ */ jsxs3(
              "div",
              {
                className: cn(
                  "group relative max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm",
                  isUser ? "bg-zinc-900 text-white font-medium rounded-tr-xs dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100/80 text-zinc-900 rounded-tl-xs border border-zinc-200/60 dark:bg-zinc-900/70 dark:text-zinc-100 dark:border-zinc-800/60"
                ),
                children: [
                  msg.toolCalls && msg.toolCalls.length > 0 && /* @__PURE__ */ jsx3("div", { className: "mb-2 space-y-1", children: msg.toolCalls.map((tc) => /* @__PURE__ */ jsx3(
                    PersonaToolTrace,
                    {
                      toolCall: tc,
                      toolRenderers
                    },
                    tc.toolCallId
                  )) }),
                  /* @__PURE__ */ jsx3("div", { className: "whitespace-pre-wrap", children: msg.content }),
                  msg.isStreaming && /* @__PURE__ */ jsx3("span", { className: "inline-block size-2 ml-1 rounded-full bg-blue-500 animate-pulse" }),
                  !isUser && !msg.isStreaming && msg.content && /* @__PURE__ */ jsxs3("div", { className: "mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                    onReload && /* @__PURE__ */ jsx3(
                      "button",
                      {
                        type: "button",
                        onClick: onReload,
                        title: "Regenerate response",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: /* @__PURE__ */ jsx3(RotateCcw, { className: "size-3" })
                      }
                    ),
                    /* @__PURE__ */ jsx3(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleCopy(msg.content, msg.id),
                        title: "Copy message",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: copiedId === msg.id ? /* @__PURE__ */ jsx3(Check2, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ jsx3(Copy, { className: "size-3" })
                      }
                    )
                  ] })
                ]
              }
            ),
            isUser && /* @__PURE__ */ jsx3("div", { className: "flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-200 text-zinc-700 shadow-2xs dark:bg-zinc-800 dark:text-zinc-300 mt-0.5", children: /* @__PURE__ */ jsx3(User, { className: "size-4" }) })
          ]
        },
        msg.id
      );
    }),
    error && /* @__PURE__ */ jsx3("div", { className: "rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400", children: error.message || "Failed to communicate with agent." }),
    /* @__PURE__ */ jsx3("div", { ref: scrollEndRef })
  ] }) });
}

// src/components/PersonaComposer.tsx
import { useRef as useRef2, useEffect as useEffect2 } from "react";
import { Square, Paperclip, ArrowUp } from "lucide-react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function PersonaComposer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Ask anything...",
  starterPrompts = [],
  onSelectStarter,
  onUploadFile,
  className
}) {
  const textareaRef = useRef2(null);
  const fileInputRef = useRef2(null);
  useEffect2(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming && !disabled) {
        onSubmit();
      }
    }
  };
  return /* @__PURE__ */ jsxs4("div", { className: cn("relative w-full max-w-3xl mx-auto", className), children: [
    starterPrompts.length > 0 && !input && /* @__PURE__ */ jsx4("div", { className: "mb-2 flex flex-wrap items-center gap-1.5 px-1", children: starterPrompts.map((item) => /* @__PURE__ */ jsxs4(
      "button",
      {
        type: "button",
        onClick: () => onSelectStarter?.(item.prompt),
        className: "flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-2xs backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
        children: [
          item.icon && /* @__PURE__ */ jsx4("span", { children: item.icon }),
          /* @__PURE__ */ jsx4("span", { children: item.title })
        ]
      },
      item.title
    )) }),
    /* @__PURE__ */ jsxs4("div", { className: "relative flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-2.5 shadow-md transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-400/20 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600", children: [
      /* @__PURE__ */ jsx4(
        "textarea",
        {
          ref: textareaRef,
          value: input,
          onChange: (e) => onInputChange(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder,
          rows: 1,
          disabled,
          className: "w-full resize-none bg-transparent px-2.5 pt-1.5 pb-2 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500 md:text-sm"
        }
      ),
      /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between pt-1", children: [
        /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ jsx4(
            "input",
            {
              ref: fileInputRef,
              type: "file",
              onChange: onUploadFile,
              className: "hidden"
            }
          ),
          /* @__PURE__ */ jsx4(
            "button",
            {
              type: "button",
              onClick: () => fileInputRef.current?.click(),
              title: "Attach document or receipt",
              className: "rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              children: /* @__PURE__ */ jsx4(Paperclip, { className: "size-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx4("div", { children: isStreaming ? /* @__PURE__ */ jsx4(
          "button",
          {
            type: "button",
            onClick: onStop,
            className: "flex size-8 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-95",
            children: /* @__PURE__ */ jsx4(Square, { className: "size-3.5 fill-white" })
          }
        ) : /* @__PURE__ */ jsx4(
          "button",
          {
            type: "button",
            onClick: onSubmit,
            disabled: !input.trim() || disabled,
            className: "flex size-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm transition-all hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            children: /* @__PURE__ */ jsx4(ArrowUp, { className: "size-4 stroke-[2.5]" })
          }
        ) })
      ] })
    ] })
  ] });
}

// src/components/PersonaFilesDrawer.tsx
import { useState as useState4 } from "react";
import { Files, Brain, X as X2, Trash2 as Trash22, FileText, Check as Check3, Copy as Copy2, Loader2 as Loader22 } from "lucide-react";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function PersonaFilesDrawer({
  isOpen,
  onClose,
  files,
  memory,
  onDeleteFile,
  onGetMemoryFile,
  onDeleteMemoryFile,
  className
}) {
  const [tab, setTab] = useState4("files");
  const [selectedMemory, setSelectedMemory] = useState4(null);
  const [loadingMemory, setLoadingMemory] = useState4(false);
  const [copied, setCopied] = useState4(false);
  if (!isOpen) return null;
  async function viewMemoryFile(path) {
    if (!onGetMemoryFile) return;
    setLoadingMemory(true);
    try {
      const data = await onGetMemoryFile(path);
      setSelectedMemory(data);
    } catch {
      setSelectedMemory({ path, content: "Could not load memory file." });
    } finally {
      setLoadingMemory(false);
    }
  }
  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  }
  return /* @__PURE__ */ jsxs5(
    "aside",
    {
      className: cn(
        "flex w-80 shrink-0 flex-col border-l border-zinc-200/80 bg-zinc-50/50 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/50",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between border-b border-zinc-200/80 p-3 dark:border-zinc-800/80", children: [
          /* @__PURE__ */ jsxs5("div", { className: "flex rounded-xl bg-zinc-200/60 p-0.5 dark:bg-zinc-800/60", children: [
            /* @__PURE__ */ jsxs5(
              "button",
              {
                type: "button",
                onClick: () => setTab("files"),
                className: cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  tab === "files" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                ),
                children: [
                  /* @__PURE__ */ jsx5(Files, { className: "size-3.5" }),
                  /* @__PURE__ */ jsx5("span", { children: "Files" }),
                  files.length > 0 && /* @__PURE__ */ jsxs5("span", { className: "text-[10px] opacity-70", children: [
                    "(",
                    files.length,
                    ")"
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxs5(
              "button",
              {
                type: "button",
                onClick: () => setTab("memory"),
                className: cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  tab === "memory" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                ),
                children: [
                  /* @__PURE__ */ jsx5(Brain, { className: "size-3.5" }),
                  /* @__PURE__ */ jsx5("span", { children: "Memory" }),
                  memory?.user?.length > 0 && /* @__PURE__ */ jsxs5("span", { className: "text-[10px] opacity-70", children: [
                    "(",
                    memory.user.length,
                    ")"
                  ] })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx5(
            "button",
            {
              type: "button",
              onClick: onClose,
              className: "rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              children: /* @__PURE__ */ jsx5(X2, { className: "size-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx5("div", { className: "flex-1 overflow-y-auto p-3", children: tab === "files" ? (
          /* Files list */
          /* @__PURE__ */ jsx5("div", { className: "space-y-2", children: files.length === 0 ? /* @__PURE__ */ jsx5("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No uploaded files yet." }) : files.map((file) => /* @__PURE__ */ jsxs5(
            "div",
            {
              className: "flex items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-2.5 shadow-2xs dark:border-zinc-800/70 dark:bg-zinc-900/60",
              children: [
                /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2 truncate", children: [
                  /* @__PURE__ */ jsx5(FileText, { className: "size-4 shrink-0 text-blue-500" }),
                  /* @__PURE__ */ jsxs5("div", { className: "truncate", children: [
                    /* @__PURE__ */ jsx5("span", { className: "block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200", children: file.filename }),
                    /* @__PURE__ */ jsx5("span", { className: "text-[10px] text-zinc-400", children: file.sizeBytes ? `${(file.sizeBytes / 1024).toFixed(1)} KB` : "" })
                  ] })
                ] }),
                onDeleteFile && /* @__PURE__ */ jsx5(
                  "button",
                  {
                    type: "button",
                    onClick: () => onDeleteFile(file._id),
                    className: "rounded p-1 text-zinc-400 hover:text-red-500",
                    children: /* @__PURE__ */ jsx5(Trash22, { className: "size-3.5" })
                  }
                )
              ]
            },
            file._id
          )) })
        ) : (
          /* Memory inspector */
          /* @__PURE__ */ jsx5("div", { className: "space-y-3", children: selectedMemory ? /* @__PURE__ */ jsxs5("div", { children: [
            /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80", children: [
              /* @__PURE__ */ jsx5("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedMemory.path }),
              /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-1", children: [
                /* @__PURE__ */ jsx5(
                  "button",
                  {
                    type: "button",
                    onClick: () => handleCopy(selectedMemory.content),
                    className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                    children: copied ? /* @__PURE__ */ jsx5(Check3, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ jsx5(Copy2, { className: "size-3" })
                  }
                ),
                /* @__PURE__ */ jsx5(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedMemory(null),
                    className: "text-[11px] text-blue-500 hover:underline",
                    children: "Back"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsx5("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedMemory.content })
          ] }) : memory?.user?.length === 0 ? /* @__PURE__ */ jsx5("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No persistent memory files recorded." }) : /* @__PURE__ */ jsx5("div", { className: "space-y-1.5", children: memory?.user?.map((f) => /* @__PURE__ */ jsxs5(
            "button",
            {
              type: "button",
              onClick: () => viewMemoryFile(f.path),
              className: "flex w-full items-center justify-between rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
              children: [
                /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2 truncate", children: [
                  /* @__PURE__ */ jsx5(Brain, { className: "size-3.5 text-purple-500" }),
                  /* @__PURE__ */ jsx5("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                ] }),
                loadingMemory && /* @__PURE__ */ jsx5(Loader22, { className: "size-3 animate-spin text-zinc-400" })
              ]
            },
            f.path
          )) }) })
        ) })
      ]
    }
  );
}

// src/components/PersonaChatView.tsx
import { PanelLeftClose, PanelLeft, Files as Files2 } from "lucide-react";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function PersonaChatView({
  agentId,
  threadId: controlledThreadId,
  onThreadChange,
  greeting = "How can I assist you today?",
  title = "AI Assistant",
  starterPrompts = [],
  toolRenderers,
  classNames = {},
  theme,
  showSidebar = true,
  showFilesDrawer = true,
  className
}) {
  const [internalThreadId, setInternalThreadId] = useState5(void 0);
  const activeThreadId = controlledThreadId !== void 0 ? controlledThreadId : internalThreadId;
  const [sidebarOpen, setSidebarOpen] = useState5(showSidebar);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState5(false);
  const { threads, createThread, deleteThread } = useThreads();
  const { files, uploadFile, deleteFile } = useFiles();
  const { memory, getFile, deleteFile: deleteMemoryFile } = useMemory();
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    error,
    stop,
    reload,
    clear
  } = useChat({
    agentId,
    threadId: activeThreadId
  });
  const setActiveThread = useCallback(
    (id) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );
  const handleSelectThread = useCallback(
    (id) => {
      clear();
      setActiveThread(id);
    },
    [clear, setActiveThread]
  );
  const handleNewChat = useCallback(() => {
    clear();
    setActiveThread(void 0);
  }, [clear, setActiveThread]);
  const handleSend = useCallback(
    async (content) => {
      let tid = activeThreadId;
      if (!tid) {
        try {
          const newThread = await createThread(agentId);
          tid = newThread?._id;
          if (tid) setActiveThread(tid);
        } catch {
        }
      }
      void sendMessage(content, tid ? { threadId: tid } : void 0);
    },
    [activeThreadId, agentId, createThread, sendMessage, setActiveThread]
  );
  const handleUploadFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      try {
        await uploadFile(formData);
        setFilesDrawerOpen(true);
      } catch {
      }
    },
    [uploadFile]
  );
  const themeStyles = theme ? {
    "--persona-primary": theme.primaryColor,
    "--persona-bg": theme.backgroundColor,
    "--persona-card": theme.cardBackgroundColor,
    "--persona-text": theme.textColor,
    borderRadius: theme.borderRadius
  } : void 0;
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      style: themeStyles,
      className: cn(
        // Full-height native feel — fills whatever container the host page gives
        "flex h-full w-full overflow-hidden bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        classNames.root,
        className
      ),
      children: [
        sidebarOpen && /* @__PURE__ */ jsx6(
          PersonaSidebar,
          {
            threads,
            activeThreadId,
            onSelectThread: handleSelectThread,
            onCreateThread: handleNewChat,
            onDeleteThread: deleteThread,
            className: cn("hidden md:flex", classNames.sidebar)
          }
        ),
        /* @__PURE__ */ jsxs6("div", { className: cn("flex flex-1 flex-col overflow-hidden", classNames.main), children: [
          /* @__PURE__ */ jsxs6("div", { className: "flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800", children: [
            /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  onClick: () => setSidebarOpen((p) => !p),
                  className: "rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                  children: sidebarOpen ? /* @__PURE__ */ jsx6(PanelLeftClose, { className: "size-4" }) : /* @__PURE__ */ jsx6(PanelLeft, { className: "size-4" })
                }
              ),
              /* @__PURE__ */ jsx6("span", { className: "text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200", children: title })
            ] }),
            showFilesDrawer && /* @__PURE__ */ jsxs6(
              "button",
              {
                type: "button",
                onClick: () => setFilesDrawerOpen((p) => !p),
                className: cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  filesDrawerOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                ),
                children: [
                  /* @__PURE__ */ jsx6(Files2, { className: "size-3.5" }),
                  /* @__PURE__ */ jsx6("span", { children: "Artifacts" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx6(
            PersonaMessageFeed,
            {
              messages,
              isStreaming,
              error,
              toolRenderers,
              onReload: reload,
              greeting,
              className: cn("flex-1 overflow-y-auto", classNames.messageList)
            }
          ),
          /* @__PURE__ */ jsx6("div", { className: cn("shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800/60 md:p-4", classNames.composer), children: /* @__PURE__ */ jsx6(
            PersonaComposer,
            {
              input,
              onInputChange: setInput,
              onSubmit: () => void handleSend(),
              onStop: stop,
              isStreaming,
              starterPrompts: messages.length === 0 ? starterPrompts : [],
              onSelectStarter: (p) => void handleSend(p),
              onUploadFile: handleUploadFile
            }
          ) })
        ] }),
        showFilesDrawer && /* @__PURE__ */ jsx6(
          PersonaFilesDrawer,
          {
            isOpen: filesDrawerOpen,
            onClose: () => setFilesDrawerOpen(false),
            files,
            memory,
            onDeleteFile: deleteFile,
            onGetMemoryFile: (path) => getFile({ path }),
            onDeleteMemoryFile: (path) => deleteMemoryFile({ path }),
            className: classNames.filesDrawer
          }
        )
      ]
    }
  );
}

// src/index.ts
var VERSION = "0.1.0";
export {
  PersonaChatView,
  PersonaComposer,
  PersonaFilesDrawer,
  PersonaMessageFeed,
  PersonaSidebar,
  PersonaToolTrace,
  VERSION,
  cn
};
//# sourceMappingURL=index.js.map