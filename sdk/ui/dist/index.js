// src/utils/cn.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/hooks/usePersonaChatWidget.ts
import { useCallback, useEffect, useState } from "react";
import { useChat, useFiles, useMemory, useThreads } from "@personaai/react";
function usePersonaChatWidget(options = {}) {
  const { agentId, threadId: controlledThreadId, onThreadChange, defaultSidebarOpen = true } = options;
  const [internalThreadId, setInternalThreadId] = useState(void 0);
  const activeThreadId = controlledThreadId !== void 0 ? controlledThreadId : internalThreadId;
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  useEffect(() => {
    if (defaultSidebarOpen && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);
  const { threads, createThread, deleteThread, renameThread } = useThreads();
  const { files, uploadFile, deleteFile } = useFiles();
  const { memory, getFile: getMemoryFile, deleteFile: deleteMemoryFile } = useMemory();
  const chat = useChat({ agentId, threadId: activeThreadId });
  const setActiveThread = useCallback(
    (id) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );
  const handleSelectThread = useCallback(
    (id) => {
      chat.clear();
      setActiveThread(id);
    },
    [chat, setActiveThread]
  );
  const handleNewChat = useCallback(() => {
    chat.clear();
    setActiveThread(void 0);
  }, [chat, setActiveThread]);
  const handleSend = useCallback(
    async (content) => {
      let tid = activeThreadId;
      if (!tid) {
        try {
          const t = await createThread(agentId);
          tid = t?._id;
          if (tid) setActiveThread(tid);
        } catch {
        }
      }
      void chat.sendMessage(content, tid ? { threadId: tid } : void 0);
    },
    [activeThreadId, agentId, createThread, chat, setActiveThread]
  );
  useEffect(() => {
    if (chat.presentedFile) setFilesDrawerOpen(true);
  }, [chat.presentedFile]);
  const handleUploadFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        await uploadFile(fd);
        setFilesDrawerOpen(true);
      } catch {
      }
    },
    [uploadFile]
  );
  const { files: workspaceFiles, ...restChat } = chat;
  return {
    // thread selection
    activeThreadId,
    setActiveThread,
    // sidebar / files-drawer UI state
    sidebarOpen,
    setSidebarOpen,
    filesDrawerOpen,
    setFilesDrawerOpen,
    // threads
    threads,
    deleteThread,
    renameThread,
    // uploaded files
    files,
    deleteFile,
    // memory
    memory,
    getMemoryFile,
    deleteMemoryFile,
    // chat — every other useChat field (messages, input, sendMessage,
    // isStreaming, interrupt, todos, etc.) plus the composed handlers below
    ...restChat,
    workspaceFiles,
    // composed handlers (thread-aware wrappers over the raw chat/upload calls)
    handleSelectThread,
    handleNewChat,
    handleSend,
    handleUploadFile
  };
}

// src/utils/themeStyles.ts
function buildThemeStyles(theme) {
  if (!theme) return void 0;
  return {
    "--persona-primary": theme.primaryColor,
    "--persona-bg": theme.backgroundColor,
    "--persona-card": theme.cardBackgroundColor,
    "--persona-text": theme.textColor,
    "--persona-user-bg": theme.userMessageBg,
    "--persona-user-text": theme.userMessageText,
    "--persona-assistant-bg": theme.assistantMessageBg,
    "--persona-assistant-text": theme.assistantMessageText,
    "--persona-user-avatar-bg": theme.userAvatarBg,
    "--persona-user-avatar-text": theme.userAvatarText,
    "--persona-assistant-avatar-bg": theme.assistantAvatarBg,
    "--persona-assistant-avatar-text": theme.assistantAvatarText,
    borderRadius: theme.borderRadius
  };
}

// src/components/PersonaSidebar.tsx
import { useState as useState2, useMemo } from "react";
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
  onClose,
  className
}) {
  const [search, setSearch] = useState2("");
  const [renamingId, setRenamingId] = useState2(null);
  const [renameValue, setRenameValue] = useState2("");
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
                          isActive ? "bg-[var(--persona-primary,#3b82f6)]" : "bg-transparent"
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
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "fixed inset-0 z-20 bg-black/30 md:hidden",
        onClick: onClose,
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ jsxs(
      "aside",
      {
        className: cn(
          "fixed inset-y-0 left-0 z-30 flex w-72 max-w-[80vw] flex-col border-r border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900",
          "md:static md:z-auto md:w-60 md:max-w-none md:shadow-none",
          className
        ),
        children: [
          /* @__PURE__ */ jsx("div", { className: "p-3", children: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onCreateThread,
              className: "flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
              children: [
                /* @__PURE__ */ jsx(Plus, { className: "size-3.5" }),
                /* @__PURE__ */ jsx("span", { children: "New Chat" })
              ]
            }
          ) }),
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
          /* @__PURE__ */ jsx("div", { className: "mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin", children: filteredThreads.length === 0 ? /* @__PURE__ */ jsx("p", { className: "p-4 text-center text-xs text-zinc-400", children: "No past conversations." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            renderGroup("Today", groups.today),
            renderGroup("Yesterday", groups.yesterday),
            renderGroup("Previous 7 Days", groups.last7Days),
            renderGroup("Older", groups.older)
          ] }) })
        ]
      }
    )
  ] });
}

// src/components/PersonaMessageFeed.tsx
import { useState as useState6, useRef as useRef2, useEffect as useEffect3 } from "react";

// src/components/PersonaToolTrace.tsx
import { useState as useState3, useMemo as useMemo2 } from "react";
import {
  Wrench,
  ChevronDown,
  ChevronRight as ChevronRight2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Bot,
  FileText,
  Circle,
  Clock
} from "lucide-react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function isTodoTool(name) {
  return name.toLowerCase().includes("todo");
}
function parseTodos(args, result) {
  const fromResult = result && typeof result === "object" ? result : null;
  const resultTodos = fromResult ? fromResult.update?.todos ?? fromResult.todos : void 0;
  const raw = Array.isArray(resultTodos) ? resultTodos : Array.isArray(args?.todos) ? args.todos : null;
  if (!Array.isArray(raw)) return null;
  const todos = raw.map((t) => {
    const todo = t;
    return {
      content: typeof todo?.content === "string" ? todo.content : "",
      status: typeof todo?.status === "string" ? todo.status : "pending"
    };
  }).filter((t) => t.content);
  return todos.length ? todos : null;
}
function PersonaTodoChecklist({ todos }) {
  return /* @__PURE__ */ jsx2("ul", { className: "space-y-0", children: todos.map((todo, i) => {
    const isCompleted = todo.status === "completed";
    const isInProgress = todo.status === "in_progress";
    const Icon = isCompleted ? CheckCircle2 : isInProgress ? Clock : Circle;
    return /* @__PURE__ */ jsxs2("li", { className: "flex items-start gap-2 py-[3px]", children: [
      /* @__PURE__ */ jsx2(
        Icon,
        {
          className: cn(
            "mt-0.5 size-3.5 shrink-0",
            isCompleted ? "fill-blue-600 text-white dark:fill-blue-400 dark:text-zinc-900" : isInProgress ? "text-blue-600 dark:text-blue-400" : "text-zinc-300 dark:text-zinc-600"
          )
        }
      ),
      /* @__PURE__ */ jsx2(
        "span",
        {
          className: cn(
            "min-w-0 flex-1 break-words text-xs leading-5",
            isCompleted ? "text-zinc-400 line-through dark:text-zinc-500" : isInProgress ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"
          ),
          children: todo.content
        }
      )
    ] }, `${i}-${todo.content}`);
  }) });
}
function groupSubagentActivity(entries) {
  const groups = [];
  for (const entry of entries) {
    if (entry.kind === "text") {
      const last = groups[groups.length - 1];
      if (last?.kind === "text") {
        last.text += entry.delta || "";
      } else {
        groups.push({ kind: "text", text: entry.delta || "" });
      }
    } else if (entry.kind === "tool_start") {
      groups.push({ kind: "tool_start", toolName: entry.toolName, args: entry.args });
    } else {
      groups.push({ kind: "tool_result", toolName: entry.toolName, result: entry.result });
    }
  }
  return groups;
}
function PersonaToolTrace({
  toolCall,
  toolRenderers,
  onOpenFile,
  className
}) {
  const [isOpen, setIsOpen] = useState3(false);
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
  const isTodo = isTodoTool(toolCall.toolName);
  const todos = useMemo2(
    () => isTodo ? parseTodos(parsedArgs, parsedResult) : null,
    [isTodo, parsedArgs, parsedResult]
  );
  const todosDone = todos ? todos.filter((t) => t.status === "completed").length : 0;
  const subagentGroups = useMemo2(
    () => toolCall.subagentActivity?.length ? groupSubagentActivity(toolCall.subagentActivity) : [],
    [toolCall.subagentActivity]
  );
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
  if (toolCall.toolName === "present_file" && !toolCall.isError) {
    const args = typeof parsedArgs === "object" && parsedArgs || {};
    const filePath = args.filePath || args.path || "";
    const fileName = filePath.split("/").pop() || filePath || "file";
    const description = args.description || "";
    return /* @__PURE__ */ jsxs2(
      "div",
      {
        className: cn(
          "my-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-2.5 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs2("div", { className: "flex min-w-0 items-center gap-2", children: [
            /* @__PURE__ */ jsx2("div", { className: "flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400", children: /* @__PURE__ */ jsx2(FileText, { className: "size-4" }) }),
            /* @__PURE__ */ jsxs2("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx2("div", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100", children: fileName }),
              /* @__PURE__ */ jsx2("p", { className: "truncate text-[10px] text-zinc-500 dark:text-zinc-400", children: description || filePath })
            ] })
          ] }),
          filePath && /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              onClick: () => onOpenFile?.(filePath),
              className: "shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
              children: "Open"
            }
          )
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      className: cn(
        "my-2 min-w-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/40",
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
              /* @__PURE__ */ jsxs2("div", { className: "flex min-w-0 items-center gap-2", children: [
                /* @__PURE__ */ jsx2(Wrench, { className: "size-3.5 shrink-0 text-zinc-500" }),
                /* @__PURE__ */ jsx2("span", { className: "truncate font-semibold text-zinc-800 dark:text-zinc-200", children: todos ? `Plan (${todosDone}/${todos.length})` : toolCall.toolName })
              ] }),
              /* @__PURE__ */ jsxs2("div", { className: "flex shrink-0 items-center gap-2", children: [
                todos ? null : isExecuting ? /* @__PURE__ */ jsxs2("span", { className: "flex items-center gap-1 text-[11px] text-blue-500", children: [
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
        isOpen && todos ? /* @__PURE__ */ jsx2("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: /* @__PURE__ */ jsx2(PersonaTodoChecklist, { todos }) }) : isOpen ? /* @__PURE__ */ jsxs2("div", { className: "border-t border-zinc-200/60 p-3 space-y-2 font-mono text-[11px] dark:border-zinc-800/60", children: [
          toolCall.args && /* @__PURE__ */ jsxs2("div", { children: [
            /* @__PURE__ */ jsx2("span", { className: "text-zinc-500 block mb-1", children: "Arguments:" }),
            /* @__PURE__ */ jsx2("pre", { className: "overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedArgs === "object" ? JSON.stringify(parsedArgs, null, 2) : toolCall.args })
          ] }),
          toolCall.result && /* @__PURE__ */ jsxs2("div", { children: [
            /* @__PURE__ */ jsx2("span", { className: "text-zinc-500 block mb-1", children: "Result:" }),
            /* @__PURE__ */ jsx2("pre", { className: "overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedResult === "object" ? JSON.stringify(parsedResult, null, 2) : toolCall.result })
          ] }),
          subagentGroups.length > 0 && /* @__PURE__ */ jsxs2("div", { children: [
            /* @__PURE__ */ jsxs2("span", { className: "text-zinc-500 mb-1 flex items-center gap-1", children: [
              /* @__PURE__ */ jsx2(Bot, { className: "size-3" }),
              "Subagent activity:"
            ] }),
            /* @__PURE__ */ jsx2("div", { className: "space-y-1.5 border-l-2 border-zinc-200 pl-2.5 dark:border-zinc-800", children: subagentGroups.map(
              (group, i) => group.kind === "text" ? /* @__PURE__ */ jsx2("p", { className: "whitespace-pre-wrap text-zinc-600 dark:text-zinc-400", children: group.text }, i) : group.kind === "tool_start" ? /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-1 text-zinc-500", children: [
                /* @__PURE__ */ jsx2(ArrowRight, { className: "size-3 shrink-0" }),
                /* @__PURE__ */ jsx2("span", { className: "font-semibold", children: group.toolName }),
                group.args && /* @__PURE__ */ jsxs2("span", { className: "truncate opacity-70", children: [
                  "(",
                  group.args,
                  ")"
                ] })
              ] }, i) : /* @__PURE__ */ jsxs2("div", { className: "flex items-start gap-1 text-emerald-600 dark:text-emerald-400", children: [
                /* @__PURE__ */ jsx2(CheckCircle2, { className: "mt-0.5 size-3 shrink-0" }),
                /* @__PURE__ */ jsxs2("span", { className: "truncate opacity-90", children: [
                  group.toolName,
                  ": ",
                  group.result
                ] })
              ] }, i)
            ) })
          ] })
        ] }) : null
      ]
    }
  );
}

// src/components/PersonaToolGroup.tsx
import { useEffect as useEffect2, useRef, useState as useState4 } from "react";

// src/utils/toolGrouping.ts
function safeParseArgs(args) {
  if (!args) return {};
  try {
    const parsed = JSON.parse(args);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
function toolGroupKey(tool) {
  const name = tool.toolName.toLowerCase();
  if (name.includes("memory") || name.includes("preference")) return "memory";
  const args = safeParseArgs(tool.args);
  const path = args.file_path ?? args.path ?? args.filePath ?? "";
  if (typeof path === "string" && path.includes("/memories")) return "memory";
  if (name.includes("file") || name === "ls" || name === "glob" || name === "grep") return "file";
  if (name.includes("search") || name.startsWith("tavily")) return "search";
  if (name === "task") return "task";
  if (name.includes("todo")) return "plan";
  return name;
}
function groupToolCalls(toolCalls) {
  const items = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length === 0) return;
    items.push({ type: buffer.length === 1 ? "single" : "group", tools: buffer });
    buffer = [];
  };
  for (const tool of toolCalls) {
    if (tool.toolName === "present_file") {
      flush();
      items.push({ type: "single", tools: [tool] });
    } else {
      buffer.push(tool);
    }
  }
  flush();
  return items;
}

// src/components/PersonaToolGroup.tsx
import {
  AlertCircle as AlertCircle2,
  Brain,
  Bot as Bot2,
  CheckCircle2 as CheckCircle22,
  ChevronDown as ChevronDown2,
  ChevronUp,
  FileText as FileText2,
  Globe,
  ListTodo,
  Loader2 as Loader22,
  Wrench as Wrench2
} from "lucide-react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var DEFAULT_CLUSTER_LABELS = {
  memory: { title: "Personalizing memory", icon: Brain },
  file: { title: "Working with files", icon: FileText2 },
  search: { title: "Searching the web", icon: Globe },
  task: { title: "Running subagents", icon: Bot2 },
  plan: { title: "Updating the plan", icon: ListTodo },
  mixed: { title: "Performing actions", icon: Wrench2 }
};
function clusterMeta(tools, labels) {
  const merged = { ...DEFAULT_CLUSTER_LABELS, ...labels };
  const groups = new Set(tools.map(toolGroupKey));
  const key = groups.size === 1 ? [...groups][0] : "mixed";
  return merged[key] ?? merged.mixed;
}
function PersonaToolGroup({
  tools,
  toolRenderers,
  onOpenFile,
  clusterLabels,
  className
}) {
  const hasError = tools.some((t) => t.isError);
  const anyRunning = tools.some((t) => !t.result && !t.isError);
  const { title, icon: ClusterIcon = Wrench2 } = clusterMeta(tools, clusterLabels);
  const [isOpen, setIsOpen] = useState4(anyRunning);
  const wasRunningRef = useRef(anyRunning);
  useEffect2(() => {
    if (anyRunning && !wasRunningRef.current) setIsOpen(true);
    wasRunningRef.current = anyRunning;
  }, [anyRunning]);
  return /* @__PURE__ */ jsxs3("div", { className: cn("my-2 min-w-0", className), children: [
    /* @__PURE__ */ jsxs3(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen((prev) => !prev),
        className: "flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
        children: [
          /* @__PURE__ */ jsxs3("div", { className: "flex min-w-0 items-center gap-2", children: [
            anyRunning ? /* @__PURE__ */ jsx3(Loader22, { className: "size-4 shrink-0 animate-spin text-blue-500" }) : hasError ? /* @__PURE__ */ jsx3(AlertCircle2, { className: "size-4 shrink-0 text-red-500" }) : /* @__PURE__ */ jsx3(CheckCircle22, { className: "size-4 shrink-0 text-emerald-500" }),
            /* @__PURE__ */ jsx3(ClusterIcon, { className: "size-4 shrink-0 text-zinc-400 dark:text-zinc-500" }),
            /* @__PURE__ */ jsx3("span", { className: "truncate", children: title }),
            /* @__PURE__ */ jsxs3("span", { className: "shrink-0 text-[10px] font-normal text-zinc-400 dark:text-zinc-500", children: [
              tools.length,
              " step",
              tools.length > 1 ? "s" : ""
            ] })
          ] }),
          isOpen ? /* @__PURE__ */ jsx3(ChevronUp, { className: "size-3.5 shrink-0" }) : /* @__PURE__ */ jsx3(ChevronDown2, { className: "size-3.5 shrink-0" })
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx3("div", { className: "mt-2 space-y-2 pl-4", children: tools.map((tool) => /* @__PURE__ */ jsx3(
      PersonaToolTrace,
      {
        toolCall: tool,
        toolRenderers,
        onOpenFile
      },
      tool.toolCallId
    )) })
  ] });
}

// src/components/PersonaMarkdown.tsx
import { useState as useState5 } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Check as Check2, Copy } from "lucide-react";
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState5(false);
  const language = /language-(\w+)/.exec(className || "")?.[1];
  const text = String(children).replace(/\n$/, "");
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return /* @__PURE__ */ jsxs4("div", { className: "group/code relative my-2 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800/80", children: [
    language && /* @__PURE__ */ jsx4("div", { className: "flex items-center justify-between bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400", children: language }),
    /* @__PURE__ */ jsx4(
      "button",
      {
        type: "button",
        onClick: handleCopy,
        title: "Copy code",
        className: cn(
          "absolute right-2 top-2 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200/70 hover:text-zinc-700 group-hover/code:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
          !language && "top-2"
        ),
        children: copied ? /* @__PURE__ */ jsx4(Check2, { className: "size-3.5 text-emerald-500" }) : /* @__PURE__ */ jsx4(Copy, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx4("pre", { className: "overflow-x-auto bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100", children: /* @__PURE__ */ jsx4("code", { className: "whitespace-pre break-words font-mono", children: text }) })
  ] });
}
function PersonaMarkdown({ content, className }) {
  return /* @__PURE__ */ jsx4(
    "div",
    {
      className: cn(
        "min-w-0 space-y-2 text-[13px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      ),
      children: /* @__PURE__ */ jsx4(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [rehypeKatex],
          components: {
            p: ({ children }) => /* @__PURE__ */ jsx4("p", { className: "my-2 whitespace-pre-wrap break-words", children }),
            a: ({ href, children }) => /* @__PURE__ */ jsx4(
              "a",
              {
                href,
                target: "_blank",
                rel: "noreferrer",
                className: "font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:decoration-blue-400",
                children
              }
            ),
            ul: ({ children }) => /* @__PURE__ */ jsx4("ul", { className: "my-2 list-disc space-y-1 pl-5", children }),
            ol: ({ children }) => /* @__PURE__ */ jsx4("ol", { className: "my-2 list-decimal space-y-1 pl-5", children }),
            li: ({ children }) => /* @__PURE__ */ jsx4("li", { className: "pl-0.5", children }),
            h1: ({ children }) => /* @__PURE__ */ jsx4("h1", { className: "mb-2 mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100", children }),
            h2: ({ children }) => /* @__PURE__ */ jsx4("h2", { className: "mb-1.5 mt-3 text-[15px] font-bold text-zinc-900 dark:text-zinc-100", children }),
            h3: ({ children }) => /* @__PURE__ */ jsx4("h3", { className: "mb-1 mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100", children }),
            h4: ({ children }) => /* @__PURE__ */ jsx4("h4", { className: "mb-1 mt-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-100", children }),
            blockquote: ({ children }) => /* @__PURE__ */ jsx4("blockquote", { className: "my-2 border-l-2 border-zinc-300 pl-3 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400", children }),
            hr: () => /* @__PURE__ */ jsx4("hr", { className: "my-3 border-zinc-200 dark:border-zinc-800" }),
            strong: ({ children }) => /* @__PURE__ */ jsx4("strong", { className: "font-semibold", children }),
            table: ({ children }) => /* @__PURE__ */ jsx4("div", { className: "my-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800", children: /* @__PURE__ */ jsx4("table", { className: "w-full min-w-max border-collapse text-left text-xs", children }) }),
            thead: ({ children }) => /* @__PURE__ */ jsx4("thead", { className: "bg-zinc-100 dark:bg-zinc-900", children }),
            th: ({ children }) => /* @__PURE__ */ jsx4("th", { className: "border-b border-zinc-200 px-2.5 py-1.5 font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300", children }),
            td: ({ children }) => /* @__PURE__ */ jsx4("td", { className: "border-b border-zinc-100 px-2.5 py-1.5 text-zinc-600 last:border-b-0 dark:border-zinc-900 dark:text-zinc-400", children }),
            code: ({ className: codeClassName, children }) => {
              const isBlock = /language-/.test(codeClassName || "");
              if (isBlock) return /* @__PURE__ */ jsx4(CodeBlock, { className: codeClassName, children });
              return /* @__PURE__ */ jsx4("code", { className: "rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children });
            },
            pre: ({ children }) => /* @__PURE__ */ jsx4(Fragment2, { children })
          },
          children: content
        }
      )
    }
  );
}

// src/components/PersonaMessageFeed.tsx
import { Bot as Bot3, User, Check as Check3, Copy as Copy2, RotateCcw, Sparkles, BrainCircuit, ChevronDown as ChevronDown3, ChevronRight as ChevronRight3, Loader2 as Loader23 } from "lucide-react";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function ReasoningBlock({ reasoning, isReasoning }) {
  const [isOpen, setIsOpen] = useState6(Boolean(isReasoning));
  useEffect3(() => {
    if (isReasoning) setIsOpen(true);
  }, [isReasoning]);
  return /* @__PURE__ */ jsxs5("div", { className: "mb-2 overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/60 text-xs dark:border-zinc-800/70 dark:bg-zinc-950/40", children: [
    /* @__PURE__ */ jsxs5(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen((prev) => !prev),
        className: "flex w-full items-center justify-between px-3 py-1.5 text-left text-zinc-500 transition-colors hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:bg-zinc-900/40",
        children: [
          /* @__PURE__ */ jsxs5("span", { className: "flex items-center gap-1.5", children: [
            isReasoning ? /* @__PURE__ */ jsx5(Loader23, { className: "size-3 animate-spin" }) : /* @__PURE__ */ jsx5(BrainCircuit, { className: "size-3" }),
            /* @__PURE__ */ jsx5("span", { className: "font-medium", children: isReasoning ? "Thinking\u2026" : "Thought process" })
          ] }),
          isOpen ? /* @__PURE__ */ jsx5(ChevronDown3, { className: "size-3" }) : /* @__PURE__ */ jsx5(ChevronRight3, { className: "size-3" })
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx5("p", { className: "whitespace-pre-wrap break-words border-t border-zinc-200/60 p-2.5 text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400", children: reasoning })
  ] });
}
function PersonaMessageFeed({
  messages,
  isStreaming,
  isLoading,
  error,
  toolRenderers,
  onReload,
  onOpenFile,
  greeting = "How can I assist you today?",
  showUserAvatar = true,
  showAssistantAvatar = true,
  userAvatar,
  assistantAvatar,
  groupTools = true,
  toolClusterLabels,
  className
}) {
  const [copiedId, setCopiedId] = useState6(null);
  const scrollEndRef = useRef2(null);
  useEffect3(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);
  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2e3);
  }
  if (messages.length === 0 && isLoading) {
    return /* @__PURE__ */ jsx5("div", { className: cn("flex min-h-0 flex-1 items-center justify-center p-8", className), children: /* @__PURE__ */ jsx5("div", { className: "size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" }) });
  }
  if (messages.length === 0) {
    return /* @__PURE__ */ jsxs5("div", { className: cn("flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center", className), children: [
      /* @__PURE__ */ jsx5("div", { className: "mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100", children: /* @__PURE__ */ jsx5(Sparkles, { className: "size-6" }) }),
      /* @__PURE__ */ jsx5("h2", { className: "text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl", children: greeting })
    ] });
  }
  return /* @__PURE__ */ jsx5("div", { className: cn("min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6", className), children: /* @__PURE__ */ jsxs5("div", { className: "mx-auto max-w-3xl space-y-6", children: [
    messages.map((msg) => {
      const isUser = msg.role === "user";
      return /* @__PURE__ */ jsxs5(
        "div",
        {
          className: cn(
            "flex gap-3 text-sm leading-relaxed",
            isUser ? "justify-end" : "justify-start"
          ),
          children: [
            !isUser && showAssistantAvatar && (assistantAvatar ?? /* @__PURE__ */ jsx5("div", { className: "mt-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-[var(--persona-assistant-avatar-bg,#f4f4f5)] text-[var(--persona-assistant-avatar-text,#27272a)] shadow-2xs dark:bg-[var(--persona-assistant-avatar-bg,#27272a)] dark:text-[var(--persona-assistant-avatar-text,#e4e4e7)]", children: /* @__PURE__ */ jsx5(Bot3, { className: "size-4" }) })),
            /* @__PURE__ */ jsxs5(
              "div",
              {
                className: cn(
                  "group relative min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-xs md:text-sm",
                  isUser ? "rounded-tr-xs bg-[var(--persona-user-bg,#18181b)] font-medium text-[var(--persona-user-text,#ffffff)] dark:bg-[var(--persona-user-bg,#f4f4f5)] dark:text-[var(--persona-user-text,#18181b)]" : "rounded-tl-xs border border-zinc-200/60 bg-[var(--persona-assistant-bg,rgb(244_244_245_/_0.8))] text-[var(--persona-assistant-text,#18181b)] dark:border-zinc-800/60 dark:bg-[var(--persona-assistant-bg,rgb(24_24_27_/_0.7))] dark:text-[var(--persona-assistant-text,#f4f4f5)]"
                ),
                children: [
                  !isUser && msg.reasoning && /* @__PURE__ */ jsx5(ReasoningBlock, { reasoning: msg.reasoning, isReasoning: msg.isReasoning }),
                  msg.toolCalls && msg.toolCalls.length > 0 && /* @__PURE__ */ jsx5("div", { className: "mb-2 space-y-1", children: groupTools ? groupToolCalls(msg.toolCalls).map(
                    (item) => item.type === "group" ? /* @__PURE__ */ jsx5(
                      PersonaToolGroup,
                      {
                        tools: item.tools,
                        toolRenderers,
                        onOpenFile,
                        clusterLabels: toolClusterLabels
                      },
                      item.tools[0].toolCallId
                    ) : /* @__PURE__ */ jsx5(
                      PersonaToolTrace,
                      {
                        toolCall: item.tools[0],
                        toolRenderers,
                        onOpenFile
                      },
                      item.tools[0].toolCallId
                    )
                  ) : msg.toolCalls.map((tc) => /* @__PURE__ */ jsx5(
                    PersonaToolTrace,
                    {
                      toolCall: tc,
                      toolRenderers,
                      onOpenFile
                    },
                    tc.toolCallId
                  )) }),
                  isUser ? /* @__PURE__ */ jsx5("div", { className: "whitespace-pre-wrap break-words", children: msg.content }) : /* @__PURE__ */ jsx5(PersonaMarkdown, { content: msg.content }),
                  msg.isStreaming && /* @__PURE__ */ jsx5("span", { className: "inline-block size-2 ml-1 rounded-full bg-blue-500 animate-pulse" }),
                  !isUser && !msg.isStreaming && msg.content && /* @__PURE__ */ jsxs5("div", { className: "mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                    onReload && /* @__PURE__ */ jsx5(
                      "button",
                      {
                        type: "button",
                        onClick: onReload,
                        title: "Regenerate response",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: /* @__PURE__ */ jsx5(RotateCcw, { className: "size-3" })
                      }
                    ),
                    /* @__PURE__ */ jsx5(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleCopy(msg.content, msg.id),
                        title: "Copy message",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: copiedId === msg.id ? /* @__PURE__ */ jsx5(Check3, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ jsx5(Copy2, { className: "size-3" })
                      }
                    )
                  ] })
                ]
              }
            ),
            isUser && showUserAvatar && (userAvatar ?? /* @__PURE__ */ jsx5("div", { className: "mt-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-[var(--persona-user-avatar-bg,#e4e4e7)] text-[var(--persona-user-avatar-text,#3f3f46)] shadow-2xs dark:bg-[var(--persona-user-avatar-bg,#27272a)] dark:text-[var(--persona-user-avatar-text,#d4d4d8)]", children: /* @__PURE__ */ jsx5(User, { className: "size-4" }) }))
          ]
        },
        msg.id
      );
    }),
    error && /* @__PURE__ */ jsx5("div", { className: "rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400", children: error.message || "Failed to communicate with agent." }),
    /* @__PURE__ */ jsx5("div", { ref: scrollEndRef })
  ] }) });
}

// src/components/PersonaComposer.tsx
import { useRef as useRef3, useEffect as useEffect4 } from "react";
import { Square, Paperclip, ArrowUp } from "lucide-react";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
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
  const textareaRef = useRef3(null);
  const fileInputRef = useRef3(null);
  useEffect4(() => {
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
  return /* @__PURE__ */ jsxs6("div", { className: cn("relative w-full max-w-3xl mx-auto", className), children: [
    starterPrompts.length > 0 && !input && /* @__PURE__ */ jsx6("div", { className: "mb-2 flex flex-wrap items-center gap-1.5 px-1", children: starterPrompts.map((item) => /* @__PURE__ */ jsxs6(
      "button",
      {
        type: "button",
        onClick: () => onSelectStarter?.(item.prompt),
        className: "flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-2xs backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
        children: [
          item.icon && /* @__PURE__ */ jsx6("span", { children: item.icon }),
          /* @__PURE__ */ jsx6("span", { children: item.title })
        ]
      },
      item.title
    )) }),
    /* @__PURE__ */ jsxs6("div", { className: "relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-400/20 dark:border-zinc-700 dark:bg-zinc-900", children: [
      /* @__PURE__ */ jsx6(
        "textarea",
        {
          ref: textareaRef,
          value: input,
          onChange: (e) => onInputChange(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder,
          rows: 1,
          disabled,
          style: { color: "#111827" },
          className: "w-full resize-none bg-transparent px-2.5 pt-1.5 pb-2 text-sm leading-relaxed placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500 dark:!text-zinc-100"
        }
      ),
      /* @__PURE__ */ jsxs6("div", { className: "flex items-center justify-between pt-1", children: [
        /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ jsx6(
            "input",
            {
              ref: fileInputRef,
              type: "file",
              onChange: onUploadFile,
              className: "hidden"
            }
          ),
          /* @__PURE__ */ jsx6(
            "button",
            {
              type: "button",
              onClick: () => fileInputRef.current?.click(),
              title: "Attach document or receipt",
              className: "rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              children: /* @__PURE__ */ jsx6(Paperclip, { className: "size-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx6("div", { children: isStreaming ? /* @__PURE__ */ jsx6(
          "button",
          {
            type: "button",
            onClick: onStop,
            className: "flex size-8 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-95",
            children: /* @__PURE__ */ jsx6(Square, { className: "size-3.5 fill-white" })
          }
        ) : /* @__PURE__ */ jsx6(
          "button",
          {
            type: "button",
            onClick: onSubmit,
            disabled: !input.trim() || disabled,
            className: "flex size-8 items-center justify-center rounded-xl bg-[var(--persona-primary,#27272a)] text-white shadow-sm transition-all hover:brightness-90 disabled:pointer-events-none disabled:opacity-25 active:scale-95 dark:bg-[var(--persona-primary,#e4e4e7)] dark:text-zinc-900 dark:hover:brightness-110",
            children: /* @__PURE__ */ jsx6(ArrowUp, { className: "size-4 stroke-[2.5]" })
          }
        ) })
      ] })
    ] })
  ] });
}

// src/components/PersonaFilesDrawer.tsx
import { useEffect as useEffect5, useState as useState7 } from "react";
import {
  Files,
  Brain as Brain2,
  FolderKanban,
  X as X2,
  Trash2 as Trash22,
  FileText as FileText3,
  Check as Check4,
  Copy as Copy3,
  Loader2 as Loader24,
  CircleDashed,
  CircleDotDashed,
  CircleCheck
} from "lucide-react";
import { Fragment as Fragment3, jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
var TODO_ICON = {
  pending: CircleDashed,
  in_progress: CircleDotDashed,
  completed: CircleCheck
};
function PersonaFilesDrawer({
  isOpen,
  onClose,
  files,
  memory,
  workspaceFiles = {},
  todos = [],
  presentedFile,
  onDeleteFile,
  onGetMemoryFile,
  onDeleteMemoryFile,
  className
}) {
  const [tab, setTab] = useState7("files");
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState7(null);
  const [selectedMemory, setSelectedMemory] = useState7(null);
  const [loadingMemory, setLoadingMemory] = useState7(false);
  const [copied, setCopied] = useState7(false);
  const workspaceEntries = Object.entries(workspaceFiles);
  useEffect5(() => {
    if (!presentedFile) return;
    setTab("workspace");
    setSelectedWorkspacePath(presentedFile.path);
  }, [presentedFile]);
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
  const selectedWorkspaceFile = selectedWorkspacePath ? workspaceFiles[selectedWorkspacePath] : void 0;
  return /* @__PURE__ */ jsxs7(Fragment3, { children: [
    /* @__PURE__ */ jsx7(
      "div",
      {
        className: "fixed inset-0 z-20 bg-black/30 lg:hidden",
        onClick: onClose,
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ jsxs7(
      "aside",
      {
        className: cn(
          "fixed inset-y-0 right-0 z-30 flex w-full max-w-xs flex-col border-l border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-950 sm:max-w-sm",
          "lg:static lg:z-auto lg:w-80 lg:max-w-none lg:shrink-0 lg:bg-zinc-50/50 lg:shadow-none lg:backdrop-blur-md lg:dark:bg-zinc-950/50",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 p-3 dark:border-zinc-800/80", children: [
            /* @__PURE__ */ jsxs7("div", { className: "flex min-w-0 rounded-xl bg-zinc-200/60 p-0.5 dark:bg-zinc-800/60", children: [
              /* @__PURE__ */ jsxs7(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("files"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "files" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ jsx7(Files, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ jsx7("span", { className: "hidden sm:inline", children: "Files" }),
                    files.length > 0 && /* @__PURE__ */ jsxs7("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      files.length,
                      ")"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs7(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("workspace"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "workspace" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ jsx7(FolderKanban, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ jsx7("span", { className: "hidden sm:inline", children: "Workspace" }),
                    workspaceEntries.length > 0 && /* @__PURE__ */ jsxs7("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      workspaceEntries.length,
                      ")"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs7(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("memory"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "memory" ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ jsx7(Brain2, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ jsx7("span", { className: "hidden sm:inline", children: "Memory" }),
                    memory?.userFiles?.length > 0 && /* @__PURE__ */ jsxs7("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      memory.userFiles.length,
                      ")"
                    ] })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsx7(
              "button",
              {
                type: "button",
                onClick: onClose,
                className: "shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                children: /* @__PURE__ */ jsx7(X2, { className: "size-4" })
              }
            )
          ] }),
          /* @__PURE__ */ jsx7("div", { className: "min-h-0 flex-1 overflow-y-auto p-3", children: tab === "files" ? (
            /* Uploaded files list */
            /* @__PURE__ */ jsx7("div", { className: "space-y-2", children: files.length === 0 ? /* @__PURE__ */ jsx7("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No uploaded files yet." }) : files.map((file) => /* @__PURE__ */ jsxs7(
              "div",
              {
                className: "flex items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 shadow-2xs dark:border-zinc-800/70 dark:bg-zinc-900/60",
                children: [
                  /* @__PURE__ */ jsxs7("div", { className: "flex min-w-0 items-center gap-2", children: [
                    /* @__PURE__ */ jsx7(FileText3, { className: "size-4 shrink-0 text-blue-500" }),
                    /* @__PURE__ */ jsxs7("div", { className: "min-w-0 truncate", children: [
                      /* @__PURE__ */ jsx7("span", { className: "block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200", children: file.originalName }),
                      /* @__PURE__ */ jsx7("span", { className: "text-[10px] text-zinc-400", children: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "" })
                    ] })
                  ] }),
                  onDeleteFile && /* @__PURE__ */ jsx7(
                    "button",
                    {
                      type: "button",
                      onClick: () => onDeleteFile(file.id),
                      className: "shrink-0 rounded p-1 text-zinc-400 hover:text-red-500",
                      children: /* @__PURE__ */ jsx7(Trash22, { className: "size-3.5" })
                    }
                  )
                ]
              },
              file.id
            )) })
          ) : tab === "workspace" ? (
            /* Agent's own virtual workspace — plan (todos) + files it wrote */
            /* @__PURE__ */ jsx7("div", { className: "space-y-4", children: selectedWorkspaceFile ? /* @__PURE__ */ jsxs7("div", { children: [
              /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80", children: [
                /* @__PURE__ */ jsx7("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedWorkspacePath }),
                /* @__PURE__ */ jsxs7("div", { className: "flex shrink-0 items-center gap-1", children: [
                  /* @__PURE__ */ jsx7(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleCopy(selectedWorkspaceFile.content),
                      className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                      children: copied ? /* @__PURE__ */ jsx7(Check4, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ jsx7(Copy3, { className: "size-3" })
                    }
                  ),
                  /* @__PURE__ */ jsx7(
                    "button",
                    {
                      type: "button",
                      onClick: () => setSelectedWorkspacePath(null),
                      className: "text-[11px] text-blue-500 hover:underline",
                      children: "Back"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsx7("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedWorkspaceFile.content })
            ] }) : /* @__PURE__ */ jsxs7(Fragment3, { children: [
              todos.length > 0 && /* @__PURE__ */ jsxs7("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsx7("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Plan" }),
                todos.map((todo, i) => {
                  const Icon = TODO_ICON[todo.status] ?? CircleDashed;
                  return /* @__PURE__ */ jsxs7(
                    "div",
                    {
                      className: "flex items-start gap-2 rounded-xl border border-zinc-200/70 bg-white p-2 text-xs dark:border-zinc-800/70 dark:bg-zinc-900/60",
                      children: [
                        /* @__PURE__ */ jsx7(
                          Icon,
                          {
                            className: cn(
                              "mt-0.5 size-3.5 shrink-0",
                              todo.status === "completed" ? "text-emerald-500" : todo.status === "in_progress" ? "text-blue-500" : "text-zinc-400"
                            )
                          }
                        ),
                        /* @__PURE__ */ jsx7(
                          "span",
                          {
                            className: cn(
                              "text-zinc-700 dark:text-zinc-300",
                              todo.status === "completed" && "text-zinc-400 line-through dark:text-zinc-500"
                            ),
                            children: todo.content
                          }
                        )
                      ]
                    },
                    i
                  );
                })
              ] }),
              workspaceEntries.length === 0 ? /* @__PURE__ */ jsx7("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No workspace files yet \u2014 files the agent creates show up here." }) : /* @__PURE__ */ jsxs7("div", { className: "space-y-1.5", children: [
                todos.length > 0 && /* @__PURE__ */ jsx7("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Files" }),
                workspaceEntries.map(([path, file]) => /* @__PURE__ */ jsxs7(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedWorkspacePath(path),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                    children: [
                      /* @__PURE__ */ jsxs7("div", { className: "flex min-w-0 items-center gap-2", children: [
                        /* @__PURE__ */ jsx7(FileText3, { className: "size-3.5 shrink-0 text-amber-500" }),
                        /* @__PURE__ */ jsx7("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: path })
                      ] }),
                      /* @__PURE__ */ jsx7("span", { className: "shrink-0 text-[10px] text-zinc-400", children: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "" })
                    ]
                  },
                  path
                ))
              ] })
            ] }) })
          ) : (
            /* Memory inspector */
            /* @__PURE__ */ jsx7("div", { className: "space-y-3", children: selectedMemory ? /* @__PURE__ */ jsxs7("div", { children: [
              /* @__PURE__ */ jsxs7("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80", children: [
                /* @__PURE__ */ jsx7("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedMemory.path }),
                /* @__PURE__ */ jsxs7("div", { className: "flex shrink-0 items-center gap-1", children: [
                  /* @__PURE__ */ jsx7(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleCopy(selectedMemory.content),
                      className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                      children: copied ? /* @__PURE__ */ jsx7(Check4, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ jsx7(Copy3, { className: "size-3" })
                    }
                  ),
                  /* @__PURE__ */ jsx7(
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
              /* @__PURE__ */ jsx7("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedMemory.content })
            ] }) : (memory?.userFiles?.length ?? 0) === 0 && (memory?.agentMemories?.length ?? 0) === 0 ? /* @__PURE__ */ jsx7("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No persistent memory files recorded." }) : /* @__PURE__ */ jsxs7("div", { className: "space-y-4", children: [
              (memory?.userFiles?.length ?? 0) > 0 && /* @__PURE__ */ jsx7("div", { className: "space-y-1.5", children: memory.userFiles.map((f) => /* @__PURE__ */ jsxs7(
                "button",
                {
                  type: "button",
                  onClick: () => viewMemoryFile(f.path),
                  className: "flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                  children: [
                    /* @__PURE__ */ jsxs7("div", { className: "flex min-w-0 items-center gap-2", children: [
                      /* @__PURE__ */ jsx7(Brain2, { className: "size-3.5 shrink-0 text-purple-500" }),
                      /* @__PURE__ */ jsx7("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                    ] }),
                    loadingMemory && /* @__PURE__ */ jsx7(Loader24, { className: "size-3 shrink-0 animate-spin text-zinc-400" })
                  ]
                },
                f.path
              )) }),
              memory?.agentMemories?.map((group) => /* @__PURE__ */ jsxs7("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsx7("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: group.agentName || "Unknown Agent" }),
                group.files.map((f) => /* @__PURE__ */ jsxs7(
                  "button",
                  {
                    type: "button",
                    onClick: () => viewMemoryFile(f.path),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                    children: [
                      /* @__PURE__ */ jsxs7("div", { className: "flex min-w-0 items-center gap-2", children: [
                        /* @__PURE__ */ jsx7(Brain2, { className: "size-3.5 shrink-0 text-purple-500" }),
                        /* @__PURE__ */ jsx7("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                      ] }),
                      loadingMemory && /* @__PURE__ */ jsx7(Loader24, { className: "size-3 shrink-0 animate-spin text-zinc-400" })
                    ]
                  },
                  f.path
                ))
              ] }, group.agentId))
            ] }) })
          ) })
        ]
      }
    )
  ] });
}

// src/components/PersonaInterruptCard.tsx
import { useState as useState8 } from "react";
import { ShieldAlert, HelpCircle, Check as Check5, X as X3 } from "lucide-react";
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
function PersonaInterruptCard({
  interrupt,
  onRespond,
  isStreaming,
  className
}) {
  const [answers, setAnswers] = useState8({});
  if (interrupt.kind === "hitl") {
    const approveAll = () => {
      onRespond(
        { decisions: interrupt.actionRequests.map(() => ({ type: "approve" })) },
        "Approved"
      );
    };
    const rejectAll = () => {
      onRespond(
        {
          decisions: interrupt.actionRequests.map(() => ({
            type: "reject",
            message: "User declined the action."
          }))
        },
        "Rejected"
      );
    };
    return /* @__PURE__ */ jsxs8(
      "div",
      {
        className: cn(
          "mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs8("div", { className: "mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300", children: [
            /* @__PURE__ */ jsx8(ShieldAlert, { className: "size-4" }),
            "Approval needed"
          ] }),
          /* @__PURE__ */ jsx8("ul", { className: "mb-3 space-y-1 font-mono text-xs text-amber-900/80 dark:text-amber-200/80", children: interrupt.actionRequests.map((action, i) => /* @__PURE__ */ jsxs8("li", { children: [
            "\u2022 ",
            action.name
          ] }, i)) }),
          /* @__PURE__ */ jsxs8("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxs8(
              "button",
              {
                type: "button",
                disabled: isStreaming,
                onClick: approveAll,
                className: "flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50",
                children: [
                  /* @__PURE__ */ jsx8(Check5, { className: "size-3.5" }),
                  " Approve"
                ]
              }
            ),
            /* @__PURE__ */ jsxs8(
              "button",
              {
                type: "button",
                disabled: isStreaming,
                onClick: rejectAll,
                className: "flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700",
                children: [
                  /* @__PURE__ */ jsx8(X3, { className: "size-3.5" }),
                  " Reject"
                ]
              }
            )
          ] })
        ]
      }
    );
  }
  const submit = () => {
    const orderedAnswers = interrupt.questions.map((_, i) => answers[i] ?? "");
    const summary = interrupt.questions.map((q, i) => `${q.text}: ${answers[i] ?? ""}`).join("\n");
    onRespond({ answers: orderedAnswers, text: summary }, summary);
  };
  const canSubmit = !interrupt.questions.some((q, i) => q.required && !answers[i]?.trim());
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      className: cn(
        "mx-auto w-full max-w-3xl rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs8("div", { className: "mb-3 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300", children: [
          /* @__PURE__ */ jsx8(HelpCircle, { className: "size-4" }),
          "A few questions before I continue"
        ] }),
        /* @__PURE__ */ jsx8("div", { className: "space-y-3", children: interrupt.questions.map((q, i) => /* @__PURE__ */ jsxs8("div", { children: [
          /* @__PURE__ */ jsx8("p", { className: "mb-1.5 text-xs font-medium text-blue-900 dark:text-blue-200", children: q.text }),
          q.options.length > 0 && /* @__PURE__ */ jsx8("div", { className: "mb-1.5 flex flex-wrap gap-1.5", children: q.options.map((opt) => /* @__PURE__ */ jsx8(
            "button",
            {
              type: "button",
              onClick: () => setAnswers((prev) => ({ ...prev, [i]: opt })),
              className: cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition-colors",
                answers[i] === opt ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-blue-700 ring-blue-200 hover:bg-blue-100 dark:bg-zinc-900 dark:text-blue-300 dark:ring-blue-900/60"
              ),
              children: opt
            },
            opt
          )) }),
          q.allowCustom && /* @__PURE__ */ jsx8(
            "input",
            {
              value: q.options.includes(answers[i] ?? "") ? "" : answers[i] || "",
              onChange: (e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value })),
              placeholder: "Or type your own answer...",
              className: "w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-blue-400 dark:border-blue-900/60 dark:bg-zinc-900 dark:text-zinc-100"
            }
          )
        ] }, q.id)) }),
        /* @__PURE__ */ jsx8(
          "button",
          {
            type: "button",
            disabled: isStreaming || !canSubmit,
            onClick: submit,
            className: "mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40",
            children: "Submit"
          }
        )
      ]
    }
  );
}

// src/components/PersonaChatView.tsx
import { PanelLeftClose, PanelLeft, Files as Files2 } from "lucide-react";
import { jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
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
  showUserAvatar = true,
  showAssistantAvatar = true,
  userAvatar,
  assistantAvatar,
  groupTools = true,
  toolClusterLabels,
  className
}) {
  const {
    activeThreadId,
    sidebarOpen,
    setSidebarOpen,
    filesDrawerOpen,
    setFilesDrawerOpen,
    threads,
    deleteThread,
    renameThread,
    files,
    deleteFile,
    memory,
    getMemoryFile,
    deleteMemoryFile,
    messages,
    input,
    setInput,
    isStreaming,
    isLoadingHistory,
    error,
    interrupt,
    resumeInterrupt,
    workspaceFiles,
    todos,
    presentedFile,
    openWorkspaceFile,
    stop,
    reload,
    handleSelectThread,
    handleNewChat,
    handleSend,
    handleUploadFile
  } = usePersonaChatWidget({
    agentId,
    threadId: controlledThreadId,
    onThreadChange,
    defaultSidebarOpen: showSidebar
  });
  const themeStyles = buildThemeStyles(theme);
  return /* @__PURE__ */ jsxs9(
    "div",
    {
      style: themeStyles,
      className: cn(
        // Fill whatever height the host container provides — no internal height set
        "flex w-full overflow-hidden bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        // Host page is responsible for the height; component just fills it
        "h-full min-h-0",
        classNames.root,
        className
      ),
      children: [
        sidebarOpen && /* @__PURE__ */ jsx9(
          PersonaSidebar,
          {
            threads,
            activeThreadId,
            onSelectThread: handleSelectThread,
            onCreateThread: handleNewChat,
            onDeleteThread: deleteThread,
            onRenameThread: renameThread,
            onClose: () => setSidebarOpen(false),
            className: classNames.sidebar
          }
        ),
        /* @__PURE__ */ jsxs9("div", { className: cn("flex min-h-0 flex-1 flex-col", classNames.main), children: [
          /* @__PURE__ */ jsxs9("div", { className: "flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950", children: [
            /* @__PURE__ */ jsxs9("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsx9(
                "button",
                {
                  type: "button",
                  onClick: () => setSidebarOpen((p) => !p),
                  className: "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                  children: sidebarOpen ? /* @__PURE__ */ jsx9(PanelLeftClose, { className: "size-4" }) : /* @__PURE__ */ jsx9(PanelLeft, { className: "size-4" })
                }
              ),
              /* @__PURE__ */ jsx9("span", { className: "text-sm font-semibold text-zinc-800 dark:text-zinc-200", children: title })
            ] }),
            showFilesDrawer && /* @__PURE__ */ jsxs9(
              "button",
              {
                type: "button",
                onClick: () => setFilesDrawerOpen((p) => !p),
                className: cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  filesDrawerOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                ),
                children: [
                  /* @__PURE__ */ jsx9(Files2, { className: "size-3.5" }),
                  /* @__PURE__ */ jsx9("span", { children: "Artifacts" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx9("div", { className: "flex min-h-0 flex-1 flex-col", children: /* @__PURE__ */ jsx9(
            PersonaMessageFeed,
            {
              messages,
              isStreaming,
              isLoading: isLoadingHistory,
              error,
              toolRenderers,
              onReload: reload,
              onOpenFile: openWorkspaceFile,
              greeting,
              showUserAvatar,
              showAssistantAvatar,
              userAvatar,
              assistantAvatar,
              groupTools,
              toolClusterLabels,
              className: classNames.messageList
            }
          ) }),
          interrupt && /* @__PURE__ */ jsx9("div", { className: "shrink-0 border-t border-zinc-100 bg-white px-3 pt-3 dark:border-zinc-800 dark:bg-zinc-950", children: /* @__PURE__ */ jsx9(
            PersonaInterruptCard,
            {
              interrupt,
              isStreaming,
              onRespond: (resume, displayContent) => void resumeInterrupt(resume, displayContent)
            }
          ) }),
          /* @__PURE__ */ jsx9("div", { className: cn(
            "shrink-0 border-t border-zinc-100 bg-white px-3 pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950",
            classNames.composer
          ), children: /* @__PURE__ */ jsx9(
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
        showFilesDrawer && /* @__PURE__ */ jsx9(
          PersonaFilesDrawer,
          {
            isOpen: filesDrawerOpen,
            onClose: () => setFilesDrawerOpen(false),
            files,
            memory,
            workspaceFiles,
            todos,
            presentedFile,
            onDeleteFile: deleteFile,
            onGetMemoryFile: (path) => getMemoryFile({ path }),
            onDeleteMemoryFile: (path) => deleteMemoryFile({ path }),
            className: classNames.filesDrawer
          }
        )
      ]
    }
  );
}

// src/components/PersonaChatLauncher.tsx
import { useState as useState9 } from "react";
import { MessageCircle, X as X4 } from "lucide-react";
import { jsx as jsx10, jsxs as jsxs10 } from "react/jsx-runtime";
function PersonaChatLauncher({
  position = "bottom-right",
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  fabIcon,
  panelWidth = "24rem",
  panelHeight = "36rem",
  fabClassName,
  panelClassName,
  theme,
  ...chatViewProps
}) {
  const [internalOpen, setInternalOpen] = useState9(defaultOpen);
  const isOpen = controlledOpen !== void 0 ? controlledOpen : internalOpen;
  const setOpen = (next) => {
    onOpenChange?.(next);
    if (controlledOpen === void 0) setInternalOpen(next);
  };
  const isRight = position !== "bottom-left";
  const themeStyles = buildThemeStyles(theme);
  return /* @__PURE__ */ jsxs10("div", { style: themeStyles, className: "contents", children: [
    isOpen && /* @__PURE__ */ jsx10(
      "div",
      {
        className: cn(
          "fixed bottom-24 z-40 flex max-h-[calc(100vh-7rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950",
          isRight ? "right-6" : "left-6",
          panelClassName
        ),
        style: { width: panelWidth, height: panelHeight },
        children: /* @__PURE__ */ jsx10(PersonaChatView, { ...chatViewProps, theme, className: "h-full w-full" })
      }
    ),
    /* @__PURE__ */ jsx10(
      "button",
      {
        type: "button",
        onClick: () => setOpen(!isOpen),
        "aria-label": isOpen ? "Close chat" : "Open chat",
        className: cn(
          "fixed bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-[var(--persona-primary,#18181b)] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900",
          isRight ? "right-6" : "left-6",
          fabClassName
        ),
        children: isOpen ? /* @__PURE__ */ jsx10(X4, { className: "size-6" }) : fabIcon ?? /* @__PURE__ */ jsx10(MessageCircle, { className: "size-6" })
      }
    )
  ] });
}

// src/index.ts
var VERSION = "0.6.0";
export {
  PersonaChatLauncher,
  PersonaChatView,
  PersonaComposer,
  PersonaFilesDrawer,
  PersonaInterruptCard,
  PersonaMarkdown,
  PersonaMessageFeed,
  PersonaSidebar,
  PersonaToolGroup,
  PersonaToolTrace,
  VERSION,
  buildThemeStyles,
  cn,
  groupToolCalls,
  toolGroupKey,
  usePersonaChatWidget
};
//# sourceMappingURL=index.js.map