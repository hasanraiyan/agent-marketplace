"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  PersonaChatLauncher: () => PersonaChatLauncher,
  PersonaChatView: () => PersonaChatView,
  PersonaComposer: () => PersonaComposer,
  PersonaDialog: () => PersonaDialog,
  PersonaFileDiffCard: () => PersonaFileDiffCard,
  PersonaFileSkeletonRow: () => PersonaFileSkeletonRow,
  PersonaFilesDrawer: () => PersonaFilesDrawer,
  PersonaGrepResultsCard: () => PersonaGrepResultsCard,
  PersonaInterruptCard: () => PersonaInterruptCard,
  PersonaLsDirectoryCard: () => PersonaLsDirectoryCard,
  PersonaMarkdown: () => PersonaMarkdown,
  PersonaMcpConnectBanner: () => PersonaMcpConnectBanner,
  PersonaMessageFeed: () => PersonaMessageFeed,
  PersonaMessageSkeletonRow: () => PersonaMessageSkeletonRow,
  PersonaReadFileCard: () => PersonaReadFileCard,
  PersonaSearchResultsCard: () => PersonaSearchResultsCard,
  PersonaSidebar: () => PersonaSidebar,
  PersonaSkeleton: () => PersonaSkeleton,
  PersonaSubagentActivityDialog: () => PersonaSubagentActivityDialog,
  PersonaThreadSkeletonRow: () => PersonaThreadSkeletonRow,
  PersonaToolGroup: () => PersonaToolGroup,
  PersonaToolTrace: () => PersonaToolTrace,
  VERSION: () => VERSION,
  buildSubagentTimeline: () => buildSubagentTimeline,
  buildThemeStyles: () => buildThemeStyles,
  classifySubagentStatus: () => classifySubagentStatus,
  cn: () => cn,
  computeFileDiffStats: () => computeFileDiffStats,
  computeLineDiff: () => computeLineDiff,
  getDomain: () => getDomain,
  getFilePathFromArgs: () => getFilePathFromArgs,
  getToolIcon: () => getToolIcon,
  getToolTitle: () => getToolTitle,
  groupToolCalls: () => groupToolCalls,
  isFileEditTool: () => isFileEditTool,
  isFileWriteTool: () => isFileWriteTool,
  isGrepTool: () => isGrepTool,
  isKbListSourcesTool: () => isKbListSourcesTool,
  isKbSearchTool: () => isKbSearchTool,
  isLsTool: () => isLsTool,
  isReadFileTool: () => isReadFileTool,
  isSubagentTool: () => isSubagentTool,
  isWebSearchTool: () => isWebSearchTool,
  parseGrepResults: () => parseGrepResults,
  parseLsResults: () => parseLsResults,
  queryFromArgs: () => queryFromArgs,
  searchResults: () => searchResults,
  toolGroupKey: () => toolGroupKey,
  usePersonaChatWidget: () => usePersonaChatWidget
});
module.exports = __toCommonJS(index_exports);

// src/utils/cn.ts
var import_clsx = require("clsx");
var import_tailwind_merge = require("tailwind-merge");
function cn(...inputs) {
  return (0, import_tailwind_merge.twMerge)((0, import_clsx.clsx)(inputs));
}

// src/hooks/usePersonaChatWidget.ts
var import_react = require("react");
var import_react2 = require("@personaai/react");
function usePersonaChatWidget(options = {}) {
  const { agentId, threadId: controlledThreadId, onThreadChange, defaultSidebarOpen = true } = options;
  const [internalThreadId, setInternalThreadId] = (0, import_react.useState)(void 0);
  const activeThreadId = controlledThreadId !== void 0 ? controlledThreadId : internalThreadId;
  const [sidebarOpen, setSidebarOpen] = (0, import_react.useState)(defaultSidebarOpen);
  const [filesDrawerOpen, setFilesDrawerOpen] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (defaultSidebarOpen && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);
  const {
    threads,
    createThread,
    deleteThread,
    renameThread,
    isLoading: threadsLoading
  } = (0, import_react2.useThreads)();
  const { files, uploadFile, deleteFile, isLoading: filesLoading } = (0, import_react2.useFiles)();
  const {
    memory,
    getFile: getMemoryFile,
    deleteFile: deleteMemoryFile,
    isLoading: memoryLoading
  } = (0, import_react2.useMemory)();
  const chat = (0, import_react2.useChat)({ agentId, threadId: activeThreadId });
  const { unconnected: unconnectedMcps, isLoading: mcpConnectionsLoading } = (0, import_react2.useMcpConnections)({
    agentId
  });
  const setActiveThread = (0, import_react.useCallback)(
    (id) => {
      if (onThreadChange) onThreadChange(id);
      else setInternalThreadId(id);
    },
    [onThreadChange]
  );
  const handleSelectThread = (0, import_react.useCallback)(
    (id) => {
      chat.clear();
      setActiveThread(id);
    },
    [chat, setActiveThread]
  );
  const handleNewChat = (0, import_react.useCallback)(() => {
    chat.clear();
    setActiveThread(void 0);
  }, [chat, setActiveThread]);
  const handleSend = (0, import_react.useCallback)(
    (content) => {
      const threadId = activeThreadId ? Promise.resolve(activeThreadId) : createThread(agentId).then((t) => {
        if (t?._id) setActiveThread(t._id);
        return t?._id;
      }).catch(() => void 0);
      void chat.sendMessage(content, { threadId });
    },
    [activeThreadId, agentId, createThread, chat, setActiveThread]
  );
  (0, import_react.useEffect)(() => {
    if (chat.presentedFile) setFilesDrawerOpen(true);
  }, [chat.presentedFile]);
  const handleUploadFile = (0, import_react.useCallback)(
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
    threadsLoading,
    // uploaded files
    files,
    deleteFile,
    filesLoading,
    // memory
    memory,
    getMemoryFile,
    deleteMemoryFile,
    memoryLoading,
    // MCP connections — every authType:'oauth', authMode:'user' MCP this
    // Agent needs that the current user hasn't authorized yet
    unconnectedMcps,
    mcpConnectionsLoading,
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
    "--persona-muted-text": theme.mutedTextColor,
    "--persona-border": theme.borderColor,
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
var import_react3 = require("react");
var import_lucide_react = require("lucide-react");

// src/components/PersonaSkeleton.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function PersonaSkeleton({ className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: cn(
        "animate-pulse rounded-lg bg-[var(--persona-border,#e4e4e7)]/70 dark:bg-[var(--persona-border,#27272a)]/70",
        className
      )
    }
  );
}
function PersonaMessageSkeletonRow({ align = "left" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cn("flex items-start gap-2.5", align === "right" && "flex-row-reverse"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "size-8 shrink-0 rounded-xl" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cn("flex max-w-[70%] flex-col gap-1.5", align === "right" && "items-end"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "h-3 w-40" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "h-3 w-56" })
    ] })
  ] });
}
function PersonaThreadSkeletonRow() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex items-center gap-2 px-3 py-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "size-1.5 shrink-0 rounded-full" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "h-3 w-full" })
  ] });
}
function PersonaFileSkeletonRow() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex items-center gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "size-4 shrink-0 rounded" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PersonaSkeleton, { className: "h-3 w-2/3" })
  ] });
}

// src/components/PersonaSidebar.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  isLoading,
  className
}) {
  const [search, setSearch] = (0, import_react3.useState)("");
  const [renamingId, setRenamingId] = (0, import_react3.useState)(null);
  const [renameValue, setRenameValue] = (0, import_react3.useState)("");
  const filteredThreads = (0, import_react3.useMemo)(() => {
    if (!search.trim()) return threads;
    return threads.filter(
      (t) => (t.title || "New Chat").toLowerCase().includes(search.toLowerCase())
    );
  }, [threads, search]);
  const groups = (0, import_react3.useMemo)(() => groupThreadsByDate(filteredThreads), [filteredThreads]);
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
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mb-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-1.5 space-y-0.5", children: items.map((thread) => {
        const isActive = thread._id === activeThreadId;
        const isRenaming = renamingId === thread._id;
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            className: cn(
              "group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all",
              isActive ? "bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
            ),
            children: isRenaming ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex flex-1 items-center gap-1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => commitRename(thread._id),
                  className: "p-1 text-emerald-500 hover:opacity-80",
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Check, { className: "size-3" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setRenamingId(null),
                  className: "p-1 text-red-500 hover:opacity-80",
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.X, { className: "size-3" })
                }
              )
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => onSelectThread(thread._id),
                  className: "flex flex-1 items-center gap-2 truncate text-left",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "span",
                      {
                        className: cn(
                          "size-1.5 shrink-0 rounded-full",
                          isActive ? "bg-[var(--persona-primary,#3b82f6)]" : "bg-transparent"
                        )
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.MessageSquare, { className: "size-3.5 shrink-0 opacity-60" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "truncate", children: thread.title || "New Conversation" })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                onRenameThread && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      startRename(thread);
                    },
                    className: "rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                    children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Edit2, { className: "size-3" })
                  }
                ),
                onDeleteThread && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      onDeleteThread(thread._id);
                    },
                    className: "rounded p-1 text-zinc-400 hover:text-red-500",
                    children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Trash2, { className: "size-3" })
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: "absolute inset-0 z-20 bg-black/30 @3xl/persona-chat:hidden",
        onClick: onClose,
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "aside",
      {
        className: cn(
          // absolute + max-w-[80cqw] (not fixed + 80vw): scoped to
          // PersonaChatView's own (relative, @container) root instead of
          // the browser viewport, so this is correctly capped to a small
          // host like PersonaChatLauncher's floating panel too.
          "absolute inset-y-0 left-0 z-30 flex w-72 max-w-[80cqw] flex-col border-r border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)] shadow-2xl dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-card,#18181b)]",
          "@3xl/persona-chat:static @3xl/persona-chat:z-auto @3xl/persona-chat:w-60 @3xl/persona-chat:max-w-none @3xl/persona-chat:shadow-none",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "p-3", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              type: "button",
              onClick: onCreateThread,
              className: "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#ffffff)] px-4 py-2.5 text-xs font-semibold text-[var(--persona-text,#27272a)] shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.98] dark:border-[var(--persona-border,#3f3f46)] dark:bg-[var(--persona-bg,#27272a)] dark:text-[var(--persona-text,#f4f4f5)] dark:hover:bg-zinc-700",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Plus, { className: "size-3.5" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "New Chat" })
              ]
            }
          ) }),
          threads.length > 5 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "relative my-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_lucide_react.Search, { className: "absolute left-2.5 top-2 size-3.5 text-zinc-400" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                value: search,
                onChange: (e) => setSearch(e.target.value),
                placeholder: "Search conversations...",
                className: "w-full rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#ffffff)] py-1.5 pl-8 pr-3 text-xs text-[var(--persona-text,#27272a)] placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-bg,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin", children: isLoading && filteredThreads.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "space-y-0.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PersonaThreadSkeletonRow, {}),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PersonaThreadSkeletonRow, {}),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PersonaThreadSkeletonRow, {})
          ] }) : filteredThreads.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "p-4 text-center text-xs text-zinc-400", children: "No past conversations." }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
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
var import_react12 = require("react");

// src/components/PersonaToolTrace.tsx
var import_react10 = require("react");

// src/utils/toolPresentation.ts
var import_lucide_react2 = require("lucide-react");
function asRecord(value) {
  return typeof value === "object" && value !== null ? value : {};
}
function firstString(args, keys) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
}
function isWebSearchTool(name) {
  const n = name.toLowerCase();
  return n === "search_web" || n.includes("google") || n.startsWith("tavily");
}
function isKbSearchTool(name) {
  const n = name.toLowerCase();
  return !isWebSearchTool(name) && (n === "search_knowledge_base" || n.startsWith("search_") && n !== "search_web");
}
function isKbListSourcesTool(name) {
  const n = name.toLowerCase();
  return n === "list_knowledge_base_sources" || n.startsWith("list_sources_");
}
function isGrepTool(name) {
  return name.toLowerCase().includes("grep");
}
function isReadFileTool(name) {
  const n = name.toLowerCase();
  return n === "read_file" || n === "view_file" || n.includes("read_file") || n.includes("view_file");
}
function isLsTool(name) {
  const n = name.toLowerCase();
  return n === "ls" || n === "list_dir" || n === "list_directory" || n.includes("list_dir") || n.includes("list_directory");
}
function isFileWriteTool(name) {
  return name.toLowerCase() === "write_file";
}
function isFileEditTool(name) {
  return name.toLowerCase() === "edit_file";
}
function isSubagentTool(name) {
  return name.toLowerCase() === "task";
}
function getToolIcon(toolName) {
  const n = toolName.toLowerCase();
  if (isWebSearchTool(toolName)) return import_lucide_react2.Globe;
  if (isKbSearchTool(toolName) || isKbListSourcesTool(toolName)) return import_lucide_react2.BookText;
  if (isGrepTool(toolName)) return import_lucide_react2.Search;
  if (n.includes("todo")) return import_lucide_react2.ListTodo;
  if (isSubagentTool(toolName)) return import_lucide_react2.Bot;
  if (isReadFileTool(toolName) || isLsTool(toolName) || isFileWriteTool(toolName) || isFileEditTool(toolName) || n.includes("file")) {
    return import_lucide_react2.FileText;
  }
  return import_lucide_react2.Wrench;
}
function queryFromArgs(args) {
  const record = asRecord(args);
  const value = firstString(record, ["query", "q", "search_query", "text", "input"]);
  return value;
}
function getToolTitle(toolName, args, status) {
  const done = status === "completed";
  const query = queryFromArgs(args);
  const record = asRecord(args);
  if (isWebSearchTool(toolName)) {
    if (query) return done ? `Searched the web for "${query}"` : `Searching the web for "${query}"`;
    return done ? "Searched the web" : "Searching the web";
  }
  if (isKbSearchTool(toolName) || isKbListSourcesTool(toolName)) {
    const kbName = firstString(record, ["knowledgeBaseName"]) || "Knowledge Base";
    const isSearch = !isKbListSourcesTool(toolName);
    const kbQuery = firstString(record, ["query"]) || query;
    if (isSearch) {
      if (kbQuery) return done ? `Searched knowledge base "${kbName}" for "${kbQuery}"` : `Searching knowledge base "${kbName}" for "${kbQuery}"`;
      return done ? `Searched knowledge base "${kbName}"` : `Searching knowledge base "${kbName}"`;
    }
    return done ? `Listed documents in "${kbName}"` : `Listing documents in "${kbName}"`;
  }
  if (toolName.toLowerCase().includes("todo")) {
    return done ? "Updated the plan" : "Updating the plan";
  }
  if (isReadFileTool(toolName)) {
    return done ? "Read file" : "Reading file";
  }
  if (isLsTool(toolName)) {
    return done ? "Listed directory" : "Listing directory";
  }
  if (isSubagentTool(toolName)) {
    const subagentType = firstString(record, ["subagent_type"]);
    const label = subagentType ? `${subagentType} subagent` : "subagent";
    return done ? `Ran ${label}` : `Running ${label}`;
  }
  if (toolName.toLowerCase().includes("file") || toolName.toLowerCase() === "glob") {
    return done ? "Updated files" : "Working with files";
  }
  return toolName.split(/[_\-\s]/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}
function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function searchResults(result) {
  if (Array.isArray(result)) return result;
  const record = asRecord(result);
  if (Array.isArray(record.results)) return record.results;
  return [];
}
function parseLsResults(result) {
  if (Array.isArray(result)) {
    return result.map((item) => {
      if (typeof item === "string") {
        const isDir = item.endsWith("/") || item.includes("(directory)");
        return { name: item.replace(/\(directory\)/g, "").trim(), isDir };
      }
      const record = asRecord(item);
      return {
        name: String(record.name ?? record.path ?? ""),
        isDir: Boolean(record.isDir ?? record.is_dir ?? record.isDirectory)
      };
    });
  }
  if (typeof result !== "string" || !result) return [];
  return result.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const isDir = line.endsWith("/") || line.toLowerCase().includes("(directory)") || line.toLowerCase().includes("(dir)");
    const name = line.replace(/\(directory\)/gi, "").replace(/\(dir\)/gi, "").trim();
    return { name, isDir };
  });
}
function parseGrepResults(result) {
  const record = Array.isArray(result) ? { matches: result } : asRecord(result);
  const matches = Array.isArray(record.matches) ? record.matches : Array.isArray(record.results) ? record.results : null;
  if (Array.isArray(matches)) {
    return matches.map((m) => {
      const row = asRecord(m);
      return {
        file: String(row.Filename ?? row.filename ?? row.file ?? row.path ?? ""),
        line: Number(row.LineNumber ?? row.lineNumber ?? row.line ?? 0),
        content: String(row.LineContent ?? row.lineContent ?? row.content ?? "")
      };
    }).filter((m) => m.file);
  }
  if (typeof result !== "string" || !result) return [];
  const out = [];
  const lines = result.split("\n");
  let currentFile = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.endsWith(":") && !/^\d+:/.test(line)) {
      currentFile = line.slice(0, -1).trim();
    } else if (currentFile) {
      const match = line.match(/^(\d+):(.*)$/);
      if (match) {
        out.push({ file: currentFile, line: parseInt(match[1], 10), content: match[2] });
      } else {
        out.push({ file: currentFile, line: 0, content: line });
      }
    }
  }
  if (out.length === 0) {
    return lines.map((l) => l.trim()).filter((l) => l && (l.startsWith("/") || l.includes(".") || l.includes("\\"))).map((l) => ({ file: l, line: 0, content: "" }));
  }
  return out;
}
function computeLineDiff(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;
  if (n * m > 25e4) {
    return [
      ...oldLines.map((line) => ({ type: "remove", line })),
      ...newLines.map((line) => ({ type: "add", line }))
    ];
  }
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i2 = n - 1; i2 >= 0; i2--) {
    for (let j2 = m - 1; j2 >= 0; j2--) {
      dp[i2][j2] = oldLines[i2] === newLines[j2] ? dp[i2 + 1][j2 + 1] + 1 : Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: "context", line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "remove", line: oldLines[i] });
      i++;
    } else {
      rows.push({ type: "add", line: newLines[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: "remove", line: oldLines[i++] });
  while (j < m) rows.push({ type: "add", line: newLines[j++] });
  return rows;
}
function computeFileDiffStats(toolName, args) {
  const record = asRecord(args);
  if (isFileWriteTool(toolName)) {
    if (typeof record.content !== "string") return null;
    return { added: record.content.split("\n").length, removed: 0 };
  }
  if (isFileEditTool(toolName)) {
    if (typeof record.old_string !== "string" && typeof record.new_string !== "string") return null;
    const rows = computeLineDiff(
      String(record.old_string ?? "").split("\n"),
      String(record.new_string ?? "").split("\n")
    );
    return {
      added: rows.filter((r) => r.type === "add").length,
      removed: rows.filter((r) => r.type === "remove").length
    };
  }
  return null;
}
function getFilePathFromArgs(args) {
  const record = asRecord(args);
  return firstString(record, ["file_path", "filePath", "path", "filename", "fileName", "targetFile", "target_file"]);
}

// src/utils/subagentTimeline.ts
function buildSubagentTimeline(entries) {
  const items = [];
  const openByName = /* @__PURE__ */ new Map();
  let counter = 0;
  for (const entry of entries) {
    if (entry.kind === "text") {
      const last = items[items.length - 1];
      if (last?.kind === "text") {
        last.text += entry.delta || "";
      } else {
        items.push({ kind: "text", text: entry.delta || "" });
      }
      continue;
    }
    if (entry.kind === "tool_start") {
      const toolCall = {
        toolCallId: `subagent-tool-${counter++}`,
        toolName: entry.toolName || "tool",
        args: entry.args
      };
      items.push({ kind: "tool", toolCall });
      const name2 = entry.toolName || "";
      const queue2 = openByName.get(name2) ?? [];
      queue2.push(toolCall);
      openByName.set(name2, queue2);
      continue;
    }
    const name = entry.toolName || "";
    const queue = openByName.get(name);
    const target = queue?.shift();
    if (target) {
      target.result = entry.result;
    } else {
      items.push({
        kind: "tool",
        toolCall: { toolCallId: `subagent-tool-${counter++}`, toolName: name || "tool", result: entry.result }
      });
    }
  }
  return items;
}
function safeParse(value) {
  if (!value) return void 0;
  try {
    return JSON.parse(value);
  } catch {
    return void 0;
  }
}
function classifySubagentStatus(toolCall, isLive) {
  const isExecuting = isLive && !toolCall.result && !toolCall.isError;
  if (isExecuting) return "running";
  if (toolCall.isError) {
    const parsed = safeParse(toolCall.result);
    const message = String(
      parsed && typeof parsed === "object" && parsed.message || toolCall.result || ""
    ).toLowerCase();
    if (/denied|reject|declin/.test(message)) return "denied";
    return "failed";
  }
  if (!toolCall.result) return "canceled";
  return "completed";
}

// src/components/tool-cards/PersonaSearchResultsCard.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function PersonaSearchResultsCard({ results, status, className }) {
  if (status !== "completed") {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: cn("space-y-1.5", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Searching..." }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "space-y-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "h-8 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "h-8 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40" })
      ] })
    ] });
  }
  if (!results.length) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: cn("text-xs italic text-zinc-500 dark:text-zinc-400", className), children: "No search results found." });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: cn("space-y-1.5", className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Search Results" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "max-h-48 space-y-1.5 overflow-auto", children: results.map((result, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "a",
      {
        href: result.url,
        target: "_blank",
        rel: "noreferrer",
        className: "flex items-center gap-3 rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] px-3 py-2 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-zinc-800/60 dark:bg-zinc-950 dark:hover:border-blue-500/30 dark:hover:bg-blue-950/10",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "img",
            {
              src: `https://www.google.com/s2/favicons?sz=32&domain=${getDomain(result.url || "")}`,
              alt: "",
              className: "size-3.5 shrink-0 rounded-sm"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "min-w-0 flex-1 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300", children: result.title || result.url }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "shrink-0 rounded border border-zinc-150 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500", children: getDomain(result.url || "") })
        ]
      },
      result.url || index
    )) })
  ] });
}

// src/components/tool-cards/PersonaReadFileCard.tsx
var import_react4 = require("react");
var import_lucide_react3 = require("lucide-react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var CODE_EXTENSIONS = /* @__PURE__ */ new Set(["js", "jsx", "ts", "tsx", "json", "html", "css", "py", "sh", "go", "rs", "md", "yaml", "yml"]);
function processLines(content, lineOffset) {
  if (!content) return { lines: [], lineNumbers: [] };
  const rawLines = content.split("\n");
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === "") rawLines.pop();
  const regex = /^\s*(\d+)(?:\s+(.*)|$)/;
  let isPrefixed = true;
  for (const line of rawLines) {
    if (line.trim() === "") continue;
    if (!regex.test(line)) {
      isPrefixed = false;
      break;
    }
  }
  if (isPrefixed && rawLines.length > 0) {
    const cleaned = [];
    const numbers = [];
    let lastNum = 0;
    for (const line of rawLines) {
      const match = line.match(regex);
      if (match) {
        cleaned.push(match[2] || "");
        lastNum = parseInt(match[1], 10);
        numbers.push(lastNum);
      } else {
        cleaned.push(line);
        lastNum += 1;
        numbers.push(lastNum);
      }
    }
    return { lines: cleaned, lineNumbers: numbers };
  }
  return { lines: rawLines, lineNumbers: rawLines.map((_, i) => lineOffset + i + 1) };
}
function PersonaReadFileCard({ filePath, content, status, lineOffset = 0, className }) {
  const { lines, lineNumbers } = (0, import_react4.useMemo)(() => processLines(content, lineOffset), [content, lineOffset]);
  const done = status === "completed";
  const fileName = filePath.split("/").pop() || filePath;
  const fileExt = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";
  const isCode = fileExt ? CODE_EXTENSIONS.has(fileExt) : false;
  const FileIcon = isCode ? import_lucide_react3.FileCode : import_lucide_react3.FileText;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: cn("flex flex-col overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] dark:border-zinc-800 dark:bg-zinc-950", className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center gap-2.5 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-3.5 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FileIcon, { className: "size-4" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "truncate text-xs font-bold text-zinc-800 dark:text-zinc-100", children: filePath })
    ] }),
    !done ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-col items-center justify-center py-10 text-center text-zinc-400 dark:text-zinc-500", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.Loader2, { className: "mb-2 size-6 animate-spin text-indigo-500 opacity-70" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[11px] font-bold uppercase tracking-wider", children: "Reading file content..." })
    ] }) : content ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "relative max-h-72 overflow-auto border-t border-[var(--persona-border,#e4e4e7)] bg-[#0D1117] font-mono text-[11.5px] text-[#C9D1D9] dark:border-zinc-850", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex min-w-full", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "w-10 shrink-0 select-none border-r border-[#30363D] bg-[#161B22]/50 py-3 pr-3 text-right text-[10px] font-bold text-[#8B949E]", children: lineNumbers.map((num, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "h-5 leading-5", children: num }, i)) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "flex-1 select-text overflow-x-auto py-3 pl-3 pr-4", children: lines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "h-5 whitespace-pre font-mono leading-5 text-[#E6EDF2]", children: line || " " }, i)) })
    ] }) }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex flex-col items-center justify-center py-8 text-center text-zinc-400 dark:text-zinc-500", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_lucide_react3.FileText, { className: "mb-2 size-8 opacity-40" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "text-[11px] font-bold uppercase tracking-wider", children: "Empty file or no content" })
    ] }),
    done && content && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex items-center justify-between border-t border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/50 px-4 py-2 text-[10px] font-bold uppercase tracking-tight text-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/20 dark:text-zinc-500", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        "Showing lines ",
        lineNumbers[0],
        "-",
        lineNumbers[lineNumbers.length - 1]
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        lines.length,
        " lines"
      ] })
    ] })
  ] });
}

// src/components/tool-cards/PersonaLsDirectoryCard.tsx
var import_lucide_react4 = require("lucide-react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function PersonaLsDirectoryCard({ path, entries, status, className }) {
  const done = status === "completed";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: cn("flex flex-col overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)]/95 dark:border-zinc-800 dark:bg-zinc-900/95", className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center gap-2.5 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-3.5 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/50", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.Folder, { className: "size-4" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate text-xs font-bold text-zinc-900 dark:text-zinc-100", children: path })
    ] }),
    !done ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-col items-center justify-center p-5 text-center text-zinc-400 dark:text-zinc-500", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.Loader2, { className: "mb-1.5 size-6 animate-spin text-blue-500 opacity-70" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-[11px] font-semibold", children: "Listing Directory Contents..." })
    ] }) : entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "max-h-56 divide-y divide-[var(--persona-border,#e4e4e7)]/70 overflow-auto dark:divide-zinc-800/60", children: entries.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex items-center justify-between px-3.5 py-2 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
        item.isDir ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.Folder, { className: "size-4 shrink-0 text-amber-500" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.FileText, { className: "size-4 shrink-0 text-zinc-400 dark:text-zinc-500" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "truncate font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300", children: item.name })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "span",
        {
          className: cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
            item.isDir ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          ),
          children: item.isDir ? "dir" : "file"
        }
      )
    ] }, index)) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "flex flex-col items-center justify-center p-5 text-center text-zinc-400 dark:text-zinc-500", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_lucide_react4.FolderOpen, { className: "mb-1.5 size-7 opacity-50" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "text-[11px] font-bold", children: "Empty Directory" })
    ] })
  ] });
}

// src/components/tool-cards/PersonaGrepResultsCard.tsx
var import_react5 = __toESM(require("react"), 1);
var import_lucide_react5 = require("lucide-react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var CODE_EXTENSIONS2 = /* @__PURE__ */ new Set(["JS", "JSX", "TS", "TSX", "JSON", "HTML", "CSS", "PY", "SH", "GO", "RS", "MD"]);
function escapeRegex(value) {
  return value.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}
function HighlightMatch({ text, query }) {
  if (!query) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: text });
  try {
    const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: parts.map(
      (part, i) => part.toLowerCase() === query.toLowerCase() ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("mark", { className: "rounded-[2px] bg-yellow-100 px-0.5 font-semibold text-zinc-900 dark:bg-yellow-500/35 dark:text-zinc-100", children: part }, i) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react5.default.Fragment, { children: part }, i)
    ) });
  } catch {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: text });
  }
}
function PersonaGrepResultsCard({ query, path, matches, status, className }) {
  const done = status === "completed";
  const fileGroups = (0, import_react5.useMemo)(() => {
    const groups = /* @__PURE__ */ new Map();
    for (const match of matches) {
      const list = groups.get(match.file) ?? [];
      list.push(match);
      groups.set(match.file, list);
    }
    return [...groups.entries()];
  }, [matches]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: cn("space-y-3", className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex flex-wrap items-center gap-1.5 text-xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Grep:" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-400", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_lucide_react5.Search, { className: "size-3" }),
        '"',
        query,
        '"'
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-zinc-400 dark:text-zinc-500", children: "in" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", children: path })
    ] }),
    !done ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "space-y-1.5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Grep Searching..." }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "h-8 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40" })
    ] }) : fileGroups.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "max-h-60 space-y-2.5 overflow-auto pr-1", children: fileGroups.map(([filePath, fileMatches]) => {
      const fileName = filePath.split("/").pop() || filePath;
      const ext = fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() : "FILE";
      const FileIcon = ext && CODE_EXTENSIONS2.has(ext) ? import_lucide_react5.FileCode : import_lucide_react5.FileText;
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] dark:border-zinc-800/80 dark:bg-zinc-950", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-center gap-2 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/60 px-3 py-1.5 dark:border-zinc-850 dark:bg-zinc-900/40", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FileIcon, { className: "size-3.5 text-zinc-400 dark:text-zinc-500" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "text-xs font-bold text-zinc-800 dark:text-zinc-200", children: filePath }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "ml-auto rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-bold text-zinc-500 dark:bg-zinc-850 dark:text-zinc-400", children: [
            fileMatches.length,
            " ",
            fileMatches.length === 1 ? "match" : "matches"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "divide-y divide-zinc-50 font-mono text-[11px] leading-relaxed dark:divide-zinc-850", children: fileMatches.map((match, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30", children: [
          match.line > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "w-9 shrink-0 select-none border-r border-[var(--persona-border,#e4e4e7)] py-1.5 pr-2.5 text-right font-bold text-zinc-400 dark:border-zinc-850 dark:text-zinc-600", children: match.line }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "flex-1 whitespace-pre-wrap break-all py-1.5 pl-3 pr-2 text-zinc-600 dark:text-zinc-300", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HighlightMatch, { text: match.content, query }) })
        ] }, i)) })
      ] }, filePath);
    }) }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "text-xs italic text-zinc-500 dark:text-zinc-400", children: "No matches found." })
  ] });
}

// src/components/tool-cards/PersonaFileDiffCard.tsx
var import_react6 = require("react");
var import_lucide_react6 = require("lucide-react");
var import_jsx_runtime7 = require("react/jsx-runtime");
var CODE_EXTENSIONS3 = /* @__PURE__ */ new Set(["JS", "JSX", "TS", "TSX", "JSON", "HTML", "CSS", "PY", "SH", "GO", "RS", "MD"]);
function PersonaFileDiffCard({ filePath, oldContent, newContent, note, className }) {
  const rows = (0, import_react6.useMemo)(
    () => computeLineDiff(oldContent.split("\n"), newContent.split("\n")),
    [oldContent, newContent]
  );
  const added = rows.filter((r) => r.type === "add").length;
  const removed = rows.filter((r) => r.type === "remove").length;
  const fileName = filePath.split("/").pop() || filePath;
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() : "FILE";
  const FileIcon = ext && CODE_EXTENSIONS3.has(ext) ? import_lucide_react6.FileCode : import_lucide_react6.FileText;
  let oldNo = 1;
  let newNo = 1;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cn("flex flex-col overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] dark:border-zinc-800 dark:bg-zinc-950", className), children: [
    filePath && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex items-center justify-between border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-3.5 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "flex min-w-0 items-center gap-2.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FileIcon, { className: "size-4" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "truncate text-xs font-bold text-zinc-800 dark:text-zinc-100", children: filePath })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "shrink-0 font-mono text-[10px] font-bold tabular-nums", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "text-emerald-600 dark:text-emerald-400", children: [
          "+",
          added
        ] }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "text-red-500 dark:text-red-400", children: [
          "-",
          removed
        ] })
      ] })
    ] }),
    note && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/40 px-3.5 py-1.5 text-[10px] font-semibold text-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/20 dark:text-zinc-500", children: note }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "max-h-72 overflow-auto font-mono text-[11.5px] leading-5", children: rows.map((row, index) => {
      const displayOldNo = row.type !== "add" ? oldNo++ : null;
      const displayNewNo = row.type !== "remove" ? newNo++ : null;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          className: cn(
            "flex",
            row.type === "add" && "bg-emerald-50 dark:bg-emerald-500/10",
            row.type === "remove" && "bg-red-50 dark:bg-red-500/10"
          ),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "w-8 shrink-0 select-none border-r border-[var(--persona-border,#e4e4e7)] px-1.5 text-right text-zinc-350 dark:border-zinc-800/80 dark:text-zinc-600", children: displayOldNo ?? "" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "w-8 shrink-0 select-none border-r border-[var(--persona-border,#e4e4e7)] px-1.5 text-right text-zinc-350 dark:border-zinc-800/80 dark:text-zinc-600", children: displayNewNo ?? "" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "span",
              {
                className: cn(
                  "w-4 shrink-0 select-none text-center font-bold",
                  row.type === "add" && "text-emerald-600 dark:text-emerald-400",
                  row.type === "remove" && "text-red-500 dark:text-red-400"
                ),
                children: row.type === "add" ? "+" : row.type === "remove" ? "-" : ""
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "flex-1 whitespace-pre px-1.5 text-zinc-700 dark:text-zinc-300", children: row.line || " " })
          ]
        },
        index
      );
    }) })
  ] });
}

// src/components/PersonaSubagentActivityDialog.tsx
var import_react9 = require("react");

// src/components/PersonaDialog.tsx
var import_react7 = require("react");
var import_react_dom = require("react-dom");
var import_lucide_react7 = require("lucide-react");
var import_jsx_runtime8 = require("react/jsx-runtime");
function PersonaDialog({ open, onOpenChange, children, className }) {
  (0, import_react7.useEffect)(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);
  if (!open || typeof document === "undefined") return null;
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "fixed inset-0 z-[10000] flex items-center justify-center p-4", role: "dialog", "aria-modal": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "absolute inset-0 bg-black/50", onClick: () => onOpenChange(false) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          className: cn(
            "relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#fff)] shadow-2xl dark:border-zinc-800 dark:bg-zinc-950",
            className
          ),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "button",
              {
                type: "button",
                onClick: () => onOpenChange(false),
                "aria-label": "Close",
                className: "absolute right-3 top-3 z-10 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_lucide_react7.X, { className: "size-4" })
              }
            ),
            children
          ]
        }
      )
    ] }),
    document.body
  );
}

// src/components/PersonaMarkdown.tsx
var import_react8 = require("react");
var import_react_markdown = __toESM(require("react-markdown"), 1);
var import_remark_gfm = __toESM(require("remark-gfm"), 1);
var import_remark_math = __toESM(require("remark-math"), 1);
var import_rehype_katex = __toESM(require("rehype-katex"), 1);
var import_lucide_react8 = require("lucide-react");
var import_jsx_runtime9 = require("react/jsx-runtime");
function CodeBlock({ className, children }) {
  const [copied, setCopied] = (0, import_react8.useState)(false);
  const language = /language-(\w+)/.exec(className || "")?.[1];
  const text = String(children).replace(/\n$/, "");
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "group/code relative my-2 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800/80", children: [
    language && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "flex items-center justify-between bg-zinc-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400", children: language }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "button",
      {
        type: "button",
        onClick: handleCopy,
        title: "Copy code",
        className: cn(
          "absolute right-2 top-2 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200/70 hover:text-zinc-700 group-hover/code:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
          !language && "top-2"
        ),
        children: copied ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react8.Check, { className: "size-3.5 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react8.Copy, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("pre", { className: "overflow-x-auto bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { className: "whitespace-pre break-words font-mono", children: text }) })
  ] });
}
function PersonaMarkdown({ content, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      className: cn(
        "min-w-0 space-y-2 text-[13px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      ),
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        import_react_markdown.default,
        {
          remarkPlugins: [import_remark_gfm.default, import_remark_math.default],
          rehypePlugins: [import_rehype_katex.default],
          components: {
            p: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "my-2 whitespace-pre-wrap break-words", children }),
            a: ({ href, children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "a",
              {
                href,
                target: "_blank",
                rel: "noreferrer",
                className: "font-medium text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:decoration-blue-400",
                children
              }
            ),
            ul: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("ul", { className: "my-2 list-disc space-y-1 pl-5", children }),
            ol: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("ol", { className: "my-2 list-decimal space-y-1 pl-5", children }),
            li: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("li", { className: "pl-0.5", children }),
            h1: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h1", { className: "mb-2 mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100", children }),
            h2: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h2", { className: "mb-1.5 mt-3 text-[15px] font-bold text-zinc-900 dark:text-zinc-100", children }),
            h3: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h3", { className: "mb-1 mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100", children }),
            h4: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("h4", { className: "mb-1 mt-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-100", children }),
            blockquote: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("blockquote", { className: "my-2 border-l-2 border-zinc-300 pl-3 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400", children }),
            hr: () => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("hr", { className: "my-3 border-zinc-200 dark:border-zinc-800" }),
            strong: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("strong", { className: "font-semibold", children }),
            table: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "my-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("table", { className: "w-full min-w-max border-collapse text-left text-xs", children }) }),
            thead: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("thead", { className: "bg-zinc-100 dark:bg-zinc-900", children }),
            th: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("th", { className: "border-b border-zinc-200 px-2.5 py-1.5 font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300", children }),
            td: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("td", { className: "border-b border-zinc-100 px-2.5 py-1.5 text-zinc-600 last:border-b-0 dark:border-zinc-900 dark:text-zinc-400", children }),
            code: ({ className: codeClassName, children }) => {
              const isBlock = /language-/.test(codeClassName || "");
              if (isBlock) return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CodeBlock, { className: codeClassName, children });
              return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { className: "rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children });
            },
            pre: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_jsx_runtime9.Fragment, { children })
          },
          children: content
        }
      )
    }
  );
}

// src/components/PersonaSubagentActivityDialog.tsx
var import_lucide_react9 = require("lucide-react");
var import_jsx_runtime10 = require("react/jsx-runtime");
var STATUS_META = {
  running: {
    label: "Running",
    icon: import_lucide_react9.Loader2,
    className: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
    spin: true
  },
  completed: {
    label: "Completed",
    icon: import_lucide_react9.Check,
    className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
  },
  failed: {
    label: "Failed",
    icon: import_lucide_react9.XCircle,
    className: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
  },
  denied: {
    label: "Denied",
    icon: import_lucide_react9.Ban,
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
  },
  canceled: {
    label: "Canceled",
    icon: import_lucide_react9.Ban,
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
  }
};
function asRecord2(value) {
  return typeof value === "object" && value !== null ? value : {};
}
function PersonaSubagentActivityDialog({
  toolCall,
  open,
  onOpenChange,
  toolRenderers,
  onOpenFile,
  isLive = false
}) {
  const args = (0, import_react9.useMemo)(() => {
    if (!toolCall?.args) return {};
    try {
      return asRecord2(JSON.parse(toolCall.args));
    } catch {
      return {};
    }
  }, [toolCall?.args]);
  const timeline = (0, import_react9.useMemo)(
    () => toolCall?.subagentActivity?.length ? buildSubagentTimeline(toolCall.subagentActivity) : [],
    [toolCall?.subagentActivity]
  );
  if (!toolCall) return null;
  const goal = String(args.description || args.task || args.goal || "Subagent task");
  const subagentType = args.subagent_type || args.subagentType;
  const status = classifySubagentStatus(toolCall, isLive);
  const { label, icon: StatusIcon, className: statusClassName, spin } = STATUS_META[status];
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(PersonaDialog, { open, onOpenChange, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "flex items-start justify-between gap-3 border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/70 px-4 py-3 pr-10 dark:border-zinc-800/80 dark:bg-zinc-900/40", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "min-w-0", children: [
        subagentType ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: [
          String(subagentType),
          " subagent"
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "mt-0.5 truncate text-sm font-bold text-zinc-900 dark:text-zinc-100", children: goal })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
        "span",
        {
          className: cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
            statusClassName
          ),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(StatusIcon, { className: cn("size-3.5", spin && "animate-spin") }),
            label
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "min-h-0 flex-1 overflow-auto p-3", children: timeline.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "space-y-2", children: timeline.map(
      (item, i) => item.kind === "text" ? item.text ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PersonaMarkdown, { content: item.text }, i) : null : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        PersonaToolTrace,
        {
          toolCall: item.toolCall,
          toolRenderers,
          onOpenFile,
          isLive
        },
        item.toolCall.toolCallId
      )
    ) }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "flex items-center justify-center py-8 text-xs italic text-zinc-400 dark:text-zinc-500", children: status === "running" ? "Waiting for activity\u2026" : "No activity recorded." }) })
  ] });
}

// src/components/PersonaToolTrace.tsx
var import_lucide_react10 = require("lucide-react");
var import_jsx_runtime11 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("ul", { className: "space-y-0", children: todos.map((todo, i) => {
    const isCompleted = todo.status === "completed";
    const isInProgress = todo.status === "in_progress";
    const Icon = isCompleted ? import_lucide_react10.CheckCircle2 : isInProgress ? import_lucide_react10.Clock : import_lucide_react10.Circle;
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("li", { className: "flex items-start gap-2 py-[3px]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        Icon,
        {
          className: cn(
            "mt-0.5 size-3.5 shrink-0",
            isCompleted ? "fill-blue-600 text-white dark:fill-blue-400 dark:text-zinc-900" : isInProgress ? "text-blue-600 dark:text-blue-400" : "text-zinc-300 dark:text-zinc-600"
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
function safeParseJson(value) {
  if (!value) return void 0;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function PersonaSubagentCompactRow({ toolCall }) {
  const Icon = getToolIcon(toolCall.toolName);
  const running = !toolCall.result && !toolCall.isError;
  const title = getToolTitle(toolCall.toolName, safeParseJson(toolCall.args), running ? "running" : "completed");
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex items-center gap-2 text-xs", children: [
    running ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Loader2, { className: "size-3.5 shrink-0 animate-spin text-orange-500" }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Check, { className: "size-3.5 shrink-0 text-emerald-500" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Icon, { className: "size-3.5 shrink-0 text-zinc-400" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "min-w-0 truncate font-medium text-zinc-600 dark:text-zinc-300", children: title })
  ] });
}
function PersonaSubagentLivePreview({ activity }) {
  const items = (0, import_react10.useMemo)(() => buildSubagentTimeline(activity).slice(-4), [activity]);
  if (items.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "border-t border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)]/60 px-3 py-2 dark:border-zinc-800/60 dark:bg-zinc-900/40", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Bot, { className: "size-3 animate-pulse text-orange-500" }),
      "Subagent working"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "space-y-1", children: items.map(
      (item, i) => item.kind === "text" ? item.text.trim() ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "whitespace-pre-wrap break-words text-xs leading-5 text-zinc-500 dark:text-zinc-400", children: item.text.trimEnd().split("\n").slice(-2).join("\n") }, i) : null : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaSubagentCompactRow, { toolCall: item.toolCall }, item.toolCall.toolCallId)
    ) })
  ] });
}
function PersonaToolTrace({
  toolCall,
  toolRenderers,
  onOpenFile,
  isLive = false,
  className
}) {
  const [isOpen, setIsOpen] = (0, import_react10.useState)(false);
  const [dialogOpen, setDialogOpen] = (0, import_react10.useState)(false);
  const parsedArgs = (0, import_react10.useMemo)(() => {
    if (!toolCall.args) return void 0;
    try {
      return JSON.parse(toolCall.args);
    } catch {
      return toolCall.args;
    }
  }, [toolCall.args]);
  const parsedResult = (0, import_react10.useMemo)(() => {
    if (!toolCall.result) return void 0;
    try {
      return JSON.parse(toolCall.result);
    } catch {
      return toolCall.result;
    }
  }, [toolCall.result]);
  const isExecuting = isLive && !toolCall.result && !toolCall.isError;
  const status = isExecuting ? "running" : "completed";
  const isTodo = isTodoTool(toolCall.toolName);
  const todos = (0, import_react10.useMemo)(
    () => isTodo ? parseTodos(parsedArgs, parsedResult) : null,
    [isTodo, parsedArgs, parsedResult]
  );
  const todosDone = todos ? todos.filter((t) => t.status === "completed").length : 0;
  const isSubagent = isSubagentTool(toolCall.toolName);
  const subToolUses = (0, import_react10.useMemo)(
    () => (toolCall.subagentActivity || []).filter((e) => e.kind === "tool_start").length,
    [toolCall.subagentActivity]
  );
  const ToolIcon = getToolIcon(toolCall.toolName);
  const toolTitle = getToolTitle(toolCall.toolName, parsedArgs, status);
  const diffStats = !toolCall.isError ? computeFileDiffStats(toolCall.toolName, parsedArgs) : null;
  const isLs = isLsTool(toolCall.toolName);
  const isRead = isReadFileTool(toolCall.toolName);
  const isSearch = isWebSearchTool(toolCall.toolName);
  const isGrep = isGrepTool(toolCall.toolName);
  const isDiff = (isFileWriteTool(toolCall.toolName) || isFileEditTool(toolCall.toolName)) && diffStats !== null;
  const results = (0, import_react10.useMemo)(() => isSearch ? searchResults(parsedResult) : [], [isSearch, parsedResult]);
  const lsEntries = (0, import_react10.useMemo)(() => isLs ? parseLsResults(parsedResult) : [], [isLs, parsedResult]);
  const grepMatches = (0, import_react10.useMemo)(() => isGrep ? parseGrepResults(parsedResult) : [], [isGrep, parsedResult]);
  const grepArgs = typeof parsedArgs === "object" && parsedArgs || {};
  const grepQuery = String(grepArgs.pattern ?? grepArgs.Query ?? grepArgs.query ?? "");
  const grepPath = String(grepArgs.path ?? grepArgs.SearchPath ?? grepArgs.searchPath ?? "/");
  const readFilePath = isRead ? getFilePathFromArgs(parsedArgs) : "";
  const CustomRenderer = toolRenderers?.[toolCall.toolName] || toolRenderers?.default;
  if (CustomRenderer && toolCall.result) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: cn("my-2", className), children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
      "div",
      {
        className: cn(
          "my-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/80 bg-[var(--persona-card,#fafafa)]/50 p-2.5 text-xs dark:border-[var(--persona-border,#27272a)]/80 dark:bg-[var(--persona-card,#18181b)]/40",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.FileText, { className: "size-4" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "min-w-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100", children: fileName }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "truncate text-[10px] text-zinc-500 dark:text-zinc-400", children: description || filePath })
            ] })
          ] }),
          filePath && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    "div",
    {
      className: cn(
        "my-2 min-w-0 overflow-hidden rounded-xl border border-[var(--persona-border,#e4e4e7)]/80 bg-[var(--persona-card,#fafafa)]/50 text-xs dark:border-[var(--persona-border,#27272a)]/80 dark:bg-[var(--persona-card,#18181b)]/40",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
          "button",
          {
            type: "button",
            onClick: () => isSubagent ? setDialogOpen(true) : setIsOpen((prev) => !prev),
            className: "flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ToolIcon, { className: cn("size-3.5 shrink-0", toolCall.isError ? "text-red-500" : "text-zinc-500") }),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "truncate font-semibold text-zinc-800 dark:text-zinc-200", children: [
                  todos ? `Plan (${todosDone}/${todos.length})` : toolTitle,
                  isSubagent && subToolUses > 0 ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "ml-1.5 font-normal text-zinc-400 dark:text-zinc-500", children: [
                    "\xB7 ",
                    subToolUses,
                    " tool ",
                    subToolUses === 1 ? "use" : "uses"
                  ] }) : null
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "flex shrink-0 items-center gap-2", children: [
                todos ? null : diffStats ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "font-mono text-[11px] font-bold tabular-nums", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "text-emerald-600 dark:text-emerald-400", children: [
                    "+",
                    diffStats.added
                  ] }),
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "text-red-500 dark:text-red-400", children: [
                    "-",
                    diffStats.removed
                  ] })
                ] }) : isExecuting ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "flex items-center gap-1 text-[11px] text-blue-500", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.Loader2, { className: "size-3 animate-spin" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Running..." })
                ] }) : toolCall.isError ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "flex items-center gap-1 text-[11px] text-red-500", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.AlertCircle, { className: "size-3" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Error" })
                ] }) : isSearch && results.length ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400", children: [
                  results.length,
                  " results"
                ] }) : isGrep && grepMatches.length ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400", children: [
                  grepMatches.length,
                  " matches"
                ] }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "flex items-center gap-1 text-[11px] text-emerald-500", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.CheckCircle2, { className: "size-3" }),
                  /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "Complete" })
                ] }),
                isOpen ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.ChevronDown, { className: "size-3.5 text-zinc-400" }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react10.ChevronRight, { className: "size-3.5 text-zinc-400" })
              ] })
            ]
          }
        ),
        toolCall.isError && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-red-200/60 bg-red-50 px-3 py-2 text-[11px] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400", children: (typeof parsedResult === "object" && parsedResult && parsedResult.message ? String(parsedResult.message) : toolCall.result) || "The tool call failed." }),
        isSubagent && isExecuting && toolCall.subagentActivity?.length ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaSubagentLivePreview, { activity: toolCall.subagentActivity }) : null,
        isOpen && todos ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaTodoChecklist, { todos }) }) : isOpen && isLs ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaLsDirectoryCard, { path: grepArgs && grepArgs.path ? String(grepArgs.path) : "/", entries: lsEntries, status }) }) : isOpen && isRead ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaReadFileCard, { filePath: readFilePath, content: typeof parsedResult === "string" ? parsedResult : toolCall.result || "", status }) }) : isOpen && isDiff ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: isFileEditTool(toolCall.toolName) ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          PersonaFileDiffCard,
          {
            filePath: getFilePathFromArgs(parsedArgs),
            oldContent: String(grepArgs.old_string ?? ""),
            newContent: String(grepArgs.new_string ?? ""),
            note: grepArgs.replace_all ? "Replacing all occurrences" : void 0
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          PersonaFileDiffCard,
          {
            filePath: getFilePathFromArgs(parsedArgs),
            oldContent: "",
            newContent: String(grepArgs.content ?? "")
          }
        ) }) : isOpen && isGrep ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaGrepResultsCard, { query: grepQuery, path: grepPath, matches: grepMatches, status }) }) : isOpen && isSearch ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "border-t border-zinc-200/60 p-3 dark:border-zinc-800/60", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PersonaSearchResultsCard, { results, status }) }) : isOpen ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "border-t border-zinc-200/60 p-3 space-y-2 font-mono text-[11px] dark:border-zinc-800/60", children: [
          toolCall.args && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "text-zinc-500 block mb-1", children: "Arguments:" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("pre", { className: "overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedArgs === "object" ? JSON.stringify(parsedArgs, null, 2) : toolCall.args })
          ] }),
          toolCall.result && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "text-zinc-500 block mb-1", children: "Result:" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("pre", { className: "overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200", children: typeof parsedResult === "object" ? JSON.stringify(parsedResult, null, 2) : toolCall.result })
          ] })
        ] }) : null,
        isSubagent && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          PersonaSubagentActivityDialog,
          {
            toolCall,
            open: dialogOpen,
            onOpenChange: setDialogOpen,
            toolRenderers,
            onOpenFile,
            isLive
          }
        )
      ]
    }
  );
}

// src/components/PersonaToolGroup.tsx
var import_react11 = require("react");

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
var import_lucide_react11 = require("lucide-react");
var import_jsx_runtime12 = require("react/jsx-runtime");
var DEFAULT_CLUSTER_LABELS = {
  memory: { title: "Personalizing memory", icon: import_lucide_react11.Brain },
  file: { title: "Working with files", icon: import_lucide_react11.FileText },
  search: { title: "Searching the web", icon: import_lucide_react11.Globe },
  task: { title: "Running subagents", icon: import_lucide_react11.Bot },
  plan: { title: "Updating the plan", icon: import_lucide_react11.ListTodo },
  mixed: { title: "Performing actions", icon: import_lucide_react11.Wrench }
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
  isLive = false,
  className
}) {
  const hasError = tools.some((t) => t.isError);
  const anyRunning = isLive && tools.some((t) => !t.result && !t.isError);
  const { title, icon: ClusterIcon = import_lucide_react11.Wrench } = clusterMeta(tools, clusterLabels);
  const [isOpen, setIsOpen] = (0, import_react11.useState)(anyRunning);
  const wasRunningRef = (0, import_react11.useRef)(anyRunning);
  (0, import_react11.useEffect)(() => {
    if (anyRunning && !wasRunningRef.current) setIsOpen(true);
    wasRunningRef.current = anyRunning;
  }, [anyRunning]);
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: cn("my-2 min-w-0", className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen((prev) => !prev),
        className: "flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
            anyRunning ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_lucide_react11.Loader2, { className: "size-4 shrink-0 animate-spin text-blue-500" }) : hasError ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_lucide_react11.AlertCircle, { className: "size-4 shrink-0 text-red-500" }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_lucide_react11.CheckCircle2, { className: "size-4 shrink-0 text-emerald-500" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ClusterIcon, { className: "size-4 shrink-0 text-zinc-400 dark:text-zinc-500" }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "truncate", children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "shrink-0 text-[10px] font-normal text-zinc-400 dark:text-zinc-500", children: [
              tools.length,
              " step",
              tools.length > 1 ? "s" : ""
            ] })
          ] }),
          isOpen ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_lucide_react11.ChevronUp, { className: "size-3.5 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_lucide_react11.ChevronDown, { className: "size-3.5 shrink-0" })
        ]
      }
    ),
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "mt-2 space-y-2 pl-4", children: tools.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
      PersonaToolTrace,
      {
        toolCall: tool,
        toolRenderers,
        onOpenFile,
        isLive
      },
      tool.toolCallId
    )) })
  ] });
}

// src/components/PersonaMessageFeed.tsx
var import_lucide_react12 = require("lucide-react");
var import_jsx_runtime13 = require("react/jsx-runtime");
function ReasoningBlock({ reasoning, isReasoning }) {
  const [isOpen, setIsOpen] = (0, import_react12.useState)(Boolean(isReasoning));
  (0, import_react12.useEffect)(() => {
    if (isReasoning) setIsOpen(true);
  }, [isReasoning]);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "mb-2 overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/60 text-xs dark:border-zinc-800/70 dark:bg-zinc-950/40", children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen((prev) => !prev),
        className: "flex w-full items-center justify-between px-3 py-1.5 text-left text-zinc-500 transition-colors hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:bg-zinc-900/40",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: "flex items-center gap-1.5", children: [
            isReasoning ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.Loader2, { className: "size-3 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.BrainCircuit, { className: "size-3" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "font-medium", children: isReasoning ? "Thinking\u2026" : "Thought process" })
          ] }),
          isOpen ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.ChevronDown, { className: "size-3" }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.ChevronRight, { className: "size-3" })
        ]
      }
    ),
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "whitespace-pre-wrap break-words border-t border-zinc-200/60 p-2.5 text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400", children: reasoning })
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
  const [copiedId, setCopiedId] = (0, import_react12.useState)(null);
  const scrollEndRef = (0, import_react12.useRef)(null);
  (0, import_react12.useEffect)(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);
  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2e3);
  }
  if (messages.length === 0 && isLoading) {
    return (
      // Same p-4 md:p-6 outer padding and mx-auto max-w-3xl centered column
      // as the real message list below — without matching it, the skeleton
      // stretched full-width on any panel wider than 768px while real
      // messages sit in a centered, margined column, so loading -> loaded
      // visibly jumped.
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: cn("flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6", className), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "mx-auto flex w-full max-w-3xl flex-col gap-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(PersonaMessageSkeletonRow, { align: "left" }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(PersonaMessageSkeletonRow, { align: "right" }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(PersonaMessageSkeletonRow, { align: "left" })
      ] }) })
    );
  }
  if (messages.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: cn("flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 shadow-2xs dark:bg-zinc-800 dark:text-zinc-100", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.Sparkles, { className: "size-6" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("h2", { className: "text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-2xl", children: greeting })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: cn("min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6", className), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "mx-auto max-w-3xl space-y-6", children: [
    messages.map((msg) => {
      const isUser = msg.role === "user";
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
        "div",
        {
          className: cn(
            "flex gap-3 text-sm leading-relaxed",
            isUser ? "justify-end" : "justify-start"
          ),
          children: [
            !isUser && showAssistantAvatar && (assistantAvatar ?? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mt-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-[var(--persona-assistant-avatar-bg,#f4f4f5)] text-[var(--persona-assistant-avatar-text,#27272a)] shadow-2xs dark:bg-[var(--persona-assistant-avatar-bg,#27272a)] dark:text-[var(--persona-assistant-avatar-text,#e4e4e7)]", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.Bot, { className: "size-4" }) })),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
              "div",
              {
                className: cn(
                  "group relative min-w-0 text-xs md:text-sm",
                  isUser ? "max-w-[85%] rounded-2xl rounded-tr-xs bg-[var(--persona-user-bg,#18181b)] px-4 py-3 font-medium text-[var(--persona-user-text,#ffffff)] dark:bg-[var(--persona-user-bg,#f4f4f5)] dark:text-[var(--persona-user-text,#18181b)]" : "flex-1 py-1 text-[var(--persona-assistant-text,#18181b)] dark:text-[var(--persona-assistant-text,#f4f4f5)]"
                ),
                children: [
                  !isUser && msg.reasoning && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ReasoningBlock, { reasoning: msg.reasoning, isReasoning: msg.isReasoning }),
                  msg.toolCalls && msg.toolCalls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mb-2 space-y-1", children: groupTools ? groupToolCalls(msg.toolCalls).map(
                    (item) => item.type === "group" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                      PersonaToolGroup,
                      {
                        tools: item.tools,
                        toolRenderers,
                        onOpenFile,
                        clusterLabels: toolClusterLabels,
                        isLive: Boolean(msg.isStreaming)
                      },
                      item.tools[0].toolCallId
                    ) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                      PersonaToolTrace,
                      {
                        toolCall: item.tools[0],
                        toolRenderers,
                        onOpenFile,
                        isLive: Boolean(msg.isStreaming)
                      },
                      item.tools[0].toolCallId
                    )
                  ) : msg.toolCalls.map((tc) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                    PersonaToolTrace,
                    {
                      toolCall: tc,
                      toolRenderers,
                      onOpenFile,
                      isLive: Boolean(msg.isStreaming)
                    },
                    tc.toolCallId
                  )) }),
                  isUser ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "whitespace-pre-wrap break-words", children: msg.content }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(PersonaMarkdown, { content: msg.content }),
                  msg.isStreaming && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "inline-block size-2 ml-1 rounded-full bg-blue-500 animate-pulse" }),
                  !isUser && !msg.isStreaming && msg.content && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [
                    onReload && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                      "button",
                      {
                        type: "button",
                        onClick: onReload,
                        title: "Regenerate response",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.RotateCcw, { className: "size-3" })
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleCopy(msg.content, msg.id),
                        title: "Copy message",
                        className: "rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                        children: copiedId === msg.id ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.Check, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.Copy, { className: "size-3" })
                      }
                    )
                  ] })
                ]
              }
            ),
            isUser && showUserAvatar && (userAvatar ?? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mt-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-[var(--persona-user-avatar-bg,#e4e4e7)] text-[var(--persona-user-avatar-text,#3f3f46)] shadow-2xs dark:bg-[var(--persona-user-avatar-bg,#27272a)] dark:text-[var(--persona-user-avatar-text,#d4d4d8)]", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_lucide_react12.User, { className: "size-4" }) }))
          ]
        },
        msg.id
      );
    }),
    error && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400", children: error.message || "Failed to communicate with agent." }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { ref: scrollEndRef })
  ] }) });
}

// src/components/PersonaComposer.tsx
var import_react13 = require("react");
var import_lucide_react13 = require("lucide-react");
var import_jsx_runtime14 = require("react/jsx-runtime");
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
  showPoweredBy = true,
  className
}) {
  const textareaRef = (0, import_react13.useRef)(null);
  const fileInputRef = (0, import_react13.useRef)(null);
  (0, import_react13.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: cn("relative w-full max-w-3xl mx-auto", className), children: [
    starterPrompts.length > 0 && !input && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "mb-2 flex flex-wrap items-center gap-1.5 px-1", children: starterPrompts.map((item) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
      "button",
      {
        type: "button",
        onClick: () => onSelectStarter?.(item.prompt),
        className: "flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-2xs backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
        children: [
          item.icon && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: item.icon }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: item.title })
        ]
      },
      item.title
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "relative flex flex-col rounded-2xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#ffffff)] p-2.5 shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-400/20 dark:border-[var(--persona-border,#3f3f46)] dark:bg-[var(--persona-card,#18181b)]", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        "textarea",
        {
          ref: textareaRef,
          value: input,
          onChange: (e) => onInputChange(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder,
          rows: 1,
          disabled,
          className: "w-full resize-none bg-transparent px-2.5 pt-1.5 pb-2 text-sm leading-relaxed text-[var(--persona-text,#111827)] placeholder:text-zinc-400 focus:outline-none dark:text-[var(--persona-text,#f4f4f5)] dark:placeholder:text-zinc-500"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "flex items-center justify-between pt-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
            "input",
            {
              ref: fileInputRef,
              type: "file",
              onChange: onUploadFile,
              className: "hidden"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
            "button",
            {
              type: "button",
              onClick: () => fileInputRef.current?.click(),
              title: "Attach document or receipt",
              className: "rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_lucide_react13.Paperclip, { className: "size-4" })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { children: isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          "button",
          {
            type: "button",
            onClick: onStop,
            className: "flex size-8 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 active:scale-95",
            children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_lucide_react13.Square, { className: "size-3.5 fill-white" })
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          "button",
          {
            type: "button",
            onClick: onSubmit,
            disabled: !input.trim() || disabled,
            className: "flex size-8 items-center justify-center rounded-xl bg-[var(--persona-primary,#27272a)] text-white shadow-sm transition-all hover:brightness-90 disabled:pointer-events-none disabled:opacity-25 active:scale-95 dark:bg-[var(--persona-primary,#e4e4e7)] dark:text-zinc-900 dark:hover:brightness-110",
            children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_lucide_react13.ArrowUp, { className: "size-4 stroke-[2.5]" })
          }
        ) })
      ] })
    ] }),
    showPoweredBy && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "mt-1.5 flex justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "a",
      {
        href: "https://persona.hasanraiyan.me",
        target: "_blank",
        rel: "noreferrer",
        className: "text-[10px] font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400",
        children: "Powered by persona.hasanraiyan.me"
      }
    ) })
  ] });
}

// src/components/PersonaFilesDrawer.tsx
var import_react14 = require("react");
var import_lucide_react14 = require("lucide-react");
var import_jsx_runtime15 = require("react/jsx-runtime");
var TODO_ICON = {
  pending: import_lucide_react14.CircleDashed,
  in_progress: import_lucide_react14.CircleDotDashed,
  completed: import_lucide_react14.CircleCheck
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
  isFilesLoading,
  isMemoryLoading,
  className
}) {
  const [tab, setTab] = (0, import_react14.useState)("files");
  const [selectedWorkspacePath, setSelectedWorkspacePath] = (0, import_react14.useState)(null);
  const [selectedMemory, setSelectedMemory] = (0, import_react14.useState)(null);
  const [loadingMemory, setLoadingMemory] = (0, import_react14.useState)(false);
  const [copied, setCopied] = (0, import_react14.useState)(false);
  const workspaceEntries = Object.entries(workspaceFiles);
  (0, import_react14.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "div",
      {
        className: "absolute inset-0 z-20 bg-black/30 @5xl/persona-chat:hidden",
        onClick: onClose,
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      "aside",
      {
        className: cn(
          // absolute + @min-[40rem] (not fixed + sm:): scoped to
          // PersonaChatView's own (relative, @container) root, same reason.
          "absolute inset-y-0 right-0 z-30 flex w-full max-w-xs flex-col border-l border-[var(--persona-border,#e4e4e7)]/80 bg-[var(--persona-bg,#ffffff)] shadow-2xl dark:border-[var(--persona-border,#27272a)]/80 dark:bg-[var(--persona-bg,#09090b)] @min-[40rem]/persona-chat:max-w-sm",
          "@5xl/persona-chat:static @5xl/persona-chat:z-auto @5xl/persona-chat:w-80 @5xl/persona-chat:max-w-none @5xl/persona-chat:shrink-0 @5xl/persona-chat:bg-[var(--persona-card,#fafafa)]/50 @5xl/persona-chat:shadow-none @5xl/persona-chat:backdrop-blur-md dark:@5xl/persona-chat:bg-[var(--persona-card,#09090b)]/50",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex items-center justify-between gap-2 border-b border-[var(--persona-border,#e4e4e7)]/80 p-3 dark:border-[var(--persona-border,#27272a)]/80", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex min-w-0 rounded-xl bg-[var(--persona-border,#e4e4e7)]/60 p-0.5 dark:bg-[var(--persona-border,#27272a)]/60", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("files"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "files" ? "bg-[var(--persona-card,#ffffff)] text-[var(--persona-text,#18181b)] shadow-xs dark:bg-[var(--persona-card,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Files, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "hidden sm:inline", children: "Files" }),
                    files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      files.length,
                      ")"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("workspace"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "workspace" ? "bg-[var(--persona-card,#ffffff)] text-[var(--persona-text,#18181b)] shadow-xs dark:bg-[var(--persona-card,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.FolderKanban, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "hidden sm:inline", children: "Workspace" }),
                    workspaceEntries.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      workspaceEntries.length,
                      ")"
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => setTab("memory"),
                  className: cn(
                    "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                    tab === "memory" ? "bg-[var(--persona-card,#ffffff)] text-[var(--persona-text,#18181b)] shadow-xs dark:bg-[var(--persona-card,#18181b)] dark:text-[var(--persona-text,#f4f4f5)]" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  ),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Brain, { className: "size-3.5 shrink-0" }),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "hidden sm:inline", children: "Memory" }),
                    memory?.userFiles?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "text-[10px] opacity-70", children: [
                      "(",
                      memory.userFiles.length,
                      ")"
                    ] })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              "button",
              {
                type: "button",
                onClick: onClose,
                className: "shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.X, { className: "size-4" })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "min-h-0 flex-1 overflow-y-auto p-3", children: tab === "files" ? (
            /* Uploaded files list */
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "space-y-2", children: isFilesLoading && files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PersonaFileSkeletonRow, {}),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PersonaFileSkeletonRow, {}),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PersonaFileSkeletonRow, {})
            ] }) : files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No uploaded files yet." }) : files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              "div",
              {
                className: "flex items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 shadow-2xs dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.FileText, { className: "size-4 shrink-0 text-blue-500" }),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "min-w-0 truncate", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200", children: file.originalName }),
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "text-[10px] text-zinc-400", children: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "" })
                    ] })
                  ] }),
                  onDeleteFile && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => onDeleteFile(file.id),
                      className: "shrink-0 rounded p-1 text-zinc-400 hover:text-red-500",
                      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Trash2, { className: "size-3.5" })
                    }
                  )
                ]
              },
              file.id
            )) })
          ) : tab === "workspace" ? (
            /* Agent's own virtual workspace — plan (todos) + files it wrote */
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "space-y-4", children: selectedWorkspaceFile ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80", children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedWorkspacePath }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex shrink-0 items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleCopy(selectedWorkspaceFile.content),
                      className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                      children: copied ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Check, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Copy, { className: "size-3" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedWorkspaceFile.content })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
              todos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Plan" }),
                todos.map((todo, i) => {
                  const Icon = TODO_ICON[todo.status] ?? import_lucide_react14.CircleDashed;
                  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                    "div",
                    {
                      className: "flex items-start gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2 text-xs dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                          Icon,
                          {
                            className: cn(
                              "mt-0.5 size-3.5 shrink-0",
                              todo.status === "completed" ? "text-emerald-500" : todo.status === "in_progress" ? "text-blue-500" : "text-zinc-400"
                            )
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
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
              workspaceEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No workspace files yet \u2014 files the agent creates show up here." }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "space-y-1.5", children: [
                todos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: "Files" }),
                workspaceEntries.map(([path, file]) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedWorkspacePath(path),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60 dark:hover:bg-zinc-900",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.FileText, { className: "size-3.5 shrink-0 text-amber-500" }),
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: path })
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "shrink-0 text-[10px] text-zinc-400", children: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "" })
                    ]
                  },
                  path
                ))
              ] })
            ] }) })
          ) : (
            /* Memory inspector */
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "space-y-3", children: selectedMemory ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 dark:border-zinc-800/80", children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200", children: selectedMemory.path }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex shrink-0 items-center gap-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleCopy(selectedMemory.content),
                      className: "p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                      children: copied ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Check, { className: "size-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Copy, { className: "size-3" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: "mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200", children: selectedMemory.content })
            ] }) : isMemoryLoading && (memory?.userFiles?.length ?? 0) === 0 && (memory?.agentMemories?.length ?? 0) === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "space-y-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PersonaFileSkeletonRow, {}),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PersonaFileSkeletonRow, {}),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PersonaFileSkeletonRow, {})
            ] }) : (memory?.userFiles?.length ?? 0) === 0 && (memory?.agentMemories?.length ?? 0) === 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "py-8 text-center text-xs text-zinc-400", children: "No persistent memory files recorded." }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "space-y-4", children: [
              (memory?.userFiles?.length ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "space-y-1.5", children: memory.userFiles.map((f) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "button",
                {
                  type: "button",
                  onClick: () => viewMemoryFile(f.path),
                  className: "flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60 dark:hover:bg-zinc-900",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Brain, { className: "size-3.5 shrink-0 text-purple-500" }),
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                    ] }),
                    loadingMemory && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Loader2, { className: "size-3 shrink-0 animate-spin text-zinc-400" })
                  ]
                },
                f.path
              )) }),
              memory?.agentMemories?.map((group) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500", children: group.agentName || "Unknown Agent" }),
                group.files.map((f) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                  "button",
                  {
                    type: "button",
                    onClick: () => viewMemoryFile(f.path),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)]/70 bg-[var(--persona-card,#ffffff)] p-2.5 text-left text-xs transition-all hover:bg-zinc-100/70 dark:border-[var(--persona-border,#27272a)]/70 dark:bg-[var(--persona-card,#18181b)]/60 dark:hover:bg-zinc-900",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "flex min-w-0 items-center gap-2", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Brain, { className: "size-3.5 shrink-0 text-purple-500" }),
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "truncate text-zinc-800 dark:text-zinc-200", children: f.path })
                      ] }),
                      loadingMemory && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react14.Loader2, { className: "size-3 shrink-0 animate-spin text-zinc-400" })
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
var import_react15 = require("react");
var import_lucide_react15 = require("lucide-react");
var import_jsx_runtime16 = require("react/jsx-runtime");
function PersonaInterruptCard({
  interrupt,
  onRespond,
  isStreaming,
  className
}) {
  const [answers, setAnswers] = (0, import_react15.useState)({});
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
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
      "div",
      {
        className: cn(
          "mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300", children: [
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react15.ShieldAlert, { className: "size-4" }),
            "Approval needed"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: "mb-3 space-y-1 font-mono text-xs text-amber-900/80 dark:text-amber-200/80", children: interrupt.actionRequests.map((action, i) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("li", { children: [
            "\u2022 ",
            action.name
          ] }, i)) }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
              "button",
              {
                type: "button",
                disabled: isStreaming,
                onClick: approveAll,
                className: "flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react15.Check, { className: "size-3.5" }),
                  " Approve"
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
              "button",
              {
                type: "button",
                disabled: isStreaming,
                onClick: rejectAll,
                className: "flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react15.X, { className: "size-3.5" }),
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
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
    "div",
    {
      className: cn(
        "mx-auto w-full max-w-3xl rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "mb-3 flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300", children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react15.HelpCircle, { className: "size-4" }),
          "A few questions before I continue"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "space-y-3", children: interrupt.questions.map((q, i) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "mb-1.5 text-xs font-medium text-blue-900 dark:text-blue-200", children: q.text }),
          q.options.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "mb-1.5 flex flex-wrap gap-1.5", children: q.options.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
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
          q.allowCustom && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
            "input",
            {
              value: q.options.includes(answers[i] ?? "") ? "" : answers[i] || "",
              onChange: (e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value })),
              placeholder: "Or type your own answer...",
              className: "w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-blue-400 dark:border-blue-900/60 dark:bg-zinc-900 dark:text-zinc-100"
            }
          )
        ] }, q.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
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

// src/components/PersonaMcpConnectBanner.tsx
var import_lucide_react16 = require("lucide-react");
var import_jsx_runtime17 = require("react/jsx-runtime");
function PersonaMcpConnectBanner({ connections, className }) {
  if (connections.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: cn("flex flex-col gap-1.5", className), children: connections.map((connection) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
    "a",
    {
      href: connection.authorizeUrl ?? void 0,
      className: cn(
        "flex items-center gap-2 rounded-xl border border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-card,#fafafa)] px-3 py-2 text-xs transition-colors hover:bg-[var(--persona-border,#e4e4e7)]/40 dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-card,#18181b)] dark:hover:bg-[var(--persona-border,#27272a)]/40",
        !connection.authorizeUrl && "pointer-events-none opacity-50"
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_lucide_react16.Link2, { className: "size-3.5 shrink-0 text-[var(--persona-primary,#3b82f6)]" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { className: "min-w-0 flex-1 truncate text-[var(--persona-text,#27272a)] dark:text-[var(--persona-text,#e4e4e7)]", children: [
          "Connect ",
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "font-semibold", children: connection.name }),
          " to unlock more of what I can do"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: "shrink-0 rounded-lg bg-[var(--persona-primary,#18181b)] px-2.5 py-1 font-semibold text-white dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900", children: "Connect" })
      ]
    },
    connection.mcpId
  )) });
}

// src/components/PersonaChatView.tsx
var import_lucide_react17 = require("lucide-react");
var import_jsx_runtime18 = require("react/jsx-runtime");
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
  showMcpConnectBanner = true,
  showPoweredBy = true,
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
    threadsLoading,
    files,
    deleteFile,
    filesLoading,
    memory,
    getMemoryFile,
    deleteMemoryFile,
    memoryLoading,
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
    unconnectedMcps,
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
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
    "div",
    {
      style: themeStyles,
      className: cn(
        // @container/persona-chat: PersonaSidebar and PersonaFilesDrawer dock
        // vs. overlay based on THIS width, not the browser viewport — so
        // they correctly stay in overlay mode inside a narrow host (e.g.
        // PersonaChatLauncher's small floating panel) even on a wide desktop
        // viewport, the same way they already do on an actual narrow phone.
        // relative: the containing block PersonaSidebar/PersonaFilesDrawer's
        // overlay mode positions against (see their own comments) — without
        // it their `absolute inset-y-0` escapes to the nearest positioned
        // ANCESTOR instead, which used to be nothing at all (fixed to the
        // browser viewport) inside PersonaChatLauncher's small floating panel.
        "@container/persona-chat relative flex w-full overflow-hidden bg-[var(--persona-bg,#ffffff)] font-sans text-[var(--persona-text,#18181b)] dark:bg-[var(--persona-bg,#09090b)] dark:text-[var(--persona-text,#f4f4f5)]",
        // Host page is responsible for the height; component just fills it
        "h-full min-h-0",
        classNames.root,
        className
      ),
      children: [
        sidebarOpen && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          PersonaSidebar,
          {
            threads,
            activeThreadId,
            onSelectThread: handleSelectThread,
            onCreateThread: handleNewChat,
            onDeleteThread: deleteThread,
            onRenameThread: renameThread,
            onClose: () => setSidebarOpen(false),
            isLoading: threadsLoading,
            className: classNames.sidebar
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: cn("flex min-h-0 flex-1 flex-col", classNames.main), children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "flex h-11 shrink-0 items-center justify-between border-b border-[var(--persona-border,#e4e4e7)] bg-[var(--persona-bg,#ffffff)] px-3 dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-bg,#09090b)]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "flex items-center gap-1.5", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                "button",
                {
                  type: "button",
                  onClick: () => setSidebarOpen((p) => !p),
                  className: "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
                  children: sidebarOpen ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_lucide_react17.PanelLeftClose, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_lucide_react17.PanelLeft, { className: "size-4" })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "text-sm font-semibold text-[var(--persona-text,#27272a)] dark:text-[var(--persona-text,#e4e4e7)]", children: title })
            ] }),
            showFilesDrawer && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
              "button",
              {
                type: "button",
                onClick: () => setFilesDrawerOpen((p) => !p),
                className: cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  filesDrawerOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                ),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_lucide_react17.Files, { className: "size-3.5" }),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { children: "Artifacts" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "flex min-h-0 flex-1 flex-col", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
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
          interrupt && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "shrink-0 border-t border-[var(--persona-border,#f4f4f5)] bg-[var(--persona-bg,#ffffff)] px-3 pt-3 dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-bg,#09090b)]", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
            PersonaInterruptCard,
            {
              interrupt,
              isStreaming,
              onRespond: (resume, displayContent) => void resumeInterrupt(resume, displayContent)
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: cn(
            "shrink-0 border-t border-[var(--persona-border,#f4f4f5)] bg-[var(--persona-bg,#ffffff)] px-3 pb-4 pt-3 dark:border-[var(--persona-border,#27272a)] dark:bg-[var(--persona-bg,#09090b)]",
            classNames.composer
          ), children: [
            showMcpConnectBanner && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(PersonaMcpConnectBanner, { connections: unconnectedMcps, className: "mb-3" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
              PersonaComposer,
              {
                input,
                onInputChange: setInput,
                onSubmit: () => void handleSend(),
                onStop: stop,
                isStreaming,
                starterPrompts: messages.length === 0 ? starterPrompts : [],
                onSelectStarter: (p) => void handleSend(p),
                onUploadFile: handleUploadFile,
                showPoweredBy
              }
            )
          ] })
        ] }),
        showFilesDrawer && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
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
            isFilesLoading: filesLoading,
            isMemoryLoading: memoryLoading,
            className: classNames.filesDrawer
          }
        )
      ]
    }
  );
}

// src/components/PersonaChatLauncher.tsx
var import_react16 = require("react");
var import_lucide_react18 = require("lucide-react");
var import_jsx_runtime19 = require("react/jsx-runtime");
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
  const [internalOpen, setInternalOpen] = (0, import_react16.useState)(defaultOpen);
  const isOpen = controlledOpen !== void 0 ? controlledOpen : internalOpen;
  const setOpen = (next) => {
    onOpenChange?.(next);
    if (controlledOpen === void 0) setInternalOpen(next);
  };
  const isRight = position !== "bottom-left";
  const themeStyles = buildThemeStyles(theme);
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: themeStyles, className: "contents", children: [
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "div",
      {
        className: cn(
          // z-[9999]: a floating widget mounted into an arbitrary host page
          // has to reliably beat that page's OWN header/nav z-index (which
          // this can't know ahead of time) — the old bespoke chat widgets
          // this SDK replaces used the same value for the same reason.
          "fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[var(--persona-bg,#ffffff)] shadow-2xl animate-[persona-drawer-up_0.25s_ease-out] dark:bg-[var(--persona-bg,#09090b)]",
          // Below sm (640px): a true full-screen takeover, not a small
          // floating card leaving gaps a host page's own fixed/sticky
          // header can render through — see PersonaChatView's own
          // @container comment for the matching reasoning on its sidebar.
          // Width/height only take effect at sm+ (arbitrary-value classes
          // bound to the CSS vars set below) — full-screen below sm
          // ignores them entirely via inset-0 above, same reasoning.
          "sm:inset-auto sm:bottom-24 sm:h-[var(--persona-panel-h)] sm:w-[var(--persona-panel-w)] sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-2rem)] sm:animate-none sm:rounded-2xl sm:border sm:border-[var(--persona-border,#e4e4e7)] sm:dark:border-[var(--persona-border,#27272a)]",
          isRight ? "sm:right-6" : "sm:left-6",
          panelClassName
        ),
        style: { "--persona-panel-w": panelWidth, "--persona-panel-h": panelHeight },
        children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(PersonaChatView, { ...chatViewProps, theme, className: "h-full w-full" })
      }
    ),
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "button",
      {
        type: "button",
        onClick: () => setOpen(false),
        "aria-label": "Close chat",
        className: "fixed right-4 top-14 z-[10000] flex size-9 items-center justify-center rounded-full bg-[var(--persona-primary,#18181b)] text-white shadow-lg sm:hidden dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900",
        children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_lucide_react18.X, { className: "size-5" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "button",
      {
        type: "button",
        onClick: () => setOpen(!isOpen),
        "aria-label": isOpen ? "Close chat" : "Open chat",
        className: cn(
          "fixed bottom-6 z-[9999] items-center justify-center rounded-full bg-[var(--persona-primary,#18181b)] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 dark:bg-[var(--persona-primary,#f4f4f5)] dark:text-zinc-900",
          // Open on mobile: the full-screen panel already covers this and
          // the dedicated close button above handles closing, so showing
          // this too would just float on top of the panel's own content.
          // Every other state (closed on mobile, either state on sm+,
          // where the panel never covers the FAB) shows it as normal.
          isOpen ? "hidden sm:flex" : "flex",
          isRight ? "right-6" : "left-6",
          fabClassName
        ),
        children: isOpen ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_lucide_react18.X, { className: "size-6" }) : fabIcon ?? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_lucide_react18.MessageCircle, { className: "size-6" })
      }
    )
  ] });
}

// src/index.ts
var VERSION = "0.9.1";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersonaChatLauncher,
  PersonaChatView,
  PersonaComposer,
  PersonaDialog,
  PersonaFileDiffCard,
  PersonaFileSkeletonRow,
  PersonaFilesDrawer,
  PersonaGrepResultsCard,
  PersonaInterruptCard,
  PersonaLsDirectoryCard,
  PersonaMarkdown,
  PersonaMcpConnectBanner,
  PersonaMessageFeed,
  PersonaMessageSkeletonRow,
  PersonaReadFileCard,
  PersonaSearchResultsCard,
  PersonaSidebar,
  PersonaSkeleton,
  PersonaSubagentActivityDialog,
  PersonaThreadSkeletonRow,
  PersonaToolGroup,
  PersonaToolTrace,
  VERSION,
  buildSubagentTimeline,
  buildThemeStyles,
  classifySubagentStatus,
  cn,
  computeFileDiffStats,
  computeLineDiff,
  getDomain,
  getFilePathFromArgs,
  getToolIcon,
  getToolTitle,
  groupToolCalls,
  isFileEditTool,
  isFileWriteTool,
  isGrepTool,
  isKbListSourcesTool,
  isKbSearchTool,
  isLsTool,
  isReadFileTool,
  isSubagentTool,
  isWebSearchTool,
  parseGrepResults,
  parseLsResults,
  queryFromArgs,
  searchResults,
  toolGroupKey,
  usePersonaChatWidget
});
//# sourceMappingURL=index.cjs.map